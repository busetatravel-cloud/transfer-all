alter table if exists requests
  add column if not exists country text,
  add column if not exists language text,
  add column if not exists origin text,
  add column if not exists destination text,
  add column if not exists travel_date date,
  add column if not exists travel_time time,
  add column if not exists flight_code text,
  add column if not exists adults integer not null default 0,
  add column if not exists children integer not null default 0,
  add column if not exists infants integer not null default 0,
  add column if not exists vehicle_category text,
  add column if not exists vehicle_name text,
  add column if not exists total_amount numeric(12,2),
  add column if not exists deposit_amount numeric(12,2),
  add column if not exists remaining_amount numeric(12,2),
  add column if not exists currency text not null default 'TRY',
  add column if not exists notes text not null default '',
  add column if not exists source text not null default 'web',
  add column if not exists booking_status text not null default 'Bekliyor';

create index if not exists idx_requests_booking_status
  on requests (business_id, booking_status, created_at desc);

create index if not exists idx_requests_source
  on requests (business_id, source, created_at desc);
