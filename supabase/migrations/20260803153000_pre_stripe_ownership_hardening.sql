-- Purchased ownership is service-issued only. Users may still save free catalog
-- items and verified private imports through the existing Locker APIs.

drop policy if exists "product_entitlements_insert_own" on public.product_entitlements;
drop policy if exists "product_entitlements_update_own" on public.product_entitlements;
revoke insert, update, delete on public.product_entitlements from authenticated;
grant select on public.product_entitlements to authenticated;
grant all on public.product_entitlements to service_role;

drop policy if exists "beat_locker_insert_own" on public.beat_locker;
drop policy if exists "beat_locker_update_own" on public.beat_locker;
create policy "beat_locker_insert_noncommerce_own" on public.beat_locker
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and license in ('Favorite', 'Private Import')
    and stripe_checkout_session_id is null
  );
create policy "beat_locker_update_noncommerce_own" on public.beat_locker
  for update to authenticated
  using ((select auth.uid()) = owner_id and license in ('Favorite', 'Private Import'))
  with check (
    (select auth.uid()) = owner_id
    and license in ('Favorite', 'Private Import')
    and stripe_checkout_session_id is null
  );

create or replace function public.prevent_commerce_provider_reassignment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.provider_checkout_id is not null
    and new.provider_checkout_id is distinct from old.provider_checkout_id then
    raise exception 'Provider checkout reference is immutable';
  end if;
  if old.provider_payment_id is not null
    and new.provider_payment_id is distinct from old.provider_payment_id then
    raise exception 'Provider payment reference is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists commerce_orders_provider_refs_immutable on public.commerce_orders;
create trigger commerce_orders_provider_refs_immutable
  before update of provider_checkout_id, provider_payment_id on public.commerce_orders
  for each row execute function public.prevent_commerce_provider_reassignment();

revoke all on function public.prevent_commerce_provider_reassignment() from public, anon, authenticated;
grant execute on function public.prevent_commerce_provider_reassignment() to service_role;
