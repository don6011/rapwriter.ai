import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const checkout = readFileSync(new URL("../../app/api/stripe/checkout/route.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20260803170000_stripe_connect_producer_payouts.sql", import.meta.url), "utf8");

describe("Stripe commerce contract", () => {
  test("routes producer beat revenue through a destination charge", () => {
    expect(checkout).toContain("application_fee_amount");
    expect(checkout).toContain("transfer_data: { destination: connectedAccountId }");
    expect(checkout).toContain("requireActiveProducerPayout");
  });

  test("synchronizes connected account updates from signed webhooks", () => {
    expect(webhook).toContain('case "account.updated"');
    expect(webhook).toContain("syncConnectedAccount(account)");
  });

  test("keeps payout account mutation behind the service role", () => {
    expect(migration).toContain("revoke insert, update, delete on public.producer_billing_accounts from authenticated");
    expect(migration).toContain("grant all on public.producer_billing_accounts to service_role");
  });
});
