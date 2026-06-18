create unique index if not exists uniq_users_email_lower
  on users (lower(email));

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
    domain_status
  )
  values (
    p_name,
    normalized_business_email,
    nullif(p_phone, ''),
    nullif(p_whatsapp, ''),
    normalized_domain,
    case when normalized_domain is null then 'pending'::domain_status else 'pending'::domain_status end
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

create or replace function ensure_super_admin(
  p_email text,
  p_password_hash text
)
returns table (
  user_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_user_id uuid;
  existing_role user_role;
  normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if normalized_email = '' then
    raise exception 'Email is required';
  end if;

  if nullif(trim(coalesce(p_password_hash, '')), '') is null then
    raise exception 'Password hash is required';
  end if;

  select id, role
    into existing_user_id, existing_role
  from users
  where lower(email) = normalized_email
  limit 1;

  if found then
    if existing_role <> 'SUPER_ADMIN' then
      raise exception 'Email already exists with another role';
    end if;

    user_id := existing_user_id;
    created := false;
    return next;
    return;
  end if;

  insert into users (
    business_id,
    role,
    email,
    password_hash,
    active
  )
  values (
    null,
    'SUPER_ADMIN',
    normalized_email,
    p_password_hash,
    true
  )
  returning id into user_id;

  created := true;
  return next;
end;
$$;
