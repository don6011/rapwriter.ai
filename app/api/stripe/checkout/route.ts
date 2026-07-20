import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getCatalogProduct } from "@/lib/product-catalog";
import { resolveBeatCheckout } from "@/lib/server/beat-checkout";

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
  if (isProductCheckout && !product) return NextResponse.json({ error: "Unknown marketplace product" }, { status: 404 });
  if (!isProductCheckout && !beat) return NextResponse.json({ error: "That beat license is not available." }, { status: 404 });
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
    beatSnapshot: string;
  } = (() => {
    if (isProductCheckout) {
      if (!product) throw new Error("Unknown marketplace product");
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
        beatSnapshot: "",
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
      beatSnapshot: JSON.stringify(beat.snapshot),
    };
  })();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    success_url: data.success_url ?? `${appUrl}/?view=locker&checkout=success`,
    cancel_url: data.cancel_url ?? `${appUrl}/?view=market&checkout=cancelled`,
    metadata: {
      user_id: user.id,
      checkout_kind: checkoutItem.checkoutKind,
      product_id: checkoutItem.productId,
      product_type: checkoutItem.productType,
      title: checkoutItem.name,
      price_cents: String(checkoutItem.unitAmount),
      beat_id: checkoutItem.beatId,
      license: checkoutItem.license,
      beat_title: checkoutItem.beatTitle,
      producer: checkoutItem.producer,
      beat_snapshot: checkoutItem.beatSnapshot,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: checkoutItem.unitAmount,
          product_data: {
            name: checkoutItem.name,
            description: checkoutItem.description,
          },
        },
      },
    ],
  });

  return NextResponse.json({ checkout_url: session.url, id: session.id });
}
