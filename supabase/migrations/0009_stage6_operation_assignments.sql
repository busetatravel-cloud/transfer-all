alter table if exists requests
  add column if not exists assigned_vehicle text,
  add column if not exists driver_name text;

create index if not exists idx_requests_assigned_vehicle
  on requests (business_id, assigned_vehicle, created_at desc);

create index if not exists idx_requests_driver_name
  on requests (business_id, driver_name, created_at desc);
