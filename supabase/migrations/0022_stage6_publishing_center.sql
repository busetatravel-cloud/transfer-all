create extension if not exists pgcrypto;

create table if not exists public.business_publication_revisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  version integer not null,
  status text not null default 'published',
  source text not null default 'manual',
  note text not null default '',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz
);

create unique index if not exists uniq_business_publication_revisions_business_version
  on public.business_publication_revisions (business_id, version);

create index if not exists idx_business_publication_revisions_business_id
  on public.business_publication_revisions (business_id, created_at desc);

create table if not exists public.business_publication_businesses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  source_id text not null default '',
  name text not null default '',
  email text not null default '',
  phone text,
  whatsapp text,
  logo_url text,
  active boolean not null default true,
  package_name text,
  package_start timestamptz,
  package_end timestamptz,
  domain text,
  domain_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_businesses_business_revision
  on public.business_publication_businesses (business_id, revision_id);

create table if not exists public.business_publication_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_button_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_profiles_business_revision
  on public.business_publication_profiles (business_id, revision_id);

create table if not exists public.business_publication_media_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  source_id text not null default '',
  kind text not null default '',
  source_url text not null default '',
  storage_path text not null default '',
  alt_text text not null default '',
  status text not null default 'placeholder',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_media_assets_business_revision
  on public.business_publication_media_assets (business_id, revision_id);

create table if not exists public.business_publication_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  source_id text not null default '',
  slug text not null default '',
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_services_business_revision
  on public.business_publication_services (business_id, revision_id);

create table if not exists public.business_publication_vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  source_id text not null default '',
  slug text not null default '',
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_vehicles_business_revision
  on public.business_publication_vehicles (business_id, revision_id);

create table if not exists public.business_publication_routes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  source_id text not null default '',
  slug text not null default '',
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_routes_business_revision
  on public.business_publication_routes (business_id, revision_id);

create table if not exists public.business_publication_blog_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  source_id text not null default '',
  title text not null default '',
  slug text not null default '',
  excerpt text not null default '',
  content text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_blog_posts_business_revision
  on public.business_publication_blog_posts (business_id, revision_id);

create table if not exists public.business_publication_seo (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  meta_title text not null default '',
  meta_description text not null default '',
  canonical_url text not null default '',
  default_locale text not null default 'tr',
  hreflang_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_publication_seo_business_revision
  on public.business_publication_seo (business_id, revision_id);

create table if not exists public.business_publication_locales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  source_id text not null default '',
  code text not null default '',
  name text not null default '',
  active boolean not null default true,
  published boolean not null default false,
  translation_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_business_publication_locales_revision_code
  on public.business_publication_locales (revision_id, code);

create index if not exists idx_business_publication_locales_business_revision
  on public.business_publication_locales (business_id, revision_id);
