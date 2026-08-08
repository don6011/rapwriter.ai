-- RapWriter Launch Content Pass: curated starter catalog depth and Producer HQ referrals.

create table if not exists public.starter_beat_collections (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 400),
  mood text,
  tags text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.starter_beat_collections (slug, title, description, mood, tags, sort_order)
values
  ('midnight-sessions', 'Midnight Sessions', 'Low-light records for reflective hooks and after-hours writing.', 'Late Night', array['Late Night', 'Melodic', 'R&B'], 10),
  ('memphis-pressure', 'Memphis Pressure', 'Dark Southern pockets with weight, tension, and room for bars.', 'Pressure', array['Memphis', 'Trap', 'Street'], 20),
  ('story-mode', 'Story Mode', 'Open arrangements for detail, memory, and complete verses.', 'Reflective', array['Storytelling', 'Soul', 'Pain'], 30),
  ('trap-energy', 'Trap Energy', 'Immediate drums for direct hooks, flex records, and harder delivery.', 'Energy', array['Trap', 'Hustle', 'Club'], 40),
  ('commercial-drive', 'Commercial Drive', 'Clean pockets built for repeatable hooks and polished demos.', 'Confident', array['Commercial', 'Hooks', 'Replay'], 50)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  mood = excluded.mood,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.starter_beats
  add column if not exists collection_slug text references public.starter_beat_collections(slug) on delete set null,
  add column if not exists energy text check (energy is null or energy in ('low', 'medium', 'high')),
  add column if not exists writing_fit text[] not null default '{}';

create index if not exists starter_beats_collection_idx
  on public.starter_beats(collection_slug, sort_order)
  where is_active = true;

update public.starter_beats
set collection_slug = 'midnight-sessions', energy = 'low', writing_fit = array['Hooks', 'Melodic writing', 'Late-night records']
where slug = 'city-shadows';

update public.starter_beats
set collection_slug = 'trap-energy', energy = 'high', writing_fit = array['Trap verses', 'Southern flow', 'Performance practice']
where slug = 'southern-strut';

update public.starter_beats
set collection_slug = 'memphis-pressure', energy = 'high', writing_fit = array['Street records', 'Punchlines', 'Dark hooks']
where slug = 'grime-in-the-shadows';

drop trigger if exists starter_beat_collections_set_updated_at on public.starter_beat_collections;
create trigger starter_beat_collections_set_updated_at
  before update on public.starter_beat_collections
  for each row execute function public.set_updated_at();

alter table public.starter_beat_collections enable row level security;
drop policy if exists "starter_beat_collections_select_active" on public.starter_beat_collections;
create policy "starter_beat_collections_select_active"
  on public.starter_beat_collections for select to anon, authenticated
  using (is_active = true);
revoke all on public.starter_beat_collections from anon, authenticated;
grant select on public.starter_beat_collections to anon, authenticated;
grant all on public.starter_beat_collections to service_role;

alter table public.producer_profiles
  add column if not exists airbit_url text,
  add column if not exists traktrain_url text,
  add column if not exists featured_until timestamptz;

create table if not exists public.producer_referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8,16}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.producer_referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.producer_referral_codes(id) on delete restrict,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'signed_up' check (status in ('signed_up', 'qualified', 'rewarded', 'rejected')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create table if not exists public.producer_growth_rewards (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  promotion_credits integer not null default 0 check (promotion_credits >= 0),
  founding_points integer not null default 0 check (founding_points >= 0),
  featured_until timestamptz,
  referral_rewards integer not null default 0 check (referral_rewards >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists producer_referrals_referrer_status_idx
  on public.producer_referrals(referrer_id, status, created_at desc);

drop trigger if exists producer_referral_codes_set_updated_at on public.producer_referral_codes;
create trigger producer_referral_codes_set_updated_at before update on public.producer_referral_codes
  for each row execute function public.set_updated_at();
drop trigger if exists producer_referrals_set_updated_at on public.producer_referrals;
create trigger producer_referrals_set_updated_at before update on public.producer_referrals
  for each row execute function public.set_updated_at();
drop trigger if exists producer_growth_rewards_set_updated_at on public.producer_growth_rewards;
create trigger producer_growth_rewards_set_updated_at before update on public.producer_growth_rewards
  for each row execute function public.set_updated_at();

alter table public.producer_referral_codes enable row level security;
alter table public.producer_referrals enable row level security;
alter table public.producer_growth_rewards enable row level security;

drop policy if exists "producer_referral_codes_select_own" on public.producer_referral_codes;
create policy "producer_referral_codes_select_own" on public.producer_referral_codes
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "producer_referrals_select_participant" on public.producer_referrals;
create policy "producer_referrals_select_participant" on public.producer_referrals
  for select to authenticated using ((select auth.uid()) in (referrer_id, referred_id));
drop policy if exists "producer_growth_rewards_select_own" on public.producer_growth_rewards;
create policy "producer_growth_rewards_select_own" on public.producer_growth_rewards
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.producer_referral_codes, public.producer_referrals, public.producer_growth_rewards from anon, authenticated;
grant select on public.producer_referral_codes, public.producer_referrals, public.producer_growth_rewards to authenticated;
grant all on public.producer_referral_codes, public.producer_referrals, public.producer_growth_rewards to service_role;

create or replace function public.get_or_create_producer_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_code text;
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (
    select 1 from public.user_roles where user_id = v_owner_id and role in ('producer', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'Producer account required';
  end if;

  select code into v_code from public.producer_referral_codes where owner_id = v_owner_id and is_active = true;
  if v_code is not null then return v_code; end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.producer_referral_codes(owner_id, code) values (v_owner_id, v_code);
      return v_code;
    exception when unique_violation then
      if exists (select 1 from public.producer_referral_codes where owner_id = v_owner_id) then
        select code into v_code from public.producer_referral_codes where owner_id = v_owner_id;
        return v_code;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.claim_producer_referral(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referred_id uuid := auth.uid();
  v_code public.producer_referral_codes%rowtype;
  v_referral_id uuid;
begin
  if v_referred_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_code
  from public.producer_referral_codes
  where code = upper(trim(p_code)) and is_active = true;
  if v_code.id is null then
    raise exception using errcode = '22023', message = 'Invite link is not valid';
  end if;
  if v_code.owner_id = v_referred_id then
    raise exception using errcode = '22023', message = 'You cannot use your own invite link';
  end if;

  insert into public.producer_referrals(referral_code_id, referrer_id, referred_id)
  values (v_code.id, v_code.owner_id, v_referred_id)
  on conflict (referred_id) do update set updated_at = now()
  returning id into v_referral_id;
  return v_referral_id;
end;
$$;

create or replace function public.evaluate_producer_referral(p_referred_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral public.producer_referrals%rowtype;
  v_reward_end timestamptz := now() + interval '30 days';
  v_owner_id uuid;
begin
  select * into v_referral
  from public.producer_referrals
  where referred_id = p_referred_id and status = 'signed_up'
  for update;
  if v_referral.id is null then return; end if;

  if not exists (
    select 1 from public.producer_profiles
    where owner_id = p_referred_id and status = 'approved' and is_public = true
  ) or not exists (
    select 1 from public.producer_beats where owner_id = p_referred_id and status = 'approved'
  ) then
    return;
  end if;

  update public.producer_referrals
  set status = 'rewarded', qualified_at = now(), rewarded_at = now()
  where id = v_referral.id and status = 'signed_up';
  if not found then return; end if;

  foreach v_owner_id in array array[v_referral.referrer_id, v_referral.referred_id]
  loop
    insert into public.user_subscriptions (
      owner_id, plan_id, audience, status, provider, provider_subscription_id,
      current_period_start, current_period_end, metadata
    ) values (
      v_owner_id, 'producer_pro', 'producer', 'active', 'promotion',
      'producer-referral:' || v_referral.id::text || ':' || v_owner_id::text,
      now(), v_reward_end, jsonb_build_object('source', 'producer_referral', 'referral_id', v_referral.id)
    ) on conflict (provider, provider_subscription_id) where provider_subscription_id is not null do nothing;

    insert into public.producer_growth_rewards (
      owner_id, promotion_credits, founding_points, featured_until, referral_rewards
    ) values (v_owner_id, 3, 500, v_reward_end, 1)
    on conflict (owner_id) do update set
      promotion_credits = public.producer_growth_rewards.promotion_credits + 3,
      founding_points = public.producer_growth_rewards.founding_points + 500,
      featured_until = greatest(coalesce(public.producer_growth_rewards.featured_until, now()), v_reward_end),
      referral_rewards = public.producer_growth_rewards.referral_rewards + 1,
      updated_at = now();

    update public.producer_profiles
    set featured_until = greatest(coalesce(featured_until, now()), v_reward_end)
    where owner_id = v_owner_id;
  end loop;
end;
$$;

create or replace function public.evaluate_producer_referral_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.evaluate_producer_referral(new.owner_id);
  return new;
end;
$$;

drop trigger if exists producer_profile_referral_qualification on public.producer_profiles;
create trigger producer_profile_referral_qualification
  after insert or update of status, is_public on public.producer_profiles
  for each row execute function public.evaluate_producer_referral_trigger();

drop trigger if exists producer_beat_referral_qualification on public.producer_beats;
create trigger producer_beat_referral_qualification
  after insert or update of status on public.producer_beats
  for each row execute function public.evaluate_producer_referral_trigger();

revoke all on function public.get_or_create_producer_referral_code() from public, anon;
revoke all on function public.claim_producer_referral(text) from public, anon;
revoke all on function public.evaluate_producer_referral(uuid) from public, anon, authenticated;
revoke all on function public.evaluate_producer_referral_trigger() from public, anon, authenticated;
grant execute on function public.get_or_create_producer_referral_code() to authenticated;
grant execute on function public.claim_producer_referral(text) to authenticated;
grant execute on function public.evaluate_producer_referral(uuid) to service_role;

