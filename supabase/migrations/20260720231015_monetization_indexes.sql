create index if not exists user_subscriptions_plan_idx
  on public.user_subscriptions(plan_id);

create index if not exists entitlement_grants_granted_by_idx
  on public.entitlement_grants(granted_by)
  where granted_by is not null;

create index if not exists billing_events_owner_created_idx
  on public.billing_events(owner_id, created_at desc)
  where owner_id is not null;
