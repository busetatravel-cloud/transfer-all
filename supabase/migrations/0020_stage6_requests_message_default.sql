update public.requests
set message = 'Manuel rezervasyon'
where message is null
   or btrim(message) = '';

alter table public.requests
  alter column message set default 'Manuel rezervasyon';

alter table public.requests
  alter column message set not null;
