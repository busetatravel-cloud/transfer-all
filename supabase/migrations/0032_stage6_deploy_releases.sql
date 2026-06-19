create table if not exists public.deploy_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  released_at timestamptz,
  released_by text,
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deploy_releases
  add column if not exists version text;

alter table public.deploy_releases
  add column if not exists released_at timestamptz;

alter table public.deploy_releases
  add column if not exists released_by text;

alter table public.deploy_releases
  add column if not exists notes text;

alter table public.deploy_releases
  add column if not exists status text;

alter table public.deploy_releases
  add column if not exists created_at timestamptz;

alter table public.deploy_releases
  add column if not exists updated_at timestamptz;

create index if not exists deploy_releases_status_updated_idx
  on public.deploy_releases (status, updated_at desc, created_at desc);

