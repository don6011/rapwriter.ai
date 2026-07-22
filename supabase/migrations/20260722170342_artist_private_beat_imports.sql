insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artist-beats',
  'artist-beats',
  false,
  104857600,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "artist_beats_storage_select_own" on storage.objects;
create policy "artist_beats_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'artist-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "artist_beats_storage_insert_own" on storage.objects;
create policy "artist_beats_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artist-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "artist_beats_storage_delete_own" on storage.objects;
create policy "artist_beats_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'artist-beats'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

update public.subscription_plans
set limits = coalesce(limits, '{}'::jsonb) || jsonb_build_object(
  'private_beat_imports',
  case id
    when 'artist_free' then 1
    when 'artist_pro' then 25
    when 'artist_studio' then 100
  end
), updated_at = now()
where id in ('artist_free', 'artist_pro', 'artist_studio');
