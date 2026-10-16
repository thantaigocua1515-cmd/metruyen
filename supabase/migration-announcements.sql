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
