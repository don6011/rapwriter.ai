alter table public.rough_takes
  add column if not exists analysis jsonb not null default '{}'::jsonb,
  add column if not exists analysis_version text not null default 'booth-ready-v2',
  add column if not exists analyzed_at timestamptz;

alter table public.rough_takes
  drop constraint if exists rough_takes_analysis_object;

alter table public.rough_takes
  add constraint rough_takes_analysis_object
  check (jsonb_typeof(analysis) = 'object');
