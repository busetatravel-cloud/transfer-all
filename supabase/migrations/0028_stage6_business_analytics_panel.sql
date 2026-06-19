alter table public.business_analytics_events
  add column if not exists page_type text not null default 'page',
  add column if not exists user_agent text;

create index if not exists idx_business_analytics_events_page_type
  on public.business_analytics_events (business_id, page_type, created_at desc);
