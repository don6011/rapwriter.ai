-- Version aligned with the migration timestamp recorded by the linked project.
drop policy if exists "product_entitlements_insert_own" on public.product_entitlements;
drop policy if exists "product_entitlements_update_own" on public.product_entitlements;

-- Entitlements are purchase records. Authenticated users may read their own rows,
-- while Stripe webhooks and explicit admin grants write through the service role.
