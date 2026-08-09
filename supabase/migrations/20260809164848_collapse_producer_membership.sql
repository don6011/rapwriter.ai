update public.subscription_plans as free_plan
set
  name = 'Producer HQ Free',
  tagline = 'Sell your sound. Keep 100% of sales.',
  monthly_price_cents = 0,
  annual_price_cents = 0,
  entitlements = pro_plan.entitlements,
  limits = jsonb_build_object(
    'beat_uploads', -1,
    'collections', -1,
    'promotion_campaigns', -1,
    'service_listings', -1
  ),
  metadata = coalesce(free_plan.metadata, '{}'::jsonb) || jsonb_build_object(
    'brand', 'Producer HQ',
    'outcome', 'Run your producer business',
    'separate_from_artist_membership', true,
    'supports_future_all_access', false
  ),
  updated_at = now()
from public.subscription_plans as pro_plan
where free_plan.id = 'producer_free'
  and pro_plan.id = 'producer_pro';

update public.subscription_plans
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'retired', true,
    'retired_reason', 'Producer HQ capabilities are included free'
  ),
  updated_at = now()
where id = 'producer_pro';
