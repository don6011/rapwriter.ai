import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillCommerceOrder, transitionCommerceOrder, type CommerceOrderStatus } from "@/lib/server/commerce";
import { createStripeClient, syncStripeSubscription } from "@/lib/server/stripe-billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncConnectedAccount } from "@/lib/server/stripe-connect";

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
          await syncStripeSubscription(subscription);
        } else if (session.payment_status === "paid") {
          await fulfillOneTimeCheckout(session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const eventSubscription = event.data.object;
        ownerId = eventSubscription.metadata.user_id ?? null;
        // Stripe can deliver subscription lifecycle events concurrently and out
        // of order. Always sync the current provider state so an older
        // `incomplete` payload cannot overwrite an already-active membership.
        const subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
        const synced = await syncStripeSubscription(subscription);
        ownerId = typeof synced.owner_id === "string" ? synced.owner_id : ownerId;
        break;
      }
      case "account.updated": {
        const account = event.data.object;
        const synced = await syncConnectedAccount(account);
        ownerId = typeof synced.owner_id === "string" ? synced.owner_id : null;
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object;
        const orderId = session.metadata?.order_id;
        ownerId = session.metadata?.user_id ?? null;
        if (orderId) {
          await transitionCommerceOrder({
            orderId,
            status: "canceled",
            reason: "Stripe checkout session expired before payment.",
            details: { providerEventId: event.id },
          });
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const paymentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentId) {
          const fullyRefunded = charge.amount_refunded >= charge.amount;
          ownerId = await transitionProviderPayment(
            paymentId,
            fullyRefunded ? "refunded" : "refund_pending",
            fullyRefunded ? "Stripe confirmed the full payment refund." : "Stripe reported a partial refund requiring review.",
            event.id,
          );
        }
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object;
        const paymentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        if (paymentId) ownerId = await transitionProviderPayment(paymentId, "disputed", "Stripe opened a payment dispute.", event.id);
        break;
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object;
        const paymentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        if (paymentId) {
          const nextStatus = dispute.status === "won" || dispute.status === "warning_closed" ? "fulfilled" : "refunded";
          ownerId = await transitionProviderPayment(paymentId, nextStatus, `Stripe closed the dispute as ${dispute.status}.`, event.id);
        }
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
    const orderId = metadata.order_id ?? session.client_reference_id;
    const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!orderId || !paymentId || session.amount_total === null || !session.currency) {
      throw new Error("Checkout is missing its RapWriter order reference");
    }
    await fulfillCommerceOrder({
      orderId,
      providerCheckoutId: session.id,
      providerPaymentId: paymentId,
      amountCents: session.amount_total,
      currency: session.currency,
    });
  }

  async function transitionProviderPayment(paymentId: string, requestedStatus: CommerceOrderStatus, reason: string, providerEventId: string) {
    const { data: order, error } = await admin
      .from("commerce_orders")
      .select("id, buyer_id, status")
      .eq("provider", "stripe")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;
    if (order.status === requestedStatus) return order.buyer_id as string | null;

    if (requestedStatus === "refund_pending" && order.status === "refund_pending") return order.buyer_id as string | null;
    if (requestedStatus === "refunded" && ["paid", "fulfilled"].includes(order.status)) {
      await transitionCommerceOrder({
        orderId: order.id,
        status: "refund_pending",
        reason: "Stripe reported a refund in progress.",
        details: { providerEventId },
      });
    }
    await transitionCommerceOrder({
      orderId: order.id,
      status: requestedStatus,
      reason,
      details: { providerEventId, providerPaymentId: paymentId },
    });
    return order.buyer_id as string | null;
  }
}
