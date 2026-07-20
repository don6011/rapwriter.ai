alter function public.set_updated_at() set search_path = public;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.capture_song_section_version() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists producer_beats_profile_idx
  on public.producer_beats(producer_profile_id);

create index if not exists producer_playlists_profile_idx
  on public.producer_playlists(producer_profile_id);

create index if not exists producer_playlist_items_beat_idx
  on public.producer_playlist_items(beat_id);
