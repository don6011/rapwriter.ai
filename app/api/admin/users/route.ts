import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const accountActionSchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum([
    "moderator_granted",
    "moderator_revoked",
    "premium_granted",
    "premium_revoked",
    "account_suspended",
    "account_blocked",
    "account_restored",
  ]),
  reason: z.string().trim().min(8).max(500),
  plan_id: z.string().trim().max(80).optional(),
  audience: z.enum(["artist", "producer"]).optional(),
  duration_days: z.number().int().min(1).max(3650).nullable().optional(),
  internal_note: z.string().trim().max(1000).optional(),
});

type PlanJoin = { name?: string; tier?: number } | Array<{ name?: string; tier?: number }> | null;

export async function GET(request: Request) {
  const admin = await requireRole("admin");
  if (admin.response || !admin.user) return admin.response;

  const url = new URL(request.url);
  const requestedPage = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const query = url.searchParams.get("query")?.trim().toLowerCase() ?? "";
  const perPage = query ? 1000 : 50;
  const page = query ? 1 : requestedPage;
  const supabase = createAdminClient();
  const { data: accountPage, error: accountError } = await supabase.auth.admin.listUsers({ page, perPage });
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });

  const authUsers = (accountPage.users ?? []).filter((user) => {
    if (!query) return true;
    const metadata = user.user_metadata ?? {};
    return [user.email, metadata.display_name, metadata.artist_name]
      .some((value) => typeof value === "string" && value.toLowerCase().includes(query));
  });
  const userIds = authUsers.map((user) => user.id);

  if (!userIds.length) {
    return NextResponse.json({
      users: [],
      events: [],
      plans: await loadPremiumPlans(supabase),
      viewer_id: admin.user.id,
      pagination: { page: requestedPage, per_page: 50, total: query ? 0 : accountPage.total ?? 0, has_more: false },
    });
  }

  const [profilesResult, rolesResult, controlsResult, subscriptionsResult, eventsResult, plans] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, artist_name, account_type, created_at, updated_at").in("id", userIds),
    supabase.from("user_roles").select("user_id, role, granted_by, created_at").in("user_id", userIds),
    supabase.from("account_controls").select("owner_id, status, reason, internal_note, expires_at, actioned_by, updated_at").in("owner_id", userIds),
    supabase
      .from("user_subscriptions")
      .select("id, owner_id, plan_id, audience, status, provider, current_period_end, created_at, subscription_plans(name, tier)")
      .in("owner_id", userIds)
      .in("status", ["active", "trialing", "past_due", "canceled"]),
    supabase
      .from("admin_account_events")
      .select("id, subject_id, actor_id, action, reason, details, created_at")
      .in("subject_id", userIds)
      .order("created_at", { ascending: false })
      .limit(150),
    loadPremiumPlans(supabase),
  ]);

  const failed = [profilesResult, rolesResult, controlsResult, subscriptionsResult, eventsResult].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const controls = new Map((controlsResult.data ?? []).map((control) => [control.owner_id, control]));
  const rolesByUser = groupBy(rolesResult.data ?? [], "user_id");
  const subscriptionsByUser = groupBy(subscriptionsResult.data ?? [], "owner_id");
  const now = Date.now();

  const users = authUsers.map((user) => {
    const profile = profiles.get(user.id);
    const control = controls.get(user.id);
    const restrictionEffective = control?.status === "blocked"
      || (control?.status === "suspended" && (!control.expires_at || Date.parse(control.expires_at) > now));
    const subscriptions = (subscriptionsByUser.get(user.id) ?? []).flatMap((subscription) => {
      const planValue = subscription.subscription_plans as PlanJoin;
      const plan = Array.isArray(planValue) ? planValue[0] : planValue;
      const periodEnd = subscription.current_period_end ? Date.parse(subscription.current_period_end) : null;
      const effective = ["active", "trialing"].includes(subscription.status)
        ? periodEnd === null || periodEnd > now
        : subscription.status === "canceled" && periodEnd !== null && periodEnd > now;
      if (!effective) return [];
      return [{
        id: subscription.id,
        plan_id: subscription.plan_id,
        plan_name: plan?.name ?? subscription.plan_id,
        tier: Number(plan?.tier) || 0,
        audience: subscription.audience,
        provider: subscription.provider,
        current_period_end: subscription.current_period_end,
      }];
    });

    return {
      id: user.id,
      email: user.email ?? profile?.email ?? null,
      display_name: profile?.display_name ?? null,
      artist_name: profile?.artist_name ?? null,
      account_type: profile?.account_type ?? "artist",
      roles: (rolesByUser.get(user.id) ?? []).map((row) => row.role),
      status: restrictionEffective ? control?.status ?? "active" : "active",
      status_reason: restrictionEffective ? control?.reason ?? null : null,
      internal_note: restrictionEffective ? control?.internal_note ?? null : null,
      status_expires_at: restrictionEffective ? control?.expires_at ?? null : null,
      subscriptions,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      email_confirmed: Boolean(user.email_confirmed_at),
    };
  });

  const total = query ? users.length : accountPage.total ?? users.length;
  return NextResponse.json(
    {
      users,
      events: eventsResult.data ?? [],
      plans,
      viewer_id: admin.user.id,
      pagination: { page: requestedPage, per_page: 50, total, has_more: !query && requestedPage * 50 < total },
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function PATCH(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const admin = await requireRole("admin");
  if (admin.response || !admin.user) return admin.response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "admin-account-operations",
    limit: 80,
    windowSeconds: 60 * 60,
    identity: admin.user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = accountActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid account action." }, { status: 400 });
  }

  if (parsed.data.action === "premium_granted" && !parsed.data.plan_id) {
    return NextResponse.json({ error: "Choose a premium plan." }, { status: 400 });
  }
  if (parsed.data.action === "premium_revoked" && !parsed.data.audience) {
    return NextResponse.json({ error: "Choose the premium access to revoke." }, { status: 400 });
  }
  if (parsed.data.action === "account_suspended" && !parsed.data.duration_days) {
    return NextResponse.json({ error: "Choose a suspension duration." }, { status: 400 });
  }

  const details = {
    ...(parsed.data.plan_id ? { plan_id: parsed.data.plan_id } : {}),
    ...(parsed.data.audience ? { audience: parsed.data.audience } : {}),
    ...(parsed.data.duration_days ? { duration_days: parsed.data.duration_days } : {}),
    ...(parsed.data.internal_note ? { internal_note: parsed.data.internal_note } : {}),
  };
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_manage_account", {
    p_actor_id: admin.user.id,
    p_subject_id: parsed.data.user_id,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
    p_details: details,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 422 });
  return NextResponse.json({ result: data });
}

async function loadPremiumPlans(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, audience, name, tier")
    .eq("is_active", true)
    .gt("tier", 0)
    .order("audience")
    .order("tier");
  if (error) throw new Error(error.message);
  return data ?? [];
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string") continue;
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}
