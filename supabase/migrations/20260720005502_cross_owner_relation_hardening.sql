-- Keep user-owned child records attached only to parents owned by the same user.
-- These restrictive policies are ANDed with the existing per-table owner policies.

drop policy if exists "songs_relation_integrity" on public.songs;
create policy "songs_relation_integrity"
  on public.songs as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.projects as project
      where project.id = songs.project_id
        and project.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.projects as project
      where project.id = songs.project_id
        and project.owner_id = (select auth.uid())
    )
  );

drop policy if exists "sessions_relation_integrity" on public.ghost_studio_sessions;
create policy "sessions_relation_integrity"
  on public.ghost_studio_sessions as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs as song
      where song.id = ghost_studio_sessions.song_id
        and song.project_id = ghost_studio_sessions.project_id
        and song.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs as song
      where song.id = ghost_studio_sessions.song_id
        and song.project_id = ghost_studio_sessions.project_id
        and song.owner_id = (select auth.uid())
    )
  );

drop policy if exists "song_sections_relation_integrity" on public.song_sections;
create policy "song_sections_relation_integrity"
  on public.song_sections as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs as song
      where song.id = song_sections.song_id
        and song.project_id = song_sections.project_id
        and song.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs as song
      where song.id = song_sections.song_id
        and song.project_id = song_sections.project_id
        and song.owner_id = (select auth.uid())
    )
  );

drop policy if exists "song_section_versions_relation_integrity" on public.song_section_versions;
create policy "song_section_versions_relation_integrity"
  on public.song_section_versions as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.song_sections as section
      where section.id = song_section_versions.section_id
        and section.song_id = song_section_versions.song_id
        and section.project_id = song_section_versions.project_id
        and section.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.song_sections as section
      where section.id = song_section_versions.section_id
        and section.song_id = song_section_versions.song_id
        and section.project_id = song_section_versions.project_id
        and section.owner_id = (select auth.uid())
    )
  );

drop policy if exists "rough_takes_relation_integrity" on public.rough_takes;
create policy "rough_takes_relation_integrity"
  on public.rough_takes as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects as project
      where project.id = rough_takes.project_id
        and project.owner_id = (select auth.uid())
    ))
    and (song_id is null or exists (
      select 1 from public.songs as song
      where song.id = rough_takes.song_id
        and song.owner_id = (select auth.uid())
        and (rough_takes.project_id is null or song.project_id = rough_takes.project_id)
    ))
    and (session_id is null or exists (
      select 1 from public.ghost_studio_sessions as studio_session
      where studio_session.id = rough_takes.session_id
        and studio_session.owner_id = (select auth.uid())
        and (rough_takes.song_id is null or studio_session.song_id = rough_takes.song_id)
    ))
  )
  with check (
    owner_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects as project
      where project.id = rough_takes.project_id
        and project.owner_id = (select auth.uid())
    ))
    and (song_id is null or exists (
      select 1 from public.songs as song
      where song.id = rough_takes.song_id
        and song.owner_id = (select auth.uid())
        and (rough_takes.project_id is null or song.project_id = rough_takes.project_id)
    ))
    and (session_id is null or exists (
      select 1 from public.ghost_studio_sessions as studio_session
      where studio_session.id = rough_takes.session_id
        and studio_session.owner_id = (select auth.uid())
        and (rough_takes.song_id is null or studio_session.song_id = rough_takes.song_id)
    ))
  );

drop policy if exists "song_locker_relation_integrity" on public.song_locker;
create policy "song_locker_relation_integrity"
  on public.song_locker as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects as project
      where project.id = song_locker.project_id
        and project.owner_id = (select auth.uid())
    ))
    and (song_id is null or exists (
      select 1 from public.songs as song
      where song.id = song_locker.song_id
        and song.owner_id = (select auth.uid())
        and (song_locker.project_id is null or song.project_id = song_locker.project_id)
    ))
  )
  with check (
    owner_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects as project
      where project.id = song_locker.project_id
        and project.owner_id = (select auth.uid())
    ))
    and (song_id is null or exists (
      select 1 from public.songs as song
      where song.id = song_locker.song_id
        and song.owner_id = (select auth.uid())
        and (song_locker.project_id is null or song.project_id = song_locker.project_id)
    ))
  );

drop policy if exists "hook_locker_relation_integrity" on public.hook_locker;
create policy "hook_locker_relation_integrity"
  on public.hook_locker as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects as project
      where project.id = hook_locker.project_id
        and project.owner_id = (select auth.uid())
    ))
    and (song_id is null or exists (
      select 1 from public.songs as song
      where song.id = hook_locker.song_id
        and song.owner_id = (select auth.uid())
        and (hook_locker.project_id is null or song.project_id = hook_locker.project_id)
    ))
  )
  with check (
    owner_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects as project
      where project.id = hook_locker.project_id
        and project.owner_id = (select auth.uid())
    ))
    and (song_id is null or exists (
      select 1 from public.songs as song
      where song.id = hook_locker.song_id
        and song.owner_id = (select auth.uid())
        and (hook_locker.project_id is null or song.project_id = hook_locker.project_id)
    ))
  );

drop policy if exists "producer_actions_relation_integrity" on public.producer_actions;
create policy "producer_actions_relation_integrity"
  on public.producer_actions as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs as song
      where song.id = producer_actions.song_id
        and song.project_id = producer_actions.project_id
        and song.owner_id = (select auth.uid())
    )
    and (session_id is null or exists (
      select 1 from public.ghost_studio_sessions as studio_session
      where studio_session.id = producer_actions.session_id
        and studio_session.song_id = producer_actions.song_id
        and studio_session.owner_id = (select auth.uid())
    ))
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs as song
      where song.id = producer_actions.song_id
        and song.project_id = producer_actions.project_id
        and song.owner_id = (select auth.uid())
    )
    and (session_id is null or exists (
      select 1 from public.ghost_studio_sessions as studio_session
      where studio_session.id = producer_actions.session_id
        and studio_session.song_id = producer_actions.song_id
        and studio_session.owner_id = (select auth.uid())
    ))
  );

drop policy if exists "producer_beats_relation_integrity" on public.producer_beats;
create policy "producer_beats_relation_integrity"
  on public.producer_beats as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_beats.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_beats.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_playlists_relation_integrity" on public.producer_playlists;
create policy "producer_playlists_relation_integrity"
  on public.producer_playlists as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_playlists.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_playlists.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_business_settings_relation_integrity" on public.producer_business_settings;
create policy "producer_business_settings_relation_integrity"
  on public.producer_business_settings as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_business_settings.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_business_settings.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_billing_accounts_relation_integrity" on public.producer_billing_accounts;
create policy "producer_billing_accounts_relation_integrity"
  on public.producer_billing_accounts as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_billing_accounts.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_billing_accounts.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  );

drop policy if exists "producer_metrics_relation_integrity" on public.producer_metrics;
create policy "producer_metrics_relation_integrity"
  on public.producer_metrics as restrictive for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_metrics.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.producer_profiles as producer
      where producer.id = producer_metrics.producer_profile_id
        and producer.owner_id = (select auth.uid())
    )
  );
