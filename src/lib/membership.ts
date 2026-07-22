import type { AppRole } from "@/lib/access-control";

export const membershipAudiences = ["artist", "producer"] as const;
export type MembershipAudience = (typeof membershipAudiences)[number];
export type EntitlementValue = boolean | number | string | null;
export type EntitlementValues = Record<string, EntitlementValue>;

export type PlanDefinition = {
  id: string;
  audience: MembershipAudience;
  tier: number;
  name: string;
  tagline: string;
  monthly_price_cents: number;
  annual_price_cents: number | null;
  currency: string;
  entitlements: EntitlementValues;
  limits: EntitlementValues;
  metadata: Record<string, unknown>;
};

export type SubscriptionRecord = {
  id: string;
  plan_id: string;
  audience: MembershipAudience;
  status: string;
  provider: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  grace_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type EntitlementGrantRecord = {
  audience: MembershipAudience | null;
  entitlement_key: string;
  entitlement_value: unknown;
  starts_at: string;
  ends_at: string | null;
};

export type UsageRecord = {
  metric: string;
  period_start: string;
  period_end: string;
  quantity: number;
};

export type WorkspaceMembership = {
  audience: MembershipAudience;
  plan: PlanDefinition;
  status: string;
  source: "free" | "subscription";
  renews_at: string | null;
  cancel_at_period_end: boolean;
  entitlements: EntitlementValues;
  limits: EntitlementValues;
  usage: Record<string, number>;
};

export type MembershipSnapshot = {
  roles: AppRole[];
  artist: WorkspaceMembership | null;
  producer: WorkspaceMembership | null;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function validDate(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isSubscriptionEffective(subscription: SubscriptionRecord, now = new Date()) {
  const timestamp = now.getTime();
  if (ACTIVE_STATUSES.has(subscription.status)) {
    const trialEnd = subscription.status === "trialing" ? validDate(subscription.trial_end) : null;
    return trialEnd === null || trialEnd > timestamp;
  }

  if (subscription.status === "canceled") {
    const periodEnd = validDate(subscription.current_period_end);
    return periodEnd !== null && periodEnd > timestamp;
  }

  if (subscription.status === "past_due") {
    const graceEnd = validDate(subscription.grace_period_end);
    return graceEnd !== null && graceEnd > timestamp;
  }

  return false;
}

function isGrantEffective(grant: EntitlementGrantRecord, now: Date) {
  const timestamp = now.getTime();
  const start = validDate(grant.starts_at);
  const end = validDate(grant.ends_at);
  return start !== null && start <= timestamp && (end === null || end > timestamp);
}

function normalizeValue(value: unknown): EntitlementValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function applyGrants(
  audience: MembershipAudience,
  grants: EntitlementGrantRecord[],
  entitlements: EntitlementValues,
  limits: EntitlementValues,
  now: Date,
) {
  for (const grant of grants) {
    if (grant.audience && grant.audience !== audience) continue;
    if (!isGrantEffective(grant, now)) continue;
    const value = normalizeValue(grant.entitlement_value);
    if (value === undefined) continue;
    if (grant.entitlement_key.startsWith("limit.")) {
      limits[grant.entitlement_key.slice("limit.".length)] = value;
    } else {
      entitlements[grant.entitlement_key] = value;
    }
  }
}

function workspaceForAudience(
  audience: MembershipAudience,
  plans: PlanDefinition[],
  subscriptions: SubscriptionRecord[],
  grants: EntitlementGrantRecord[],
  usageRows: UsageRecord[],
  now: Date,
): WorkspaceMembership | null {
  const audiencePlans = plans.filter((plan) => plan.audience === audience).sort((a, b) => a.tier - b.tier);
  const freePlan = audiencePlans[0];
  if (!freePlan) return null;

  const activeSubscriptions = subscriptions
    .filter((subscription) => subscription.audience === audience && isSubscriptionEffective(subscription, now))
    .map((subscription) => ({ subscription, plan: audiencePlans.find((plan) => plan.id === subscription.plan_id) }))
    .filter((entry): entry is { subscription: SubscriptionRecord; plan: PlanDefinition } => Boolean(entry.plan))
    .sort((a, b) => b.plan.tier - a.plan.tier);

  const selected = activeSubscriptions[0] ?? null;
  const plan = selected?.plan ?? freePlan;
  const entitlements = { ...plan.entitlements };
  const limits = { ...plan.limits };
  applyGrants(audience, grants, entitlements, limits, now);

  const usage = Object.fromEntries(
    usageRows
      .filter((row) => {
        const start = validDate(row.period_start);
        const end = validDate(row.period_end);
        return start !== null && end !== null && start <= now.getTime() && end > now.getTime();
      })
      .map((row) => [row.metric, Number(row.quantity) || 0]),
  );

  return {
    audience,
    plan,
    status: selected?.subscription.status ?? "free",
    source: selected ? "subscription" : "free",
    renews_at: selected?.subscription.current_period_end ?? null,
    cancel_at_period_end: selected?.subscription.cancel_at_period_end ?? false,
    entitlements,
    limits,
    usage,
  };
}

export function resolveMembership(input: {
  roles: AppRole[];
  plans: PlanDefinition[];
  subscriptions?: SubscriptionRecord[];
  grants?: EntitlementGrantRecord[];
  usage?: UsageRecord[];
  now?: Date;
}): MembershipSnapshot {
  const now = input.now ?? new Date();
  const subscriptions = input.subscriptions ?? [];
  const grants = input.grants ?? [];
  const usage = input.usage ?? [];
  const isAdmin = input.roles.includes("admin");

  return {
    roles: input.roles,
    artist: input.roles.includes("artist") || isAdmin
      ? workspaceForAudience("artist", input.plans, subscriptions, grants, usage, now)
      : null,
    producer: input.roles.includes("producer") || isAdmin
      ? workspaceForAudience("producer", input.plans, subscriptions, grants, usage, now)
      : null,
  };
}

export function hasEntitlement(
  membership: MembershipSnapshot | null | undefined,
  audience: MembershipAudience,
  key: string,
) {
  return membership?.[audience]?.entitlements[key] === true;
}

export function entitlementLimit(
  membership: MembershipSnapshot | null | undefined,
  audience: MembershipAudience,
  key: string,
) {
  const value = membership?.[audience]?.limits[key];
  return typeof value === "number" ? value : 0;
}
