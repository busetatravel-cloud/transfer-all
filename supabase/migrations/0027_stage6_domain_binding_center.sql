create extension if not exists pgcrypto;

do $$
begin
  alter type domain_status add value if not exists 'dns_detected';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type domain_status add value if not exists 'failed';
exception
  when duplicate_object then null;
end $$;

alter table public.businesses
  add column if not exists hostname text,
  add column if not exists verification_token text,
  add column if not exists verified_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists ssl_status text not null default 'pending';

update public.businesses
set
  hostname = coalesce(hostname, domain),
  verification_token = coalesce(verification_token, replace(gen_random_uuid()::text, '-', '')),
  verified_at = case
    when verified_at is not null then verified_at
    when domain_status in ('verified', 'active') then coalesce(updated_at, created_at)
    else verified_at
  end,
  activated_at = case
    when activated_at is not null then activated_at
    when domain_status = 'active' then coalesce(updated_at, created_at)
    else activated_at
  end,
  last_checked_at = coalesce(last_checked_at, updated_at, created_at),
  ssl_status = coalesce(ssl_status, case when domain_status = 'active' then 'active' else 'pending' end)
where hostname is distinct from coalesce(domain, hostname)
   or verification_token is null
   or verified_at is null
   or activated_at is null
   or last_checked_at is null
   or ssl_status is null;

create or replace function create_business_with_admin(
  p_name text,
  p_email text,
  p_admin_email text,
  p_admin_password_hash text,
  p_phone text default null,
  p_whatsapp text default null,
  p_domain text default null
)
returns table (
  business_id uuid,
  user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
  new_user_id uuid;
  normalized_business_email text := lower(trim(coalesce(p_email, '')));
  normalized_admin_email text := lower(trim(coalesce(p_admin_email, '')));
  normalized_domain text := nullif(lower(trim(coalesce(p_domain, ''))), '');
begin
  if normalized_business_email = '' or normalized_admin_email = '' then
    raise exception 'Business and admin email are required';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Business name is required';
  end if;

  if nullif(trim(coalesce(p_admin_password_hash, '')), '') is null then
    raise exception 'Admin password hash is required';
  end if;

  if exists (
    select 1
    from businesses
    where normalized_domain is not null
      and lower(domain) = normalized_domain
  ) then
    raise exception 'Business domain already exists';
  end if;

  if exists (
    select 1
    from users
    where lower(email) = normalized_admin_email
  ) then
    raise exception 'Admin email already exists';
  end if;

  insert into businesses (
    name,
    email,
    phone,
    whatsapp,
    domain,
    hostname,
    verification_token,
    verified_at,
    activated_at,
    last_checked_at,
    ssl_status,
    domain_status
  )
  values (
    p_name,
    normalized_business_email,
    nullif(p_phone, ''),
    nullif(p_whatsapp, ''),
    normalized_domain,
    normalized_domain,
    case when normalized_domain is null then null else replace(gen_random_uuid()::text, '-', '') end,
    null,
    null,
    case when normalized_domain is null then null else now() end,
    'pending',
    'pending'::domain_status
  )
  returning id into new_business_id;

  insert into users (
    business_id,
    role,
    email,
    password_hash,
    active
  )
  values (
    new_business_id,
    'BUSINESS_ADMIN',
    normalized_admin_email,
    p_admin_password_hash,
    true
  )
  returning id into new_user_id;

  business_id := new_business_id;
  user_id := new_user_id;
  return next;
end;
$$;
