alter table public.producer_beats
  drop constraint if exists producer_beats_status_check;

alter table public.producer_beats
  add constraint producer_beats_status_check
  check (status in ('draft', 'submitted', 'approved', 'rejected', 'archived'));

create index if not exists producer_beats_owner_status_updated_idx
  on public.producer_beats(owner_id, status, updated_at desc);

create or replace function public.protect_producer_beat_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    if new.status not in ('draft', 'submitted', 'archived') then
      new.status := case when tg_op = 'UPDATE' then old.status else 'draft' end;
    end if;
    if tg_op = 'UPDATE' then
      new.admin_notes := old.admin_notes;
      new.metadata := (coalesce(new.metadata, '{}'::jsonb) - 'featured' - 'reviewed_by' - 'reviewed_at')
        || jsonb_strip_nulls(jsonb_build_object(
          'featured', old.metadata -> 'featured',
          'reviewed_by', old.metadata -> 'reviewed_by',
          'reviewed_at', old.metadata -> 'reviewed_at'
        ));
    else
      new.admin_notes := null;
      new.metadata := coalesce(new.metadata, '{}'::jsonb) - 'featured' - 'reviewed_by' - 'reviewed_at';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.save_producer_playlist(
  p_playlist_id uuid,
  p_title text,
  p_description text,
  p_beat_ids uuid[],
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_value uuid := (select auth.uid());
  profile_value uuid;
  playlist_row public.producer_playlists%rowtype;
  requested_count integer := coalesce(cardinality(p_beat_ids), 0);
  owned_count integer;
  approved_count integer;
  items_value jsonb;
begin
  if owner_value is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if btrim(coalesce(p_title, '')) = '' or length(btrim(p_title)) > 120 then
    raise exception 'Playlist title is required' using errcode = '22023';
  end if;

  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'Invalid playlist status' using errcode = '22023';
  end if;

  if requested_count <> (
    select count(distinct selected.beat_id)
    from unnest(coalesce(p_beat_ids, '{}'::uuid[])) as selected(beat_id)
  ) then
    raise exception 'A beat can only appear once in a playlist' using errcode = '22023';
  end if;

  select id into profile_value
  from public.producer_profiles
  where owner_id = owner_value;

  if profile_value is null then
    raise exception 'Complete producer onboarding first' using errcode = 'P0002';
  end if;

  select count(*)::integer,
         count(*) filter (where status = 'approved')::integer
    into owned_count, approved_count
  from public.producer_beats
  where owner_id = owner_value
    and id = any(coalesce(p_beat_ids, '{}'::uuid[]));

  if owned_count <> requested_count then
    raise exception 'Playlist contains an unavailable beat' using errcode = '42501';
  end if;

  if p_status = 'published' and (requested_count = 0 or approved_count <> requested_count) then
    raise exception 'Only approved beats can be published' using errcode = '22023';
  end if;

  if p_playlist_id is null then
    insert into public.producer_playlists (
      owner_id,
      producer_profile_id,
      title,
      description,
      status
    ) values (
      owner_value,
      profile_value,
      btrim(p_title),
      nullif(btrim(coalesce(p_description, '')), ''),
      p_status
    ) returning * into playlist_row;
  else
    update public.producer_playlists
    set title = btrim(p_title),
        description = nullif(btrim(coalesce(p_description, '')), ''),
        status = p_status
    where id = p_playlist_id
      and owner_id = owner_value
    returning * into playlist_row;

    if playlist_row.id is null then
      raise exception 'Playlist not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.producer_playlist_items
  where playlist_id = playlist_row.id;

  insert into public.producer_playlist_items (playlist_id, beat_id, position)
  select playlist_row.id, selected.beat_id, (selected.ordinality - 1)::integer
  from unnest(coalesce(p_beat_ids, '{}'::uuid[])) with ordinality as selected(beat_id, ordinality);

  select coalesce(
    jsonb_agg(
      jsonb_build_object('beat_id', items.beat_id, 'position', items.position)
      order by items.position
    ),
    '[]'::jsonb
  ) into items_value
  from public.producer_playlist_items as items
  where items.playlist_id = playlist_row.id;

  return to_jsonb(playlist_row) || jsonb_build_object('producer_playlist_items', items_value);
end;
$$;

revoke all on function public.save_producer_playlist(uuid, text, text, uuid[], text) from public, anon;
grant execute on function public.save_producer_playlist(uuid, text, text, uuid[], text) to authenticated, service_role;
