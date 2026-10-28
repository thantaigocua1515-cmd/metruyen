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

-- 26. Gamification: nhiệm vụ / thành tựu / danh hiệu -------------------------------
-- 26a. titles: danh hiệu
create table if not exists public.titles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  color text not null default '#fbbf24',
  glow text not null default '#f59e0b',
  animation text not null default 'blink', -- blink | shine | none
  created_from text not null default 'achievement', -- rank | achievement
  is_active boolean not null default true
);
alter table public.titles enable row level security;
drop policy if exists titles_public_read on public.titles;
create policy titles_public_read on public.titles for select using (true);
drop policy if exists titles_admin_all on public.titles;
create policy titles_admin_all on public.titles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.titles to anon;
grant all on public.titles to authenticated;

-- 26b. user_titles: danh hiệu đã nhận
create table if not exists public.user_titles (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  earned_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (user_id, title_id)
);
alter table public.user_titles enable row level security;
drop policy if exists user_titles_owner on public.user_titles;
create policy user_titles_owner on public.user_titles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists user_titles_public_equipped on public.user_titles;
create policy user_titles_public_equipped on public.user_titles
  for select using (equipped = true);
grant select on public.user_titles to anon;
grant all on public.user_titles to authenticated;

-- 26c. quests: định nghĩa nhiệm vụ
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  period text not null, -- daily | weekly | monthly
  target_type text not null,
  target_value int not null,
  reward_stones int not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0
);
alter table public.quests enable row level security;
drop policy if exists quests_public_read on public.quests;
create policy quests_public_read on public.quests for select using (true);
drop policy if exists quests_admin_all on public.quests;
create policy quests_admin_all on public.quests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.quests to anon;
grant all on public.quests to authenticated;

-- 26d. quest_progress: tiến độ nhiệm vụ của user
create table if not exists public.quest_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  period_key text not null,
  progress int not null default 0,
  completed boolean not null default false,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id, period_key)
);
alter table public.quest_progress enable row level security;
drop policy if exists quest_progress_owner on public.quest_progress;
create policy quest_progress_owner on public.quest_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant all on public.quest_progress to authenticated;

-- 26e. achievements: định nghĩa thành tựu
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  category text not null default 'reading',
  target_type text not null,
  target_value int not null,
  reward_stones int not null default 0,
  reward_title_code text,
  icon text not null default '🏅',
  is_active boolean not null default true
);
alter table public.achievements enable row level security;
drop policy if exists achievements_public_read on public.achievements;
create policy achievements_public_read on public.achievements for select using (true);
drop policy if exists achievements_admin_all on public.achievements;
create policy achievements_admin_all on public.achievements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.achievements to anon;
grant all on public.achievements to authenticated;

-- 26f. user_achievements: thành tựu của user
create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  progress int not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  claimed boolean not null default false,
  primary key (user_id, achievement_id)
);
alter table public.user_achievements enable row level security;
drop policy if exists user_achievements_owner on public.user_achievements;
create policy user_achievements_owner on public.user_achievements
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant all on public.user_achievements to authenticated;

-- 26g. profiles: thêm cột streak
alter table public.profiles add column if not exists last_active_date date;
alter table public.profiles add column if not exists login_streak int not null default 0;

-- 26h. Seed danh hiệu
insert into public.titles (code, name, color, glow, animation, created_from) values
  ('rank_0','🌱 Phàm Trần Khách','#86efac','#22c55e','blink','rank'),
  ('rank_1','🔥 Luyện Khí Tu Sĩ','#4ade80','#16a34a','blink','rank'),
  ('rank_2','🪨 Trúc Cơ Chân Nhân','#22d3ee','#0891b2','blink','rank'),
  ('rank_3','⚡ Kim Đan Lão Tổ','#38bdf8','#0284c7','blink','rank'),
  ('rank_4','👶 Nguyên Anh Thánh Tử','#818cf8','#4f46e5','blink','rank'),
  ('rank_5','🌩️ Hóa Thần Đại Năng','#a78bfa','#7c3aed','blink','rank'),
  ('rank_6','🌀 Luyện Hư Tôn Giả','#c084fc','#9333ea','blink','rank'),
  ('rank_7','🌌 Hợp Thể Thánh Quân','#e879f9','#c026d3','blink','rank'),
  ('rank_8','☁️ Đại Thừa Tiên Ông','#f472b6','#db2777','blink','rank'),
  ('rank_9','💥 Độ Kiếp Thiên Tôn','#fb7185','#e11d48','blink','rank'),
  ('rank_10','🏔️ Địa Tiên','#fbbf24','#d97706','blink','rank'),
  ('rank_11','☀️ Thiên Tiên','#f59e0b','#b45309','blink','rank'),
  ('rank_12','✨ Kim Tiên','#f97316','#c2410c','blink','rank'),
  ('rank_13','🌟 Đại La Kim Tiên','#ef4444','#b91c1c','shine','rank'),
  ('rank_14','👑 Thánh Nhân Vô Thượng','#fde047','#f59e0b','shine','rank'),
  ('title_thu_thanh','📚 Thư Thánh','#a78bfa','#7c3aed','shine','achievement'),
  ('title_phu_giap','💰 Phú Giáp Thiên Hạ','#fbbf24','#d97706','shine','achievement'),
  ('title_thuy_chung','🏵️ Thủy Chung Bất Dụ','#f472b6','#db2777','shine','achievement')
on conflict (code) do nothing;

-- 26i. Seed nhiệm vụ
insert into public.quests (code, name, description, period, target_type, target_value, reward_stones, sort_order) values
  ('q_daily_read300','Điểm Danh Tu Luyện','Đọc truyện 5 phút trong ngày', 'daily','read_seconds',300,5,1),
  ('q_daily_read1800','Chăm Chỉ Tu Luyện','Đọc truyện 30 phút trong ngày','daily','read_seconds',1800,12,2),
  ('q_daily_read7200','Bế Quan Tu Luyện','Đọc truyện 2 giờ trong ngày','daily','read_seconds',7200,30,3),
  ('q_daily_ch20','Mọt Sách Mỗi Ngày','Đọc 20 chương trong ngày','daily','read_chapters',20,20,4),
  ('q_weekly_read36000','Tuần Chăm Chỉ','Đọc truyện 10 giờ trong tuần','weekly','read_seconds',36000,120,1),
  ('q_weekly_ch100','Cày Chương','Đọc 100 chương trong tuần','weekly','read_chapters',100,150,2),
  ('q_weekly_daily5','Kỷ Luật Sắt','Nhận thưởng 5 nhiệm vụ ngày trong tuần','weekly','daily_quests_done',5,100,3),
  ('q_weekly_stones500','Tích Tiểu Thành Đại','Kiếm 500 linh thạch trong tuần','weekly','stones_earned',500,120,4),
  ('q_monthly_read144000','Bế Quan Tháng','Đọc truyện 40 giờ trong tháng','monthly','read_seconds',144000,500,1),
  ('q_monthly_ch400','Cuồng Đọc','Đọc 400 chương trong tháng','monthly','read_chapters',400,600,2),
  ('q_monthly_ach3','Danh Vọng','Mở khóa 3 thành tựu trong tháng','monthly','achievements_unlocked',3,400,3)
on conflict (code) do nothing;

-- 26j. Seed thành tựu
insert into public.achievements (code, name, description, category, target_type, target_value, reward_stones, reward_title_code, icon) values
  ('ach_ch1','Bước Đầu Tiên','Đọc chương truyện đầu tiên','reading','read_chapters',1,10,null,'🌱'),
  ('ach_ch100','Mọt Sách Sơ Cấp','Đọc 100 chương truyện','reading','read_chapters',100,50,null,'📖'),
  ('ach_ch500','Mọt Sách Trung Cấp','Đọc 500 chương truyện','reading','read_chapters',500,150,null,'📚'),
  ('ach_ch1000','Mọt Sách Cao Cấp','Đọc 1000 chương truyện','reading','read_chapters',1000,300,null,'📚'),
  ('ach_ch5000','Thư Thánh','Đọc 5000 chương truyện','reading','read_chapters',5000,800,'title_thu_thanh','🏆'),
  ('ach_novels_5','Thư Hải Du Long','Đọc 5 bộ truyện khác nhau','reading','novels_read',5,60,null,'🐉'),
  ('ach_novels_20','Bác Lãm Quần Thư','Đọc 20 bộ truyện khác nhau','reading','novels_read',20,200,null,'🐉'),
  ('ach_night','Cú Đêm Tu Luyện','Đọc 10 chương vào lúc 0–5h sáng','reading','night_reads',10,80,null,'🦉'),
  ('ach_rank_1','Trúc Cơ Thành Công','Đạt cảnh giới Luyện Khí','cultivation','rank_index',1,30,null,'🌱'),
  ('ach_rank_2','Kim Đan Đại Thành','Đạt cảnh giới Trúc Cơ','cultivation','rank_index',2,60,null,'🔥'),
  ('ach_rank_3','Nguyên Anh Xuất Thế','Đạt cảnh giới Kim Đan','cultivation','rank_index',3,120,null,'👶'),
  ('ach_rank_5','Hóa Thần Phi Thăng','Đạt cảnh giới Hóa Thần','cultivation','rank_index',5,250,null,'🌩️'),
  ('ach_rank_7','Hợp Thể Vô Địch','Đạt cảnh giới Hợp Thể','cultivation','rank_index',7,400,null,'🌌'),
  ('ach_rank_9','Độ Kiếp Phi Thăng','Đạt cảnh giới Độ Kiếp','cultivation','rank_index',9,700,null,'💥'),
  ('ach_rank_14','Thánh Nhân Vô Thượng','Đạt cảnh giới Thánh Nhân','cultivation','rank_index',14,2000,null,'👑'),
  ('ach_stones_100','Tiểu Phú','Sở hữu 100 linh thạch cùng lúc','wealth','stones_owned_max',100,20,null,'💰'),
  ('ach_stones_1000','Trung Phú','Sở hữu 1000 linh thạch cùng lúc','wealth','stones_owned_max',1000,100,null,'💰'),
  ('ach_stones_10000','Phú Giáp Thiên Hạ','Sở hữu 10000 linh thạch cùng lúc','wealth','stones_owned_max',10000,500,'title_phu_giap','🏦'),
  ('ach_frame_1','Hữu Duyên','Sở hữu 1 khung avatar','collection','frames_owned',1,30,null,'🖼️'),
  ('ach_treasure_1','Tầm Bảo','Sở hữu 1 pháp bảo','collection','treasures_owned',1,30,null,'⚔️'),
  ('ach_frame_5','Khung Sưu Tầm Gia','Sở hữu 5 khung avatar','collection','frames_owned',5,150,null,'🖼️'),
  ('ach_treasure_5','Bảo Khố','Sở hữu 5 pháp bảo','collection','treasures_owned',5,150,null,'⚔️'),
  ('ach_streak_3','Kiên Trì','Đăng nhập 3 ngày liên tiếp','streak','login_streak',3,60,null,'🔥'),
  ('ach_streak_7','Bền Bỉ','Đăng nhập 7 ngày liên tiếp','streak','login_streak',7,180,null,'🔥'),
  ('ach_streak_30','Thủy Chung Bất Dụ','Đăng nhập 30 ngày liên tiếp','streak','login_streak',30,600,'title_thuy_chung','🏵️'),
  ('ach_bookshelf_1','Tàng Thư','Thêm 1 truyện vào tủ sách','explore','bookshelf_count',1,20,null,'🗄️'),
  ('ach_bookshelf_10','Tàng Kinh Các','Thêm 10 truyện vào tủ sách','explore','bookshelf_count',10,80,null,'🗄️'),
  ('ach_avatar','Diện Mạo Mới','Đặt avatar cá nhân','explore','avatar_set',1,10,null,'📷'),
  ('ach_quest_10','Nhiệm Vụ Đại Sư','Nhận thưởng 10 nhiệm vụ bất kỳ','explore','quests_claimed',10,150,null,'🎯'),
  ('ach_stones_earned_1000','Tích Tiểu Thành Đại','Kiếm tổng cộng 1000 linh thạch','wealth','stones_earned',1000,150,null,'💎')
on conflict (code) do nothing;
-- 27. Thông báo thiên đạo: admin gửi messagebox realtime tới mọi user đang online
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
alter table public.announcements enable row level security;
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements for select using (true);
drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write on public.announcements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.announcements to anon;
grant all on public.announcements to authenticated;

-- bật realtime cho bảng (để client đang online nhận ngay)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;
END $$;

