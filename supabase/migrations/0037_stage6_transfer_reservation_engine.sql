alter table if exists requests
  add column if not exists passenger_name text,
  add column if not exists trip_type text not null default 'one_way',
  add column if not exists hotel_name_or_address text,
  add column if not exists child_seat_requested boolean not null default false,
  add column if not exists extra_baggage_requested boolean not null default false;

update requests
set passenger_name = coalesce(nullif(trim(passenger_name), ''), customer_name)
where passenger_name is null or trim(passenger_name) = '';

update requests
set trip_type = coalesce(nullif(trim(trip_type), ''), 'one_way')
where trip_type is null or trim(trip_type) = '';
