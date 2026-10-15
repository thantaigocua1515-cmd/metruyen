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
