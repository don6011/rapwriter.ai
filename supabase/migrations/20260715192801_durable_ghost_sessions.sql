-- Version aligned with the migration timestamp recorded by the linked project.
alter table public.ghost_studio_sessions
  add column if not exists revision bigint not null default 1,
  add column if not exists playback_position_seconds double precision not null default 0,
  add column if not exists studio_dna jsonb not null default '{}'::jsonb,
  add column if not exists client_updated_at timestamptz;

alter table public.ghost_studio_sessions
  drop constraint if exists ghost_studio_sessions_revision_check,
  drop constraint if exists ghost_studio_sessions_playback_position_check;

alter table public.ghost_studio_sessions
  add constraint ghost_studio_sessions_revision_check check (revision > 0),
  add constraint ghost_studio_sessions_playback_position_check check (
    playback_position_seconds >= 0 and playback_position_seconds <= 86400
  );

create unique index if not exists ghost_sessions_one_active_per_owner_idx
  on public.ghost_studio_sessions(owner_id)
  where is_active;

create index if not exists ghost_sessions_project_idx
  on public.ghost_studio_sessions(project_id);

create index if not exists ghost_sessions_song_idx
  on public.ghost_studio_sessions(song_id);

create index if not exists songs_project_idx
  on public.songs(project_id);

create or replace function public.save_ghost_studio_session(
  p_session_id uuid,
  p_project_id uuid,
  p_song_id uuid,
  p_beat_id text,
  p_beat_snapshot jsonb,
  p_mode text,
  p_ambiance text,
  p_section_content jsonb,
  p_active_section text,
  p_song_state integer,
  p_completion_pct integer,
  p_booth_score integer,
  p_total_bars integer,
  p_expected_revision bigint,
  p_playback_position_seconds double precision,
  p_studio_dna jsonb,
  p_client_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  owner_id_value uuid := (select auth.uid());
  current_session public.ghost_studio_sessions%rowtype;
  saved_session public.ghost_studio_sessions%rowtype;
  now_value timestamptz := pg_catalog.now();
begin
  if owner_id_value is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.projects
  where id = p_project_id and owner_id = owner_id_value;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.songs
  where id = p_song_id and project_id = p_project_id and owner_id = owner_id_value;
  if not found then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(owner_id_value::text, 0)
  );

  if p_session_id is not null then
    select * into current_session
    from public.ghost_studio_sessions
    where id = p_session_id and owner_id = owner_id_value
    for update;

    if not found then
      raise exception 'Session not found' using errcode = 'P0002';
    end if;
  else
    select * into current_session
    from public.ghost_studio_sessions
    where owner_id = owner_id_value and is_active
    order by last_active_at desc
    limit 1
    for update;
  end if;

  if current_session.id is not null then
    if p_expected_revision is null or current_session.revision <> p_expected_revision then
      return pg_catalog.jsonb_build_object(
        'conflict', true,
        'session', pg_catalog.to_jsonb(current_session)
      );
    end if;

    update public.ghost_studio_sessions
    set project_id = p_project_id,
        song_id = p_song_id,
        beat_id = p_beat_id,
        beat_snapshot = coalesce(p_beat_snapshot, '{}'::jsonb),
        mode = p_mode,
        ambiance = p_ambiance,
        section_content = coalesce(p_section_content, '{}'::jsonb),
        active_section = p_active_section,
        song_state = p_song_state,
        completion_pct = p_completion_pct,
        booth_score = p_booth_score,
        total_bars = p_total_bars,
        playback_position_seconds = greatest(0, least(p_playback_position_seconds, 86400)),
        studio_dna = coalesce(p_studio_dna, '{}'::jsonb),
        client_updated_at = coalesce(p_client_updated_at, now_value),
        last_active_at = now_value,
        is_active = true,
        revision = current_session.revision + 1
    where id = current_session.id
      and owner_id = owner_id_value
      and revision = current_session.revision
    returning * into saved_session;
  else
    insert into public.ghost_studio_sessions (
      owner_id,
      project_id,
      song_id,
      beat_id,
      beat_snapshot,
      mode,
      ambiance,
      section_content,
      active_section,
      song_state,
      completion_pct,
      booth_score,
      total_bars,
      playback_position_seconds,
      studio_dna,
      client_updated_at,
      is_active,
      revision,
      last_active_at
    ) values (
      owner_id_value,
      p_project_id,
      p_song_id,
      p_beat_id,
      coalesce(p_beat_snapshot, '{}'::jsonb),
      p_mode,
      p_ambiance,
      coalesce(p_section_content, '{}'::jsonb),
      p_active_section,
      p_song_state,
      p_completion_pct,
      p_booth_score,
      p_total_bars,
      greatest(0, least(p_playback_position_seconds, 86400)),
      coalesce(p_studio_dna, '{}'::jsonb),
      coalesce(p_client_updated_at, now_value),
      true,
      1,
      now_value
    )
    returning * into saved_session;
  end if;

  update public.songs
  set sections = coalesce(p_section_content, '{}'::jsonb),
      active_section = p_active_section,
      song_state = p_song_state,
      completion_pct = p_completion_pct,
      booth_score = p_booth_score,
      total_bars = p_total_bars,
      beat_id = p_beat_id,
      beat_snapshot = coalesce(p_beat_snapshot, '{}'::jsonb),
      last_saved_at = now_value
  where id = p_song_id and owner_id = owner_id_value;

  insert into public.song_sections (
    owner_id,
    project_id,
    song_id,
    section_key,
    title,
    position,
    target_bars,
    content,
    bar_count,
    word_count,
    content_hash,
    last_edited_at
  )
  select
    owner_id_value,
    p_project_id,
    p_song_id,
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(entry.title), '[^a-z0-9]+', '-', 'g'), '-'),
    entry.title,
    case entry.title
      when 'Hook' then 0
      when 'Verse 1' then 1
      when 'Verse 2' then 2
      when 'Bridge' then 3
      when 'Outro' then 4
      else 99
    end,
    case entry.title
      when 'Hook' then 8
      when 'Verse 1' then 16
      when 'Verse 2' then 16
      when 'Bridge' then 8
      when 'Outro' then 4
      else 0
    end,
    entry.content,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.regexp_split_to_table(entry.content, E'\\r?\\n') as line
      where pg_catalog.btrim(line) <> ''
    ),
    case
      when pg_catalog.btrim(entry.content) = '' then 0
      else pg_catalog.array_length(
        pg_catalog.regexp_split_to_array(pg_catalog.btrim(entry.content), E'\\s+'),
        1
      )
    end,
    pg_catalog.encode(extensions.digest(entry.content, 'sha256'), 'hex'),
    now_value
  from pg_catalog.jsonb_each_text(
    coalesce(p_section_content, '{}'::jsonb)
  ) as entry(title, content)
  on conflict (owner_id, song_id, section_key)
  do update set
    project_id = excluded.project_id,
    title = excluded.title,
    position = excluded.position,
    target_bars = excluded.target_bars,
    content = excluded.content,
    bar_count = excluded.bar_count,
    word_count = excluded.word_count,
    content_hash = excluded.content_hash,
    last_edited_at = excluded.last_edited_at;

  return pg_catalog.jsonb_build_object(
    'conflict', false,
    'session', pg_catalog.to_jsonb(saved_session)
  );
end;
$$;

revoke all on function public.save_ghost_studio_session(
  uuid, uuid, uuid, text, jsonb, text, text, jsonb, text, integer,
  integer, integer, integer, bigint, double precision, jsonb, timestamptz
) from public, anon;

grant execute on function public.save_ghost_studio_session(
  uuid, uuid, uuid, text, jsonb, text, text, jsonb, text, integer,
  integer, integer, integer, bigint, double precision, jsonb, timestamptz
) to authenticated, service_role;
