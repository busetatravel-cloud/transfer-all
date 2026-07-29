create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  priority integer not null default 100,
  origin text,
  destination text,
  vehicle_category text,
  trip_type text,
  currency text not null default 'TRY',
  season_months integer[] not null default '{}'::integer[],
  season_multiplier numeric(12,4) not null default 1,
  base_price numeric(12,2) not null default 0,
  minimum_price numeric(12,2) not null default 0,
  day_multiplier numeric(12,4) not null default 1,
  night_multiplier numeric(12,4) not null default 1,
  night_fee numeric(12,2) not null default 0,
  round_trip_multiplier numeric(12,4) not null default 1,
  tax_rate numeric(12,4) not null default 0.20,
  child_seat_fee numeric(12,2) not null default 0,
  extra_baggage_fee numeric(12,2) not null default 0,
  vip_greeting_fee numeric(12,2) not null default 0,
  waiting_fee_per_minute numeric(12,2) not null default 0,
  airport_parking_fee numeric(12,2) not null default 0,
  discount_percent numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  coupon_code text,
  agency_name text,
  coupon_discount_percent numeric(12,2) not null default 0,
  coupon_discount_amount numeric(12,2) not null default 0,
  agency_discount_percent numeric(12,2) not null default 0,
  agency_discount_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_rules_trip_type_check check (
    trip_type is null or trip_type in ('one_way', 'round_trip')
  ),
  constraint pricing_rules_currency_check check (
    currency in ('TRY', 'EUR', 'USD', 'GBP')
  )
);

create index if not exists pricing_rules_business_active_priority_idx
  on public.pricing_rules (business_id, active, priority);

create index if not exists pricing_rules_business_route_idx
  on public.pricing_rules (business_id, origin, destination, vehicle_category, trip_type, currency);

create index if not exists pricing_rules_season_months_idx
  on public.pricing_rules using gin (season_months);
