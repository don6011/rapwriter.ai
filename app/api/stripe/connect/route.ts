import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createStripeClient } from "@/lib/server/stripe-billing";
import { getOrCreateConnectedAccount, getProducerBilling, syncConnectedAccount } from "@/lib/server/stripe-connect";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireRole("producer");
  if (access.response || !access.user) return access.response;
  const stripe = createStripeClient();
  if (!stripe) return NextResponse.json({ error: "Producer payouts are waiting for Stripe configuration.", code: "stripe_not_configured" }, { status: 503 });
  try {
    const billing = await getProducerBilling(access.user.id);
    if (!billing?.stripe_account_id) return NextResponse.json({ status: "not_connected", billing });
    const account = await stripe.accounts.retrieve(billing.stripe_account_id);
    if (account.deleted) throw new Error("The connected payout account is unavailable.");
    const synced = await syncConnectedAccount(account);
    return NextResponse.json({ status: synced.stripe_status, billing: synced }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payout status could not be refreshed." }, { status: 422 });
  }
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await requireRole("producer");
  if (access.response || !access.user) return access.response;
  const rateLimit = await enforceRateLimit(request, { scope: "stripe-connect", limit: 12, windowSeconds: 3600, identity: access.user.id });
  if (rateLimit) return rateLimit;
  const stripe = createStripeClient();
  if (!stripe) return NextResponse.json({ error: "Producer payouts are waiting for Stripe configuration.", code: "stripe_not_configured" }, { status: 503 });
  try {
    const accountId = await getOrCreateConnectedAccount(stripe, access.user);
    const account = await stripe.accounts.retrieve(accountId);
    if (account.deleted) throw new Error("The connected payout account is unavailable.");
    await syncConnectedAccount(account);
    if (account.charges_enabled && account.payouts_enabled) {
      const login = await stripe.accounts.createLoginLink(accountId);
      return NextResponse.json({ url: login.url, status: "active" });
    }
    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appOrigin}/producer?connect=refresh`,
      return_url: `${appOrigin}/producer?connect=return`,
      collection_options: { fields: "eventually_due" },
    });
    return NextResponse.json({ url: link.url, status: "pending" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payout setup could not be opened." }, { status: 422 });
  }
}
