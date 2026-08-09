-- Collapse current artist membership to Free and RapWriter Pro while retaining
-- the historical artist_studio row for grandfathered access resolution.

update public.subscription_plans
set
  name = 'RapWriter Free',
  tagline = 'Start the record.',
  limits = coalesce(limits, '{}'::jsonb) || jsonb_build_object(
    'active_projects', -1,
    'song_storage', -1,
    'studio_rooms', 2
  )
where id = 'artist_free';

update public.subscription_plans
set
  name = 'RapWriter Pro',
  tagline = 'Finish the record.',
  monthly_price_cents = 799,
  annual_price_cents = 5900,
  entitlements = coalesce(entitlements, '{}'::jsonb) || jsonb_build_object('priority_ai', true),
  limits = coalesce(limits, '{}'::jsonb) || jsonb_build_object(
    'active_projects', -1,
    'song_storage', -1,
    'studio_rooms', 15,
    'ghostwriter_actions_monthly', 150,
    'ai_pens', -1
  ),
  metadata = (coalesce(metadata, '{}'::jsonb) - 'retired') || jsonb_build_object(
    'brand', 'RapWriter',
    'outcome', 'Finish the record.'
  )
where id = 'artist_pro';

update public.subscription_plans
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('retired', true)
where id = 'artist_studio';
