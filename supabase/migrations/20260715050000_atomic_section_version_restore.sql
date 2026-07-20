create or replace function public.restore_song_section_version(
  p_version_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  version_row public.song_section_versions%rowtype;
  section_row public.song_sections%rowtype;
  all_sections jsonb;
  now_value timestamptz := now();
begin
  select * into version_row
  from public.song_section_versions
  where id = p_version_id
    and owner_id = (select auth.uid());

  if not found then
    raise exception 'Song section version not found' using errcode = 'P0002';
  end if;

  perform set_config('rapwriter.version_source', 'recovery', true);

  update public.song_sections
  set content = version_row.content,
      bar_count = version_row.bar_count,
      word_count = version_row.word_count,
      content_hash = version_row.content_hash,
      last_edited_at = now_value
  where id = version_row.section_id
    and owner_id = version_row.owner_id
  returning * into section_row;

  if section_row.id is null then
    raise exception 'Song section not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_object_agg(rows.title, rows.content order by rows.position), '{}'::jsonb)
    into all_sections
  from public.song_sections as rows
  where rows.owner_id = version_row.owner_id
    and rows.song_id = version_row.song_id;

  update public.songs
  set sections = all_sections,
      active_section = section_row.title,
      last_saved_at = now_value
  where id = version_row.song_id
    and owner_id = version_row.owner_id;

  update public.ghost_studio_sessions
  set section_content = all_sections,
      active_section = section_row.title,
      last_active_at = now_value
  where song_id = version_row.song_id
    and owner_id = version_row.owner_id
    and is_active = true;

  return jsonb_build_object(
    'section', jsonb_build_object(
      'id', section_row.id,
      'title', section_row.title,
      'section_key', section_row.section_key,
      'content', section_row.content,
      'updated_at', section_row.updated_at
    ),
    'section_content', all_sections
  );
end;
$$;

revoke all on function public.restore_song_section_version(uuid) from public;
grant execute on function public.restore_song_section_version(uuid) to authenticated;
