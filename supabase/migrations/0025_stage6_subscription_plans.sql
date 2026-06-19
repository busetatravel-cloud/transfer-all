create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_price numeric(12,2) not null default 0,
  yearly_price numeric(12,2) not null default 0,
  trial_days integer not null default 0,
  features text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists monthly_price numeric(12,2) default 0,
  add column if not exists yearly_price numeric(12,2) default 0,
  add column if not exists trial_days integer default 0,
  add column if not exists features text[] default '{}'::text[],
  add column if not exists active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.businesses
  add column if not exists plan_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_plan_id_fkey'
  ) then
    alter table public.businesses
      add constraint businesses_plan_id_fkey
      foreign key (plan_id)
      references public.subscription_plans(id)
      on delete set null;
  end if;
end $$;

insert into public.subscription_plans (name, monthly_price, yearly_price, trial_days, features, active)
select 'Starter', 49, 490, 7, array['Rezervasyon yönetimi', 'Temel bildirimler', 'Standart destek'], true
where not exists (
  select 1 from public.subscription_plans where name = 'Starter'
);

insert into public.subscription_plans (name, monthly_price, yearly_price, trial_days, features, active)
select 'Pro', 99, 990, 14, array['Yayın merkezi', 'Görevler', 'Gelişmiş operasyon'], true
where not exists (
  select 1 from public.subscription_plans where name = 'Pro'
);

insert into public.subscription_plans (name, monthly_price, yearly_price, trial_days, features, active)
select 'Enterprise', 199, 1990, 30, array['Özel domain', 'Özel destek', 'Çoklu ekip yönetimi'], true
where not exists (
  select 1 from public.subscription_plans where name = 'Enterprise'
);

update public.businesses
set
  plan_id = coalesce(plan_id, null),
  updated_at = now()
where true;

create index if not exists subscription_plans_active_idx
  on public.subscription_plans (active);

create index if not exists subscription_plans_created_idx
  on public.subscription_plans (created_at desc);

create index if not exists businesses_plan_id_idx
  on public.businesses (plan_id);
