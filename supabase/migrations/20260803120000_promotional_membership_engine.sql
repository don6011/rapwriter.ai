-- Promotional access is intentionally separate from paid user_subscriptions.
-- Existing plan IDs remain stable; canonical_code exposes the launch vocabulary.

alter table public.subscription_plans
  add column if not exists canonical_code text;

update public.subscription_plans set canonical_code = case id
  when 'artist_free' then 'free'
  when 'artist_pro' then 'prep_studio_pro'
  when 'artist_studio' then 'prep_studio_elite'
  when 'producer_free' then 'producer_free'
  when 'producer_pro' then 'producer_pro'
  else id
end where canonical_code is null;

alter table public.subscription_plans alter column canonical_code set not null;
create unique index if not exists subscription_plans_canonical_code_idx
  on public.subscription_plans(canonical_code);

create table if not exists public.launch_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  audience text not null check (audience in ('artist', 'producer')),
  plan_id text not null references public.subscription_plans(id) on delete restrict,
  max_claims integer not null check (max_claims > 0),
  claim_count integer not null default 0 check (claim_count >= 0 and claim_count <= max_claims),
  duration_days integer not null check (duration_days between 1 and 3650),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  badge_code text check (badge_code is null or badge_code ~ '^[a-z0-9_]+$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.membership_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id) on delete restrict,
  grant_type text not null check (grant_type in ('founding_artist','founding_producer','artist_referral','producer_referral','admin','promotion','partner_campaign')),
  campaign_id uuid references public.launch_campaigns(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  granted_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists membership_grants_campaign_owner_idx
  on public.membership_grants(campaign_id, owner_id) where campaign_id is not null;
create index if not exists membership_grants_owner_active_idx
  on public.membership_grants(owner_id, status, ends_at desc);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null check (badge_code ~ '^[a-z0-9_]+$'),
  source text not null check (source in ('campaign','referral','admin','achievement')),
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  awarded_at timestamptz not null default now(),
  unique (owner_id, badge_code)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete cascade,
  referral_code text not null,
  referral_type text not null check (referral_type in ('artist','producer')),
  status text not null default 'invited' check (status in ('invited','registered','activated','qualified','rewarded','rejected')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (referred_user_id is null or referrer_user_id <> referred_user_id)
);
create unique index if not exists referrals_referred_type_idx
  on public.referrals(referred_user_id, referral_type) where referred_user_id is not null;
create index if not exists referrals_referrer_status_idx
  on public.referrals(referrer_user_id, status, created_at desc);

create table if not exists public.growth_events (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete set null,
  event_name text not null check (event_name in (
    'campaign_viewed','campaign_claim_attempted','campaign_claimed','campaign_full',
    'promo_started','promo_expired','promo_converted_to_paid','referral_created',
    'referral_registered','referral_qualified','referral_rewarded',
    'membership_upgraded','membership_downgraded'
  )),
  campaign_id uuid references public.launch_campaigns(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists growth_events_campaign_created_idx on public.growth_events(campaign_id, created_at desc);

drop trigger if exists launch_campaigns_set_updated_at on public.launch_campaigns;
create trigger launch_campaigns_set_updated_at before update on public.launch_campaigns
  for each row execute function public.set_updated_at();
drop trigger if exists membership_grants_set_updated_at on public.membership_grants;
create trigger membership_grants_set_updated_at before update on public.membership_grants
  for each row execute function public.set_updated_at();

alter table public.launch_campaigns enable row level security;
alter table public.membership_grants enable row level security;
alter table public.user_badges enable row level security;
alter table public.referrals enable row level security;
alter table public.growth_events enable row level security;

create policy "launch_campaigns_read_available" on public.launch_campaigns
  for select to authenticated using (is_active or exists (
    select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'
  ));
create policy "membership_grants_read_own" on public.membership_grants
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "user_badges_read_own" on public.user_badges
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "referrals_read_related" on public.referrals
  for select to authenticated using (referrer_user_id = (select auth.uid()) or referred_user_id = (select auth.uid()));

revoke all on public.launch_campaigns, public.membership_grants, public.user_badges, public.referrals, public.growth_events from anon, authenticated;
grant select on public.launch_campaigns, public.membership_grants, public.user_badges, public.referrals to authenticated;
grant all on public.launch_campaigns, public.membership_grants, public.user_badges, public.referrals, public.growth_events to service_role;

create or replace function public.claim_launch_campaign(campaign_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_campaign public.launch_campaigns%rowtype;
  v_grant public.membership_grants%rowtype;
  v_position integer;
begin
  if v_user is null then return jsonb_build_object('success', false, 'error', 'unauthenticated'); end if;

  insert into public.growth_events(owner_id, event_name, metadata)
  values (v_user, 'campaign_claim_attempted', jsonb_build_object('slug', campaign_slug));

  select * into v_campaign from public.launch_campaigns where slug = campaign_slug for update;
  if not found then return jsonb_build_object('success', false, 'error', 'campaign_not_found'); end if;
  if not v_campaign.is_active then return jsonb_build_object('success', false, 'error', 'campaign_inactive'); end if;
  if now() < v_campaign.starts_at then return jsonb_build_object('success', false, 'error', 'campaign_inactive'); end if;
  if now() >= v_campaign.ends_at then return jsonb_build_object('success', false, 'error', 'campaign_expired'); end if;

  select * into v_grant from public.membership_grants
    where campaign_id = v_campaign.id and owner_id = v_user;
  if found then
    return jsonb_build_object('success', false, 'error', 'already_claimed', 'campaign', v_campaign.slug);
  end if;

  if v_campaign.claim_count >= v_campaign.max_claims then
    insert into public.growth_events(owner_id, event_name, campaign_id) values (v_user, 'campaign_full', v_campaign.id);
    return jsonb_build_object('success', false, 'error', 'campaign_full', 'remaining_slots', 0);
  end if;

  v_position := v_campaign.claim_count + 1;
  insert into public.membership_grants(owner_id, plan_id, grant_type, campaign_id, starts_at, ends_at, metadata)
  values (
    v_user, v_campaign.plan_id,
    case when v_campaign.audience = 'artist' then 'founding_artist' else 'founding_producer' end,
    v_campaign.id, now(), now() + make_interval(days => v_campaign.duration_days),
    jsonb_build_object('claim_position', v_position)
  ) returning * into v_grant;

  update public.launch_campaigns set claim_count = v_position where id = v_campaign.id;
  if v_campaign.badge_code is not null then
    insert into public.user_badges(owner_id, badge_code, source, source_id)
    values (v_user, v_campaign.badge_code, 'campaign', v_campaign.id)
    on conflict (owner_id, badge_code) do nothing;
  end if;
  insert into public.growth_events(owner_id, event_name, campaign_id, metadata)
  values (v_user, 'campaign_claimed', v_campaign.id, jsonb_build_object('position', v_position)),
         (v_user, 'promo_started', v_campaign.id, jsonb_build_object('plan_id', v_campaign.plan_id));

  return jsonb_build_object(
    'success', true, 'campaign', v_campaign.slug, 'claim_position', v_position,
    'max_claims', v_campaign.max_claims, 'plan', v_campaign.plan_id,
    'starts_at', v_grant.starts_at, 'ends_at', v_grant.ends_at,
    'badge', v_campaign.badge_code, 'remaining_slots', v_campaign.max_claims - v_position
  );
exception when unique_violation then
  return jsonb_build_object('success', false, 'error', 'already_claimed');
end;
$$;

create or replace function public.get_my_entitlements()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with me as (select auth.uid() as id),
paid as (
  select us.audience, sp.id as plan_id, sp.canonical_code, sp.tier, us.current_period_start as starts_at,
    coalesce(us.current_period_end, us.trial_end, us.grace_period_end) as expires_at,
    'paid'::text as source
  from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id, me
  where us.owner_id = me.id and (
    (us.status in ('active','trialing') and coalesce(us.trial_end, us.current_period_end, 'infinity') > now()) or
    (us.status = 'canceled' and us.current_period_end > now()) or
    (us.status = 'past_due' and us.grace_period_end > now())
  )
), promo as (
  select mg.id as grant_id, sp.audience, sp.id as plan_id, sp.canonical_code, sp.tier,
    mg.starts_at, mg.ends_at as expires_at, 'promotion'::text as source, mg.grant_type
  from public.membership_grants mg join public.subscription_plans sp on sp.id = mg.plan_id, me
  where mg.owner_id = me.id and mg.status = 'active' and mg.starts_at <= now()
    and (mg.ends_at is null or mg.ends_at > now())
), candidates as (
  select audience, plan_id, canonical_code, tier, starts_at, expires_at, source from paid
  union all
  select audience, plan_id, canonical_code, tier, starts_at, expires_at, source from promo
), ranked as (
  select *, row_number() over (partition by audience order by
    case source when 'paid' then 2 else 1 end desc, tier desc, expires_at desc nulls first
  ) as rn from candidates
), defaults as (
  select audience, id as plan_id, canonical_code, tier from public.subscription_plans
  where is_active and tier = 0
), effective as (
  select d.audience, coalesce(r.plan_id, d.plan_id) plan_id,
    coalesce(r.canonical_code, d.canonical_code) canonical_code,
    coalesce(r.source, 'free') source, r.starts_at, r.expires_at
  from defaults d left join ranked r on r.audience = d.audience and r.rn = 1
), badge_list as (
  select coalesce(jsonb_agg(jsonb_build_object('code', badge_code, 'awarded_at', awarded_at) order by awarded_at), '[]'::jsonb) value
  from public.user_badges, me where owner_id = me.id
), grant_list as (
  select coalesce(jsonb_agg(jsonb_build_object('id', grant_id, 'plan', canonical_code, 'type', grant_type, 'starts_at', starts_at, 'expires_at', expires_at)), '[]'::jsonb) value from promo
)
select case when (select id from me) is null then jsonb_build_object('error','unauthenticated') else jsonb_build_object(
  'artist', (select jsonb_build_object('plan',canonical_code,'internal_plan_id',plan_id,'source',source,'starts_at',starts_at,'expires_at',expires_at) from effective where audience='artist'),
  'producer', (select jsonb_build_object('plan',canonical_code,'internal_plan_id',plan_id,'source',source,'starts_at',starts_at,'expires_at',expires_at) from effective where audience='producer'),
  'all_access', coalesce((select canonical_code='prep_studio_elite' from effective where audience='artist'),false)
    and coalesce((select canonical_code='producer_pro' from effective where audience='producer'),false),
  'badges', (select value from badge_list), 'active_grants', (select value from grant_list)
) end;
$$;

revoke execute on function public.claim_launch_campaign(text), public.get_my_entitlements() from public, anon;
grant execute on function public.claim_launch_campaign(text), public.get_my_entitlements() to authenticated;

insert into public.launch_campaigns
  (slug, name, description, audience, plan_id, max_claims, duration_days, starts_at, ends_at, is_active, badge_code, metadata)
values
  ('founding_artist_2026', 'Founding Artist', 'Thirty days of Prep Studio Pro for RapWriter launch artists.', 'artist', 'artist_pro', 1000, 30, now(), '2027-01-01T00:00:00Z', false, 'founding_artist', '{"public":true}'::jsonb),
  ('founding_producer_2026', 'Founding Producer', 'Ninety days of Producer Pro for launch producers.', 'producer', 'producer_pro', 500, 90, now(), '2027-01-01T00:00:00Z', false, 'founding_producer', '{"public":true}'::jsonb)
on conflict (slug) do nothing;
