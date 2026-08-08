-- One account can hold artist and producer memberships independently.
-- Bundles provide one billing surface while preserving those entitlement boundaries.

create table if not exists public.membership_bundles (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null,
  tagline text not null,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  annual_price_cents integer check (annual_price_cents is null or annual_price_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  included_plan_ids text[] not null check (cardinality(included_plan_ids) >= 2),
  stripe_product_id text,
  stripe_monthly_price_id text,
  stripe_annual_price_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  is_active boolean not null default true,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.membership_bundles (
  id, name, tagline, monthly_price_cents, annual_price_cents,
  included_plan_ids, metadata
) values (
  'creator_all_access',
  'RapWriter All Access',
  'Create as an artist. Build as a producer.',
  4499,
  44990,
  array['artist_studio', 'producer_pro'],
  '{"artist_workspace":"Prep Studio Elite","producer_workspace":"Producer HQ Pro","savings_monthly_cents":999,"preserves_separate_entitlements":true}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  monthly_price_cents = excluded.monthly_price_cents,
  annual_price_cents = excluded.annual_price_cents,
  included_plan_ids = excluded.included_plan_ids,
  metadata = excluded.metadata,
  is_active = true,
  is_public = true,
  updated_at = now();

drop trigger if exists membership_bundles_set_updated_at on public.membership_bundles;
create trigger membership_bundles_set_updated_at before update on public.membership_bundles
  for each row execute function public.set_updated_at();

alter table public.membership_bundles enable row level security;

create policy "membership_bundles_select_public" on public.membership_bundles
  for select to anon, authenticated using (is_active and is_public);

revoke all on public.membership_bundles from anon, authenticated;
grant select on public.membership_bundles to anon, authenticated;
grant all on public.membership_bundles to service_role;
