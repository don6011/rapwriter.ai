-- Version aligned with the migration timestamp recorded by the linked project.
alter table public.rough_takes
  add column if not exists beat_id text,
  add column if not exists beat_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists beat_position_seconds double precision not null default 0;

alter table public.rough_takes
  drop constraint if exists rough_takes_beat_snapshot_object_check,
  add constraint rough_takes_beat_snapshot_object_check
    check (jsonb_typeof(beat_snapshot) = 'object'),
  drop constraint if exists rough_takes_beat_position_seconds_check,
  add constraint rough_takes_beat_position_seconds_check
    check (beat_position_seconds >= 0 and beat_position_seconds <= 86400),
  drop constraint if exists rough_takes_beat_id_length_check,
  add constraint rough_takes_beat_id_length_check
    check (beat_id is null or char_length(beat_id) <= 200);

create index if not exists rough_takes_owner_beat_created_idx
  on public.rough_takes(owner_id, beat_id, created_at desc)
  where beat_id is not null;

alter table public.producer_beats
  drop constraint if exists producer_beats_duration_seconds_check,
  add constraint producer_beats_duration_seconds_check
    check (duration_seconds >= 0 and duration_seconds <= 7200);
