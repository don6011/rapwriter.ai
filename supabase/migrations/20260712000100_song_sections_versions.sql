create table public.song_sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  section_key text not null,
  title text not null,
  position integer not null default 0,
  target_bars integer not null default 0,
  is_enabled boolean not null default true,
  is_collapsed boolean not null default false,
  content text not null default '',
  bar_count integer not null default 0 check (bar_count >= 0),
  word_count integer not null default 0 check (word_count >= 0),
  content_hash text not null default '',
  last_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, song_id, section_key)
);

create table public.song_section_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  section_id uuid not null references public.song_sections(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content text not null default '',
  bar_count integer not null default 0 check (bar_count >= 0),
  word_count integer not null default 0 check (word_count >= 0),
  content_hash text not null default '',
  source text not null default 'autosave' check (source in ('autosave', 'manual', 'recovery', 'import')),
  created_at timestamptz not null default now(),
  unique(section_id, version_number)
);

create index song_sections_owner_song_idx on public.song_sections(owner_id, song_id, position);
create index song_sections_song_key_idx on public.song_sections(song_id, section_key);
create index song_section_versions_section_created_idx on public.song_section_versions(section_id, created_at desc);
create index song_section_versions_owner_song_idx on public.song_section_versions(owner_id, song_id, created_at desc);

create trigger song_sections_set_updated_at
  before update on public.song_sections
  for each row execute function public.set_updated_at();

create or replace function public.capture_song_section_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if tg_op = 'UPDATE' and old.content_hash = new.content_hash then
    return new;
  end if;

  select coalesce(max(version_number), 0) + 1
    into next_version
  from public.song_section_versions
  where section_id = new.id;

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
    'autosave'
  );

  return new;
end;
$$;

create trigger song_sections_capture_version
  after insert or update on public.song_sections
  for each row execute function public.capture_song_section_version();

alter table public.song_sections enable row level security;
alter table public.song_section_versions enable row level security;

create policy "song_sections_select_own" on public.song_sections for select using (auth.uid() = owner_id);
create policy "song_sections_insert_own" on public.song_sections for insert with check (auth.uid() = owner_id);
create policy "song_sections_update_own" on public.song_sections for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "song_sections_delete_own" on public.song_sections for delete using (auth.uid() = owner_id);

create policy "song_section_versions_select_own" on public.song_section_versions for select using (auth.uid() = owner_id);
create policy "song_section_versions_insert_own" on public.song_section_versions for insert with check (auth.uid() = owner_id);
