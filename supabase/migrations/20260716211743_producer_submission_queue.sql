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
          and profile.status in ('submitted', 'approved')
          and (profile.status = 'submitted' or profile.is_public = true)
          and business.onboarding_completed = true
          and nullif(btrim(coalesce(business.business_email, '')), '') is not null
      ) then
        raise exception 'Submit your completed producer profile before submitting beats'
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
