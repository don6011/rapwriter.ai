create index if not exists rough_takes_project_created_idx
  on public.rough_takes (project_id, created_at desc)
  where project_id is not null;

create index if not exists rough_takes_song_created_idx
  on public.rough_takes (song_id, created_at desc)
  where song_id is not null;

create index if not exists rough_takes_session_created_idx
  on public.rough_takes (session_id, created_at desc)
  where session_id is not null;
