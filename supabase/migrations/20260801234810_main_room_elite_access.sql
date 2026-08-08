update public.subscription_plans
set
  limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{studio_rooms}', '9'::jsonb, true),
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{studio_room_ids}',
    '["skyline-loft", "midnight", "bedroom", "trap-house", "cypher", "penthouse", "red-light", "main-room", "radio-room"]'::jsonb,
    true
  )
where id = 'artist_studio';
