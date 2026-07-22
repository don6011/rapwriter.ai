create table if not exists public.artist_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  goals text[] not null default '{}',
  genres text[] not null default '{}',
  writing_styles text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_plans (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  audience text not null check (audience in ('artist', 'producer')),
  tier integer not null check (tier >= 0),
  name text not null,
  tagline text not null,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  annual_price_cents integer check (annual_price_cents is null or annual_price_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  stripe_product_id text,
  stripe_monthly_price_id text,
  stripe_annual_price_id text,
  entitlements jsonb not null default '{}'::jsonb check (jsonb_typeof(entitlements) = 'object'),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  is_active boolean not null default true,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audience, tier)
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  audience text not null check (audience in ('artist', 'producer')),
  status text not null default 'active'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete', 'incomplete_expired', 'expired')),
  provider text not null default 'internal' check (provider in ('internal', 'stripe', 'admin', 'promotion')),
  provider_customer_id text,
  provider_subscription_id text,
  provider_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  grace_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_subscriptions_provider_id_idx
  on public.user_subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists user_subscriptions_owner_audience_idx
  on public.user_subscriptions(owner_id, audience, status, current_period_end desc);

create table if not exists public.entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  audience text check (audience is null or audience in ('artist', 'producer')),
  entitlement_key text not null check (entitlement_key ~ '^[a-z0-9_]+$'),
  entitlement_value jsonb not null default 'true'::jsonb,
  source text not null check (source in ('admin', 'promotion', 'trial', 'support')),
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists entitlement_grants_owner_window_idx
  on public.entitlement_grants(owner_id, starts_at, ends_at);

create table if not exists public.usage_counters (
  owner_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric ~ '^[a-z0-9_]+$'),
  period_start timestamptz not null,
  period_end timestamptz not null,
  quantity bigint not null default 0 check (quantity >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, metric, period_start),
  check (period_end > period_start)
);

create index if not exists usage_counters_owner_period_idx
  on public.usage_counters(owner_id, period_end desc);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  owner_id uuid references auth.users(id) on delete set null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

insert into public.subscription_plans
  (id, audience, tier, name, tagline, monthly_price_cents, annual_price_cents, entitlements, limits, metadata)
values
  (
    'artist_free', 'artist', 0, 'RapWriter Free', 'Start writing.', 0, 0,
    '{"writing_pad":true,"writer_flow":true,"basic_studio":true,"marketplace_browse":true,"marketplace_purchase":true,"beat_previews":true,"basic_booth_ready":true,"full_pen_view":false,"advanced_booth_ready":false,"ghostwriter":false,"producer_notes":false,"studio_dna_full":false,"premium_exports":false,"cloud_sync":true,"version_history":false,"producer_messaging":false,"priority_ai":false}'::jsonb,
    '{"active_projects":3,"song_storage":12,"ghostwriter_actions_monthly":3,"studio_rooms":3,"ai_pens":1,"storage_mb":250}'::jsonb,
    '{"outcome":"Creation essentials"}'::jsonb
  ),
  (
    'artist_pro', 'artist', 1, 'RapWriter Pro', 'Sharpen your pen.', 1499, 14990,
    '{"writing_pad":true,"writer_flow":true,"basic_studio":true,"marketplace_browse":true,"marketplace_purchase":true,"beat_previews":true,"basic_booth_ready":true,"full_pen_view":true,"advanced_booth_ready":true,"ghostwriter":true,"producer_notes":true,"studio_dna_full":true,"premium_exports":true,"cloud_sync":true,"version_history":true,"producer_messaging":true,"priority_ai":false}'::jsonb,
    '{"active_projects":-1,"song_storage":-1,"ghostwriter_actions_monthly":80,"studio_rooms":8,"ai_pens":6,"storage_mb":5000}'::jsonb,
    '{"outcome":"Improve every record"}'::jsonb
  ),
  (
    'artist_studio', 'artist', 2, 'RapWriter Studio', 'Build serious records.', 2799, 27990,
    '{"writing_pad":true,"writer_flow":true,"basic_studio":true,"marketplace_browse":true,"marketplace_purchase":true,"beat_previews":true,"basic_booth_ready":true,"full_pen_view":true,"advanced_booth_ready":true,"ghostwriter":true,"producer_notes":true,"studio_dna_full":true,"premium_exports":true,"cloud_sync":true,"version_history":true,"producer_messaging":true,"priority_ai":true}'::jsonb,
    '{"active_projects":-1,"song_storage":-1,"ghostwriter_actions_monthly":250,"studio_rooms":12,"ai_pens":-1,"storage_mb":20000}'::jsonb,
    '{"outcome":"Maximum creative depth"}'::jsonb
  ),
  (
    'producer_free', 'producer', 0, 'Producer Free', 'Build your storefront.', 0, 0,
    '{"producer_storefront":true,"basic_licensing":true,"producer_analytics":true,"producer_intelligence":false,"catalog_import":false,"custom_storefront":false,"collections":true,"bundles":false,"custom_license_templates":false,"automatic_delivery":true,"artist_messaging":false,"service_listings":false,"promotions":false,"advanced_customer_insights":false,"priority_support":false}'::jsonb,
    '{"beat_uploads":5,"collections":1,"promotion_campaigns":0,"service_listings":0}'::jsonb,
    '{"outcome":"Start selling your sound"}'::jsonb
  ),
  (
    'producer_pro', 'producer', 1, 'Producer Pro', 'Build a serious business.', 2499, 24990,
    '{"producer_storefront":true,"basic_licensing":true,"producer_analytics":true,"producer_intelligence":true,"catalog_import":true,"custom_storefront":true,"collections":true,"bundles":true,"custom_license_templates":true,"automatic_delivery":true,"artist_messaging":true,"service_listings":true,"promotions":true,"advanced_customer_insights":true,"priority_support":true}'::jsonb,
    '{"beat_uploads":-1,"collections":-1,"promotion_campaigns":-1,"service_listings":-1}'::jsonb,
    '{"outcome":"Grow your catalog and business"}'::jsonb
  )
on conflict (id) do update set
  audience = excluded.audience,
  tier = excluded.tier,
  name = excluded.name,
  tagline = excluded.tagline,
  monthly_price_cents = excluded.monthly_price_cents,
  annual_price_cents = excluded.annual_price_cents,
  entitlements = excluded.entitlements,
  limits = excluded.limits,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.artist_profiles (owner_id)
select user_id from public.user_roles where role = 'artist'
on conflict (owner_id) do nothing;

drop trigger if exists artist_profiles_set_updated_at on public.artist_profiles;
create trigger artist_profiles_set_updated_at before update on public.artist_profiles
  for each row execute function public.set_updated_at();
drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();
drop trigger if exists user_subscriptions_set_updated_at on public.user_subscriptions;
create trigger user_subscriptions_set_updated_at before update on public.user_subscriptions
  for each row execute function public.set_updated_at();
drop trigger if exists entitlement_grants_set_updated_at on public.entitlement_grants;
create trigger entitlement_grants_set_updated_at before update on public.entitlement_grants
  for each row execute function public.set_updated_at();
drop trigger if exists usage_counters_set_updated_at on public.usage_counters;
create trigger usage_counters_set_updated_at before update on public.usage_counters
  for each row execute function public.set_updated_at();
drop trigger if exists billing_events_set_updated_at on public.billing_events;
create trigger billing_events_set_updated_at before update on public.billing_events
  for each row execute function public.set_updated_at();

alter table public.artist_profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.entitlement_grants enable row level security;
alter table public.usage_counters enable row level security;
alter table public.billing_events enable row level security;

create policy "artist_profiles_select_own" on public.artist_profiles
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "artist_profiles_insert_own" on public.artist_profiles
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "artist_profiles_update_own" on public.artist_profiles
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "subscription_plans_select_public" on public.subscription_plans
  for select to anon, authenticated using (is_active and is_public);
create policy "user_subscriptions_select_own" on public.user_subscriptions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "entitlement_grants_select_own" on public.entitlement_grants
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "usage_counters_select_own" on public.usage_counters
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.artist_profiles, public.subscription_plans, public.user_subscriptions,
  public.entitlement_grants, public.usage_counters, public.billing_events from anon, authenticated;
grant select on public.subscription_plans to anon, authenticated;
grant select, insert, update on public.artist_profiles to authenticated;
grant select on public.user_subscriptions, public.entitlement_grants, public.usage_counters to authenticated;
grant all on public.artist_profiles, public.subscription_plans, public.user_subscriptions,
  public.entitlement_grants, public.usage_counters, public.billing_events to service_role;
