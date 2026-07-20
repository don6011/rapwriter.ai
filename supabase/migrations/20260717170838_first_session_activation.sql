alter table public.profiles
  add column if not exists first_session_completed boolean not null default false,
  add column if not exists artist_goal text;

alter table public.profiles
  drop constraint if exists profiles_artist_goal_check;

alter table public.profiles
  add constraint profiles_artist_goal_check
  check (
    artist_goal is null
    or artist_goal in ('finish_song', 'write_hook', 'write_verse', 'freestyle')
  );

update public.profiles as profile
set first_session_completed = exists (
  select 1
  from public.projects as project
  where project.owner_id = profile.id
);

create unique index if not exists projects_single_activation_workspace_idx
  on public.projects (owner_id)
  where metadata ->> 'source' = 'activation';

grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;
