import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAnyCatalogProduct } from "@/lib/product-catalog";
import { createStripeClient, syncStripeSubscription } from "@/lib/server/stripe-billing";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const stripe = createStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid Stripe signature" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const claimed = await claimEvent(event);
  if (!claimed) return NextResponse.json({ received: true, duplicate: true });

  try {
    let ownerId: string | null = null;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        ownerId = session.metadata?.user_id ?? null;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncStripeSubscription(stripe, subscription);
        } else if (session.payment_status === "paid") {
          await fulfillOneTimeCheckout(session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        ownerId = subscription.metadata.user_id ?? null;
        const synced = await syncStripeSubscription(stripe, subscription);
        ownerId = typeof synced.owner_id === "string" ? synced.owner_id : ownerId;
        break;
      }
      default:
        await markEvent(event.id, "ignored", null, ownerId);
        return NextResponse.json({ received: true, ignored: true });
    }

    await markEvent(event.id, "processed", null, ownerId);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await markEvent(event.id, "failed", message, null);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  async function claimEvent(nextEvent: Stripe.Event) {
    const { error } = await admin.from("billing_events").insert({
      provider: "stripe",
      provider_event_id: nextEvent.id,
      event_type: nextEvent.type,
      processing_status: "received",
      attempt_count: 1,
      payload: JSON.parse(JSON.stringify(nextEvent)),
    });
    if (!error) return true;
    if (error.code === "23505") {
      const { data: existing, error: readError } = await admin
        .from("billing_events")
        .select("processing_status, attempt_count")
        .eq("provider", "stripe")
        .eq("provider_event_id", nextEvent.id)
        .single();
      if (readError) throw new Error(readError.message);
      if (existing.processing_status !== "failed") return false;
      const { error: retryError } = await admin
        .from("billing_events")
        .update({
          processing_status: "received",
          attempt_count: existing.attempt_count + 1,
          error_message: null,
        })
        .eq("provider", "stripe")
        .eq("provider_event_id", nextEvent.id);
      if (retryError) throw new Error(retryError.message);
      return true;
    }
    throw new Error(error.message);
  }

  async function markEvent(
    eventId: string,
    status: "processed" | "ignored" | "failed",
    errorMessage: string | null,
    ownerId: string | null,
  ) {
    const { error } = await admin
      .from("billing_events")
      .update({
        processing_status: status,
        error_message: errorMessage,
        owner_id: ownerId,
        processed_at: status === "failed" ? null : new Date().toISOString(),
      })
      .eq("provider", "stripe")
      .eq("provider_event_id", eventId);
    if (error) throw new Error(error.message);
  }

  async function fulfillOneTimeCheckout(session: Stripe.Checkout.Session) {
    const metadata = session.metadata ?? {};
    if (metadata.checkout_kind === "beat_license") {
      const userId = metadata.user_id;
      const beatId = metadata.beat_id;
      const license = metadata.license;
      const title = metadata.beat_title;
      if (!userId || !beatId || !license || !title) throw new Error("Missing beat license metadata");

      let snapshot: Record<string, unknown> = {};
      try {
        snapshot = metadata.beat_snapshot ? JSON.parse(metadata.beat_snapshot) as Record<string, unknown> : {};
      } catch {
        snapshot = {};
      }
      const priceCents = session.amount_total ?? Number(metadata.price_cents || 0);
      const { error } = await admin.from("beat_locker").upsert(
        {
          owner_id: userId,
          beat_id: beatId,
          title,
          producer: metadata.producer || null,
          bpm: numberOrNull(snapshot.bpm),
          musical_key: stringOrNull(snapshot.key),
          mood: stringOrNull(snapshot.mood),
          license,
          price: Math.round(priceCents / 100),
          stripe_checkout_session_id: session.id,
          beat_snapshot: {
            ...snapshot,
            purchase: {
              currency: session.currency ?? "usd",
              priceCents,
              stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
            },
          },
        },
        { onConflict: "owner_id,beat_id,license" },
      );
      if (error) throw new Error(error.message);
      return;
    }

    if (metadata.checkout_kind !== "product_entitlement") return;
    const userId = metadata.user_id;
    const productId = metadata.product_id;
    if (!userId || !productId) throw new Error("Missing entitlement metadata");
    const product = getAnyCatalogProduct(productId);
    if (!product) throw new Error("Unknown marketplace product");

    const { error } = await admin.from("product_entitlements").upsert(
      {
        owner_id: userId,
        product_id: product.id,
        product_type: product.type,
        title: product.title,
        price_cents: product.priceCents,
        currency: session.currency ?? "usd",
        source: "stripe",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        metadata: { detail: product.detail, price: product.price, tags: product.tags },
      },
      { onConflict: "owner_id,product_id" },
    );
    if (error) throw new Error(error.message);
  }
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
