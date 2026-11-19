-- Mê Truyện — protected HTML crawler integration
-- Run once after supabase/schema.sql in the Supabase SQL editor.
-- No cookies, provider keys, service-role keys, or raw upstream HTML are stored here.

alter table public.api_sources
  add column if not exists source_type text not null default 'api';

do $$
begin
  alter table public.api_sources
    add constraint api_sources_source_type_check
    check (source_type in ('api', 'crawler'));
exception
  when duplicate_object then null;
end $$;

create index if not exists api_sources_source_type_idx
  on public.api_sources (source_type, is_active);

create table if not exists public.crawler_sources (
  id            text primary key,
  name          text not null,
  allowed_hosts text[] not null,
  preset        text not null default 'generic',
  selectors     jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint crawler_sources_id_check
    check (id ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  constraint crawler_sources_hosts_check
    check (cardinality(allowed_hosts) between 1 and 10),
  constraint crawler_sources_preset_check
    check (preset in ('generic'))
);

create table if not exists public.crawler_jobs (
  id              uuid primary key default gen_random_uuid(),
  source_id       text not null references public.crawler_sources(id) on delete cascade,
  source_url      text not null,
  novel_key       text,
  status          text not null default 'pending',
  total           integer not null default 0,
  done            integer not null default 0,
  skipped         integer not null default 0,
  max_chapters    integer not null default 100,
  next_index      integer not null default 0,
  chapter_links   jsonb not null default '[]'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  error           text,
  heartbeat_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint crawler_jobs_status_check
    check (status in ('pending', 'running', 'paused', 'done', 'error', 'cancelled')),
  constraint crawler_jobs_limits_check
    check (max_chapters between 1 and 300),
  constraint crawler_jobs_progress_check
    check (done >= 0 and skipped >= 0 and next_index >= 0)
);

create index if not exists crawler_jobs_source_idx
  on public.crawler_jobs (source_id, created_at desc);
create index if not exists crawler_jobs_status_idx
  on public.crawler_jobs (status, heartbeat_at);

alter table public.crawler_sources enable row level security;
alter table public.crawler_jobs enable row level security;

drop policy if exists crawler_sources_admin_all on public.crawler_sources;
create policy crawler_sources_admin_all on public.crawler_sources
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists crawler_jobs_admin_all on public.crawler_jobs;
create policy crawler_jobs_admin_all on public.crawler_jobs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant all on public.crawler_sources to authenticated;
grant all on public.crawler_jobs to authenticated;

-- Atomic lease: prevents two Edge Function invocations from processing one job
-- concurrently while allowing a stale worker to be recovered after two minutes.
create or replace function public.claim_crawler_job(p_job_id uuid)
returns setof public.crawler_jobs
language sql
security definer
set search_path = public
as $$
  update public.crawler_jobs
     set status = 'running',
         heartbeat_at = now(),
         updated_at = now()
   where id = p_job_id
     and (
       status = 'pending'
       or (
         status = 'running'
         and (heartbeat_at is null or heartbeat_at < now() - interval '2 minutes')
       )
     )
  returning *;
$$;

revoke all on function public.claim_crawler_job(uuid) from public;
grant execute on function public.claim_crawler_job(uuid) to service_role;

-- Keep realtime progress available to the admin console.
do $$
begin
  alter publication supabase_realtime add table public.crawler_jobs;
exception
  when duplicate_object then null;
end $$;

comment on table public.crawler_sources is
  'Admin-owned allowlisted HTML crawler sources; secrets and cookies are intentionally excluded.';
comment on table public.crawler_jobs is
  'Admin-owned bounded crawler jobs; chapter links and metadata are resumable state.';
