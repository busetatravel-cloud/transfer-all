begin;

do $$
declare
  issue_count bigint;
begin
  select count(*)
  into issue_count
  from (
    select 1
    from public.payments p
    join public.requests r on r.id = p.reservation_id
    where p.business_id is distinct from r.business_id

    union all
    select 1
    from public.reservation_assignments a
    join public.requests r on r.id = a.reservation_id
    where a.business_id is distinct from r.business_id

    union all
    select 1
    from public.reservation_assignments a
    join public.drivers d on d.id = a.driver_id
    where a.driver_id is not null and a.business_id is distinct from d.business_id

    union all
    select 1
    from public.reservation_assignments a
    join public.vehicles v on v.id = a.vehicle_id
    where a.vehicle_id is not null and a.business_id is distinct from v.business_id

    union all
    select 1
    from public.business_vouchers v
    join public.requests r on r.id = v.request_id
    where v.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_businesses x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_profiles x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_media_assets x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_services x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_vehicles x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_routes x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_blog_posts x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_seo x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_locales x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id

    union all
    select 1
    from public.business_publication_translations x
    join public.business_publication_revisions r on r.id = x.revision_id
    where x.business_id is distinct from r.business_id
  ) issues;

  if issue_count > 0 then
    raise exception
      'tenant preflight is not clean. Run validate_tenant_security_preflight.sql first and fix all issues before validating constraints.';
  end if;
end;
$$;

alter table public.payments validate constraint payments_business_reservation_fk;
alter table public.reservation_assignments validate constraint reservation_assignments_business_reservation_fk;
alter table public.reservation_assignments validate constraint reservation_assignments_business_driver_fk;
alter table public.reservation_assignments validate constraint reservation_assignments_business_vehicle_fk;
alter table public.business_vouchers validate constraint business_vouchers_business_request_fk;
alter table public.business_publication_businesses validate constraint business_publication_businesses_business_revision_fk;
alter table public.business_publication_profiles validate constraint business_publication_profiles_business_revision_fk;
alter table public.business_publication_media_assets validate constraint business_publication_media_assets_business_revision_fk;
alter table public.business_publication_services validate constraint business_publication_services_business_revision_fk;
alter table public.business_publication_vehicles validate constraint business_publication_vehicles_business_revision_fk;
alter table public.business_publication_routes validate constraint business_publication_routes_business_revision_fk;
alter table public.business_publication_blog_posts validate constraint business_publication_blog_posts_business_revision_fk;
alter table public.business_publication_seo validate constraint business_publication_seo_business_revision_fk;
alter table public.business_publication_locales validate constraint business_publication_locales_business_revision_fk;
alter table public.business_publication_translations validate constraint business_publication_translations_business_revision_fk;

commit;
