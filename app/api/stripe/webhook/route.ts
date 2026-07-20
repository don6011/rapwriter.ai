import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCatalogProduct } from "@/lib/product-catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 });
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Stripe signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return NextResponse.json({ received: true });
  const metadata = session.metadata ?? {};
  const supabase = createAdminClient();

  if (metadata.checkout_kind === "beat_license") {
    const userId = metadata.user_id;
    const beatId = metadata.beat_id;
    const license = metadata.license;
    const title = metadata.beat_title;
    if (!userId || !beatId || !license || !title) {
      return NextResponse.json({ error: "Missing beat license metadata" }, { status: 400 });
    }

    let snapshot: Record<string, unknown> = {};
    try {
      snapshot = metadata.beat_snapshot ? JSON.parse(metadata.beat_snapshot) as Record<string, unknown> : {};
    } catch {
      snapshot = {};
    }

    const priceCents = session.amount_total ?? Number(metadata.price_cents || 0);
    const { error } = await supabase.from("beat_locker").upsert(
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ received: true });
  }

  if (metadata.checkout_kind !== "product_entitlement") return NextResponse.json({ received: true });

  const userId = metadata.user_id;
  const productId = metadata.product_id;
  if (!userId || !productId) {
    return NextResponse.json({ error: "Missing entitlement metadata" }, { status: 400 });
  }

  const product = getCatalogProduct(productId);
  if (!product) return NextResponse.json({ error: "Unknown marketplace product" }, { status: 404 });

  const { error } = await supabase.from("product_entitlements").upsert(
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
      metadata: {
        detail: product.detail,
        price: product.price,
        tags: product.tags,
      },
    },
    { onConflict: "owner_id,product_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ received: true });
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
