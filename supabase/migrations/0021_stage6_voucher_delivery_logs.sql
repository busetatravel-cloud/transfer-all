create table if not exists public.business_voucher_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  reservation_id text not null,
  voucher_id text not null,
  channel text not null,
  recipient text not null,
  status text not null default 'draft',
  message_preview text not null,
  created_at timestamptz not null default now()
);

create index if not exists business_voucher_delivery_logs_business_id_idx
  on public.business_voucher_delivery_logs (business_id, created_at desc);

create index if not exists business_voucher_delivery_logs_reservation_id_idx
  on public.business_voucher_delivery_logs (reservation_id);
