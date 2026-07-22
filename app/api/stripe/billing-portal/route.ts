import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createStripeClient } from "@/lib/server/stripe-billing";

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const rateLimit = await enforceRateLimit(request, {
    scope: "billing-portal",
    limit: 10,
    windowSeconds: 10 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const stripe = createStripeClient();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  const { data, error } = await supabase
    .from("billing_customers")
    .select("provider_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.provider_customer_id) {
    return NextResponse.json({ error: "No billing account exists yet.", code: "billing_account_not_found" }, { status: 404 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer: data.provider_customer_id,
      return_url: `${appUrl}/?view=profile`,
    });
    return NextResponse.json({ portal_url: portal.url });
  } catch (portalError) {
    return NextResponse.json(
      { error: portalError instanceof Error ? portalError.message : "Could not open billing." },
      { status: 502 },
    );
  }
}
