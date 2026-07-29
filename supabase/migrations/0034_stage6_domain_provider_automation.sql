do $migration$
begin
  alter type public.domain_status
    add value if not exists 'provider_added';
exception
  when duplicate_object then
    null;
end
$migration$;

alter table public.businesses
  add column if not exists domain_provider text not null default 'manual',
  add column if not exists provider_status text not null default 'manual',
  add column if not exists provider_message text,
  add column if not exists provider_synced_at timestamptz;

update public.businesses
set
  domain_provider = coalesce(
    nullif(trim(domain_provider), ''),
    'manual'
  ),

  provider_status = case
    when domain_status::text = 'provider_added'
      then 'provider_added'
    when domain_status::text = 'failed'
      then 'failed'
    else coalesce(
      nullif(trim(provider_status), ''),
      'manual'
    )
  end,

  provider_synced_at = coalesce(
    provider_synced_at,
    updated_at,
    created_at
  )
where domain_provider is null
   or trim(domain_provider) = ''
   or provider_status is null
   or trim(provider_status) = ''
   or provider_synced_at is null;


   