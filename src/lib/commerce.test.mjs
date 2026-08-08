import { describe, expect, test } from "bun:test";
import { checkoutIdempotencyKey } from "./server/commerce.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("commerce checkout identity", () => {
  test("preserves a valid caller idempotency key", () => {
    expect(checkoutIdempotencyKey("user-1", "beat-1:lease", "checkout_attempt_123")).toBe("checkout_attempt_123");
  });

  test("generates a stable short-window key when the caller does not provide one", () => {
    const first = checkoutIdempotencyKey("user-1", "beat-1:lease");
    const second = checkoutIdempotencyKey("user-1", "beat-1:lease");
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test("does not reuse a key across different products", () => {
    expect(checkoutIdempotencyKey("user-1", "beat-1:lease")).not.toBe(checkoutIdempotencyKey("user-1", "room-1"));
  });
});

describe("commerce ownership boundary", () => {
  const migration = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20260803153000_pre_stripe_ownership_hardening.sql", import.meta.url)), "utf8");
  test("prevents clients from self-issuing purchased entitlements", () => {
    expect(migration).toContain('drop policy if exists "product_entitlements_insert_own"');
    expect(migration).toContain("revoke insert, update, delete on public.product_entitlements from authenticated");
  });
  test("limits direct Locker writes to non-commerce records", () => {
    expect(migration).toContain("license in ('Favorite', 'Private Import')");
    expect(migration).toContain("stripe_checkout_session_id is null");
  });
  test("makes attached provider references immutable", () => {
    expect(migration).toContain("Provider checkout reference is immutable");
    expect(migration).toContain("Provider payment reference is immutable");
  });
});
