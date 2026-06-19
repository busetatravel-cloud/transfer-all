create extension if not exists pgcrypto;

create table if not exists public.business_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  reservation_id uuid references public.requests(id) on delete set null,
  customer_name text,
  due_date date,
  due_time text,
  priority text not null default 'Normal',
  status text not null default 'Bekliyor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_tasks_business_id
  on public.business_tasks (business_id, due_date asc nulls last, due_time asc nulls last, created_at desc);

create index if not exists idx_business_tasks_reservation_id
  on public.business_tasks (reservation_id);
