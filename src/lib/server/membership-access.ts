import { NextResponse } from "next/server";
import type { MembershipAudience, WorkspaceMembership } from "@/lib/membership";
import { getMembershipForUser } from "@/lib/server/membership";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export class MembershipAccessError extends Error {
  constructor(
    message: string,
    readonly code: "upgrade_required" | "usage_limit_reached" | "membership_unavailable",
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "MembershipAccessError";
  }
}

export async function requireMembershipEntitlement(
  supabase: ServerSupabaseClient,
  userId: string,
  audience: MembershipAudience,
  entitlement: string,
) {
  const workspace = await membershipWorkspace(supabase, userId, audience);
  if (workspace.entitlements[entitlement] !== true) {
    throw new MembershipAccessError(
      "Upgrade your membership to use this feature.",
      "upgrade_required",
      402,
      accessDetails(workspace, entitlement),
    );
  }
  return workspace;
}

export async function requireMembershipLimit(
  supabase: ServerSupabaseClient,
  userId: string,
  audience: MembershipAudience,
  limitKey: string,
  currentQuantity: number,
) {
  const workspace = await membershipWorkspace(supabase, userId, audience);
  const limit = numericLimit(workspace, limitKey);
  if (limit >= 0 && currentQuantity >= limit) {
    throw new MembershipAccessError(
      "You have reached this plan's limit.",
      "usage_limit_reached",
      429,
      { ...accessDetails(workspace, limitKey), usage: currentQuantity, limit },
    );
  }
  return workspace;
}

export async function consumeMembershipUsage(
  supabase: ServerSupabaseClient,
  userId: string,
  audience: MembershipAudience,
  options: { entitlement: string; limitKey: string; metric: string; amount?: number },
) {
  const workspace = await requireMembershipEntitlement(supabase, userId, audience, options.entitlement);
  const limit = numericLimit(workspace, options.limitKey);
  const amount = options.amount ?? 1;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_membership_usage", {
    p_owner_id: userId,
    p_metric: options.metric,
    p_amount: amount,
    p_limit: limit,
  });

  if (error) {
    if (error.code === "P0001") {
      throw new MembershipAccessError(
        "You have used this month's allowance.",
        "usage_limit_reached",
        429,
        {
          ...accessDetails(workspace, options.entitlement),
          usage: workspace.usage[options.metric] ?? 0,
          limit,
        },
      );
    }
    throw new MembershipAccessError("Membership usage is temporarily unavailable.", "membership_unavailable", 503);
  }

  return { workspace, usage: Array.isArray(data) ? data[0] ?? null : data };
}

export function membershipErrorResponse(error: unknown) {
  if (error instanceof MembershipAccessError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...error.details },
      { status: error.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    { error: "Membership is temporarily unavailable.", code: "membership_unavailable" },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function membershipWorkspace(
  supabase: ServerSupabaseClient,
  userId: string,
  audience: MembershipAudience,
) {
  const membership = await getMembershipForUser(supabase, userId);
  const workspace = membership[audience];
  if (!workspace) {
    throw new MembershipAccessError("Membership is temporarily unavailable.", "membership_unavailable", 503);
  }
  return workspace;
}

function numericLimit(workspace: WorkspaceMembership, key: string) {
  const value = workspace.limits[key];
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function accessDetails(workspace: WorkspaceMembership, feature: string) {
  return {
    audience: workspace.audience,
    feature,
    current_plan: workspace.plan.id,
    recommended_plan: workspace.audience === "artist" ? "artist_pro" : "producer_pro",
  };
}
