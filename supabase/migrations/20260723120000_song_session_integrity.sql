alter table public.songs
  add column if not exists playback_position_seconds double precision not null default 0,
  add column if not exists studio_dna jsonb not null default '{}'::jsonb,
  add column if not exists session_mode text not null default 'midnight',
  add column if not exists session_ambiance text not null default 'midnight';

alter table public.songs
  drop constraint if exists songs_playback_position_check;

alter table public.songs
  add constraint songs_playback_position_check check (
    playback_position_seconds >= 0 and playback_position_seconds <= 86400
  );

create or replace function public.sync_session_context_to_song()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.songs
  set playback_position_seconds = greatest(0, least(new.playback_position_seconds, 86400)),
      studio_dna = coalesce(new.studio_dna, '{}'::jsonb),
      session_mode = new.mode,
      session_ambiance = new.ambiance
  where id = new.song_id
    and owner_id = new.owner_id;

  return new;
end;
$$;

drop trigger if exists ghost_sessions_sync_song_context on public.ghost_studio_sessions;
create trigger ghost_sessions_sync_song_context
after insert or update of song_id, playback_position_seconds, studio_dna, mode, ambiance
on public.ghost_studio_sessions
for each row execute function public.sync_session_context_to_song();

update public.songs as song
set playback_position_seconds = session.playback_position_seconds,
    studio_dna = session.studio_dna,
    session_mode = session.mode,
    session_ambiance = session.ambiance
from public.ghost_studio_sessions as session
where session.song_id = song.id
  and session.owner_id = song.owner_id
  and session.is_active;
