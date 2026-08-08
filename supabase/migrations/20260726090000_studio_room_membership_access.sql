update public.subscription_plans
set
  limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{studio_rooms}', '1'::jsonb, true),
  metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{studio_room_ids}', '["midnight"]'::jsonb, true)
where id = 'artist_free';

update public.subscription_plans
set
  limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{studio_rooms}', '4'::jsonb, true),
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{studio_room_ids}',
    '["midnight", "bedroom", "trap-house", "cypher"]'::jsonb,
    true
  )
where id = 'artist_pro';

update public.subscription_plans
set
  limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{studio_rooms}', '8'::jsonb, true),
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{studio_room_ids}',
    '["midnight", "bedroom", "trap-house", "cypher", "penthouse", "skyline-loft", "red-light", "radio-room"]'::jsonb,
    true
  )
where id = 'artist_studio';
