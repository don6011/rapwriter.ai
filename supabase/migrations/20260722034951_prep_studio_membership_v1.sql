-- Prep Studio Membership separates artist capability from owned Store assets.
-- Stable plan IDs are preserved so existing subscriptions and Stripe metadata
-- continue resolving without a data migration.

update public.subscription_plans
set
  name = 'Prep Studio Free',
  tagline = 'Start the record.',
  monthly_price_cents = 0,
  annual_price_cents = 0,
  entitlements = '{
    "writing_pad": true,
    "writer_flow": true,
    "basic_studio": true,
    "marketplace_browse": true,
    "marketplace_purchase": true,
    "beat_previews": true,
    "basic_booth_ready": true,
    "booth_ready_lite": true,
    "ghostwriter": true,
    "basic_ghostwriter": true,
    "full_pen_view": false,
    "producer_pass": false,
    "commercial_pass": false,
    "hook_doctor": false,
    "rewrite": false,
    "advanced_booth_ready": false,
    "producer_notes": false,
    "studio_dna_full": false,
    "ai_session_memory": false,
    "advanced_lyric_intelligence": false,
    "commercial_intelligence": false,
    "performance_intelligence": false,
    "performance_coach": false,
    "premium_exports": false,
    "cloud_sync": true,
    "multi_device_cloud_sync": false,
    "version_history": false,
    "producer_connections": false,
    "producer_messaging": false,
    "priority_ai": false,
    "unlimited_priority_ai": false,
    "elite_rooms": false,
    "exclusive_releases": false,
    "elite_badge": false,
    "early_features": false
  }'::jsonb,
  limits = '{
    "active_projects": 3,
    "song_storage": 12,
    "ghostwriter_actions_monthly": 3,
    "studio_rooms": 1,
    "ai_pens": 1,
    "storage_mb": 250,
    "priority_ai_actions_monthly": 0
  }'::jsonb,
  metadata = '{"brand":"Prep Studio","outcome":"Experience RapWriter","positioning":"Prove the value of a better writing room"}'::jsonb,
  updated_at = now()
where id = 'artist_free';

update public.subscription_plans
set
  name = 'Prep Studio Pro',
  tagline = 'Finish better records.',
  monthly_price_cents = 1499,
  annual_price_cents = 14990,
  entitlements = '{
    "writing_pad": true,
    "writer_flow": true,
    "basic_studio": true,
    "marketplace_browse": true,
    "marketplace_purchase": true,
    "beat_previews": true,
    "basic_booth_ready": true,
    "booth_ready_lite": true,
    "ghostwriter": true,
    "basic_ghostwriter": true,
    "full_pen_view": true,
    "producer_pass": true,
    "commercial_pass": true,
    "hook_doctor": true,
    "rewrite": true,
    "advanced_booth_ready": true,
    "producer_notes": true,
    "studio_dna_full": true,
    "ai_session_memory": true,
    "advanced_lyric_intelligence": true,
    "commercial_intelligence": false,
    "performance_intelligence": false,
    "performance_coach": false,
    "premium_exports": true,
    "cloud_sync": true,
    "multi_device_cloud_sync": true,
    "version_history": true,
    "producer_connections": true,
    "producer_messaging": false,
    "priority_ai": true,
    "unlimited_priority_ai": false,
    "elite_rooms": false,
    "exclusive_releases": false,
    "elite_badge": false,
    "early_features": false
  }'::jsonb,
  limits = '{
    "active_projects": -1,
    "song_storage": -1,
    "ghostwriter_actions_monthly": 80,
    "studio_rooms": 8,
    "ai_pens": 6,
    "storage_mb": 5000,
    "priority_ai_actions_monthly": 100
  }'::jsonb,
  metadata = '{"brand":"Prep Studio","outcome":"Finish better records","positioning":"Everything that improves the writing process"}'::jsonb,
  updated_at = now()
where id = 'artist_pro';

update public.subscription_plans
set
  name = 'Prep Studio Elite',
  tagline = 'Turn serious records into a career.',
  monthly_price_cents = 2999,
  annual_price_cents = 29990,
  entitlements = '{
    "writing_pad": true,
    "writer_flow": true,
    "basic_studio": true,
    "marketplace_browse": true,
    "marketplace_purchase": true,
    "beat_previews": true,
    "basic_booth_ready": true,
    "booth_ready_lite": true,
    "ghostwriter": true,
    "basic_ghostwriter": true,
    "full_pen_view": true,
    "producer_pass": true,
    "commercial_pass": true,
    "hook_doctor": true,
    "rewrite": true,
    "advanced_booth_ready": true,
    "producer_notes": true,
    "studio_dna_full": true,
    "ai_session_memory": true,
    "advanced_lyric_intelligence": true,
    "commercial_intelligence": true,
    "performance_intelligence": true,
    "performance_coach": true,
    "premium_exports": true,
    "cloud_sync": true,
    "multi_device_cloud_sync": true,
    "version_history": true,
    "producer_connections": true,
    "producer_messaging": true,
    "priority_ai": true,
    "unlimited_priority_ai": true,
    "elite_rooms": true,
    "exclusive_releases": true,
    "elite_badge": true,
    "early_features": true
  }'::jsonb,
  limits = '{
    "active_projects": -1,
    "song_storage": -1,
    "ghostwriter_actions_monthly": 250,
    "studio_rooms": 12,
    "ai_pens": -1,
    "storage_mb": 20000,
    "priority_ai_actions_monthly": -1
  }'::jsonb,
  metadata = '{"brand":"Prep Studio","outcome":"Build a professional creative practice","positioning":"Career-focused intelligence for serious creators"}'::jsonb,
  updated_at = now()
where id = 'artist_studio';

update public.subscription_plans
set
  metadata = coalesce(metadata, '{}'::jsonb) || '{"brand":"Producer HQ","separate_from_artist_membership":true,"supports_future_all_access":true}'::jsonb,
  updated_at = now()
where audience = 'producer';
