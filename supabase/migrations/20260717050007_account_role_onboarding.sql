alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add column if not exists role_onboarding_completed boolean not null default false;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('artist', 'producer', 'artist_producer', 'admin'));

update public.profiles as profile
set account_type = case
      when profile.account_type = 'admin' then 'admin'
      when exists (
        select 1
        from public.producer_profiles as producer
        where producer.owner_id = profile.id
      ) then 'artist_producer'
      else 'artist'
    end,
    role_onboarding_completed = true;

grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;
