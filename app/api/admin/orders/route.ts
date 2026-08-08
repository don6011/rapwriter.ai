import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { transitionCommerceOrder } from "@/lib/server/commerce";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/server/stripe-billing";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  order_id: z.string().uuid(),
  action: z.enum(["cancel", "request_refund", "mark_disputed", "resolve_for_seller"]),
  reason: z.string().trim().min(8).max(500),
});

export async function GET(request: Request) {
  const access = await requireRole("admin");
  if (access.response) return access.response;
  const status = new URL(request.url).searchParams.get("status");
  const admin = createAdminClient();
  let query = admin
    .from("commerce_orders")
    .select("id, order_number, buyer_id, seller_owner_id, status, provider, currency, total_cents, platform_fee_cents, seller_earnings_cents, provider_checkout_id, provider_payment_id, created_at, paid_at, fulfilled_at, refunded_at, commerce_order_items(id, title, item_type, license_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PATCH(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await requireRole("admin");
  if (access.response || !access.user) return access.response;
  const rateLimit = await enforceRateLimit(request, {
    scope: "admin-commerce-orders",
    limit: 60,
    windowSeconds: 60 * 60,
    identity: access.user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order action." }, { status: 400 });
  const status = parsed.data.action === "cancel"
    ? "canceled"
    : parsed.data.action === "request_refund"
      ? "refund_pending"
      : parsed.data.action === "mark_disputed"
        ? "disputed"
      : "fulfilled";
  try {
    if (parsed.data.action === "request_refund") {
      const admin = createAdminClient();
      const { data: existing, error: existingError } = await admin
        .from("commerce_orders")
        .select("id,status,provider,provider_payment_id,seller_owner_id")
        .eq("id", parsed.data.order_id)
        .single();
      if (existingError || !existing) throw new Error(existingError?.message ?? "Order not found.");
      if (existing.provider !== "stripe" || !existing.provider_payment_id) throw new Error("This order has no refundable Stripe payment.");
      const stripe = createStripeClient();
      if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
      await transitionCommerceOrder({
        orderId: existing.id, status: "refund_pending", reason: parsed.data.reason,
        actorId: access.user.id, details: { source: "admin_control_room", action: parsed.data.action },
      });
      try {
        await stripe.refunds.create({
          payment_intent: existing.provider_payment_id,
          reason: "requested_by_customer",
          ...(existing.seller_owner_id ? { reverse_transfer: true, refund_application_fee: true } : {}),
          metadata: { order_id: existing.id, requested_by: access.user.id },
        }, { idempotencyKey: `order-refund:${existing.id}` });
      } catch (error) {
        await transitionCommerceOrder({
          orderId: existing.id, status: "fulfilled", reason: "Stripe refund creation failed; restored fulfillment.",
          actorId: access.user.id, details: { source: "stripe_refund_recovery" },
        }).catch(() => null);
        throw error;
      }
      return NextResponse.json({ order: { ...existing, status: "refund_pending" } });
    }
    const order = await transitionCommerceOrder({
      orderId: parsed.data.order_id,
      status,
      reason: parsed.data.reason,
      actorId: access.user.id,
      details: { source: "admin_control_room", action: parsed.data.action },
    });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order action failed." }, { status: 409 });
  }
}
