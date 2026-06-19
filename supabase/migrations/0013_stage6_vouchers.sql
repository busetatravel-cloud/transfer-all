create table if not exists business_vouchers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  document_no text not null,
  business_name text not null,
  business_logo_url text,
  language text not null default 'tr',
  booking_status text not null default 'Bekliyor',
  origin text,
  destination text,
  transfer_type text,
  flight_code text,
  vehicle_name text,
  travel_date date,
  travel_time time,
  customer_name text not null,
  phone text,
  email text,
  passenger_count integer not null default 0,
  total_amount numeric(12,2),
  deposit_amount numeric(12,2),
  remaining_amount numeric(12,2),
  currency text not null default 'TRY',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, request_id),
  unique (business_id, document_no)
);

create index if not exists idx_business_vouchers_business_id
  on business_vouchers (business_id, created_at desc);

create index if not exists idx_business_vouchers_request_id
  on business_vouchers (request_id);

drop trigger if exists trg_business_vouchers_updated_at on business_vouchers;
create trigger trg_business_vouchers_updated_at
before update on business_vouchers
for each row execute function touch_updated_at();
