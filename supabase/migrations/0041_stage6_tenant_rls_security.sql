create extension if not exists pgcrypto;

create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.business_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.role = 'BUSINESS_ADMIN'
    and coalesce(u.active, true)
    and u.deleted_at is null
  order by u.updated_at desc
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role = 'SUPER_ADMIN'
      and coalesce(u.active, true)
      and u.deleted_at is null
  );
$$;

create or replace function public.apply_uuid_tenant_rls(target_table regclass)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  table_name text := format('%s', target_table);
  policy_prefix text := replace(target_table::text, '.', '_');
begin
  execute format('grant select, insert, update, delete on %s to authenticated', table_name);
  execute format('alter table %s enable row level security', table_name);
  execute format('alter table %s force row level security', table_name);

  execute format('drop policy if exists %I_select_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_select_tenant on %s for select using (public.is_super_admin() or business_id = public.current_business_id())',
    policy_prefix,
    table_name
  );

  execute format('drop policy if exists %I_insert_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_insert_tenant on %s for insert with check (public.is_super_admin() or business_id = public.current_business_id())',
    policy_prefix,
    table_name
  );

  execute format('drop policy if exists %I_update_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_update_tenant on %s for update using (public.is_super_admin() or business_id = public.current_business_id()) with check (public.is_super_admin() or business_id = public.current_business_id())',
    policy_prefix,
    table_name
  );

  execute format('drop policy if exists %I_delete_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_delete_tenant on %s for delete using (public.is_super_admin() or business_id = public.current_business_id())',
    policy_prefix,
    table_name
  );
end;
$$;

create or replace function public.apply_text_tenant_rls(target_table regclass)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  table_name text := format('%s', target_table);
  policy_prefix text := replace(target_table::text, '.', '_');
begin
  execute format('grant select, insert, update, delete on %s to authenticated', table_name);
  execute format('alter table %s enable row level security', table_name);
  execute format('alter table %s force row level security', table_name);

  execute format('drop policy if exists %I_select_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_select_tenant on %s for select using (public.is_super_admin() or business_id = public.current_business_id()::text)',
    policy_prefix,
    table_name
  );

  execute format('drop policy if exists %I_insert_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_insert_tenant on %s for insert with check (public.is_super_admin() or business_id = public.current_business_id()::text)',
    policy_prefix,
    table_name
  );

  execute format('drop policy if exists %I_update_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_update_tenant on %s for update using (public.is_super_admin() or business_id = public.current_business_id()::text) with check (public.is_super_admin() or business_id = public.current_business_id()::text)',
    policy_prefix,
    table_name
  );

  execute format('drop policy if exists %I_delete_tenant on %s', policy_prefix, table_name);
  execute format(
    'create policy %I_delete_tenant on %s for delete using (public.is_super_admin() or business_id = public.current_business_id()::text)',
    policy_prefix,
    table_name
  );
end;
$$;

revoke all on function public.current_business_id() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.apply_uuid_tenant_rls(regclass) from public;
revoke all on function public.apply_text_tenant_rls(regclass) from public;

grant execute on function public.current_business_id() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.apply_uuid_tenant_rls(regclass) to authenticated;
grant execute on function public.apply_text_tenant_rls(regclass) to authenticated;

grant select, insert, update, delete on public.businesses to authenticated;

alter table public.businesses enable row level security;
alter table public.businesses force row level security;

drop policy if exists public_businesses_select_tenant on public.businesses;
create policy public_businesses_select_tenant
  on public.businesses
  for select
  using (public.is_super_admin() or id = public.current_business_id());

drop policy if exists public_businesses_insert_tenant on public.businesses;
create policy public_businesses_insert_tenant
  on public.businesses
  for insert
  with check (public.is_super_admin());

drop policy if exists public_businesses_update_tenant on public.businesses;
create policy public_businesses_update_tenant
  on public.businesses
  for update
  using (public.is_super_admin() or id = public.current_business_id())
  with check (public.is_super_admin() or id = public.current_business_id());

drop policy if exists public_businesses_delete_tenant on public.businesses;
create policy public_businesses_delete_tenant
  on public.businesses
  for delete
  using (public.is_super_admin());

do $$
begin
  raise notice 'tenant_rls_security: scanning public.business_voucher_delivery_logs for unmatched business ids';
  if exists (
    select 1
    from public.business_voucher_delivery_logs l
    left join public.businesses b on b.id::text = l.business_id
    where nullif(trim(l.business_id), '') is not null
      and l.business_id <> 'system'
      and b.id is null
  ) then
    raise notice 'tenant_rls_security: orphan business_voucher_delivery_logs rows found';
  end if;

  raise notice 'tenant_rls_security: scanning public.audit_logs for unmatched business ids';
  if exists (
    select 1
    from public.audit_logs l
    left join public.businesses b on b.id::text = l.business_id
    where nullif(trim(l.business_id), '') is not null
      and l.business_id <> 'system'
      and b.id is null
  ) then
    raise notice 'tenant_rls_security: orphan audit_logs rows found';
  end if;
end;
$$;

do $$
begin
  begin
    alter table public.requests
      add constraint requests_business_id_id_key unique (business_id, id);
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.drivers
      add constraint drivers_business_id_id_key unique (business_id, id);
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.vehicles
      add constraint vehicles_business_id_id_key unique (business_id, id);
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_revisions
      add constraint business_publication_revisions_business_id_id_key unique (business_id, id);
  exception
    when duplicate_object then null;
  end;
end;
$$;

do $$
begin
  begin
    alter table public.payments
      add constraint payments_business_reservation_fk
      foreign key (business_id, reservation_id)
      references public.requests (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.reservation_assignments
      add constraint reservation_assignments_business_reservation_fk
      foreign key (business_id, reservation_id)
      references public.requests (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.reservation_assignments
      add constraint reservation_assignments_business_driver_fk
      foreign key (business_id, driver_id)
      references public.drivers (business_id, id)
      on delete set null
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.reservation_assignments
      add constraint reservation_assignments_business_vehicle_fk
      foreign key (business_id, vehicle_id)
      references public.vehicles (business_id, id)
      on delete set null
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_vouchers
      add constraint business_vouchers_business_request_fk
      foreign key (business_id, request_id)
      references public.requests (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_businesses
      add constraint business_publication_businesses_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_profiles
      add constraint business_publication_profiles_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_media_assets
      add constraint business_publication_media_assets_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_services
      add constraint business_publication_services_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_vehicles
      add constraint business_publication_vehicles_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_routes
      add constraint business_publication_routes_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_blog_posts
      add constraint business_publication_blog_posts_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_seo
      add constraint business_publication_seo_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_locales
      add constraint business_publication_locales_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_translations
      add constraint business_publication_translations_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object then null;
  end;
end;
$$;

do $$
begin
  perform public.apply_uuid_tenant_rls('public.requests'::regclass);
  perform public.apply_uuid_tenant_rls('public.pricing_rules'::regclass);
  perform public.apply_uuid_tenant_rls('public.payments'::regclass);
  perform public.apply_uuid_tenant_rls('public.drivers'::regclass);
  perform public.apply_uuid_tenant_rls('public.vehicles'::regclass);
  perform public.apply_uuid_tenant_rls('public.reservation_assignments'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_profiles'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_services'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_vehicles'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_routes'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_blog_posts'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_seo'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_locales'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_media_assets'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_analytics_events'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_customers'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_tasks'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_notifications'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_export_logs'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_vouchers'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_revisions'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_businesses'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_profiles'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_media_assets'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_services'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_vehicles'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_routes'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_blog_posts'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_seo'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_locales'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_content_translations'::regclass);
  perform public.apply_uuid_tenant_rls('public.business_publication_translations'::regclass);
  perform public.apply_text_tenant_rls('public.audit_logs'::regclass);
  perform public.apply_text_tenant_rls('public.business_voucher_delivery_logs'::regclass);
end;
$$;
