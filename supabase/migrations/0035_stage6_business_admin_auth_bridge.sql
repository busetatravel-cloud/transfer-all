alter table public.users
  add column if not exists auth_user_id uuid,
  add column if not exists last_login_at timestamptz;

create unique index if not exists uniq_users_auth_user_id
  on public.users (auth_user_id)
  where auth_user_id is not null;

create index if not exists idx_users_auth_user_id
  on public.users (auth_user_id);
