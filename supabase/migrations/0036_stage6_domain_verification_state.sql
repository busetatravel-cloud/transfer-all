alter table public.businesses
  add column if not exists verification_required boolean not null default false,
  add column if not exists verification_type text,
  add column if not exists verification_name text,
  add column if not exists verification_value text,
  add column if not exists vercel_domain_error text,
  add column if not exists dns_status text not null default 'pending',
  add column if not exists app_status text not null default 'pending';

update public.businesses
set
  verification_required = coalesce(verification_required, false),
  verification_type = coalesce(verification_type, case when verification_required then 'TXT' else null end),
  verification_name = coalesce(verification_name, case when verification_required then '_vercel' else null end),
  verification_value = coalesce(verification_value, verification_token),
  vercel_domain_error = coalesce(vercel_domain_error, null),
  dns_status = coalesce(
    dns_status,
    case
      when domain_status = 'active' then 'verified'
      when domain_status in ('verified', 'ssl_ready', 'provider_added', 'dns_detected') then 'verified'
      else 'pending'
    end
  ),
  app_status = coalesce(
    app_status,
    case
      when domain_status = 'active' then 'ready'
      else 'pending'
    end
  )
where verification_required is null
   or verification_type is null
   or verification_name is null
   or verification_value is null
   or vercel_domain_error is null
   or dns_status is null
   or app_status is null;
