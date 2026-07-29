alter table public.requests
  add column if not exists operation_status text not null default 'Pending',
  add column if not exists pickup_time text,
  add column if not exists meeting_point text;

update public.requests
set operation_status = coalesce(nullif(trim(operation_status), ''), 'Pending')
where operation_status is null or trim(operation_status) = '';

create index if not exists idx_requests_operation_status
  on public.requests (business_id, operation_status, travel_date, travel_time);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drivers_business_id
  on public.drivers (business_id, active, created_at desc);

drop trigger if exists trg_drivers_updated_at on public.drivers;
create trigger trg_drivers_updated_at
before update on public.drivers
for each row execute function touch_updated_at();

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plate text not null default '',
  brand text not null default '',
  model text not null default '',
  capacity integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicles_business_id
  on public.vehicles (business_id, active, created_at desc);

drop trigger if exists trg_vehicles_updated_at on public.vehicles;
create trigger trg_vehicles_updated_at
before update on public.vehicles
for each row execute function touch_updated_at();

create table if not exists public.reservation_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reservation_id uuid not null references public.requests(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.users(id) on delete set null,
  pickup_time text,
  meeting_point text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_reservation_assignments_reservation_id
  on public.reservation_assignments (reservation_id);

create index if not exists idx_reservation_assignments_business_id
  on public.reservation_assignments (business_id, assigned_at desc);

drop trigger if exists trg_reservation_assignments_updated_at on public.reservation_assignments;
create trigger trg_reservation_assignments_updated_at
before update on public.reservation_assignments
for each row execute function touch_updated_at();

