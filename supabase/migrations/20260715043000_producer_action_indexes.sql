create index producer_actions_project_idx
  on public.producer_actions(project_id);

create index producer_actions_session_idx
  on public.producer_actions(session_id)
  where session_id is not null;
