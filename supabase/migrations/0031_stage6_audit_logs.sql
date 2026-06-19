create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  actor_user_id text,
  actor_role text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs
  add column if not exists business_id text;

alter table public.audit_logs
  add column if not exists actor_user_id text;

alter table public.audit_logs
  add column if not exists actor_role text;

alter table public.audit_logs
  add column if not exists entity_type text;

alter table public.audit_logs
  add column if not exists entity_id text;

alter table public.audit_logs
  add column if not exists action text;

alter table public.audit_logs
  add column if not exists before jsonb;

alter table public.audit_logs
  add column if not exists after jsonb;

alter table public.audit_logs
  add column if not exists created_at timestamptz;

create index if not exists audit_logs_business_id_created_at_idx
  on public.audit_logs (business_id, created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_user_id, created_at desc);

