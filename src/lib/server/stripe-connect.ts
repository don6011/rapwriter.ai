import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getProducerBilling(ownerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("producer_billing_accounts").select("*").eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrCreateConnectedAccount(stripe: Stripe, user: { id: string; email: string | null }) {
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("producer_profiles").select("id, country, status").eq("owner_id", user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("Create Producer HQ before connecting payouts.");

  const billing = await getProducerBilling(user.id);
  if (billing?.stripe_account_id) return billing.stripe_account_id as string;

  const account = await stripe.accounts.create({
    type: "express",
    country: countryCode(profile.country),
    email: user.email ?? undefined,
    capabilities: { transfers: { requested: true } },
    business_type: "individual",
    metadata: { rapwriter_user_id: user.id, producer_profile_id: profile.id },
  }, { idempotencyKey: `producer-connect:${user.id}` });

  const { error } = await admin.from("producer_billing_accounts").upsert({
    owner_id: user.id,
    producer_profile_id: profile.id,
    stripe_account_id: account.id,
    stripe_status: "pending",
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    requirements_due: account.requirements?.currently_due ?? [],
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
  return account.id;
}

export async function syncConnectedAccount(account: Stripe.Account) {
  const ownerId = account.metadata?.rapwriter_user_id;
  if (!ownerId) throw new Error("Connected account is not linked to RapWriter.");
  const requirementsDue = account.requirements?.currently_due ?? [];
  const status = connectedAccountStatus(account);
  const admin = createAdminClient();
  const { data, error } = await admin.from("producer_billing_accounts").update({
    stripe_status: status,
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    requirements_due: requirementsDue,
    connected_at: status === "active" ? new Date().toISOString() : null,
    last_synced_at: new Date().toISOString(),
  }).eq("stripe_account_id", account.id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export function connectedAccountStatus(account: Pick<Stripe.Account, "charges_enabled" | "payouts_enabled" | "details_submitted" | "requirements">) {
  if (account.charges_enabled && account.payouts_enabled) return "active" as const;
  if (account.details_submitted && (account.requirements?.currently_due?.length ?? 0) > 0) return "restricted" as const;
  return "pending" as const;
}

export async function requireActiveProducerPayout(ownerId: string) {
  const billing = await getProducerBilling(ownerId);
  if (!billing?.stripe_account_id || billing.stripe_status !== "active" || !billing.charges_enabled || !billing.payouts_enabled) {
    throw new Error("This producer is finishing payout setup. Beat licensing will open when verification is complete.");
  }
  return billing.stripe_account_id as string;
}

function countryCode(country: unknown) {
  if (typeof country !== "string") return "US";
  const normalized = country.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  if (["UNITED STATES", "USA", "U.S.", "US"].includes(normalized)) return "US";
  return "US";
}
