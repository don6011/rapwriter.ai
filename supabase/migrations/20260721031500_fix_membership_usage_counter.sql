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
  on conflict on constraint usage_counters_pkey do update
    set quantity = counters.quantity + excluded.quantity,
        period_end = excluded.period_end,
        updated_at = now()
    where p_limit < 0 or counters.quantity + excluded.quantity <= p_limit
  returning counters.quantity into v_quantity;

  if v_quantity is null then
    raise exception using errcode = 'P0001', message = 'membership usage limit reached';
  end if;

  return query select v_quantity, v_period_start, v_period_end;
end;
$$;

revoke all on function public.consume_membership_usage(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_membership_usage(uuid, text, integer, integer) to service_role;
