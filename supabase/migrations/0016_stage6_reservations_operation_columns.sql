alter table if exists public.requests
  add column if not exists pickup_status text,
  add column if not exists operation_notes text;

update public.requests
set pickup_status = coalesce(nullif(trim(pickup_status), ''), null)
where pickup_status is not null;

update public.requests
set operation_notes = coalesce(nullif(trim(operation_notes), ''), null)
where operation_notes is not null;
