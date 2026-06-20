do $$
begin
  alter type domain_status add value if not exists 'provider_added';
exception
  when duplicate_object then null;
end $$;

alter table public.businesses
  add column if not exists domain_provider text not null default 'manual',
  add column if not exists provider_status text not null default 'manual',
  add column if not exists provider_message text,
  add column if not exists provider_synced_at timestamptz;

update public.businesses
set
  domain_provider = coalesce(domain_provider, 'manual'),
  provider_status = coalesce(
    provider_status,
    case
      when domain_status = 'provider_added' then 'provider_added'
      when domain_status = 'failed' then 'failed'
      else 'manual'
    end
  ),
  provider_message = provider_message,
  provider_synced_at = coalesce(provider_synced_at, updated_at)
where domain_provider is null
   or provider_status is null
   or provider_message is null
   or provider_synced_at is null;
