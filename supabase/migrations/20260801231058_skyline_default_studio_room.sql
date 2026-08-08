alter table public.ghost_studio_sessions
  alter column mode set default 'skyline-loft',
  alter column ambiance set default 'skyline-loft';

alter table public.songs
  alter column session_mode set default 'skyline-loft',
  alter column session_ambiance set default 'skyline-loft';

update public.subscription_plans
set
  limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{studio_rooms}', '2'::jsonb, true),
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{studio_room_ids}',
    '["skyline-loft", "midnight"]'::jsonb,
    true
  )
where id = 'artist_free';

update public.subscription_plans
set
  limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{studio_rooms}', '5'::jsonb, true),
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{studio_room_ids}',
    '["skyline-loft", "midnight", "bedroom", "trap-house", "cypher"]'::jsonb,
    true
  )
where id = 'artist_pro';

update public.subscription_plans
set
  limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{studio_rooms}', '8'::jsonb, true),
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{studio_room_ids}',
    '["skyline-loft", "midnight", "bedroom", "trap-house", "cypher", "penthouse", "red-light", "radio-room"]'::jsonb,
    true
  )
where id = 'artist_studio';
