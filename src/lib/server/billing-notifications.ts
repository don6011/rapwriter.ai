import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type BillingNotice = {
  kind: string;
  title: string;
  body: string;
  emailSubject: string;
};

export async function notifyInvoiceEvent(event: Stripe.Event, invoice: Stripe.Invoice) {
  const ownerId = await ownerForCustomer(invoice.customer);
  if (!ownerId) return null;

  const billingReason = invoice.billing_reason;
  if (event.type === "invoice.paid") {
    const notice = billingReason === "subscription_create"
      ? {
          kind: "membership_activated",
          title: "Your membership is active",
          body: "RapWriter Pro is ready. Open your studio to use your newly unlocked writing tools and rooms.",
          emailSubject: "Your RapWriter membership is active",
        }
      : billingReason === "subscription_cycle"
        ? {
            kind: "membership_renewed",
            title: "Membership renewed",
            body: "Your RapWriter Pro membership renewed successfully. Your studio access continues without interruption.",
            emailSubject: "Your RapWriter membership renewed",
          }
        : null;
    if (!notice) return ownerId;
    await deliverBillingNotice(ownerId, event.id, notice);
    return ownerId;
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_action_required") {
    await deliverBillingNotice(ownerId, event.id, {
      kind: "membership_payment_failed",
      title: event.type === "invoice.payment_action_required" ? "Payment needs confirmation" : "Payment needs attention",
      body: event.type === "invoice.payment_action_required"
        ? "Confirm your payment method to keep RapWriter Pro active. Open billing to finish the secure verification step."
        : "We could not renew RapWriter Pro. Your access is temporarily protected during the grace period; update billing to avoid losing Pro tools.",
      emailSubject: event.type === "invoice.payment_action_required"
        ? "Confirm your RapWriter membership payment"
        : "Action needed: update your RapWriter payment method",
    });
  }
  return ownerId;
}

export async function notifySubscriptionEvent(event: Stripe.Event, subscription: Stripe.Subscription, ownerId: string) {
  const previous = (event.data.previous_attributes ?? {}) as Record<string, unknown>;
  let notice: BillingNotice | null = null;

  if (event.type === "customer.subscription.deleted") {
    notice = {
      kind: "membership_ended",
      title: "Your Pro membership ended",
      body: "Your projects and purchases are safe. Your account is now on RapWriter Free, and you can restart Pro anytime.",
      emailSubject: "Your RapWriter Pro membership ended",
    };
  } else if (event.type === "customer.subscription.updated" && previous.cancel_at_period_end === false && subscription.cancel_at_period_end) {
    notice = {
      kind: "membership_cancellation_scheduled",
      title: "Cancellation scheduled",
      body: `RapWriter Pro stays active through ${formatDate(subscription.current_period_end)}. It will not renew after that date.`,
      emailSubject: "Your RapWriter cancellation is scheduled",
    };
  } else if (event.type === "customer.subscription.updated" && previous.cancel_at_period_end === true && !subscription.cancel_at_period_end) {
    notice = {
      kind: "membership_cancellation_reversed",
      title: "Membership renewal restored",
      body: "RapWriter Pro will renew normally. Your studio access remains uninterrupted.",
      emailSubject: "Your RapWriter membership will renew",
    };
  }

  if (notice) await deliverBillingNotice(ownerId, event.id, notice);
}

async function ownerForCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_customers")
    .select("owner_id")
    .eq("provider", "stripe")
    .eq("provider_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.owner_id === "string" ? data.owner_id : null;
}

async function deliverBillingNotice(ownerId: string, eventId: string, notice: BillingNotice) {
  const admin = createAdminClient();
  const notificationId = deterministicUuid(`stripe:${eventId}:${notice.kind}`);
  const actionUrl = "/?view=profile";
  const { error } = await admin.from("user_notifications").insert({
    id: notificationId,
    owner_id: ownerId,
    type: "billing",
    title: notice.title,
    body: notice.body,
    action_url: actionUrl,
    entity_type: "stripe_event",
    metadata: { provider: "stripe", provider_event_id: eventId, kind: notice.kind },
  });
  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_FROM_EMAIL ?? process.env.SUPPORT_FROM_EMAIL;
  if (!apiKey || !from) return;
  const { data: userData } = await admin.auth.admin.getUserById(ownerId);
  const to = userData.user?.email;
  if (!to) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://rapwriter.ai").replace(/\/$/, "");
  // Email is a delivery convenience. The in-app notice remains the source of truth.
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: notice.emailSubject,
      text: `${notice.body}\n\nManage your membership: ${appUrl}${actionUrl}`,
    }),
  }).catch(() => null);
}

function deterministicUuid(value: string) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(value * 1000));
}
