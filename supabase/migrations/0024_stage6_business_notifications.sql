create table if not exists public.business_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  status text not null default 'unread',
  related_type text,
  related_id text,
  created_at timestamptz not null default now()
);

alter table public.business_notifications
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists business_id uuid,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists status text default 'unread',
  add column if not exists related_type text,
  add column if not exists related_id text,
  add column if not exists created_at timestamptz default now();

update public.business_notifications
set
  status = coalesce(nullif(status, ''), 'unread'),
  created_at = coalesce(created_at, now())
where true;

alter table public.business_notifications
  alter column status set default 'unread',
  alter column created_at set default now();

create index if not exists business_notifications_business_created_idx
  on public.business_notifications (business_id, created_at desc);

create index if not exists business_notifications_business_status_created_idx
  on public.business_notifications (business_id, status, created_at desc);
