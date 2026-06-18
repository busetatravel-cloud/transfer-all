alter table public.business_customers
  add column if not exists country text,
  add column if not exists language text;

create index if not exists idx_business_customers_phone
  on public.business_customers (business_id, phone);
