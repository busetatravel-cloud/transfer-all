create extension if not exists pgcrypto;

create table if not exists public.business_content_translations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  locale_code text not null,
  section text not null,
  source_id text not null default '',
  field_key text not null,
  source_text text not null default '',
  translated_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_business_content_translations_lookup
  on public.business_content_translations (
    business_id,
    locale_code,
    section,
    source_id,
    field_key
  );

create index if not exists idx_business_content_translations_business_locale
  on public.business_content_translations (business_id, locale_code, section);

create table if not exists public.business_publication_translations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null references public.business_publication_revisions(id) on delete cascade,
  locale_code text not null,
  section text not null,
  source_id text not null default '',
  field_key text not null,
  source_text text not null default '',
  translated_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_business_publication_translations_lookup
  on public.business_publication_translations (
    business_id,
    revision_id,
    locale_code,
    section,
    source_id,
    field_key
  );

create index if not exists idx_business_publication_translations_business_revision
  on public.business_publication_translations (business_id, revision_id, locale_code);
