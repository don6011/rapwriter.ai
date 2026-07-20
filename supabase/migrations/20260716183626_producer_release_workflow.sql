alter table public.producer_profiles
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.producer_beats
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

update public.producer_profiles
set submitted_at = coalesce(submitted_at, updated_at)
where status in ('submitted', 'approved', 'rejected');

update public.producer_beats
set submitted_at = coalesce(submitted_at, updated_at)
where status in ('submitted', 'approved', 'rejected');

create table public.producer_release_reviews (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('profile', 'beat')),
  target_id uuid not null,
  producer_owner_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid references public.producer_profiles(id) on delete cascade,
  beat_id uuid references public.producer_beats(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  from_status text not null,
  to_status text not null,
  notes text,
  blockers text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (
    (target_type = 'profile' and producer_profile_id = target_id and beat_id is null)
    or
    (target_type = 'beat' and beat_id = target_id and producer_profile_id is not null)
  )
);

create index producer_release_reviews_owner_created_idx
  on public.producer_release_reviews (producer_owner_id, created_at desc);

create index producer_release_reviews_target_created_idx
  on public.producer_release_reviews (target_type, target_id, created_at desc);

alter table public.producer_release_reviews enable row level security;

create policy "producer_release_reviews_select_own"
  on public.producer_release_reviews
  for select
  to authenticated
  using ((select auth.uid()) = producer_owner_id);

revoke all on table public.producer_release_reviews from anon;
revoke insert, update, delete, truncate, references, trigger on table public.producer_release_reviews from authenticated;
grant select on table public.producer_release_reviews to authenticated;
grant all on table public.producer_release_reviews to service_role;

drop policy if exists "producer_business_settings_insert_own" on public.producer_business_settings;
create policy "producer_business_settings_insert_own"
  on public.producer_business_settings
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.producer_profiles as profile
      where profile.id = producer_profile_id
        and profile.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_business_settings_update_own" on public.producer_business_settings;
create policy "producer_business_settings_update_own"
  on public.producer_business_settings
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.producer_profiles as profile
      where profile.id = producer_profile_id
        and profile.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_beats_insert_own" on public.producer_beats;
create policy "producer_beats_insert_own"
  on public.producer_beats
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.producer_profiles as profile
      where profile.id = producer_profile_id
        and profile.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_beats_update_own" on public.producer_beats;
create policy "producer_beats_update_own"
  on public.producer_beats
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.producer_profiles as profile
      where profile.id = producer_profile_id
        and profile.owner_id = (select auth.uid())
    )
  );

create or replace function public.protect_producer_profile_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.status := 'draft';
    new.verified := false;
    new.is_public := false;
    new.submitted_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

create or replace function public.protect_producer_business_review_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    update public.producer_profiles
    set
      status = 'draft',
      verified = false,
      is_public = false,
      submitted_at = null,
      reviewed_at = null,
      reviewed_by = null
    where id = new.producer_profile_id
      and owner_id = new.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists producer_business_settings_protect_review_state on public.producer_business_settings;
create trigger producer_business_settings_protect_review_state
  after insert or update on public.producer_business_settings
  for each row execute function public.protect_producer_business_review_state();

create or replace function public.protect_producer_beat_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  valid_license_count integer;
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.status not in ('draft', 'submitted') then
        new.status := 'draft';
      end if;
    elsif new.status not in ('submitted', 'archived') then
      new.status := 'draft';
    end if;

    if new.status = 'submitted' then
      if not exists (
        select 1
        from public.producer_profiles as profile
        join public.producer_business_settings as business
          on business.producer_profile_id = profile.id
        where profile.id = new.producer_profile_id
          and profile.owner_id = new.owner_id
          and profile.status = 'approved'
          and profile.is_public = true
          and business.onboarding_completed = true
          and nullif(btrim(coalesce(business.business_email, '')), '') is not null
      ) then
        raise exception 'Producer profile approval is required before submitting beats'
          using errcode = '22023';
      end if;

      select count(distinct tier ->> 'license')::integer
        into valid_license_count
      from jsonb_array_elements(coalesce(new.license_tiers, '[]'::jsonb)) as tier
      where tier ->> 'license' in ('Lease', 'Premium Lease', 'Exclusive')
        and jsonb_typeof(tier -> 'price') = 'number'
        and (tier ->> 'price')::numeric > 0;

      if nullif(btrim(coalesce(new.title, '')), '') is null
        or new.bpm is null
        or new.bpm < 40
        or new.bpm > 220
        or new.duration_seconds < 1
        or nullif(btrim(coalesce(new.genre, '')), '') is null
        or nullif(btrim(coalesce(new.mood, '')), '') is null
        or nullif(btrim(coalesce(new.region, '')), '') is null
        or cardinality(coalesce(new.tags, '{}'::text[])) = 0
        or nullif(btrim(coalesce(new.audio_path, '')), '') is null
        or nullif(btrim(coalesce(new.artwork_path, '')), '') is null
        or valid_license_count <> 3
      then
        raise exception 'Beat must be release-ready before submission'
          using errcode = '22023';
      end if;
    end if;

    new.submitted_at := case when new.status = 'submitted' then now() else null end;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.admin_notes := case
      when new.status = 'submitted' then null
      when tg_op = 'UPDATE' then old.admin_notes
      else null
    end;
    new.metadata := case
      when tg_op = 'UPDATE' then coalesce(old.metadata, '{}'::jsonb)
      else coalesce(new.metadata, '{}'::jsonb)
    end - 'featured' - 'reviewed_by' - 'reviewed_at';
  end if;
  return new;
end;
$$;

create or replace function public.apply_producer_release_review(
  p_target_type text,
  p_target_id uuid,
  p_reviewer_id uuid,
  p_status text,
  p_notes text default null,
  p_blockers text[] default '{}',
  p_featured boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_status text;
  owner_id uuid;
  profile_id uuid;
  updated_row jsonb;
  updated_record record;
begin
  if p_target_type not in ('profile', 'beat') or p_status not in ('approved', 'rejected') then
    raise exception 'Invalid release review action' using errcode = '22023';
  end if;

  if p_target_type = 'profile' then
    select status, producer_profiles.owner_id, id
      into previous_status, owner_id, profile_id
    from public.producer_profiles
    where id = p_target_id
    for update;

    if owner_id is null then
      raise exception 'Producer profile not found' using errcode = 'P0002';
    end if;
    if previous_status <> 'submitted' then
      raise exception 'Only submitted producer profiles can be reviewed' using errcode = '22023';
    end if;

    update public.producer_profiles
    set
      status = p_status,
      verified = p_status = 'approved',
      is_public = p_status = 'approved',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
    where id = p_target_id
    returning * into updated_record;
    updated_row := to_jsonb(updated_record);

    insert into public.producer_release_reviews (
      target_type, target_id, producer_owner_id, producer_profile_id,
      reviewer_id, from_status, to_status, notes, blockers
    )
    values (
      'profile', p_target_id, owner_id, profile_id,
      p_reviewer_id, previous_status, p_status, nullif(trim(p_notes), ''), coalesce(p_blockers, '{}')
    );
  else
    select producer_beats.status, producer_beats.owner_id, producer_profile_id
      into previous_status, owner_id, profile_id
    from public.producer_beats
    where id = p_target_id
    for update;

    if owner_id is null then
      raise exception 'Producer beat not found' using errcode = 'P0002';
    end if;
    if previous_status <> 'submitted' then
      raise exception 'Only submitted beats can be reviewed' using errcode = '22023';
    end if;

    update public.producer_beats
    set
      status = p_status,
      admin_notes = nullif(trim(p_notes), ''),
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{featured}',
        to_jsonb(p_status = 'approved' and p_featured),
        true
      )
    where id = p_target_id
    returning * into updated_record;
    updated_row := to_jsonb(updated_record);

    insert into public.producer_release_reviews (
      target_type, target_id, producer_owner_id, producer_profile_id, beat_id,
      reviewer_id, from_status, to_status, notes, blockers
    )
    values (
      'beat', p_target_id, owner_id, profile_id, p_target_id,
      p_reviewer_id, previous_status, p_status, nullif(trim(p_notes), ''), coalesce(p_blockers, '{}')
    );
  end if;

  return updated_row;
end;
$$;

revoke execute on function public.apply_producer_release_review(text, uuid, uuid, text, text, text[], boolean)
  from public, anon, authenticated;
grant execute on function public.apply_producer_release_review(text, uuid, uuid, text, text, text[], boolean)
  to service_role;
