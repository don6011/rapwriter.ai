alter type public.app_role add value if not exists 'moderator';

create table if not exists public.account_controls (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'blocked')),
  reason text,
  internal_note text,
  expires_at timestamptz,
  actioned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'active' or length(trim(coalesce(reason, ''))) >= 8),
  check (status <> 'blocked' or expires_at is null)
);

create table if not exists public.admin_account_events (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'moderator_granted',
    'moderator_revoked',
    'premium_granted',
    'premium_revoked',
    'account_suspended',
    'account_blocked',
    'account_restored'
  )),
  reason text not null check (length(trim(reason)) >= 8),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists account_controls_status_idx
  on public.account_controls(status, expires_at);
create index if not exists admin_account_events_subject_created_idx
  on public.admin_account_events(subject_id, created_at desc);
create index if not exists admin_account_events_actor_created_idx
  on public.admin_account_events(actor_id, created_at desc);

drop trigger if exists account_controls_set_updated_at on public.account_controls;
create trigger account_controls_set_updated_at
  before update on public.account_controls
  for each row execute function public.set_updated_at();

alter table public.account_controls enable row level security;
alter table public.admin_account_events enable row level security;

drop policy if exists "account_controls_select_own" on public.account_controls;
create policy "account_controls_select_own"
  on public.account_controls for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.account_controls, public.admin_account_events from anon, authenticated;
grant select on public.account_controls to authenticated;
grant all on public.account_controls, public.admin_account_events to service_role;

insert into public.account_controls (owner_id)
select id from auth.users
on conflict (owner_id) do nothing;

create or replace function private.create_account_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_controls (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.create_account_control() from public, anon, authenticated;
grant execute on function private.create_account_control() to service_role;

drop trigger if exists on_auth_user_account_control_created on auth.users;
create trigger on_auth_user_account_control_created
  after insert on auth.users
  for each row execute function private.create_account_control();

create or replace function public.admin_manage_account(
  p_actor_id uuid,
  p_subject_id uuid,
  p_action text,
  p_reason text,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_audience text;
  v_duration_days integer;
  v_expires_at timestamptz;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = p_actor_id and role = 'admin'::public.app_role
  ) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_subject_id) then
    raise exception 'Account not found.' using errcode = 'P0002';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'Add a clear reason of at least 8 characters.' using errcode = '22023';
  end if;

  if p_action in ('moderator_granted', 'moderator_revoked', 'account_suspended', 'account_blocked')
     and p_actor_id = p_subject_id then
    raise exception 'You cannot change your own staff access or account status.' using errcode = '22023';
  end if;

  if p_action in ('moderator_granted', 'moderator_revoked', 'account_suspended', 'account_blocked')
     and exists (
       select 1 from public.user_roles
       where user_id = p_subject_id and role = 'admin'::public.app_role
     ) then
    raise exception 'Owner accounts cannot be changed from the Control Room.' using errcode = '22023';
  end if;

  case p_action
    when 'moderator_granted' then
      insert into public.user_roles (user_id, role, granted_by)
      values (p_subject_id, 'moderator'::public.app_role, p_actor_id)
      on conflict (user_id, role) do nothing;

    when 'moderator_revoked' then
      delete from public.user_roles
      where user_id = p_subject_id and role = 'moderator'::public.app_role;

    when 'premium_granted' then
      select * into v_plan
      from public.subscription_plans
      where id = p_details->>'plan_id' and is_active and tier > 0;
      if not found then
        raise exception 'Choose an active premium plan.' using errcode = '22023';
      end if;
      v_duration_days := nullif(p_details->>'duration_days', '')::integer;
      if v_duration_days is not null and (v_duration_days < 1 or v_duration_days > 3650) then
        raise exception 'Premium duration must be between 1 and 3650 days.' using errcode = '22023';
      end if;
      v_expires_at := case when v_duration_days is null then null else now() + make_interval(days => v_duration_days) end;

      update public.user_subscriptions
      set status = 'expired', canceled_at = now(), updated_at = now()
      where owner_id = p_subject_id
        and audience = v_plan.audience
        and provider = 'admin'
        and status in ('active', 'trialing');

      insert into public.user_subscriptions (
        owner_id, plan_id, audience, status, provider, provider_subscription_id,
        current_period_start, current_period_end, metadata
      ) values (
        p_subject_id, v_plan.id, v_plan.audience, 'active', 'admin',
        'admin:' || gen_random_uuid()::text, now(), v_expires_at,
        jsonb_build_object('reason', trim(p_reason), 'granted_by', p_actor_id)
      );
      p_details := p_details || jsonb_build_object('audience', v_plan.audience, 'plan_name', v_plan.name, 'expires_at', v_expires_at);

    when 'premium_revoked' then
      v_audience := p_details->>'audience';
      if v_audience is null or v_audience not in ('artist', 'producer') then
        raise exception 'Choose artist or producer premium access.' using errcode = '22023';
      end if;
      update public.user_subscriptions
      set status = 'expired', canceled_at = now(), updated_at = now()
      where owner_id = p_subject_id
        and audience = v_audience
        and provider = 'admin'
        and status in ('active', 'trialing');

    when 'account_suspended' then
      v_duration_days := nullif(p_details->>'duration_days', '')::integer;
      if v_duration_days is null or v_duration_days < 1 or v_duration_days > 365 then
        raise exception 'Suspension duration must be between 1 and 365 days.' using errcode = '22023';
      end if;
      v_expires_at := now() + make_interval(days => v_duration_days);
      insert into public.account_controls (owner_id, status, reason, internal_note, expires_at, actioned_by)
      values (p_subject_id, 'suspended', trim(p_reason), nullif(trim(p_details->>'internal_note'), ''), v_expires_at, p_actor_id)
      on conflict (owner_id) do update set
        status = excluded.status,
        reason = excluded.reason,
        internal_note = excluded.internal_note,
        expires_at = excluded.expires_at,
        actioned_by = excluded.actioned_by,
        updated_at = now();
      p_details := p_details || jsonb_build_object('expires_at', v_expires_at);

    when 'account_blocked' then
      insert into public.account_controls (owner_id, status, reason, internal_note, expires_at, actioned_by)
      values (p_subject_id, 'blocked', trim(p_reason), nullif(trim(p_details->>'internal_note'), ''), null, p_actor_id)
      on conflict (owner_id) do update set
        status = excluded.status,
        reason = excluded.reason,
        internal_note = excluded.internal_note,
        expires_at = null,
        actioned_by = excluded.actioned_by,
        updated_at = now();

    when 'account_restored' then
      insert into public.account_controls (owner_id, status, reason, internal_note, expires_at, actioned_by)
      values (p_subject_id, 'active', null, null, null, p_actor_id)
      on conflict (owner_id) do update set
        status = 'active',
        reason = null,
        internal_note = null,
        expires_at = null,
        actioned_by = p_actor_id,
        updated_at = now();

    else
      raise exception 'Unsupported account action.' using errcode = '22023';
  end case;

  insert into public.admin_account_events (subject_id, actor_id, action, reason, details)
  values (p_subject_id, p_actor_id, p_action, trim(p_reason), coalesce(p_details, '{}'::jsonb));

  return jsonb_build_object('ok', true, 'action', p_action, 'subject_id', p_subject_id);
end;
$$;

revoke execute on function public.admin_manage_account(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_manage_account(uuid, uuid, text, text, jsonb) to service_role;
