alter table if exists public.requests
  add column if not exists adult_count integer not null default 0,
  add column if not exists child_count integer not null default 0,
  add column if not exists baby_count integer not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'adults'
  ) then
    execute 'update public.requests
      set adult_count = coalesce(adult_count, adults),
          child_count = coalesce(child_count, children),
          baby_count = coalesce(baby_count, infants)';
  end if;
end $$;

alter table if exists public.requests
  alter column adult_count set default 0,
  alter column child_count set default 0,
  alter column baby_count set default 0;
