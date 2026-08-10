-- Producer HQ is a free workspace. Retire the former paid producer surfaces
-- while preserving historical records for audit and billing reconciliation.

update public.subscription_plans
set
  is_active = false,
  is_public = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'retired', true,
    'retired_reason', 'Producer HQ capabilities are included free'
  ),
  updated_at = now()
where id = 'producer_pro';

update public.membership_bundles
set
  is_active = false,
  is_public = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'retired', true,
    'retired_reason', 'Producer HQ no longer requires a paid membership'
  ),
  updated_at = now()
where 'producer_pro' = any(included_plan_ids);

update public.launch_campaigns
set is_active = false, updated_at = now()
where plan_id = 'producer_pro';

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
