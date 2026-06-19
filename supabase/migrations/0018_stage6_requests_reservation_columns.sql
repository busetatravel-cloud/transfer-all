alter table public.requests
  add column if not exists country text,
  add column if not exists language text,
  add column if not exists from_location text,
  add column if not exists to_location text,
  add column if not exists flight_code text,
  add column if not exists adult_count integer not null default 1,
  add column if not exists child_count integer not null default 0,
  add column if not exists baby_count integer not null default 0,
  add column if not exists vehicle_category text,
  add column if not exists vehicle text,
  add column if not exists total numeric,
  add column if not exists deposit numeric,
  add column if not exists remaining numeric,
  add column if not exists currency text not null default 'TRY',
  add column if not exists note text,
  add column if not exists payment_status text not null default 'Ödenmedi',
  add column if not exists booking_status text not null default 'Bekliyor',
  add column if not exists source text not null default 'Manuel',
  add column if not exists assigned_vehicle text,
  add column if not exists driver_name text,
  add column if not exists pickup_status text,
  add column if not exists operation_notes text;

do $$
declare
  has_col boolean;
  has_old_origin boolean;
  has_old_destination boolean;
  has_old_vehicle_name boolean;
  has_old_total_amount boolean;
  has_old_deposit_amount boolean;
  has_old_remaining_amount boolean;
  has_old_notes boolean;
  has_old_status boolean;
  has_old_adults boolean;
  has_old_children boolean;
  has_old_infants boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'country'
  ) into has_col;

  if has_col then
    update public.requests
    set country = nullif(trim(country), '')
    where country is not null and trim(country) <> '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'language'
  ) into has_col;

  if has_col then
    update public.requests
    set language = nullif(trim(language), '')
    where language is not null and trim(language) <> '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'origin'
  ) into has_old_origin;

  if has_old_origin then
    update public.requests
    set from_location = coalesce(nullif(trim(from_location), ''), origin)
    where from_location is null or trim(from_location) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'destination'
  ) into has_old_destination;

  if has_old_destination then
    update public.requests
    set to_location = coalesce(nullif(trim(to_location), ''), destination)
    where to_location is null or trim(to_location) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'flight_code'
  ) into has_col;

  if has_col then
    update public.requests
    set flight_code = nullif(trim(flight_code), '')
    where flight_code is not null and trim(flight_code) <> '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'adults'
  ) into has_old_adults;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'children'
  ) into has_old_children;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'infants'
  ) into has_old_infants;

  if has_old_adults then
    update public.requests
    set adult_count = coalesce(adult_count, adults, 1)
    where adult_count is null;
  end if;

  if has_old_children then
    update public.requests
    set child_count = coalesce(child_count, children, 0)
    where child_count is null;
  end if;

  if has_old_infants then
    update public.requests
    set baby_count = coalesce(baby_count, infants, 0)
    where baby_count is null;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'vehicle_name'
  ) into has_old_vehicle_name;

  if has_old_vehicle_name then
    update public.requests
    set vehicle = coalesce(nullif(trim(vehicle), ''), vehicle_name)
    where vehicle is null or trim(vehicle) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'total_amount'
  ) into has_old_total_amount;

  if has_old_total_amount then
    update public.requests
    set total = coalesce(total, total_amount)
    where total is null;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'deposit_amount'
  ) into has_old_deposit_amount;

  if has_old_deposit_amount then
    update public.requests
    set deposit = coalesce(deposit, deposit_amount)
    where deposit is null;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'remaining_amount'
  ) into has_old_remaining_amount;

  if has_old_remaining_amount then
    update public.requests
    set remaining = coalesce(remaining, remaining_amount)
    where remaining is null;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'currency'
  ) into has_col;

  if has_col then
    update public.requests
    set currency = coalesce(nullif(trim(currency), ''), 'TRY')
    where currency is null or trim(currency) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'note'
  ) into has_col;

  if has_col then
    update public.requests
    set note = coalesce(nullif(trim(note), ''), null)
    where note is not null and trim(note) <> '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'notes'
  ) into has_old_notes;

  if has_old_notes then
    update public.requests
    set note = coalesce(nullif(trim(note), ''), notes)
    where note is null or trim(note) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'payment_status'
  ) into has_col;

  if has_col then
    update public.requests
    set payment_status = coalesce(nullif(trim(payment_status), ''), 'Ödenmedi')
    where payment_status is null or trim(payment_status) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'booking_status'
  ) into has_col;

  if has_col then
    update public.requests
    set booking_status = coalesce(nullif(trim(booking_status), ''), 'Bekliyor')
    where booking_status is null or trim(booking_status) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'status'
  ) into has_old_status;

  if has_old_status then
    update public.requests
    set booking_status = coalesce(nullif(trim(booking_status), ''), status::text, 'Bekliyor')
    where booking_status is null or trim(booking_status) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'source'
  ) into has_col;

  if has_col then
    update public.requests
    set source = coalesce(nullif(trim(source), ''), 'Manuel')
    where source is null or trim(source) = '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'assigned_vehicle'
  ) into has_col;

  if has_col then
    update public.requests
    set assigned_vehicle = nullif(trim(assigned_vehicle), '')
    where assigned_vehicle is not null and trim(assigned_vehicle) <> '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'driver_name'
  ) into has_col;

  if has_col then
    update public.requests
    set driver_name = nullif(trim(driver_name), '')
    where driver_name is not null and trim(driver_name) <> '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'pickup_status'
  ) into has_col;

  if has_col then
    update public.requests
    set pickup_status = nullif(trim(pickup_status), '')
    where pickup_status is not null and trim(pickup_status) <> '';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'operation_notes'
  ) into has_col;

  if has_col then
    update public.requests
    set operation_notes = nullif(trim(operation_notes), '')
    where operation_notes is not null and trim(operation_notes) <> '';
  end if;
end $$;

alter table public.requests
  alter column adult_count set default 1,
  alter column child_count set default 0,
  alter column baby_count set default 0,
  alter column currency set default 'TRY',
  alter column payment_status set default 'Ödenmedi',
  alter column booking_status set default 'Bekliyor',
  alter column source set default 'Manuel';
