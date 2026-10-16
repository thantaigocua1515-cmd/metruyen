-- ============================================================================
-- MÊ TRUYỆN — Supabase Postgres schema
-- ----------------------------------------------------------------------------
-- Cách dùng: Supabase Dashboard → SQL Editor → New query → dán toàn bộ file
-- này → Run. Chạy 1 lần duy nhất (script viết theo kiểu idempotent, chạy lại
-- cũng an toàn).
--
-- Sau đó BẮT BUỘC: Authentication → Sign In / Sign Up → tắt "Confirm email"
-- (vì web đăng ký bằng username, dùng email tổng hợp username@metruyen.local).
-- ============================================================================

-- 0. Extension ---------------------------------------------------------------
create extension if not exists "pgcrypto";

-- 1. Bảng profiles: hồ sơ người dùng -----------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  role            text not null default 'user' check (role in ('user','admin')),
  avatar_url      text,
  reading_seconds bigint not null default 0,
  spirit_stones   integer not null default 0,
  created_at      timestamptz not null default now()
);

-- 2. reading_sessions: phiên đọc (mỗi 60 giây ghi 1 dòng) ---------------------
create table if not exists public.reading_sessions (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  seconds    integer not null default 0,
  started_at timestamptz not null default now()
);
create index if not exists idx_reading_sessions_user on public.reading_sessions(user_id);

-- 3. reading_progress: tiến độ đọc từng truyện --------------------------------
create table if not exists public.reading_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  source_id  text not null,
  novel_id   text not null,
  chapter    integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, source_id, novel_id)
);

-- 4. bookshelf: tủ truyện ----------------------------------------------------
create table if not exists public.bookshelf (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  source_id    text not null,
  novel_id     text not null,
  novel_title  text,
  novel_cover  text,
  last_chapter integer not null default 1,
  updated_at   timestamptz not null default now(),
  primary key (user_id, source_id, novel_id)
);

-- 5. api_sources: các nguồn API truyện ----------------------------------------
create table if not exists public.api_sources (
  id         text primary key,
  name       text not null,
  openapi_url text not null,
  base_url   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. thumbnail_overrides: thumbnail do admin đặt ------------------------------
create table if not exists public.thumbnail_overrides (
  source_id     text not null,
  novel_id      text not null,
  thumbnail_url text not null,
  updated_at    timestamptz not null default now(),
  primary key (source_id, novel_id)
);

-- 7. cosmetic_items: khung avatar / pháp bảo -----------------------------------
create table if not exists public.cosmetic_items (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('frame','treasure')),
  name       text not null,
  image_url  text not null,
  price      integer not null default 0,
  scale      double precision not null default 1,
  offset_x   double precision not null default 0,
  offset_y   double precision not null default 0,
  created_at timestamptz not null default now()
);

-- 8. inventory_items: túi trữ vật ----------------------------------------------
create table if not exists public.inventory_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    uuid not null references public.cosmetic_items(id) on delete cascade,
  equipped   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);
create index if not exists idx_inventory_user on public.inventory_items(user_id);

-- 9. character_defaults: thông số mặc định cho nhân vật mới ---------------------
create table if not exists public.character_defaults (
  id            integer primary key default 1 check (id = 1),
  spirit_stones integer not null default 100,
  reading_hours double precision not null default 0,
  frame_id      uuid references public.cosmetic_items(id) on delete set null,
  treasure_id   uuid references public.cosmetic_items(id) on delete set null
);

-- 10. Seed dữ liệu --------------------------------------------------------------
insert into public.api_sources (id, name, openapi_url, base_url, is_active)
values ('truyenok', 'TruyenOK', 'https://truyenok.online/api/v1/openapi.json', 'https://truyenok.online', true)
on conflict (id) do update set
  name = excluded.name,
  openapi_url = excluded.openapi_url,
  base_url = excluded.base_url;

insert into public.character_defaults (id, spirit_stones, reading_hours)
values (1, 100, 0)
on conflict (id) do nothing;

-- 11. Hàm is_admin(): kiểm tra quyền admin của user hiện tại --------------------
-- SECURITY DEFINER để đọc profiles mà không bị RLS chặn (tránh đệ quy).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 12. Trigger: tài khoản đầu tiên (chưa có admin) tự thành admin -----------------
create or replace function public.set_first_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    new.role := 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_first_admin on public.profiles;
create trigger trg_set_first_admin
  before insert on public.profiles
  for each row execute function public.set_first_admin();

-- 13. Trigger: tặng quà tân thủ theo character_defaults --------------------------
create or replace function public.grant_newbie_gifts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  select * into d from public.character_defaults where id = 1;
  if found then
    update public.profiles
       set spirit_stones   = spirit_stones + coalesce(d.spirit_stones, 0),
           reading_seconds = reading_seconds + floor(coalesce(d.reading_hours, 0) * 3600)::bigint
     where id = new.id;

    if d.frame_id is not null then
      insert into public.inventory_items (user_id, item_id, equipped)
      values (new.id, d.frame_id, true)
      on conflict (user_id, item_id) do nothing;
    end if;

    if d.treasure_id is not null then
      insert into public.inventory_items (user_id, item_id, equipped)
      values (new.id, d.treasure_id, true)
      on conflict (user_id, item_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grant_newbie_gifts on public.profiles;
create trigger trg_grant_newbie_gifts
  after insert on public.profiles
  for each row execute function public.grant_newbie_gifts();

-- 14. Trigger: chặn user tự nâng role ---------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Chỉ admin mới được đổi role.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- 15. Bật RLS + policies -----------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.reading_sessions    enable row level security;
alter table public.reading_progress    enable row level security;
alter table public.bookshelf           enable row level security;
alter table public.api_sources         enable row level security;
alter table public.thumbnail_overrides enable row level security;
alter table public.cosmetic_items      enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.character_defaults  enable row level security;

-- profiles: ai cũng đọc được (bảng xếp hạng), tự tạo/sửa dòng của mình, admin full
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- reading_sessions: user ghi/xem của mình, admin xem hết
drop policy if exists sessions_select on public.reading_sessions;
create policy sessions_select on public.reading_sessions
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists sessions_insert on public.reading_sessions;
create policy sessions_insert on public.reading_sessions
  for insert to authenticated with check (auth.uid() = user_id);

-- reading_progress: upsert tiến độ của chính mình
drop policy if exists progress_all_own on public.reading_progress;
create policy progress_all_own on public.reading_progress
  for all to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- bookshelf: tủ truyện của chính mình
drop policy if exists bookshelf_all_own on public.bookshelf;
create policy bookshelf_all_own on public.bookshelf
  for all to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- api_sources: public đọc, admin ghi
drop policy if exists sources_select_all on public.api_sources;
create policy sources_select_all on public.api_sources
  for select using (true);

drop policy if exists sources_write_admin on public.api_sources;
create policy sources_write_admin on public.api_sources
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- thumbnail_overrides: public đọc, admin ghi
drop policy if exists thumbs_select_all on public.thumbnail_overrides;
create policy thumbs_select_all on public.thumbnail_overrides
  for select using (true);

drop policy if exists thumbs_write_admin on public.thumbnail_overrides;
create policy thumbs_write_admin on public.thumbnail_overrides
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- cosmetic_items: public đọc, admin ghi
drop policy if exists items_select_all on public.cosmetic_items;
create policy items_select_all on public.cosmetic_items
  for select using (true);

drop policy if exists items_write_admin on public.cosmetic_items;
create policy items_write_admin on public.cosmetic_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- inventory_items: của chính mình, admin full
drop policy if exists inventory_all_own on public.inventory_items;
create policy inventory_all_own on public.inventory_items
  for all to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- inventory_items: ai cũng xem được vật phẩm ĐANG TRANG BỊ
-- (hiển thị khung/pháp bảo trên bảng xếp hạng + trang cá nhân người khác)
drop policy if exists inventory_select_equipped_public on public.inventory_items;
create policy inventory_select_equipped_public on public.inventory_items
  for select using (equipped = true);

-- character_defaults: public đọc, admin ghi
drop policy if exists defaults_select_all on public.character_defaults;
create policy defaults_select_all on public.character_defaults
  for select using (true);

drop policy if exists defaults_write_admin on public.character_defaults;
create policy defaults_write_admin on public.character_defaults
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 16. Quyền cơ bản cho role anon/authenticated ---------------------------------------
grant select on all tables in schema public to anon;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 17. Realtime cho bảng xếp hạng ------------------------------------------------------
alter publication supabase_realtime add table public.profiles;

-- 18. Storage buckets: avatars / frames / covers ----------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true),
       ('frames',  'frames',  true),
       ('covers',  'covers',  true)
on conflict (id) do nothing;

-- Đọc công khai 3 bucket
drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select using (bucket_id in ('avatars', 'frames', 'covers'));

-- User đã đăng nhập được upload/sửa/xóa trong 3 bucket
drop policy if exists storage_auth_insert on storage.objects;
create policy storage_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'frames', 'covers'));

drop policy if exists storage_auth_update on storage.objects;
create policy storage_auth_update on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'frames', 'covers'));

drop policy if exists storage_auth_delete on storage.objects;
create policy storage_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'frames', 'covers'));

-- 19. site_settings: cấu hình chung của site (template giao diện...) ---------------
create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- ai cũng đọc được (để web biết template đang dùng)
drop policy if exists site_settings_select_all on public.site_settings;
create policy site_settings_select_all on public.site_settings
  for select using (true);

-- chỉ admin được ghi
drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- seed template mặc định
insert into public.site_settings (key, value)
values ('active_template', 'thu-cac')
on conflict (key) do nothing;

-- realtime: đổi template trong admin → áp dụng ngay mọi máy
alter publication supabase_realtime add table public.site_settings;

-- 20. Đồng bộ truyện: synced_novels + synced_chapters ------------------------------
-- Lần đầu: kéo metadata + nội dung chương từ API về DB.
-- Sau này: "Kiểm tra cập nhật" chỉ lấy truyện mới / chương mới. Web ưu tiên đọc DB.
create table if not exists public.synced_novels (
  id text primary key,                       -- ${source_id}:${api_id}
  source_id text not null,
  api_id text not null,
  title text not null default '',
  author text,
  description text,
  cover_url text,
  status text,
  chapters_count int not null default 0,
  translated_count int not null default 0,    -- số chương đọc được theo API
  synced_chapters int not null default 0,     -- số chương đã lưu nội dung vào DB
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists synced_novels_source_idx on public.synced_novels (source_id);

create table if not exists public.synced_chapters (
  novel_id text not null references public.synced_novels (id) on delete cascade,
  chapter_number int not null,
  title text not null default '',
  content text not null default '',
  synced_at timestamptz not null default now(),
  primary key (novel_id, chapter_number)
);

alter table public.synced_novels enable row level security;
alter table public.synced_chapters enable row level security;

-- ai cũng đọc được (web đọc truyện công khai từ DB)
drop policy if exists synced_novels_public_read on public.synced_novels;
create policy synced_novels_public_read on public.synced_novels
  for select using (true);
drop policy if exists synced_chapters_public_read on public.synced_chapters;
create policy synced_chapters_public_read on public.synced_chapters
  for select using (true);

-- chỉ admin được ghi
drop policy if exists synced_novels_admin_write on public.synced_novels;
create policy synced_novels_admin_write on public.synced_novels
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists synced_chapters_admin_write on public.synced_chapters;
create policy synced_chapters_admin_write on public.synced_chapters
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- quyền (bảng tạo sau mục 16 nên cần grant riêng)
grant select on public.synced_novels, public.synced_chapters to anon;
grant all on public.synced_novels, public.synced_chapters to authenticated;

-- realtime
alter publication supabase_realtime add table public.synced_novels;
alter publication supabase_realtime add table public.synced_chapters;

-- 21. Gemini API keys (chỉ admin đọc/ghi — KHÔNG có policy public) -----------------
create table if not exists public.gemini_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  api_key text not null,
  is_active boolean not null default true,
  last_tested_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz not null default now()
);
alter table public.gemini_keys enable row level security;
drop policy if exists gemini_keys_admin_all on public.gemini_keys;
create policy gemini_keys_admin_all on public.gemini_keys
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant all on public.gemini_keys to authenticated;

-- 22. sync_jobs: job đồng bộ nền (Edge Function sync-worker) ----------------------
-- Chỉ admin đọc/ghi — KHÔNG có policy public.
create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  source_id text,
  novel_key text,
  status text not null default 'pending', -- pending|running|done|error|cancelled
  total int not null default 0,
  done int not null default 0,
  skipped int not null default 0,
  error text,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sync_jobs enable row level security;
drop policy if exists sync_jobs_admin_all on public.sync_jobs;
create policy sync_jobs_admin_all on public.sync_jobs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant all on public.sync_jobs to authenticated;

-- realtime để admin xem tiến trình live
alter publication supabase_realtime add table public.sync_jobs;

-- 23. translation_styles: phong cách dịch Gemini do admin quản lý -----------------
create table if not exists public.translation_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  prompt text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.translation_styles enable row level security;
drop policy if exists translation_styles_public_read on public.translation_styles;
create policy translation_styles_public_read on public.translation_styles
  for select using (true);
drop policy if exists translation_styles_admin_write on public.translation_styles;
create policy translation_styles_admin_write on public.translation_styles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.translation_styles to anon;
grant all on public.translation_styles to authenticated;
-- Seed 4 phong cách (idempotent)
insert into public.translation_styles (name, prompt, is_default) values
  ('Tu tiên cổ điển', 'Dịch sang tiếng Việt văn phong tu tiên cổ điển, dùng nhiều từ Hán Việt trang trọng, giữ nguyên tên riêng và thuật ngữ tu chân, không thêm bớt hay bình luận, chỉ trả về bản dịch.', true),
  ('Hiện đại mượt mà', 'Dịch sang tiếng Việt hiện đại, câu văn mượt mà dễ đọc, hạn chế Hán Việt khó hiểu, giữ tên riêng, chỉ trả về bản dịch.', false),
  ('Hài hước dí dỏm', 'Dịch sang tiếng Việt giữ nguyên chất hài hước dí dỏm của bản gốc, văn phong trẻ trung tự nhiên, chỉ trả về bản dịch.', false),
  ('Kiếm hiệp hào hùng', 'Dịch sang tiếng Việt văn phong kiếm hiệp hào hùng, câu văn mạnh mẽ, giữ tên riêng và tên chiêu thức, chỉ trả về bản dịch.', false)
on conflict (name) do nothing;

-- 24. translation_glossary: từ điển dịch tự học (không cần Gemini) ---------------
-- novel_id = '' nghĩa là từ toàn cục (áp dụng mọi truyện).
create table if not exists public.translation_glossary (
  id uuid primary key default gen_random_uuid(),
  novel_id text not null default '',
  source_term text not null,
  target_term text not null,
  usage_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (novel_id, source_term)
);
alter table public.translation_glossary enable row level security;
drop policy if exists translation_glossary_admin_all on public.translation_glossary;
create policy translation_glossary_admin_all on public.translation_glossary
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant all on public.translation_glossary to authenticated;
-- KHÔNG có policy public: chỉ admin đọc/ghi (giống gemini_keys).

-- 25. cloudflare_config: cấu hình Worker proxy cho Workers AI (nguồn ảnh dự phòng) --
create table if not exists public.cloudflare_config (
  id int primary key,
  worker_url text not null default '',
  worker_secret text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint cloudflare_config_single_row check (id = 1)
);
alter table public.cloudflare_config enable row level security;
drop policy if exists cloudflare_config_admin_all on public.cloudflare_config;
create policy cloudflare_config_admin_all on public.cloudflare_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant all on public.cloudflare_config to authenticated;
-- KHÔNG có policy public: chỉ admin đọc/ghi (giống gemini_keys).
