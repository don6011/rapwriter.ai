import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { bundlePriceEnvKey, createStripeClient, getOrCreateStripeCustomer, subscriptionPriceEnvKey } from "@/lib/server/stripe-billing";
import { getMembershipForUser } from "@/lib/server/membership";
import type { MembershipAudience } from "@/lib/membership";

const schema = z.object({
  plan_id: z.string().regex(/^(artist|producer)_[a-z0-9_]+$/).optional(),
  bundle_id: z.string().regex(/^[a-z0-9_]+$/).optional(),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
}).refine((value) => Boolean(value.plan_id) !== Boolean(value.bundle_id), {
  message: "Choose one plan or bundle.",
});

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "subscription-checkout",
    limit: 10,
    windowSeconds: 10 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = await parseJson(request, schema);
  if (parsed.response) return parsed.response;
  const stripe = createStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Subscriptions are waiting for Stripe configuration.", code: "stripe_not_configured" }, { status: 503 });
  }

  if (parsed.data.bundle_id) {
    const { data: bundle, error: bundleError } = await supabase
      .from("membership_bundles")
      .select("id, name, included_plan_ids, stripe_monthly_price_id, stripe_annual_price_id")
      .eq("id", parsed.data.bundle_id)
      .eq("is_active", true)
      .eq("is_public", true)
      .maybeSingle();
    if (bundleError) return NextResponse.json({ error: bundleError.message }, { status: 500 });
    if (!bundle) return NextResponse.json({ error: "Membership bundle not found." }, { status: 404 });

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "producer")
      .maybeSingle();
    if (!role) {
      return NextResponse.json({ error: "Set up Producer HQ before choosing All Access." }, { status: 403 });
    }

    const membership = await getMembershipForUser(supabase, user.id).catch(() => null);
    if (!membership) return NextResponse.json({ error: "Membership is temporarily unavailable." }, { status: 503 });
    if (membership.artist?.provider === "stripe" || membership.producer?.provider === "stripe") {
      return NextResponse.json(
        { error: "Manage your current membership before switching to All Access.", code: "active_subscription_exists" },
        { status: 409 },
      );
    }

    const includedPlanIds = Array.isArray(bundle.included_plan_ids)
      ? bundle.included_plan_ids.filter((value): value is string => typeof value === "string")
      : [];
    const { data: includedPlans, error: includedPlansError } = await supabase
      .from("subscription_plans")
      .select("id, audience, tier")
      .in("id", includedPlanIds)
      .eq("is_active", true);
    if (includedPlansError) return NextResponse.json({ error: includedPlansError.message }, { status: 500 });
    if (includedPlans?.length !== includedPlanIds.length || !includedPlans.some((plan) => plan.audience === "artist") || !includedPlans.some((plan) => plan.audience === "producer")) {
      return NextResponse.json({ error: "Membership bundle configuration is incomplete." }, { status: 503 });
    }

    const columnPrice = parsed.data.interval === "annual" ? bundle.stripe_annual_price_id : bundle.stripe_monthly_price_id;
    const priceId = columnPrice || process.env[bundlePriceEnvKey(bundle.id, parsed.data.interval)];
    if (!priceId) {
      return NextResponse.json(
        { error: `${bundle.name} checkout is not configured yet.`, code: "stripe_price_not_configured" },
        { status: 503 },
      );
    }

    try {
      const customer = await getOrCreateStripeCustomer(stripe, user);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
      const metadata = { user_id: user.id, bundle_id: bundle.id, checkout_kind: "membership_bundle" };
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer,
        client_reference_id: user.id,
        success_url: `${appUrl}/?view=profile&subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?view=profile&subscription=cancelled`,
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata,
        subscription_data: { metadata },
      });
      return NextResponse.json({ checkout_url: session.url, id: session.id });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not start All Access checkout." },
        { status: 502 },
      );
    }
  }

  if (!parsed.data.plan_id) {
    return NextResponse.json({ error: "Choose a membership plan." }, { status: 400 });
  }

  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("id, audience, tier, name, stripe_monthly_price_id, stripe_annual_price_id")
    .eq("id", parsed.data.plan_id)
    .eq("is_active", true)
    .eq("is_public", true)
    .maybeSingle();
  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });
  if (!plan || plan.tier < 1) return NextResponse.json({ error: "Paid plan not found." }, { status: 404 });
  const audience: MembershipAudience | null = plan.audience === "artist" || plan.audience === "producer"
    ? plan.audience as MembershipAudience
    : null;
  if (!audience) return NextResponse.json({ error: "Plan audience is invalid." }, { status: 500 });

  if (audience === "producer") {
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "producer").maybeSingle();
    if (!role) return NextResponse.json({ error: "Create your producer profile before choosing Producer Pro." }, { status: 403 });
  }

  const membership = await getMembershipForUser(supabase, user.id).catch(() => null);
  if (!membership) return NextResponse.json({ error: "Membership is temporarily unavailable." }, { status: 503 });
  if (membership[audience]?.source === "subscription") {
    return NextResponse.json(
      { error: "Manage your existing membership before starting another.", code: "active_subscription_exists" },
      { status: 409 },
    );
  }

  const columnPrice = parsed.data.interval === "annual" ? plan.stripe_annual_price_id : plan.stripe_monthly_price_id;
  const priceId = columnPrice || process.env[subscriptionPriceEnvKey(plan.id, parsed.data.interval)];
  if (!priceId) {
    return NextResponse.json(
      { error: `${plan.name} checkout is not configured yet.`, code: "stripe_price_not_configured" },
      { status: 503 },
    );
  }

  try {
    const customer = await getOrCreateStripeCustomer(stripe, user);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      success_url: `${appUrl}/?view=profile&subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?view=profile&subscription=cancelled`,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id: user.id, plan_id: plan.id, audience },
      subscription_data: { metadata: { user_id: user.id, plan_id: plan.id, audience } },
    });
    return NextResponse.json({ checkout_url: session.url, id: session.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start subscription checkout." },
      { status: 502 },
    );
  }
}
