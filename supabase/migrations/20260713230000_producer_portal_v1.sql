alter table public.profiles
  add column if not exists account_type text not null default 'artist'
  check (account_type in ('artist', 'producer', 'admin')),
  add column if not exists onboarding_completed boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'producer-beats',
  'producer-beats',
  false,
  209715200,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.producer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  handle text,
  city text,
  bio text,
  genres text[] not null default '{}',
  avatar_path text,
  banner_path text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  verified boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id),
  unique(handle)
);

create table if not exists public.producer_beats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  title text not null,
  bpm integer check (bpm is null or (bpm >= 40 and bpm <= 220)),
  musical_key text,
  genre text,
  mood text,
  region text,
  tags text[] not null default '{}',
  license_tiers jsonb not null default '[]'::jsonb,
  audio_bucket text not null default 'producer-beats',
  audio_path text not null,
  artwork_path text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.producer_playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.producer_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.producer_playlists(id) on delete cascade,
  beat_id uuid not null references public.producer_beats(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(playlist_id, beat_id)
);

create index if not exists producer_profiles_owner_idx on public.producer_profiles(owner_id);
create index if not exists producer_profiles_public_idx on public.producer_profiles(status, is_public, updated_at desc);
create index if not exists producer_beats_owner_created_idx on public.producer_beats(owner_id, created_at desc);
create index if not exists producer_beats_public_idx on public.producer_beats(status, created_at desc);
create index if not exists producer_playlists_owner_created_idx on public.producer_playlists(owner_id, created_at desc);

drop trigger if exists producer_profiles_set_updated_at on public.producer_profiles;
create trigger producer_profiles_set_updated_at
  before update on public.producer_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists producer_beats_set_updated_at on public.producer_beats;
create trigger producer_beats_set_updated_at
  before update on public.producer_beats
  for each row execute function public.set_updated_at();

drop trigger if exists producer_playlists_set_updated_at on public.producer_playlists;
create trigger producer_playlists_set_updated_at
  before update on public.producer_playlists
  for each row execute function public.set_updated_at();

alter table public.producer_profiles enable row level security;
alter table public.producer_beats enable row level security;
alter table public.producer_playlists enable row level security;
alter table public.producer_playlist_items enable row level security;

drop policy if exists "producer_profiles_select_own" on public.producer_profiles;
drop policy if exists "producer_profiles_select_public" on public.producer_profiles;
drop policy if exists "producer_profiles_insert_own" on public.producer_profiles;
drop policy if exists "producer_profiles_update_own" on public.producer_profiles;
drop policy if exists "producer_profiles_delete_own" on public.producer_profiles;

create policy "producer_profiles_select_own"
  on public.producer_profiles for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "producer_profiles_select_public"
  on public.producer_profiles for select to anon, authenticated
  using (is_public = true and status = 'approved');

create policy "producer_profiles_insert_own"
  on public.producer_profiles for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "producer_profiles_update_own"
  on public.producer_profiles for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "producer_profiles_delete_own"
  on public.producer_profiles for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "producer_beats_select_own" on public.producer_beats;
drop policy if exists "producer_beats_select_public" on public.producer_beats;
drop policy if exists "producer_beats_insert_own" on public.producer_beats;
drop policy if exists "producer_beats_update_own" on public.producer_beats;
drop policy if exists "producer_beats_delete_own" on public.producer_beats;

create policy "producer_beats_select_own"
  on public.producer_beats for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "producer_beats_select_public"
  on public.producer_beats for select to anon, authenticated
  using (status = 'approved');

create policy "producer_beats_insert_own"
  on public.producer_beats for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "producer_beats_update_own"
  on public.producer_beats for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "producer_beats_delete_own"
  on public.producer_beats for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "producer_playlists_select_own" on public.producer_playlists;
drop policy if exists "producer_playlists_insert_own" on public.producer_playlists;
drop policy if exists "producer_playlists_update_own" on public.producer_playlists;
drop policy if exists "producer_playlists_delete_own" on public.producer_playlists;

create policy "producer_playlists_select_own"
  on public.producer_playlists for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "producer_playlists_insert_own"
  on public.producer_playlists for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "producer_playlists_update_own"
  on public.producer_playlists for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "producer_playlists_delete_own"
  on public.producer_playlists for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "producer_playlist_items_select_own" on public.producer_playlist_items;
drop policy if exists "producer_playlist_items_insert_own" on public.producer_playlist_items;
drop policy if exists "producer_playlist_items_update_own" on public.producer_playlist_items;
drop policy if exists "producer_playlist_items_delete_own" on public.producer_playlist_items;

create policy "producer_playlist_items_select_own"
  on public.producer_playlist_items for select to authenticated
  using (
    exists (
      select 1 from public.producer_playlists playlists
      where playlists.id = public.producer_playlist_items.playlist_id
        and playlists.owner_id = (select auth.uid())
    )
  );

create policy "producer_playlist_items_insert_own"
  on public.producer_playlist_items for insert to authenticated
  with check (
    exists (
      select 1 from public.producer_playlists playlists
      where playlists.id = public.producer_playlist_items.playlist_id
        and playlists.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.producer_beats beats
      where beats.id = public.producer_playlist_items.beat_id
        and beats.owner_id = (select auth.uid())
    )
  );

create policy "producer_playlist_items_update_own"
  on public.producer_playlist_items for update to authenticated
  using (
    exists (
      select 1 from public.producer_playlists playlists
      where playlists.id = public.producer_playlist_items.playlist_id
        and playlists.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.producer_playlists playlists
      where playlists.id = public.producer_playlist_items.playlist_id
        and playlists.owner_id = (select auth.uid())
    )
  );

create policy "producer_playlist_items_delete_own"
  on public.producer_playlist_items for delete to authenticated
  using (
    exists (
      select 1 from public.producer_playlists playlists
      where playlists.id = public.producer_playlist_items.playlist_id
        and playlists.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_beats_storage_select_own" on storage.objects;
drop policy if exists "producer_beats_storage_insert_own" on storage.objects;
drop policy if exists "producer_beats_storage_update_own" on storage.objects;
drop policy if exists "producer_beats_storage_delete_own" on storage.objects;

create policy "producer_beats_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'producer-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "producer_beats_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'producer-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "producer_beats_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'producer-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'producer-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "producer_beats_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'producer-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
