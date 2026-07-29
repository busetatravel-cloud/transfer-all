with target_tables(schema_name, table_name) as (
  values
    ('public', 'requests'),
    ('public', 'pricing_rules'),
    ('public', 'payments'),
    ('public', 'drivers'),
    ('public', 'vehicles'),
    ('public', 'reservation_assignments'),
    ('public', 'business_profiles'),
    ('public', 'business_services'),
    ('public', 'business_vehicles'),
    ('public', 'business_routes'),
    ('public', 'business_blog_posts'),
    ('public', 'business_seo'),
    ('public', 'business_locales'),
    ('public', 'business_media_assets'),
    ('public', 'business_analytics_events'),
    ('public', 'business_customers'),
    ('public', 'business_tasks'),
    ('public', 'business_notifications'),
    ('public', 'business_export_logs'),
    ('public', 'business_vouchers'),
    ('public', 'business_publication_revisions'),
    ('public', 'business_publication_businesses'),
    ('public', 'business_publication_profiles'),
    ('public', 'business_publication_media_assets'),
    ('public', 'business_publication_services'),
    ('public', 'business_publication_vehicles'),
    ('public', 'business_publication_routes'),
    ('public', 'business_publication_blog_posts'),
    ('public', 'business_publication_seo'),
    ('public', 'business_publication_locales'),
    ('public', 'business_content_translations'),
    ('public', 'business_publication_translations'),
    ('public', 'audit_logs'),
    ('public', 'business_voucher_delivery_logs')
)
select
  tt.schema_name as schema,
  tt.table_name as table,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(c.relforcerowsecurity, false) as force_rls_enabled,
  count(p.*)::int as policy_count,
  coalesce(bool_or(p.cmd in ('SELECT', 'ALL')), false) as has_select_policy,
  coalesce(bool_or(p.cmd in ('INSERT', 'ALL')), false) as has_insert_policy,
  coalesce(bool_or(p.cmd in ('UPDATE', 'ALL')), false) as has_update_policy,
  coalesce(bool_or(p.cmd in ('DELETE', 'ALL')), false) as has_delete_policy,
  case
    when bool_or(p.cmd in ('SELECT', 'ALL')) then null
    else 'missing SELECT policy'
  end as select_status,
  case
    when bool_or(p.cmd in ('INSERT', 'ALL')) then null
    else 'missing INSERT policy'
  end as insert_status,
  case
    when bool_or(p.cmd in ('UPDATE', 'ALL')) then null
    else 'missing UPDATE policy'
  end as update_status,
  case
    when bool_or(p.cmd in ('DELETE', 'ALL')) then null
    else 'missing DELETE policy'
  end as delete_status
from target_tables tt
left join pg_class c
  on c.relname = tt.table_name
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = tt.schema_name
left join pg_policies p
  on p.schemaname = tt.schema_name
 and p.tablename = tt.table_name
group by
  tt.schema_name,
  tt.table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
order by
  tt.schema_name,
  tt.table_name;
