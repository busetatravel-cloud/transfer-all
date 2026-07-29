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
  verification_required = coalesce(
    verification_required,
    false
  ),

  verification_type = coalesce(
    verification_type,
    case
      when verification_required then 'TXT'
      else null
    end
  ),

  verification_name = coalesce(
    verification_name,
    case
      when verification_required then '_vercel'
      else null
    end
  ),

  verification_value = coalesce(
    verification_value,
    verification_token
  ),

  dns_status = case
    when domain_status::text in (
      'active',
      'verified',
      'ssl_ready',
      'provider_added',
      'dns_detected'
    )
      then 'verified'
    else coalesce(
      nullif(trim(dns_status), ''),
      'pending'
    )
  end,

  app_status = case
    when domain_status::text = 'active'
      then 'ready'
    else coalesce(
      nullif(trim(app_status), ''),
      'pending'
    )
  end

where verification_required is null
   or verification_type is null
   or verification_name is null
   or verification_value is null
   or dns_status is null
   or trim(dns_status) = ''
   or app_status is null
   or trim(app_status) = '';
   