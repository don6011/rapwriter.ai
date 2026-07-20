create table public.marketplace_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('beat_play', 'beat_favorite', 'beat_add')),
  actor_id uuid references auth.users(id) on delete set null,
  anonymous_key_hash text not null check (char_length(anonymous_key_hash) = 64),
  beat_id uuid not null references public.producer_beats(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  event_bucket text not null,
  dedupe_key text not null unique check (char_length(dedupe_key) = 64),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index marketplace_events_beat_type_created_idx
  on public.marketplace_events (beat_id, event_type, created_at desc);

create index marketplace_events_producer_type_created_idx
  on public.marketplace_events (producer_profile_id, event_type, created_at desc);

create index marketplace_events_actor_created_idx
  on public.marketplace_events (actor_id, created_at desc)
  where actor_id is not null;

create index if not exists ghost_sessions_beat_activity_idx
  on public.ghost_studio_sessions (beat_id, last_active_at desc)
  where beat_id is not null;

alter table public.marketplace_events enable row level security;

revoke all on table public.marketplace_events from anon, authenticated;
grant all on table public.marketplace_events to service_role;

create or replace view public.marketplace_beat_metrics
with (security_invoker = true)
as
with event_totals as (
  select
    beat_id,
    count(*) filter (where event_type = 'beat_play')::bigint as plays,
    count(*) filter (where event_type = 'beat_favorite')::bigint as favorites,
    count(*) filter (where event_type = 'beat_add')::bigint as project_adds
  from public.marketplace_events
  group by beat_id
),
session_rows as (
  select
    case
      when beat_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then beat_id::uuid
      when beat_id ~* '^producer-beat-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then substring(beat_id from 15)::uuid
      else null
    end as beat_id,
    completion_pct,
    booth_score,
    is_active,
    last_active_at
  from public.ghost_studio_sessions
  where beat_id is not null
),
session_totals as (
  select
    beat_id,
    count(*)::bigint as session_count,
    count(*) filter (where completion_pct >= 100)::bigint as tracks_finished,
    count(*) filter (
      where is_active = true
        and last_active_at >= now() - interval '1 hour'
    )::bigint as writing_now,
    coalesce(
      round(100.0 * count(*) filter (where completion_pct >= 100) / nullif(count(*), 0)),
      0
    )::integer as completion_rate,
    coalesce(round(avg(booth_score) filter (where booth_score > 0)), 0)::integer as booth_ready_score
  from session_rows
  where beat_id is not null
  group by beat_id
)
select
  beats.id as beat_id,
  coalesce(events.plays, 0)::bigint as plays,
  coalesce(events.favorites, 0)::bigint as favorites,
  coalesce(events.project_adds, 0)::bigint as project_adds,
  coalesce(sessions.session_count, 0)::bigint as session_count,
  coalesce(sessions.tracks_finished, 0)::bigint as tracks_finished,
  coalesce(sessions.writing_now, 0)::bigint as writing_now,
  coalesce(sessions.completion_rate, 0)::integer as completion_rate,
  coalesce(sessions.booth_ready_score, 0)::integer as booth_ready_score
from public.producer_beats as beats
left join event_totals as events on events.beat_id = beats.id
left join session_totals as sessions on sessions.beat_id = beats.id;

revoke all on table public.marketplace_beat_metrics from anon, authenticated;
grant select on table public.marketplace_beat_metrics to service_role;
