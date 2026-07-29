with issues as (
  select
    'requests'::text as schema_table,
    'business_id_null'::text as issue_type,
    count(*)::bigint as issue_count,
    coalesce(
      (
        select string_agg(id::text, ', ' order by id)
        from (
          select id
          from public.requests
          where business_id is null
          order by id
          limit 5
        ) sample
      ),
      ''
    ) as sample_record_ids
  from public.requests
  where business_id is null

  union all
  select
    'pricing_rules',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select id from public.pricing_rules r left join public.businesses b on b.id = r.business_id where b.id is null order by r.id limit 5) sample), '')
  from public.pricing_rules r
  left join public.businesses b on b.id = r.business_id
  where b.id is null

  union all
  select
    'payments',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select p.id from public.payments p left join public.businesses b on b.id = p.business_id where b.id is null order by p.id limit 5) sample), '')
  from public.payments p
  left join public.businesses b on b.id = p.business_id
  where b.id is null

  union all
  select
    'payments',
    'reservation_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select p.id from public.payments p join public.requests r on r.id = p.reservation_id where p.business_id is distinct from r.business_id order by p.id limit 5) sample), '')
  from public.payments p
  join public.requests r on r.id = p.reservation_id
  where p.business_id is distinct from r.business_id

  union all
  select
    'drivers',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select d.id from public.drivers d left join public.businesses b on b.id = d.business_id where b.id is null order by d.id limit 5) sample), '')
  from public.drivers d
  left join public.businesses b on b.id = d.business_id
  where b.id is null

  union all
  select
    'vehicles',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select v.id from public.vehicles v left join public.businesses b on b.id = v.business_id where b.id is null order by v.id limit 5) sample), '')
  from public.vehicles v
  left join public.businesses b on b.id = v.business_id
  where b.id is null

  union all
  select
    'reservation_assignments',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select a.id from public.reservation_assignments a left join public.businesses b on b.id = a.business_id where b.id is null order by a.id limit 5) sample), '')
  from public.reservation_assignments a
  left join public.businesses b on b.id = a.business_id
  where b.id is null

  union all
  select
    'reservation_assignments',
    'reservation_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select a.id from public.reservation_assignments a join public.requests r on r.id = a.reservation_id where a.business_id is distinct from r.business_id order by a.id limit 5) sample), '')
  from public.reservation_assignments a
  join public.requests r on r.id = a.reservation_id
  where a.business_id is distinct from r.business_id

  union all
  select
    'reservation_assignments',
    'driver_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select a.id from public.reservation_assignments a join public.drivers d on d.id = a.driver_id where a.driver_id is not null and a.business_id is distinct from d.business_id order by a.id limit 5) sample), '')
  from public.reservation_assignments a
  join public.drivers d on d.id = a.driver_id
  where a.driver_id is not null and a.business_id is distinct from d.business_id

  union all
  select
    'reservation_assignments',
    'vehicle_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select a.id from public.reservation_assignments a join public.vehicles v on v.id = a.vehicle_id where a.vehicle_id is not null and a.business_id is distinct from v.business_id order by a.id limit 5) sample), '')
  from public.reservation_assignments a
  join public.vehicles v on v.id = a.vehicle_id
  where a.vehicle_id is not null and a.business_id is distinct from v.business_id

  union all
  select
    'business_vouchers',
    'reservation_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select v.id from public.business_vouchers v join public.requests r on r.id = v.request_id where v.business_id is distinct from r.business_id order by v.id limit 5) sample), '')
  from public.business_vouchers v
  join public.requests r on r.id = v.request_id
  where v.business_id is distinct from r.business_id

  union all
  select
    'business_publication_revisions',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select r.id from public.business_publication_revisions r left join public.businesses b on b.id = r.business_id where b.id is null order by r.id limit 5) sample), '')
  from public.business_publication_revisions r
  left join public.businesses b on b.id = r.business_id
  where b.id is null

  union all
  select
    'business_publication_businesses',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_businesses x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_businesses x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_profiles',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_profiles x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_profiles x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_media_assets',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_media_assets x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_media_assets x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_services',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_services x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_services x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_vehicles',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_vehicles x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_vehicles x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_routes',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_routes x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_routes x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_blog_posts',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_blog_posts x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_blog_posts x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_seo',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_seo x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_seo x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_publication_locales',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_locales x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_locales x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_content_translations',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_content_translations x left join public.businesses b on b.id = x.business_id where b.id is null order by x.id limit 5) sample), '')
  from public.business_content_translations x
  left join public.businesses b on b.id = x.business_id
  where b.id is null

  union all
  select
    'business_publication_translations',
    'revision_tenant_mismatch',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_publication_translations x join public.business_publication_revisions r on r.id = x.revision_id where x.business_id is distinct from r.business_id order by x.id limit 5) sample), '')
  from public.business_publication_translations x
  join public.business_publication_revisions r on r.id = x.revision_id
  where x.business_id is distinct from r.business_id

  union all
  select
    'business_media_assets',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_media_assets x left join public.businesses b on b.id = x.business_id where b.id is null order by x.id limit 5) sample), '')
  from public.business_media_assets x
  left join public.businesses b on b.id = x.business_id
  where b.id is null

  union all
  select
    'business_analytics_events',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_analytics_events x left join public.businesses b on b.id = x.business_id where b.id is null order by x.id limit 5) sample), '')
  from public.business_analytics_events x
  left join public.businesses b on b.id = x.business_id
  where b.id is null

  union all
  select
    'business_customers',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_customers x left join public.businesses b on b.id = x.business_id where b.id is null order by x.id limit 5) sample), '')
  from public.business_customers x
  left join public.businesses b on b.id = x.business_id
  where b.id is null

  union all
  select
    'business_tasks',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_tasks x left join public.businesses b on b.id = x.business_id where b.id is null order by x.id limit 5) sample), '')
  from public.business_tasks x
  left join public.businesses b on b.id = x.business_id
  where b.id is null

  union all
  select
    'business_notifications',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_notifications x left join public.businesses b on b.id = x.business_id where b.id is null order by x.id limit 5) sample), '')
  from public.business_notifications x
  left join public.businesses b on b.id = x.business_id
  where b.id is null

  union all
  select
    'business_export_logs',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_export_logs x left join public.businesses b on b.id = x.business_id where b.id is null order by x.id limit 5) sample), '')
  from public.business_export_logs x
  left join public.businesses b on b.id = x.business_id
  where b.id is null

  union all
  select
    'audit_logs',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.audit_logs x left join public.businesses b on b.id::text = x.business_id where nullif(trim(x.business_id), '') is not null and x.business_id <> 'system' and b.id is null order by x.id limit 5) sample), '')
  from public.audit_logs x
  left join public.businesses b on b.id::text = x.business_id
  where nullif(trim(x.business_id), '') is not null
    and x.business_id <> 'system'
    and b.id is null

  union all
  select
    'business_voucher_delivery_logs',
    'business_id_orphan',
    count(*)::bigint,
    coalesce((select string_agg(id::text, ', ' order by id) from (select x.id from public.business_voucher_delivery_logs x left join public.businesses b on b.id::text = x.business_id where nullif(trim(x.business_id), '') is not null and x.business_id <> 'system' and b.id is null order by x.id limit 5) sample), '')
  from public.business_voucher_delivery_logs x
  left join public.businesses b on b.id::text = x.business_id
  where nullif(trim(x.business_id), '') is not null
    and x.business_id <> 'system'
    and b.id is null
)
select
  schema_table as table_name,
  issue_type,
  issue_count,
  sample_record_ids
from issues
where issue_count > 0
order by table_name, issue_type;
