alter table public.requests
  add column if not exists supplier_name text;

alter table public.requests
  add column if not exists agency_name text;

alter table public.requests
  add column if not exists collected_amount numeric default 0;

alter table public.requests
  add column if not exists supplier_pass numeric default 0;

alter table public.requests
  add column if not exists agency_pass numeric default 0;

alter table public.requests
  add column if not exists supplier_collection numeric default 0;

alter table public.requests
  add column if not exists profit numeric default 0;

update public.requests
set profit = coalesce(profit, coalesce(collected_amount, 0) + coalesce(agency_pass, 0) - coalesce(supplier_pass, 0))
where profit is null;

