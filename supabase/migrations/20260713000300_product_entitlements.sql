create table if not exists public.product_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  product_type text not null check (product_type in ('studio_room', 'vocal_chain', 'writing_pack', 'beat_license')),
  title text not null,
  price_cents integer not null default 0,
  currency text not null default 'usd',
  source text not null default 'dev_unlock' check (source in ('dev_unlock', 'stripe', 'admin_grant')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, product_id)
);

create index if not exists product_entitlements_owner_created_idx
  on public.product_entitlements(owner_id, created_at desc);

create index if not exists product_entitlements_owner_type_idx
  on public.product_entitlements(owner_id, product_type);

alter table public.product_entitlements enable row level security;

drop policy if exists "product_entitlements_select_own" on public.product_entitlements;
drop policy if exists "product_entitlements_insert_own" on public.product_entitlements;
drop policy if exists "product_entitlements_update_own" on public.product_entitlements;

create policy "product_entitlements_select_own"
  on public.product_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "product_entitlements_insert_own"
  on public.product_entitlements
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "product_entitlements_update_own"
  on public.product_entitlements
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop trigger if exists product_entitlements_set_updated_at on public.product_entitlements;
create trigger product_entitlements_set_updated_at
  before update on public.product_entitlements
  for each row execute function public.set_updated_at();
