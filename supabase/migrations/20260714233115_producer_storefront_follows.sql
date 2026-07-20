create table if not exists public.producer_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, producer_profile_id)
);

create index if not exists producer_follows_follower_idx
  on public.producer_follows(follower_id, created_at desc);

create index if not exists producer_follows_profile_idx
  on public.producer_follows(producer_profile_id, created_at desc);

alter table public.producer_follows enable row level security;

drop policy if exists "producer_follows_select_own" on public.producer_follows;
create policy "producer_follows_select_own"
  on public.producer_follows for select to authenticated
  using ((select auth.uid()) = follower_id);

drop policy if exists "producer_follows_insert_own" on public.producer_follows;
create policy "producer_follows_insert_own"
  on public.producer_follows for insert to authenticated
  with check (
    (select auth.uid()) = follower_id
    and exists (
      select 1
      from public.producer_profiles profiles
      where profiles.id = producer_profile_id
        and profiles.status = 'approved'
        and profiles.is_public = true
    )
  );

drop policy if exists "producer_follows_delete_own" on public.producer_follows;
create policy "producer_follows_delete_own"
  on public.producer_follows for delete to authenticated
  using ((select auth.uid()) = follower_id);

create or replace function public.sync_producer_follow_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile_id uuid;
begin
  target_profile_id := coalesce(new.producer_profile_id, old.producer_profile_id);

  insert into public.producer_metrics (producer_profile_id, owner_id, followers)
  select
    profiles.id,
    profiles.owner_id,
    (select count(*) from public.producer_follows follows where follows.producer_profile_id = profiles.id)
  from public.producer_profiles profiles
  where profiles.id = target_profile_id
  on conflict (producer_profile_id)
  do update set
    followers = excluded.followers,
    updated_at = now();

  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_producer_follow_count() from public, anon, authenticated;

drop trigger if exists producer_follows_sync_count on public.producer_follows;
create trigger producer_follows_sync_count
  after insert or delete on public.producer_follows
  for each row execute function public.sync_producer_follow_count();

grant select, insert, delete on public.producer_follows to authenticated;
grant all on public.producer_follows to service_role;
