import { isAppRole } from "@/lib/access-control";
import {
  membershipAudiences,
  resolveMembership,
  type EntitlementGrantRecord,
  type EntitlementValue,
  type PlanDefinition,
  type SubscriptionRecord,
  type UsageRecord,
} from "@/lib/membership";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function isAudience(value: unknown): value is "artist" | "producer" {
  return typeof value === "string" && membershipAudiences.includes(value as "artist" | "producer");
}

function entitlementValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, EntitlementValue] => {
      const item = entry[1];
      return item === null || ["boolean", "number", "string"].includes(typeof item);
    }),
  );
}

function metadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function getMembershipForUser(supabase: ServerSupabaseClient, userId: string) {
  const [rolesResult, plansResult, subscriptionsResult, grantsResult, usageResult] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("subscription_plans").select("*").eq("is_active", true).eq("is_public", true).order("audience").order("tier"),
    supabase.from("user_subscriptions").select("id, plan_id, audience, status, provider, current_period_start, current_period_end, trial_end, grace_period_end, cancel_at_period_end").eq("owner_id", userId),
    supabase.from("entitlement_grants").select("audience, entitlement_key, entitlement_value, starts_at, ends_at").eq("owner_id", userId),
    supabase.from("usage_counters").select("metric, period_start, period_end, quantity").eq("owner_id", userId).gte("period_end", new Date().toISOString()),
  ]);

  const failed = [rolesResult, plansResult, subscriptionsResult, grantsResult, usageResult].find((result) => result.error);
  if (failed?.error) throw new Error("Membership data is unavailable.");

  const roles = (rolesResult.data ?? []).map((row) => row.role).filter(isAppRole);
  const plans = (plansResult.data ?? []).flatMap((row): PlanDefinition[] => {
    if (!isAudience(row.audience) || typeof row.id !== "string" || typeof row.name !== "string") return [];
    return [{
      id: row.id,
      audience: row.audience,
      tier: Number(row.tier) || 0,
      name: row.name,
      tagline: typeof row.tagline === "string" ? row.tagline : "",
      monthly_price_cents: Number(row.monthly_price_cents) || 0,
      annual_price_cents: typeof row.annual_price_cents === "number" ? row.annual_price_cents : null,
      currency: typeof row.currency === "string" ? row.currency : "usd",
      entitlements: entitlementValues(row.entitlements),
      limits: entitlementValues(row.limits),
      metadata: metadata(row.metadata),
    }];
  });
  const subscriptions = (subscriptionsResult.data ?? []).filter((row) => isAudience(row.audience)) as SubscriptionRecord[];
  const grants = (grantsResult.data ?? []).filter((row) => row.audience === null || isAudience(row.audience)) as EntitlementGrantRecord[];
  const usage = (usageResult.data ?? []) as UsageRecord[];
  const membership = resolveMembership({ roles, plans, subscriptions, grants, usage });

  if ((roles.includes("artist") || roles.includes("admin")) && !membership.artist) {
    throw new Error("Artist plan configuration is unavailable.");
  }

  return membership;
}
