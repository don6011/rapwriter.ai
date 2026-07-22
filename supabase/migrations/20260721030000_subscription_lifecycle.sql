create table if not exists public.billing_customers (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists billing_customers_set_updated_at on public.billing_customers;
create trigger billing_customers_set_updated_at before update on public.billing_customers
  for each row execute function public.set_updated_at();

alter table public.billing_customers enable row level security;

create policy "billing_customers_select_own" on public.billing_customers
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.billing_customers from anon, authenticated;
grant select on public.billing_customers to authenticated;
grant all on public.billing_customers to service_role;

create index if not exists billing_customers_provider_idx
  on public.billing_customers(provider, provider_customer_id);

create or replace function public.consume_membership_usage(
  p_owner_id uuid,
  p_metric text,
  p_amount integer,
  p_limit integer
)
returns table(quantity bigint, period_start timestamptz, period_end timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_quantity bigint;
begin
  if p_owner_id is null then
    raise exception using errcode = '22023', message = 'owner_id is required';
  end if;
  if p_metric !~ '^[a-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'invalid usage metric';
  end if;
  if p_amount < 1 or p_amount > 100 then
    raise exception using errcode = '22023', message = 'invalid usage amount';
  end if;

  insert into public.usage_counters as counters (
    owner_id,
    metric,
    period_start,
    period_end,
    quantity
  ) values (
    p_owner_id,
    p_metric,
    v_period_start,
    v_period_end,
    p_amount
  )
  on conflict (owner_id, metric, period_start) do update
    set quantity = counters.quantity + excluded.quantity,
        period_end = excluded.period_end,
        updated_at = now()
    where p_limit < 0 or counters.quantity + excluded.quantity <= p_limit
  returning usage_counters.quantity into v_quantity;

  if v_quantity is null then
    raise exception using errcode = 'P0001', message = 'membership usage limit reached';
  end if;

  return query select v_quantity, v_period_start, v_period_end;
end;
$$;

revoke all on function public.consume_membership_usage(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_membership_usage(uuid, text, integer, integer) to service_role;

update public.subscription_plans
set limits = limits - 'ai_pens',
    updated_at = now()
where limits ? 'ai_pens';

update public.subscription_plans
set limits = jsonb_set(limits, '{ghostwriter_actions_monthly}', '0'::jsonb, true),
    updated_at = now()
where id = 'artist_free';
