create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reservation_id uuid not null references public.requests(id) on delete cascade,
  provider text not null default 'manual',
  amount numeric not null default 0,
  currency text not null default 'TRY',
  status text not null default 'Pending',
  transaction_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_payments_reservation_id
  on public.payments (reservation_id);

create index if not exists idx_payments_business_id
  on public.payments (business_id, created_at desc);

create index if not exists idx_payments_status
  on public.payments (business_id, status);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
before update on public.payments
for each row execute function touch_updated_at();

