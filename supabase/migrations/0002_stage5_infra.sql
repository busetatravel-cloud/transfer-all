alter table if exists business_seo
  add column if not exists canonical_url text not null default '',
  add column if not exists default_locale text not null default 'tr',
  add column if not exists hreflang_enabled boolean not null default true;

create table if not exists business_media_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null,
  source_url text not null default '',
  storage_path text not null default '',
  alt_text text not null default '',
  status text not null default 'placeholder',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_media_assets_business_id
  on business_media_assets (business_id);

create index if not exists idx_business_media_assets_kind
  on business_media_assets (business_id, kind, sort_order);

create table if not exists business_analytics_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  event_name text not null,
  page_path text not null default '',
  referrer text,
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_analytics_events_business_id
  on business_analytics_events (business_id, created_at desc);

create index if not exists idx_business_analytics_events_name
  on business_analytics_events (business_id, event_name);

create table if not exists business_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  source text not null default 'manual',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_customers_business_id
  on business_customers (business_id);

create index if not exists idx_business_customers_email
  on business_customers (business_id, email);

drop trigger if exists trg_business_media_assets_updated_at on business_media_assets;
create trigger trg_business_media_assets_updated_at
before update on business_media_assets
for each row execute function touch_updated_at();

drop trigger if exists trg_business_customers_updated_at on business_customers;
create trigger trg_business_customers_updated_at
before update on business_customers
for each row execute function touch_updated_at();
