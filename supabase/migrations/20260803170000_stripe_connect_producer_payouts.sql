alter table public.producer_billing_accounts
  add column if not exists details_submitted boolean not null default false,
  add column if not exists connected_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists requirements_due text[] not null default '{}';

create index if not exists producer_billing_accounts_stripe_status_idx
  on public.producer_billing_accounts(stripe_status, payouts_enabled, charges_enabled);

-- Connected account identifiers and verification state are server-controlled.
revoke insert, update, delete on public.producer_billing_accounts from authenticated;
grant select on public.producer_billing_accounts to authenticated;
grant all on public.producer_billing_accounts to service_role;
