create table if not exists public.business_export_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  export_type text not null,
  status text not null default 'draft',
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.business_export_logs
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists business_id uuid,
  add column if not exists export_type text,
  add column if not exists status text default 'draft',
  add column if not exists row_count integer default 0,
  add column if not exists created_at timestamptz default now();

alter table public.business_export_logs
  alter column status set default 'draft',
  alter column row_count set default 0,
  alter column created_at set default now();

update public.business_export_logs
set
  status = coalesce(nullif(status, ''), 'draft'),
  row_count = coalesce(row_count, 0),
  created_at = coalesce(created_at, now())
where true;

create index if not exists business_export_logs_business_created_idx
  on public.business_export_logs (business_id, created_at desc);

create index if not exists business_export_logs_business_type_idx
  on public.business_export_logs (business_id, export_type, created_at desc);
