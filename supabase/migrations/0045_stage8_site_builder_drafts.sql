create table if not exists public.business_site_builder_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  draft_version integer not null default 1,
  base_published_version integer not null default 1,
  document jsonb not null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_site_builder_drafts_business_id_idx
  on public.business_site_builder_drafts (business_id);

do $$
begin
  begin
    alter table public.business_site_builder_drafts
      add constraint business_site_builder_drafts_draft_version_check
      check (draft_version > 0);
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_site_builder_drafts
      add constraint business_site_builder_drafts_base_published_version_check
      check (base_published_version > 0);
  exception
    when duplicate_object then null;
  end;
end;
$$;

drop trigger if exists trg_business_site_builder_drafts_updated_at on public.business_site_builder_drafts;
create trigger trg_business_site_builder_drafts_updated_at
before update on public.business_site_builder_drafts
for each row execute function touch_updated_at();

do $$
begin
  perform public.apply_uuid_tenant_rls('public.business_site_builder_drafts'::regclass);
end;
$$;
