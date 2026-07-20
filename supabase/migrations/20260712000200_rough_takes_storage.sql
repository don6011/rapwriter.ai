insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rough-takes',
  'rough-takes',
  false,
  52428800,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.rough_takes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  song_id uuid references public.songs(id) on delete cascade,
  session_id uuid references public.ghost_studio_sessions(id) on delete set null,
  section_name text not null default 'Hook',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  mime_type text not null default 'audio/webm',
  storage_bucket text not null default 'rough-takes',
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rough_takes_owner_created_idx on public.rough_takes(owner_id, created_at desc);
create index rough_takes_session_created_idx on public.rough_takes(owner_id, session_id, created_at desc);
create index rough_takes_song_created_idx on public.rough_takes(owner_id, song_id, created_at desc);

create trigger rough_takes_set_updated_at before update on public.rough_takes for each row execute function public.set_updated_at();

alter table public.rough_takes enable row level security;

create policy "rough_takes_select_own" on public.rough_takes
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "rough_takes_insert_own" on public.rough_takes
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "rough_takes_update_own" on public.rough_takes
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "rough_takes_delete_own" on public.rough_takes
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "rough_takes_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rough-takes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "rough_takes_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rough-takes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "rough_takes_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'rough-takes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'rough-takes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "rough_takes_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rough-takes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
