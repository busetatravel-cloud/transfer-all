alter table public.requests
  add column if not exists booking_status text,
  add column if not exists payment_status text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'booking_status'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'requests'
        and column_name = 'status'
    ) then
      execute $sql$
        update public.requests
        set booking_status = coalesce(nullif(trim(booking_status), ''), status::text, 'Bekliyor')
        where booking_status is null
           or trim(booking_status) = ''
      $sql$;
    else
      execute $sql$
        update public.requests
        set booking_status = coalesce(nullif(trim(booking_status), ''), 'Bekliyor')
        where booking_status is null
           or trim(booking_status) = ''
      $sql$;
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'payment_status'
  ) then
    execute $sql$
      update public.requests
      set payment_status = coalesce(nullif(trim(payment_status), ''), 'Ödenmedi')
      where payment_status is null
         or trim(payment_status) = ''
    $sql$;
  end if;
end $$;

alter table public.requests
  alter column booking_status set default 'Bekliyor',
  alter column payment_status set default 'Ödenmedi';
