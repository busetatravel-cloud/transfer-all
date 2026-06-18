alter table public.requests
  add column if not exists payment_status text;

update public.requests
set payment_status = coalesce(nullif(trim(payment_status), ''), 'Ödenmedi')
where payment_status is null or trim(payment_status) = '';

alter table public.requests
  alter column payment_status set default 'Ödenmedi';

alter table public.requests
  alter column payment_status set not null;
