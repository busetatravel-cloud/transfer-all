alter table users
  add column if not exists password_plaintext text,
  add column if not exists password_changed_at timestamptz not null default now();

drop function if exists create_business_with_admin(text, text, text, text, text, text, text);

create or replace function create_business_with_admin(
  p_name text,
  p_email text,
  p_admin_email text,
  p_admin_password text,
  p_admin_password_hash text,
  p_phone text default null,
  p_whatsapp text default null,
  p_domain text default null
)
returns jsonb
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
  changed_at timestamptz := now();
begin
  if normalized_business_email = '' or normalized_admin_email = '' then
    raise exception 'Business and admin email are required';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Business name is required';
  end if;

  if nullif(trim(coalesce(p_admin_password, '')), '') is null then
    raise exception 'Admin password is required';
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
    domain_status
  )
  values (
    p_name,
    normalized_business_email,
    nullif(p_phone, ''),
    nullif(p_whatsapp, ''),
    normalized_domain,
    'pending'::domain_status
  )
  returning id into new_business_id;

  insert into users (
    business_id,
    role,
    email,
    password_hash,
    password_plaintext,
    password_changed_at,
    active
  )
  values (
    new_business_id,
    'BUSINESS_ADMIN',
    normalized_admin_email,
    p_admin_password_hash,
    p_admin_password,
    changed_at,
    true
  )
  returning id into new_user_id;

  return jsonb_build_object(
    'business_id', new_business_id,
    'business_name', p_name,
    'business_email', normalized_business_email,
    'user_id', new_user_id,
    'admin_email', normalized_admin_email,
    'role', 'BUSINESS_ADMIN',
    'business', jsonb_build_object(
      'id', new_business_id,
      'name', p_name,
      'email', normalized_business_email
    ),
    'admin', jsonb_build_object(
      'id', new_user_id,
      'email', normalized_admin_email,
      'role', 'BUSINESS_ADMIN'
    )
  );
end;
$$;
