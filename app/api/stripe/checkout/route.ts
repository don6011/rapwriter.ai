import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getCatalogProduct } from "@/lib/product-catalog";
import { beatLicenseEntitlementId } from "@/lib/producer-beat-media";
import { resolveBeatCheckout } from "@/lib/server/beat-checkout";
import {
  attachProviderCheckout,
  buyerOwnsCatalogProduct,
  checkoutIdempotencyKey,
  createPendingOrder,
  transitionCommerceOrder,
  type CommerceOffer,
} from "@/lib/server/commerce";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { requireActiveProducerPayout } from "@/lib/server/stripe-connect";

const beatCheckoutSchema = z.object({
  beat_id: z.string().min(1),
  license: z.string().min(1),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

const productCheckoutSchema = z.object({
  product_id: z.string().min(1),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

const checkoutSchema = z.union([beatCheckoutSchema, productCheckoutSchema]);

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { user, response } = await requireUser();
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "stripe-checkout",
    limit: 20,
    windowSeconds: 10 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Checkout is waiting for Stripe configuration.", code: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const parsed = await parseJson(request, checkoutSchema);
  if (parsed.response) return parsed.response;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
  const data = parsed.data;
  const isProductCheckout = "product_id" in data;
  const product = isProductCheckout ? getCatalogProduct(data.product_id) : null;
  const beat = isProductCheckout ? null : await resolveBeatCheckout(data.beat_id, data.license);
  if (isProductCheckout && !product) return NextResponse.json({ error: "That Studio Store asset is not available for purchase." }, { status: 404 });
  if (!isProductCheckout && !beat) return NextResponse.json({ error: "That beat license is not available." }, { status: 404 });
  if (beat?.producerOwnerId === user.id) {
    return NextResponse.json({ error: "You already own the source catalog for this beat." }, { status: 409 });
  }
  if (product && product.priceCents <= 0) {
    return NextResponse.json({ error: "This item does not require checkout." }, { status: 422 });
  }

  const checkoutItem: {
    name: string;
    description: string;
    unitAmount: number;
    checkoutKind: "product_entitlement" | "beat_license";
    productId: string;
    productType: string;
    beatId: string;
    license: string;
    beatTitle: string;
    producer: string;
    offer: CommerceOffer;
  } = (() => {
    if (isProductCheckout) {
      if (!product) throw new Error("Unknown Studio Store asset");
      return {
        name: product.title,
        description: product.detail,
        unitAmount: product.priceCents,
        checkoutKind: "product_entitlement",
        productId: product.id,
        productType: product.type,
        beatId: "",
        license: "",
        beatTitle: "",
        producer: "",
        offer: {
          itemType: "product_entitlement",
          catalogProductId: product.id,
          title: product.title,
          description: product.detail,
          unitAmountCents: product.priceCents,
          productSnapshot: {
            productType: product.type,
            detail: product.detail,
            price: product.price,
            tags: product.tags,
          },
        },
      };
    }

    if (!beat) throw new Error("Unknown beat license");
    return {
      name: `${beat.title} - ${beat.license}`,
      description: `RapWriter beat license by ${beat.producer}`,
      unitAmount: beat.priceCents,
      checkoutKind: "beat_license",
      productId: "",
      productType: "beat_license",
      beatId: beat.beatId,
      license: beat.license,
      beatTitle: beat.title,
      producer: beat.producer,
      offer: {
        itemType: "beat_license",
        catalogProductId: beat.beatId,
        title: beat.title,
        description: `RapWriter beat license by ${beat.producer}`,
        unitAmountCents: beat.priceCents,
        sellerOwnerId: beat.producerOwnerId,
        sellerProfileId: beat.producerProfileId,
        beatId: beat.producerBeatId,
        licenseName: beat.license,
        licenseTerms: beat.licenseTerms,
        productSnapshot: beat.snapshot,
      },
    };
  })();

  const entitlementProductId = checkoutItem.checkoutKind === "beat_license"
    ? beatLicenseEntitlementId(checkoutItem.offer.beatId ?? "", checkoutItem.license)
    : checkoutItem.productId;
  if (await buyerOwnsCatalogProduct(user.id, entitlementProductId)) {
    return NextResponse.json({ error: "You already own this item.", code: "already_owned" }, { status: 409 });
  }

  const identity = checkoutItem.checkoutKind === "beat_license"
    ? `${checkoutItem.beatId}:${checkoutItem.license}`
    : checkoutItem.productId;
  const idempotencyKey = checkoutIdempotencyKey(user.id, identity, request.headers.get("idempotency-key"));
  let connectedAccountId: string | null = null;
  if (checkoutItem.checkoutKind === "beat_license" && checkoutItem.offer.sellerOwnerId) {
    try {
      connectedAccountId = await requireActiveProducerPayout(checkoutItem.offer.sellerOwnerId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Producer payouts are unavailable.", code: "producer_payout_unavailable" }, { status: 409 });
    }
  }
  const order = await createPendingOrder(user.id, idempotencyKey, checkoutItem.offer);

  if (order.provider_checkout_id) {
    const existing = await stripe.checkout.sessions.retrieve(order.provider_checkout_id);
    if (existing.status === "open" && existing.url) {
      return NextResponse.json({ checkout_url: existing.url, id: existing.id, order_id: order.id, order_number: order.order_number });
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      customer_email: user.email ?? undefined,
      success_url: safeCheckoutReturnUrl(data.success_url, appUrl, `/studio?view=locker&checkout=success&order=${order.id}`),
      cancel_url: safeCheckoutReturnUrl(data.cancel_url, appUrl, `/studio?view=market&checkout=cancelled&order=${order.id}`),
      metadata: {
        order_id: order.id,
        user_id: user.id,
        checkout_kind: checkoutItem.checkoutKind,
      },
      payment_intent_data: {
        metadata: { order_id: order.id, user_id: user.id },
        ...(connectedAccountId ? {
          ...(order.platform_fee_cents > 0 ? { application_fee_amount: order.platform_fee_cents } : {}),
          transfer_data: { destination: connectedAccountId },
        } : {}),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency,
            unit_amount: checkoutItem.unitAmount,
            product_data: {
              name: checkoutItem.name,
              description: checkoutItem.description,
            },
          },
        },
      ],
    }, { idempotencyKey: order.id });

    await attachProviderCheckout(order.id, session.id);
    return NextResponse.json({ checkout_url: session.url, id: session.id, order_id: order.id, order_number: order.order_number });
  } catch (error) {
    await transitionCommerceOrder({
      orderId: order.id,
      status: "canceled",
      reason: "Payment provider session creation failed.",
      actorId: user.id,
      details: { provider: "stripe" },
    }).catch(() => null);
    throw error;
  }
}

function safeCheckoutReturnUrl(candidate: string | undefined, appUrl: string, fallbackPath: string) {
  const origin = new URL(appUrl).origin;
  if (!candidate) return new URL(fallbackPath, origin).toString();
  try {
    const url = new URL(candidate);
    return url.origin === origin ? url.toString() : new URL(fallbackPath, origin).toString();
  } catch {
    return new URL(fallbackPath, origin).toString();
  }
}
