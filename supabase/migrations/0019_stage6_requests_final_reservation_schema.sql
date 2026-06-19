alter table public.requests
  add column if not exists country text;

alter table public.requests
  add column if not exists language text;

alter table public.requests
  add column if not exists from_location text;

alter table public.requests
  add column if not exists to_location text;

alter table public.requests
  add column if not exists travel_date date;

alter table public.requests
  add column if not exists travel_time text;

alter table public.requests
  add column if not exists flight_code text;

alter table public.requests
  add column if not exists adult_count integer default 1;

alter table public.requests
  add column if not exists child_count integer default 0;

alter table public.requests
  add column if not exists baby_count integer default 0;

alter table public.requests
  add column if not exists vehicle_category text;

alter table public.requests
  add column if not exists vehicle_name text;

alter table public.requests
  add column if not exists total_amount numeric;

alter table public.requests
  add column if not exists deposit_amount numeric;

alter table public.requests
  add column if not exists remaining_amount numeric;

alter table public.requests
  add column if not exists currency text default 'TRY';

alter table public.requests
  add column if not exists notes text;

alter table public.requests
  add column if not exists payment_status text default 'Ödenmedi';

alter table public.requests
  add column if not exists booking_status text default 'Bekliyor';

alter table public.requests
  add column if not exists source text default 'Manuel';

alter table public.requests
  add column if not exists assigned_vehicle text;

alter table public.requests
  add column if not exists driver_name text;

alter table public.requests
  add column if not exists pickup_status text;

alter table public.requests
  add column if not exists operation_notes text;
