import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getMembershipForUser } from "@/lib/server/membership";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;

  try {
    const [membership, plansResult, bundlesResult] = await Promise.all([
      getMembershipForUser(supabase, user.id),
      supabase
        .from("subscription_plans")
        .select("id, audience, tier, name, tagline, monthly_price_cents, annual_price_cents, currency, entitlements, limits, metadata")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("audience")
        .order("tier"),
      supabase
        .from("membership_bundles")
        .select("id, name, tagline, monthly_price_cents, annual_price_cents, currency, included_plan_ids, metadata")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("monthly_price_cents"),
    ]);
    if (plansResult.error) throw plansResult.error;
    if (bundlesResult.error) throw bundlesResult.error;
    return NextResponse.json(
      { membership, plans: plansResult.data ?? [], bundles: bundlesResult.data ?? [], server_time: new Date().toISOString() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Membership is temporarily unavailable.", code: "membership_unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
