import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const notifications = readFileSync(new URL("server/billing-notifications.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");

describe("billing notification delivery", () => {
  test("covers renewal, payment recovery, and cancellation lifecycle events", () => {
    expect(webhook).toContain('case "invoice.paid"');
    expect(webhook).toContain('case "invoice.payment_failed"');
    expect(webhook).toContain('case "invoice.payment_action_required"');
    expect(notifications).toContain("membership_cancellation_scheduled");
    expect(notifications).toContain("membership_cancellation_reversed");
    expect(notifications).toContain("membership_ended");
  });

  test("uses deterministic notification ids to absorb webhook retries", () => {
    expect(notifications).toContain("deterministicUuid(`stripe:${eventId}:${notice.kind}`)");
    expect(notifications).toContain('error?.code === "23505"');
  });

  test("keeps email optional and points billing notices to Profile", () => {
    expect(notifications).toContain('const actionUrl = "/?view=profile"');
    expect(notifications).toContain("process.env.RESEND_API_KEY");
    expect(notifications).toContain("process.env.BILLING_FROM_EMAIL ?? process.env.SUPPORT_FROM_EMAIL");
  });
});
