create table if not exists public.booth_exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  session_id uuid references public.ghost_studio_sessions(id) on delete set null,
  rough_take_id uuid references public.rough_takes(id) on delete set null,
  version_number integer not null check (version_number > 0),
  title text not null check (char_length(title) between 1 and 160),
  booth_score integer not null default 0 check (booth_score between 0 and 100),
  completion_pct integer not null default 0 check (completion_pct between 0 and 100),
  total_bars integer not null default 0 check (total_bars >= 0),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, song_id, version_number)
);

create index if not exists booth_exports_owner_created_idx
  on public.booth_exports (owner_id, created_at desc);

create index if not exists booth_exports_song_version_idx
  on public.booth_exports (song_id, version_number desc);

alter table public.booth_exports enable row level security;

drop policy if exists "Users can read their booth exports" on public.booth_exports;
create policy "Users can read their booth exports"
  on public.booth_exports for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create their booth exports" on public.booth_exports;
create policy "Users can create their booth exports"
  on public.booth_exports for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their booth exports" on public.booth_exports;
create policy "Users can delete their booth exports"
  on public.booth_exports for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke update on public.booth_exports from authenticated;
grant select, insert, delete on public.booth_exports to authenticated;
grant all on public.booth_exports to service_role;

comment on table public.booth_exports is
  'Immutable, versioned Booth Ready snapshots used to generate studio handoff files.';
