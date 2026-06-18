alter table users
  add column if not exists deleted_at timestamptz;

drop index if exists uniq_primary_business_admin;
create unique index if not exists uniq_primary_business_admin
  on users (business_id)
  where role = 'BUSINESS_ADMIN'
    and business_id is not null
    and deleted_at is null;
