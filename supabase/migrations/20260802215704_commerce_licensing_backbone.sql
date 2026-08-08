create table public.commerce_fee_rules (
  item_type text primary key check (item_type in ('product_entitlement', 'beat_license', 'producer_service')),
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 10000),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.commerce_fee_rules (item_type, platform_fee_bps)
values
  ('product_entitlement', 0),
  ('beat_license', 1000),
  ('producer_service', 1000)
on conflict (item_type) do nothing;

create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('RW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  buyer_id uuid references auth.users(id) on delete set null,
  seller_owner_id uuid references auth.users(id) on delete set null,
  seller_profile_id uuid references public.producer_profiles(id) on delete set null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'fulfilled', 'canceled', 'refund_pending', 'refunded', 'disputed')),
  provider text not null default 'stripe' check (provider in ('stripe', 'manual')),
  provider_checkout_id text,
  provider_payment_id text,
  idempotency_key text not null,
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  platform_fee_cents bigint not null default 0 check (platform_fee_cents >= 0),
  seller_earnings_cents bigint not null default 0 check (seller_earnings_cents >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  expires_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, idempotency_key),
  check (total_cents = subtotal_cents - discount_cents + tax_cents),
  check (
    (seller_owner_id is null and platform_fee_cents = 0 and seller_earnings_cents = 0)
    or
    (seller_owner_id is not null and platform_fee_cents + seller_earnings_cents = subtotal_cents - discount_cents)
  )
);

create unique index commerce_orders_provider_checkout_unique
  on public.commerce_orders(provider, provider_checkout_id)
  where provider_checkout_id is not null;
create unique index commerce_orders_provider_payment_unique
  on public.commerce_orders(provider, provider_payment_id)
  where provider_payment_id is not null;
create index commerce_orders_buyer_created_idx on public.commerce_orders(buyer_id, created_at desc);
create index commerce_orders_seller_created_idx on public.commerce_orders(seller_owner_id, created_at desc);
create index commerce_orders_status_created_idx on public.commerce_orders(status, created_at desc);

create table public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  item_type text not null check (item_type in ('product_entitlement', 'beat_license', 'producer_service')),
  catalog_product_id text,
  beat_id uuid references public.producer_beats(id) on delete set null,
  seller_owner_id uuid references auth.users(id) on delete set null,
  seller_profile_id uuid references public.producer_profiles(id) on delete set null,
  title text not null,
  description text,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents bigint not null check (unit_amount_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  platform_fee_cents bigint not null default 0 check (platform_fee_cents >= 0),
  seller_earnings_cents bigint not null default 0 check (seller_earnings_cents >= 0),
  license_name text,
  license_terms_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(license_terms_snapshot) = 'object'),
  product_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(product_snapshot) = 'object'),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'fulfilled', 'revoked', 'refunded')),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, catalog_product_id, license_name),
  check (line_total_cents = unit_amount_cents * quantity),
  check (
    (seller_owner_id is null and platform_fee_cents = 0 and seller_earnings_cents = 0)
    or
    (seller_owner_id is not null and platform_fee_cents + seller_earnings_cents = line_total_cents)
  ),
  check (
    (item_type = 'beat_license' and beat_id is not null and license_name is not null)
    or item_type <> 'beat_license'
  )
);

create index commerce_order_items_order_idx on public.commerce_order_items(order_id);
create index commerce_order_items_seller_idx on public.commerce_order_items(seller_owner_id, created_at desc);
create index commerce_order_items_beat_idx on public.commerce_order_items(beat_id) where beat_id is not null;

create table public.beat_license_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  order_item_id uuid not null unique references public.commerce_order_items(id) on delete restrict,
  owner_id uuid references auth.users(id) on delete set null,
  producer_owner_id uuid references auth.users(id) on delete set null,
  producer_profile_id uuid references public.producer_profiles(id) on delete set null,
  beat_id uuid references public.producer_beats(id) on delete set null,
  catalog_beat_id text not null,
  beat_title text not null,
  producer_name text not null,
  license_name text not null,
  status text not null default 'active' check (status in ('active', 'disputed', 'refunded', 'revoked')),
  terms_snapshot jsonb not null check (jsonb_typeof(terms_snapshot) = 'object'),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index beat_license_grants_owner_idx on public.beat_license_grants(owner_id, created_at desc);
create index beat_license_grants_producer_idx on public.beat_license_grants(producer_owner_id, created_at desc);
create index beat_license_grants_beat_idx on public.beat_license_grants(beat_id, status);

create table public.producer_earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  order_item_id uuid not null unique references public.commerce_order_items(id) on delete restrict,
  producer_owner_id uuid references auth.users(id) on delete set null,
  producer_profile_id uuid references public.producer_profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'available', 'held', 'paid', 'reversed')),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  gross_cents bigint not null check (gross_cents >= 0),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  net_cents bigint not null check (net_cents >= 0),
  available_at timestamptz,
  paid_at timestamptz,
  payout_reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee_cents + net_cents = gross_cents)
);

create index producer_earnings_owner_idx on public.producer_earnings_ledger(producer_owner_id, created_at desc);
create index producer_earnings_status_idx on public.producer_earnings_ledger(status, available_at);

create table public.commerce_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_status text,
  new_status text,
  reason text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index commerce_order_events_order_idx on public.commerce_order_events(order_id, created_at desc);

create or replace function public.block_immutable_commerce_row_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or tg_table_name = 'commerce_order_events' then
    raise exception 'Commerce snapshots and events are immutable';
  end if;
  if row(
    new.order_id, new.item_type, new.catalog_product_id, new.beat_id,
    new.seller_owner_id, new.seller_profile_id, new.title, new.description,
    new.quantity, new.unit_amount_cents, new.line_total_cents,
    new.platform_fee_cents, new.seller_earnings_cents, new.license_name,
    new.license_terms_snapshot, new.product_snapshot, new.created_at
  ) is distinct from row(
    old.order_id, old.item_type, old.catalog_product_id, old.beat_id,
    old.seller_owner_id, old.seller_profile_id, old.title, old.description,
    old.quantity, old.unit_amount_cents, old.line_total_cents,
    old.platform_fee_cents, old.seller_earnings_cents, old.license_name,
    old.license_terms_snapshot, old.product_snapshot, old.created_at
  ) then
    raise exception 'Commerce financial snapshots are immutable';
  end if;
  return new;
end;
$$;

create trigger commerce_order_items_immutable
  before update or delete on public.commerce_order_items
  for each row execute function public.block_immutable_commerce_row_changes();
create trigger commerce_order_events_immutable
  before update or delete on public.commerce_order_events
  for each row execute function public.block_immutable_commerce_row_changes();

create trigger commerce_orders_set_updated_at before update on public.commerce_orders
  for each row execute function public.set_updated_at();
create trigger commerce_fee_rules_set_updated_at before update on public.commerce_fee_rules
  for each row execute function public.set_updated_at();
create trigger beat_license_grants_set_updated_at before update on public.beat_license_grants
  for each row execute function public.set_updated_at();
create trigger producer_earnings_ledger_set_updated_at before update on public.producer_earnings_ledger
  for each row execute function public.set_updated_at();

create or replace function public.create_commerce_order(
  p_buyer_id uuid,
  p_idempotency_key text,
  p_item_type text,
  p_catalog_product_id text,
  p_title text,
  p_description text,
  p_unit_amount_cents bigint,
  p_currency text,
  p_seller_owner_id uuid default null,
  p_seller_profile_id uuid default null,
  p_beat_id uuid default null,
  p_license_name text default null,
  p_license_terms jsonb default '{}'::jsonb,
  p_product_snapshot jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns public.commerce_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_order public.commerce_orders;
  created_order public.commerce_orders;
  fee_bps integer := 0;
  fee_cents bigint := 0;
  earnings_cents bigint := 0;
  actual_seller uuid := p_seller_owner_id;
  actual_profile uuid := p_seller_profile_id;
begin
  if p_buyer_id is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Buyer and idempotency key are required';
  end if;
  if p_item_type not in ('product_entitlement', 'beat_license', 'producer_service') then
    raise exception 'Unsupported commerce item type';
  end if;
  if p_unit_amount_cents <= 0 or lower(p_currency) !~ '^[a-z]{3}$' then
    raise exception 'Invalid order amount or currency';
  end if;

  select * into existing_order
  from public.commerce_orders
  where buyer_id = p_buyer_id and idempotency_key = p_idempotency_key;
  if found then return existing_order; end if;

  if p_item_type = 'beat_license' then
    select beats.owner_id, beats.producer_profile_id
      into actual_seller, actual_profile
    from public.producer_beats beats
    join public.producer_profiles profiles on profiles.id = beats.producer_profile_id
    where beats.id = p_beat_id
      and beats.status = 'approved'
      and profiles.status = 'approved'
      and profiles.is_public = true;
    if actual_seller is null or actual_profile is null or p_license_name is null then
      raise exception 'Beat license is not available';
    end if;
  elsif p_item_type = 'product_entitlement' then
    actual_seller := null;
    actual_profile := null;
  end if;

  if actual_seller is not null then
    select platform_fee_bps into fee_bps
    from public.commerce_fee_rules
    where item_type = p_item_type and is_active = true;
    fee_bps := coalesce(fee_bps, 0);
    fee_cents := floor((p_unit_amount_cents * fee_bps)::numeric / 10000)::bigint;
    earnings_cents := p_unit_amount_cents - fee_cents;
  end if;

  insert into public.commerce_orders (
    buyer_id, seller_owner_id, seller_profile_id, idempotency_key, currency,
    subtotal_cents, total_cents, platform_fee_cents, seller_earnings_cents,
    metadata, expires_at
  ) values (
    p_buyer_id, actual_seller, actual_profile, trim(p_idempotency_key), lower(p_currency),
    p_unit_amount_cents, p_unit_amount_cents, fee_cents, earnings_cents,
    coalesce(p_metadata, '{}'::jsonb), now() + interval '24 hours'
  ) returning * into created_order;

  insert into public.commerce_order_items (
    order_id, item_type, catalog_product_id, beat_id, seller_owner_id, seller_profile_id,
    title, description, unit_amount_cents, line_total_cents, platform_fee_cents,
    seller_earnings_cents, license_name, license_terms_snapshot, product_snapshot
  ) values (
    created_order.id, p_item_type, p_catalog_product_id, p_beat_id, actual_seller, actual_profile,
    p_title, p_description, p_unit_amount_cents, p_unit_amount_cents, fee_cents,
    earnings_cents, p_license_name, coalesce(p_license_terms, '{}'::jsonb),
    coalesce(p_product_snapshot, '{}'::jsonb)
  );

  insert into public.commerce_order_events (order_id, actor_id, event_type, new_status, details)
  values (created_order.id, p_buyer_id, 'order_created', 'pending_payment', jsonb_build_object('provider', created_order.provider));

  return created_order;
end;
$$;

create or replace function public.fulfill_commerce_order(
  p_order_id uuid,
  p_provider_checkout_id text,
  p_provider_payment_id text,
  p_amount_cents bigint,
  p_currency text
)
returns public.commerce_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.commerce_orders;
  order_item public.commerce_order_items;
  entitlement_product_id text;
  entitlement_source text;
  producer_name text;
begin
  select * into current_order from public.commerce_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if current_order.status = 'fulfilled' then return current_order; end if;
  if current_order.status not in ('pending_payment', 'paid') then raise exception 'Order cannot be fulfilled from status %', current_order.status; end if;
  if current_order.total_cents <> p_amount_cents or current_order.currency <> lower(p_currency) then
    raise exception 'Paid amount does not match order';
  end if;

  select * into order_item from public.commerce_order_items where order_id = current_order.id;
  if not found then raise exception 'Order item not found'; end if;
  entitlement_source := case when current_order.provider = 'stripe' then 'stripe' else 'admin_grant' end;

  update public.commerce_orders set
    status = 'paid', provider_checkout_id = p_provider_checkout_id,
    provider_payment_id = p_provider_payment_id, paid_at = coalesce(paid_at, now())
  where id = current_order.id;

  if order_item.item_type = 'beat_license' then
    entitlement_product_id := 'beat-license:' || order_item.beat_id::text || ':' ||
      trim(both '-' from regexp_replace(lower(order_item.license_name), '[^a-z0-9]+', '-', 'g'));
    producer_name := coalesce(order_item.product_snapshot ->> 'producer', 'RapWriter Producer');

    insert into public.beat_license_grants (
      order_id, order_item_id, owner_id, producer_owner_id, producer_profile_id, beat_id,
      catalog_beat_id, beat_title, producer_name, license_name, terms_snapshot
    ) values (
      current_order.id, order_item.id, current_order.buyer_id, order_item.seller_owner_id,
      order_item.seller_profile_id, order_item.beat_id,
      coalesce(order_item.catalog_product_id, 'producer-beat-' || order_item.beat_id::text),
      order_item.title, producer_name, order_item.license_name, order_item.license_terms_snapshot
    ) on conflict (order_item_id) do nothing;

    insert into public.beat_locker (
      owner_id, beat_id, title, producer, bpm, musical_key, mood, license, price,
      stripe_checkout_session_id, beat_snapshot
    ) values (
      current_order.buyer_id,
      coalesce(order_item.catalog_product_id, 'producer-beat-' || order_item.beat_id::text),
      order_item.title, producer_name,
      case when jsonb_typeof(order_item.product_snapshot -> 'bpm') = 'number' then (order_item.product_snapshot ->> 'bpm')::integer else null end,
      order_item.product_snapshot ->> 'key', order_item.product_snapshot ->> 'mood',
      order_item.license_name, round(order_item.unit_amount_cents::numeric / 100)::integer,
      p_provider_checkout_id,
      order_item.product_snapshot || jsonb_build_object('orderId', current_order.id, 'orderNumber', current_order.order_number)
    ) on conflict (owner_id, beat_id, license) do update set
      stripe_checkout_session_id = excluded.stripe_checkout_session_id,
      beat_snapshot = excluded.beat_snapshot,
      updated_at = now();

    insert into public.product_entitlements (
      owner_id, product_id, product_type, title, price_cents, currency, source,
      stripe_checkout_session_id, stripe_payment_intent_id, metadata
    ) values (
      current_order.buyer_id, entitlement_product_id, 'beat_license',
      order_item.title || ' - ' || order_item.license_name, order_item.unit_amount_cents::integer,
      current_order.currency, entitlement_source, p_provider_checkout_id, p_provider_payment_id,
      jsonb_build_object('orderId', current_order.id, 'producerBeatId', order_item.beat_id, 'license', order_item.license_name, 'producer', producer_name)
    ) on conflict (owner_id, product_id) do update set
      stripe_checkout_session_id = excluded.stripe_checkout_session_id,
      stripe_payment_intent_id = excluded.stripe_payment_intent_id,
      metadata = excluded.metadata,
      updated_at = now();

    insert into public.producer_earnings_ledger (
      order_id, order_item_id, producer_owner_id, producer_profile_id, currency,
      gross_cents, platform_fee_cents, net_cents, available_at
    ) values (
      current_order.id, order_item.id, order_item.seller_owner_id, order_item.seller_profile_id,
      current_order.currency, order_item.line_total_cents, order_item.platform_fee_cents,
      order_item.seller_earnings_cents, now() + interval '7 days'
    ) on conflict (order_item_id) do nothing;

    update public.producer_metrics set
      sales = sales + 1,
      revenue_cents = revenue_cents + order_item.seller_earnings_cents,
      revenue_month_cents = revenue_month_cents + order_item.seller_earnings_cents,
      revenue_year_cents = revenue_year_cents + order_item.seller_earnings_cents
    where owner_id = order_item.seller_owner_id;
  elsif order_item.item_type = 'product_entitlement' then
    insert into public.product_entitlements (
      owner_id, product_id, product_type, title, price_cents, currency, source,
      stripe_checkout_session_id, stripe_payment_intent_id, metadata
    ) values (
      current_order.buyer_id, order_item.catalog_product_id,
      order_item.product_snapshot ->> 'productType', order_item.title,
      order_item.unit_amount_cents::integer, current_order.currency, entitlement_source,
      p_provider_checkout_id, p_provider_payment_id,
      order_item.product_snapshot || jsonb_build_object('orderId', current_order.id, 'orderNumber', current_order.order_number)
    ) on conflict (owner_id, product_id) do update set
      stripe_checkout_session_id = excluded.stripe_checkout_session_id,
      stripe_payment_intent_id = excluded.stripe_payment_intent_id,
      metadata = excluded.metadata,
      updated_at = now();
  end if;

  update public.commerce_order_items set fulfillment_status = 'fulfilled', fulfilled_at = now()
  where id = order_item.id;
  update public.commerce_orders set status = 'fulfilled', fulfilled_at = now()
  where id = current_order.id returning * into current_order;
  insert into public.commerce_order_events (order_id, event_type, previous_status, new_status, details)
  values (current_order.id, 'order_fulfilled', 'pending_payment', 'fulfilled', jsonb_build_object('providerPaymentId', p_provider_payment_id));
  return current_order;
end;
$$;

create or replace function public.transition_commerce_order(
  p_order_id uuid,
  p_new_status text,
  p_reason text,
  p_actor_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns public.commerce_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.commerce_orders;
  order_item public.commerce_order_items;
  prior_status text;
begin
  if length(trim(coalesce(p_reason, ''))) < 8 then raise exception 'A reason is required'; end if;
  select * into current_order from public.commerce_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  prior_status := current_order.status;
  select * into order_item from public.commerce_order_items where order_id = current_order.id;

  if not (
    (current_order.status = 'pending_payment' and p_new_status = 'canceled') or
    (current_order.status in ('paid', 'fulfilled') and p_new_status in ('refund_pending', 'disputed')) or
    (current_order.status = 'refund_pending' and p_new_status in ('fulfilled', 'refunded')) or
    (current_order.status = 'disputed' and p_new_status in ('fulfilled', 'refunded'))
  ) then raise exception 'Invalid order transition from % to %', current_order.status, p_new_status; end if;

  if p_new_status = 'canceled' then
    update public.commerce_orders set status = p_new_status, canceled_at = now() where id = current_order.id returning * into current_order;
  elsif p_new_status = 'disputed' then
    update public.commerce_orders set status = p_new_status, disputed_at = now() where id = current_order.id returning * into current_order;
    update public.beat_license_grants set status = 'disputed' where order_id = current_order.id;
    update public.producer_earnings_ledger set status = 'held' where order_id = current_order.id and status <> 'paid';
  elsif p_new_status = 'refunded' then
    update public.commerce_orders set status = p_new_status, refunded_at = now() where id = current_order.id returning * into current_order;
    update public.commerce_order_items set fulfillment_status = 'refunded' where order_id = current_order.id;
    update public.beat_license_grants set status = 'refunded', revoked_at = now() where order_id = current_order.id;
    update public.producer_earnings_ledger set status = 'reversed' where order_id = current_order.id;
    if order_item.item_type = 'beat_license' then
      delete from public.beat_locker where owner_id = current_order.buyer_id and beat_id = order_item.catalog_product_id and license = order_item.license_name;
      delete from public.product_entitlements where owner_id = current_order.buyer_id and metadata ->> 'orderId' = current_order.id::text;
      update public.producer_metrics set
        sales = greatest(0, sales - 1),
        revenue_cents = greatest(0, revenue_cents - order_item.seller_earnings_cents),
        revenue_month_cents = greatest(0, revenue_month_cents - order_item.seller_earnings_cents),
        revenue_year_cents = greatest(0, revenue_year_cents - order_item.seller_earnings_cents)
      where owner_id = order_item.seller_owner_id;
    else
      delete from public.product_entitlements where owner_id = current_order.buyer_id and product_id = order_item.catalog_product_id;
    end if;
  elsif p_new_status = 'fulfilled' then
    update public.commerce_orders set status = p_new_status where id = current_order.id returning * into current_order;
    update public.beat_license_grants set status = 'active', revoked_at = null where order_id = current_order.id;
    update public.producer_earnings_ledger set status = 'pending' where order_id = current_order.id and status = 'held';
  else
    update public.commerce_orders set status = p_new_status where id = current_order.id returning * into current_order;
  end if;

  insert into public.commerce_order_events (order_id, actor_id, event_type, previous_status, new_status, reason, details)
  values (current_order.id, p_actor_id, 'status_changed', prior_status, p_new_status, trim(p_reason), coalesce(p_details, '{}'::jsonb));
  return current_order;
end;
$$;

alter table public.commerce_fee_rules enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.beat_license_grants enable row level security;
alter table public.producer_earnings_ledger enable row level security;
alter table public.commerce_order_events enable row level security;

create policy commerce_orders_select_participant on public.commerce_orders
  for select to authenticated
  using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_owner_id);
create policy commerce_order_items_select_participant on public.commerce_order_items
  for select to authenticated
  using (exists (
    select 1 from public.commerce_orders orders
    where orders.id = commerce_order_items.order_id
      and ((select auth.uid()) = orders.buyer_id or (select auth.uid()) = orders.seller_owner_id)
  ));
create policy beat_license_grants_select_participant on public.beat_license_grants
  for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = producer_owner_id);
create policy producer_earnings_select_own on public.producer_earnings_ledger
  for select to authenticated using ((select auth.uid()) = producer_owner_id);
create policy commerce_order_events_select_participant on public.commerce_order_events
  for select to authenticated
  using (exists (
    select 1 from public.commerce_orders orders
    where orders.id = commerce_order_events.order_id
      and ((select auth.uid()) = orders.buyer_id or (select auth.uid()) = orders.seller_owner_id)
  ));

revoke all on public.commerce_fee_rules, public.commerce_orders, public.commerce_order_items,
  public.beat_license_grants, public.producer_earnings_ledger, public.commerce_order_events
  from anon, authenticated;
grant select on public.commerce_orders, public.commerce_order_items, public.beat_license_grants,
  public.producer_earnings_ledger, public.commerce_order_events to authenticated;
grant all on public.commerce_fee_rules, public.commerce_orders, public.beat_license_grants,
  public.producer_earnings_ledger to service_role;
grant select, insert on public.commerce_order_items, public.commerce_order_events to service_role;

revoke all on function public.create_commerce_order(uuid, text, text, text, text, text, bigint, text, uuid, uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.fulfill_commerce_order(uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.transition_commerce_order(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_commerce_order(uuid, text, text, text, text, text, bigint, text, uuid, uuid, uuid, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.fulfill_commerce_order(uuid, text, text, bigint, text) to service_role;
grant execute on function public.transition_commerce_order(uuid, text, text, uuid, jsonb) to service_role;
