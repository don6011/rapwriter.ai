import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { enforceRateLimit } from "@/lib/api/rate-limit";

const claimSchema = z.object({
  code: z.string().trim().min(8).max(16).regex(/^[a-z0-9]+$/i),
});

export async function GET() {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const { data: code, error: codeError } = await supabase.rpc("get_or_create_producer_referral_code");
  if (codeError) return NextResponse.json({ error: codeError.message }, { status: 500 });

  const [referralsResult, rewardsResult] = await Promise.all([
    supabase
      .from("producer_referrals")
      .select("id, referred_id, status, qualified_at, rewarded_at, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("producer_growth_rewards")
      .select("promotion_credits, founding_points, featured_until, referral_rewards")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (referralsResult.error) return NextResponse.json({ error: referralsResult.error.message }, { status: 500 });
  if (rewardsResult.error) return NextResponse.json({ error: rewardsResult.error.message }, { status: 500 });

  const referrals = referralsResult.data ?? [];
  return NextResponse.json({
    code,
    referrals,
    invited: referrals.length,
    qualified: referrals.filter((referral) => referral.status === "qualified" || referral.status === "rewarded").length,
    rewards: rewardsResult.data ?? {
      promotion_credits: 0,
      founding_points: 0,
      featured_until: null,
      referral_rewards: 0,
    },
  });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "producer-referral-claim",
    limit: 8,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = await parseJson(request, claimSchema);
  if (parsed.response) return parsed.response;

  const { data, error } = await supabase.rpc("claim_producer_referral", {
    p_code: parsed.data.code.toUpperCase(),
  });
  if (error) {
    const status = error.code === "22023" ? 422 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ referral_id: data, status: "signed_up" }, { status: 201 });
}

