create index if not exists booth_exports_project_idx
  on public.booth_exports (project_id);

create index if not exists booth_exports_session_idx
  on public.booth_exports (session_id)
  where session_id is not null;

create index if not exists booth_exports_rough_take_idx
  on public.booth_exports (rough_take_id)
  where rough_take_id is not null;
