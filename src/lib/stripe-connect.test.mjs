import { describe, expect, test } from "bun:test";
import { connectedAccountStatus } from "./server/stripe-connect.ts";

describe("Stripe Connect payout readiness", () => {
  test("is active only when charges and payouts are enabled", () => {
    expect(connectedAccountStatus({ charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: null })).toBe("active");
  });

  test("is restricted when submitted details still have requirements due", () => {
    expect(connectedAccountStatus({
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: true,
      requirements: { currently_due: ["individual.verification.document"] },
    })).toBe("restricted");
  });

  test("remains pending before onboarding details are submitted", () => {
    expect(connectedAccountStatus({ charges_enabled: false, payouts_enabled: false, details_submitted: false, requirements: null })).toBe("pending");
  });
});
