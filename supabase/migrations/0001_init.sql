create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('SUPER_ADMIN', 'BUSINESS_ADMIN');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type domain_status as enum ('pending', 'verified', 'active');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type request_status as enum ('new', 'in_progress', 'completed', 'archived');
exception
  when duplicate_object then null;
end $$;

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  whatsapp text,
  logo_url text,
  active boolean not null default true,
  package_name text,
  package_start timestamptz,
  package_end timestamptz,
  domain text unique,
  domain_status domain_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_businesses_email_lower
  on businesses (lower(email));
create unique index if not exists uniq_businesses_domain_lower
  on businesses (lower(domain));

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  role user_role not null,
  email text not null unique,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_name text not null,
  phone text,
  email text,
  message text not null,
  status request_status not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_users_business_id on users (business_id);
create index if not exists idx_requests_business_id on requests (business_id);
create unique index if not exists uniq_primary_business_admin
  on users (business_id)
  where role = 'BUSINESS_ADMIN' and business_id is not null;

create table if not exists business_profiles (
  business_id uuid primary key references businesses(id) on delete cascade,
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_button_text text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  slug text not null default '',
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uniq_business_services_slug
  on business_services (business_id, slug);

create table if not exists business_vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  slug text not null default '',
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uniq_business_vehicles_slug
  on business_vehicles (business_id, slug);

create table if not exists business_routes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  slug text not null default '',
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uniq_business_routes_slug
  on business_routes (business_id, slug);

create table if not exists business_blog_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  slug text not null,
  excerpt text not null default '',
  content text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create table if not exists business_seo (
  business_id uuid primary key references businesses(id) on delete cascade,
  meta_title text not null default '',
  meta_description text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists business_locales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  published boolean not null default false,
  translation_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create or replace function create_business_with_admin(
  p_name text,
  p_email text,
  p_phone text default null,
  p_whatsapp text default null,
  p_domain text default null,
  p_admin_email text,
  p_admin_password_hash text
)
returns table (
  business_id uuid,
  user_id uuid
)
language plpgsql
as $$
declare
  new_business_id uuid;
  new_user_id uuid;
begin
  if exists (
    select 1
    from businesses
    where lower(email) = lower(p_email)
       or (nullif(p_domain, '') is not null and lower(domain) = lower(nullif(p_domain, '')))
  ) then
    raise exception 'Business email or domain already exists';
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
    p_email,
    p_phone,
    p_whatsapp,
    nullif(p_domain, ''),
    case when nullif(p_domain, '') is null then 'pending' else 'pending' end
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
    p_admin_email,
    p_admin_password_hash,
    true
  )
  returning id into new_user_id;

  business_id := new_business_id;
  user_id := new_user_id;
  return next;
end;
$$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_businesses_updated_at on businesses;
create trigger trg_businesses_updated_at
before update on businesses
for each row execute function touch_updated_at();

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function touch_updated_at();

drop trigger if exists trg_business_profiles_updated_at on business_profiles;
create trigger trg_business_profiles_updated_at
before update on business_profiles
for each row execute function touch_profile_updated_at();

drop trigger if exists trg_business_services_updated_at on business_services;
create trigger trg_business_services_updated_at
before update on business_services
for each row execute function touch_updated_at();

drop trigger if exists trg_business_vehicles_updated_at on business_vehicles;
create trigger trg_business_vehicles_updated_at
before update on business_vehicles
for each row execute function touch_updated_at();

drop trigger if exists trg_business_routes_updated_at on business_routes;
create trigger trg_business_routes_updated_at
before update on business_routes
for each row execute function touch_updated_at();

drop trigger if exists trg_business_blog_posts_updated_at on business_blog_posts;
create trigger trg_business_blog_posts_updated_at
before update on business_blog_posts
for each row execute function touch_updated_at();

drop trigger if exists trg_business_seo_updated_at on business_seo;
create trigger trg_business_seo_updated_at
before update on business_seo
for each row execute function touch_profile_updated_at();

drop trigger if exists trg_business_locales_updated_at on business_locales;
create trigger trg_business_locales_updated_at
before update on business_locales
for each row execute function touch_updated_at();
