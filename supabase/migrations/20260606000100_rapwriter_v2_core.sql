create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  artist_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'studio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  project_type text not null default 'Single',
  status text not null default 'draft' check (status in ('idea', 'draft', 'session_ready', 'booth_ready', 'archived')),
  artwork jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  track_number integer not null default 1,
  song_state integer not null default 0 check (song_state between 0 and 3),
  sections jsonb not null default '{}'::jsonb,
  active_section text not null default 'Hook',
  beat_id text,
  beat_snapshot jsonb not null default '{}'::jsonb,
  completion_pct integer not null default 0 check (completion_pct between 0 and 100),
  booth_score integer not null default 0 check (booth_score between 0 and 100),
  total_bars integer not null default 0,
  last_saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ghost_studio_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  beat_id text,
  beat_snapshot jsonb not null default '{}'::jsonb,
  mode text not null default 'midnight',
  ambiance text not null default 'vinyl',
  section_content jsonb not null default '{}'::jsonb,
  active_section text not null default 'Hook',
  song_state integer not null default 0 check (song_state between 0 and 3),
  completion_pct integer not null default 0 check (completion_pct between 0 and 100),
  booth_score integer not null default 0 check (booth_score between 0 and 100),
  total_bars integer not null default 0,
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.beat_locker (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  beat_id text not null,
  title text not null,
  producer text,
  bpm integer,
  musical_key text,
  mood text,
  license text,
  price integer,
  stripe_checkout_session_id text,
  beat_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, beat_id, license)
);

create table public.song_locker (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  song_id uuid references public.songs(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  booth_ready boolean not null default false,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, song_id)
);

create table public.hook_locker (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  title text not null default 'Untitled Hook',
  content text not null,
  source_section text not null default 'Hook',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects(owner_id, updated_at desc);
create index songs_owner_updated_idx on public.songs(owner_id, updated_at desc);
create index sessions_owner_active_idx on public.ghost_studio_sessions(owner_id, is_active, last_active_at desc);
create index beat_locker_owner_created_idx on public.beat_locker(owner_id, created_at desc);
create index song_locker_owner_created_idx on public.song_locker(owner_id, created_at desc);
create index hook_locker_owner_created_idx on public.hook_locker(owner_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger songs_set_updated_at before update on public.songs for each row execute function public.set_updated_at();
create trigger ghost_sessions_set_updated_at before update on public.ghost_studio_sessions for each row execute function public.set_updated_at();
create trigger beat_locker_set_updated_at before update on public.beat_locker for each row execute function public.set_updated_at();
create trigger song_locker_set_updated_at before update on public.song_locker for each row execute function public.set_updated_at();
create trigger hook_locker_set_updated_at before update on public.hook_locker for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, artist_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'artist_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.songs enable row level security;
alter table public.ghost_studio_sessions enable row level security;
alter table public.beat_locker enable row level security;
alter table public.song_locker enable row level security;
alter table public.hook_locker enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "projects_select_own" on public.projects for select using (auth.uid() = owner_id);
create policy "projects_insert_own" on public.projects for insert with check (auth.uid() = owner_id);
create policy "projects_update_own" on public.projects for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "projects_delete_own" on public.projects for delete using (auth.uid() = owner_id);

create policy "songs_select_own" on public.songs for select using (auth.uid() = owner_id);
create policy "songs_insert_own" on public.songs for insert with check (auth.uid() = owner_id);
create policy "songs_update_own" on public.songs for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "songs_delete_own" on public.songs for delete using (auth.uid() = owner_id);

create policy "sessions_select_own" on public.ghost_studio_sessions for select using (auth.uid() = owner_id);
create policy "sessions_insert_own" on public.ghost_studio_sessions for insert with check (auth.uid() = owner_id);
create policy "sessions_update_own" on public.ghost_studio_sessions for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "sessions_delete_own" on public.ghost_studio_sessions for delete using (auth.uid() = owner_id);

create policy "beat_locker_select_own" on public.beat_locker for select using (auth.uid() = owner_id);
create policy "beat_locker_insert_own" on public.beat_locker for insert with check (auth.uid() = owner_id);
create policy "beat_locker_update_own" on public.beat_locker for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "beat_locker_delete_own" on public.beat_locker for delete using (auth.uid() = owner_id);

create policy "song_locker_select_own" on public.song_locker for select using (auth.uid() = owner_id);
create policy "song_locker_insert_own" on public.song_locker for insert with check (auth.uid() = owner_id);
create policy "song_locker_update_own" on public.song_locker for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "song_locker_delete_own" on public.song_locker for delete using (auth.uid() = owner_id);

create policy "hook_locker_select_own" on public.hook_locker for select using (auth.uid() = owner_id);
create policy "hook_locker_insert_own" on public.hook_locker for insert with check (auth.uid() = owner_id);
create policy "hook_locker_update_own" on public.hook_locker for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "hook_locker_delete_own" on public.hook_locker for delete using (auth.uid() = owner_id);
