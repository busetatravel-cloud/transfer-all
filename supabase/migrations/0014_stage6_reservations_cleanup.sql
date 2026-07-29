alter table public.requests
  add column if not exists payment_status text;

alter table public.requests
  add column if not exists booking_status text;

update public.requests
set payment_status = U&'\00D6denmedi'
where payment_status is null
   or trim(payment_status) = ''
   or lower(trim(payment_status)) like '%denmedi';

alter table public.requests
  alter column payment_status set default U&'\00D6denmedi';

alter table public.requests
  alter column payment_status set not null;

update public.requests
set booking_status = 'Bekliyor'
where booking_status is null
   or trim(booking_status) = '';

alter table public.requests
  alter column booking_status set default 'Bekliyor';