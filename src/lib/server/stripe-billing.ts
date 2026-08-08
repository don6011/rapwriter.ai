import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, { maxNetworkRetries: 2 });
}

export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: { id: string; email: string | null },
) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("billing_customers")
    .select("provider_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.provider_customer_id) return existing.provider_customer_id;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { supabase_user_id: user.id },
  });
  const { error } = await admin.from("billing_customers").upsert(
    {
      owner_id: user.id,
      provider: "stripe",
      provider_customer_id: customer.id,
      email: user.email,
    },
    { onConflict: "owner_id" },
  );
  if (error) throw new Error(error.message);
  return customer.id;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Stripe subscription has no price.");

  const { data: customer, error: customerError } = await admin
    .from("billing_customers")
    .select("owner_id")
    .eq("provider_customer_id", customerId)
    .maybeSingle();
  if (customerError) throw new Error(customerError.message);

  const ownerId = customer?.owner_id ?? subscription.metadata.user_id ?? subscription.metadata.supabase_user_id;
  if (!ownerId) throw new Error("Stripe customer is not linked to a RapWriter account.");

  const bundleId = subscription.metadata.bundle_id;
  if (bundleId) {
    const { data: bundle, error: bundleError } = await admin
      .from("membership_bundles")
      .select("id, included_plan_ids, stripe_monthly_price_id, stripe_annual_price_id")
      .eq("id", bundleId)
      .eq("is_active", true)
      .maybeSingle();
    if (bundleError) throw new Error(bundleError.message);
    if (!bundle) throw new Error(`Membership bundle ${bundleId} is unavailable.`);

    const interval = subscription.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly";
    const configuredPrice = interval === "annual" ? bundle.stripe_annual_price_id : bundle.stripe_monthly_price_id;
    const environmentPrice = process.env[bundlePriceEnvKey(bundle.id, interval)];
    if (configuredPrice !== priceId && environmentPrice !== priceId) {
      throw new Error(`Stripe price ${priceId} is not linked to ${bundle.id}.`);
    }

    const includedPlanIds = Array.isArray(bundle.included_plan_ids)
      ? bundle.included_plan_ids.filter((value): value is string => typeof value === "string")
      : [];
    const { data: plans, error: plansError } = await admin
      .from("subscription_plans")
      .select("id, audience")
      .in("id", includedPlanIds)
      .eq("is_active", true);
    if (plansError) throw new Error(plansError.message);
    if (!plans || plans.length !== includedPlanIds.length) throw new Error("Membership bundle plans are incomplete.");

    const synced = [];
    for (const plan of plans) {
      const row = await upsertSubscription({
        planId: plan.id,
        audience: plan.audience,
        providerSubscriptionId: `${subscription.id}:${plan.audience}`,
        bundleId: bundle.id,
      });
      synced.push(row);
    }
    return synced[0];
  }

  const pricePlanResult = await admin
    .from("subscription_plans")
    .select("id, audience, stripe_monthly_price_id, stripe_annual_price_id")
    .or(`stripe_monthly_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`)
    .maybeSingle();
  if (pricePlanResult.error) throw new Error(pricePlanResult.error.message);

  let plan = pricePlanResult.data;
  if (!plan && subscription.metadata.plan_id) {
    const { data: metadataPlan, error: metadataPlanError } = await admin
      .from("subscription_plans")
      .select("id, audience, stripe_monthly_price_id, stripe_annual_price_id")
      .eq("id", subscription.metadata.plan_id)
      .maybeSingle();
    if (metadataPlanError) throw new Error(metadataPlanError.message);
    const interval = subscription.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly";
    const configuredPrice = interval === "annual" ? metadataPlan?.stripe_annual_price_id : metadataPlan?.stripe_monthly_price_id;
    const environmentPrice = metadataPlan ? process.env[subscriptionPriceEnvKey(metadataPlan.id, interval)] : null;
    if (metadataPlan && (configuredPrice === priceId || environmentPrice === priceId)) plan = metadataPlan;
  }
  if (!plan) throw new Error(`Stripe price ${priceId} is not linked to a subscription plan.`);
  return upsertSubscription({ planId: plan.id, audience: plan.audience, providerSubscriptionId: subscription.id });

  async function upsertSubscription(input: {
    planId: string;
    audience: string;
    providerSubscriptionId: string;
    bundleId?: string;
  }) {
    const values = {
      owner_id: ownerId,
      plan_id: input.planId,
      audience: input.audience,
      status: subscription.status,
      provider: "stripe",
      provider_customer_id: customerId,
      provider_subscription_id: input.providerSubscriptionId,
      provider_price_id: priceId,
      current_period_start: unixDate(subscription.current_period_start),
      current_period_end: unixDate(subscription.current_period_end),
      trial_end: unixDate(subscription.trial_end),
      grace_period_end: subscription.status === "past_due"
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: unixDate(subscription.canceled_at),
      metadata: {
        interval: subscription.items.data[0]?.price.recurring?.interval ?? null,
        latest_invoice: typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : null,
        bundle_id: input.bundleId ?? null,
        stripe_subscription_id: subscription.id,
      },
    };

    const { data: existing, error: existingError } = await admin
      .from("user_subscriptions")
      .select("id")
      .eq("provider", "stripe")
      .eq("provider_subscription_id", input.providerSubscriptionId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const result = existing
      ? await admin.from("user_subscriptions").update(values).eq("id", existing.id).select("*").single()
      : await admin.from("user_subscriptions").insert(values).select("*").single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
}

export function subscriptionPriceEnvKey(planId: string, interval: "monthly" | "annual") {
  return `STRIPE_PRICE_${planId.toUpperCase()}_${interval.toUpperCase()}`;
}

export function bundlePriceEnvKey(bundleId: string, interval: "monthly" | "annual") {
  return `STRIPE_PRICE_${bundleId.toUpperCase()}_${interval.toUpperCase()}`;
}

function unixDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}
