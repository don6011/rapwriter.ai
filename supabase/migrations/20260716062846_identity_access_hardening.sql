do $$
begin
  create type public.app_role as enum ('artist', 'producer', 'admin');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists user_roles_role_user_idx
  on public.user_roles (role, user_id);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.user_roles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.user_roles from authenticated;
grant select on table public.user_roles to authenticated;
grant all on table public.user_roles to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.grant_artist_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role, granted_by)
  values (new.id, 'artist'::public.app_role, new.id)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

create or replace function private.grant_producer_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role, granted_by)
  values (new.owner_id, 'producer'::public.app_role, new.owner_id)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

revoke execute on function private.grant_artist_role() from public, anon, authenticated;
revoke execute on function private.grant_producer_role() from public, anon, authenticated;
grant execute on function private.grant_artist_role() to service_role;
grant execute on function private.grant_producer_role() to service_role;

drop trigger if exists on_auth_user_role_created on auth.users;
create trigger on_auth_user_role_created
  after insert on auth.users
  for each row execute function private.grant_artist_role();

drop trigger if exists on_producer_profile_role_created on public.producer_profiles;
create trigger on_producer_profile_role_created
  after insert on public.producer_profiles
  for each row execute function private.grant_producer_role();

insert into public.user_roles (user_id, role, granted_by)
select users.id, 'artist'::public.app_role, users.id
from auth.users as users
on conflict (user_id, role) do nothing;

insert into public.user_roles (user_id, role, granted_by)
select profiles.owner_id, 'producer'::public.app_role, profiles.owner_id
from public.producer_profiles as profiles
on conflict (user_id, role) do nothing;

insert into public.user_roles (user_id, role, granted_by)
select users.id, 'admin'::public.app_role, users.id
from auth.users as users
where lower(users.email) = lower('ghinko88@gmail.com')
on conflict (user_id, role) do nothing;

update public.profiles as profiles
set account_type = 'admin'
from auth.users as users
where profiles.id = users.id
  and lower(users.email) = lower('ghinko88@gmail.com');
