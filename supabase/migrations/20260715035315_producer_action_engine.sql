alter table public.song_section_versions
  drop constraint if exists song_section_versions_source_check;

alter table public.song_section_versions
  add constraint song_section_versions_source_check
  check (source in ('autosave', 'manual', 'recovery', 'import', 'producer_action'));

create table public.producer_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  session_id uuid references public.ghost_studio_sessions(id) on delete set null,
  section_name text not null,
  section_key text not null,
  action_type text not null check (action_type in ('hook', 'rewrite', 'commercial', 'pocket')),
  attempt integer not null default 0 check (attempt between 0 and 20),
  input_content text not null,
  proposed_content text not null,
  rationale text not null,
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  provider text not null default 'local',
  model text,
  status text not null default 'previewed' check (status in ('previewed', 'accepted', 'rejected', 'reverted')),
  accepted_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index producer_actions_owner_created_idx
  on public.producer_actions(owner_id, created_at desc);

create index producer_actions_song_created_idx
  on public.producer_actions(song_id, created_at desc);

create trigger producer_actions_set_updated_at
  before update on public.producer_actions
  for each row execute function public.set_updated_at();

alter table public.producer_actions enable row level security;

create policy "producer_actions_select_own"
  on public.producer_actions for select
  using ((select auth.uid()) = owner_id);

create policy "producer_actions_insert_own"
  on public.producer_actions for insert
  with check ((select auth.uid()) = owner_id);

create policy "producer_actions_update_own"
  on public.producer_actions for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create or replace function public.capture_song_section_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  version_source text;
begin
  if tg_op = 'UPDATE' and old.content_hash = new.content_hash then
    return new;
  end if;

  select coalesce(max(version_number), 0) + 1
    into next_version
  from public.song_section_versions
  where section_id = new.id;

  version_source := coalesce(
    nullif(current_setting('rapwriter.version_source', true), ''),
    'autosave'
  );

  insert into public.song_section_versions (
    owner_id,
    project_id,
    song_id,
    section_id,
    version_number,
    content,
    bar_count,
    word_count,
    content_hash,
    source
  )
  values (
    new.owner_id,
    new.project_id,
    new.song_id,
    new.id,
    next_version,
    new.content,
    new.bar_count,
    new.word_count,
    new.content_hash,
    version_source
  );

  return new;
end;
$$;

create or replace function public.resolve_producer_action(
  p_action_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  action_row public.producer_actions%rowtype;
  target_content text;
  all_sections jsonb;
  updated_section_id uuid;
  now_value timestamptz := now();
begin
  if p_decision not in ('accept', 'reject', 'revert') then
    raise exception 'Invalid producer action decision' using errcode = '22023';
  end if;

  select * into action_row
  from public.producer_actions
  where id = p_action_id
    and owner_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Producer action not found' using errcode = 'P0002';
  end if;

  if p_decision = 'reject' then
    if action_row.status <> 'previewed' then
      raise exception 'Only previewed actions can be rejected' using errcode = '22023';
    end if;

    update public.producer_actions
    set status = 'rejected'
    where id = action_row.id;

    return jsonb_build_object('status', 'rejected', 'action_id', action_row.id);
  end if;

  if p_decision = 'accept' then
    if action_row.status <> 'previewed' then
      raise exception 'Only previewed actions can be accepted' using errcode = '22023';
    end if;
    target_content := action_row.proposed_content;
    perform set_config('rapwriter.version_source', 'producer_action', true);
  else
    if action_row.status <> 'accepted' then
      raise exception 'Only accepted actions can be reverted' using errcode = '22023';
    end if;
    target_content := action_row.input_content;
    perform set_config('rapwriter.version_source', 'recovery', true);
  end if;

  update public.song_sections
  set content = target_content,
      bar_count = (
        select count(*)::integer
        from regexp_split_to_table(target_content, E'\\n') as line
        where btrim(line) <> ''
      ),
      word_count = case
        when btrim(target_content) = '' then 0
        else cardinality(regexp_split_to_array(btrim(target_content), E'\\s+'))
      end,
      content_hash = md5(target_content),
      last_edited_at = now_value
  where owner_id = action_row.owner_id
    and song_id = action_row.song_id
    and section_key = action_row.section_key
  returning id into updated_section_id;

  if updated_section_id is null then
    raise exception 'Song section not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_object_agg(section_rows.title, section_rows.content order by section_rows.position), '{}'::jsonb)
    into all_sections
  from public.song_sections as section_rows
  where section_rows.owner_id = action_row.owner_id
    and section_rows.song_id = action_row.song_id;

  update public.songs
  set sections = all_sections,
      active_section = action_row.section_name,
      last_saved_at = now_value
  where id = action_row.song_id
    and owner_id = action_row.owner_id;

  update public.ghost_studio_sessions
  set section_content = all_sections,
      active_section = action_row.section_name,
      last_active_at = now_value
  where song_id = action_row.song_id
    and owner_id = action_row.owner_id
    and is_active = true;

  update public.producer_actions
  set status = case when p_decision = 'accept' then 'accepted' else 'reverted' end,
      accepted_at = case when p_decision = 'accept' then now_value else accepted_at end,
      reverted_at = case when p_decision = 'revert' then now_value else reverted_at end
  where id = action_row.id;

  return jsonb_build_object(
    'status', case when p_decision = 'accept' then 'accepted' else 'reverted' end,
    'action_id', action_row.id,
    'section_name', action_row.section_name,
    'content', target_content,
    'section_content', all_sections
  );
end;
$$;

revoke all on function public.resolve_producer_action(uuid, text) from public;
grant execute on function public.resolve_producer_action(uuid, text) to authenticated;
