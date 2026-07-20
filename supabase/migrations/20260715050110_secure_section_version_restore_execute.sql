revoke all on function public.restore_song_section_version(uuid) from public, anon;
grant execute on function public.restore_song_section_version(uuid) to authenticated, service_role;
