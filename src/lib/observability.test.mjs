import { describe, expect, test } from "bun:test";
import {
  createRequestId,
  getReleaseId,
  safeRequestPath,
  serializeError,
} from "./observability.ts";

describe("production observability", () => {
  test("preserves safe upstream request IDs", () => {
    expect(createRequestId("edge-request_123")).toBe("edge-request_123");
  });

  test("replaces malformed request IDs", () => {
    const requestId = createRequestId("bad id\r\nx-injected: true");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("removes query strings from logged paths", () => {
    expect(safeRequestPath("/api/profile?token=private")).toBe("/api/profile");
  });

  test("serializes errors without stacks", () => {
    expect(serializeError(new Error("Database temporarily unavailable"))).toEqual({
      error_name: "Error",
      error_message: "Database temporarily unavailable",
      error_digest: undefined,
    });
  });

  test("redacts sensitive fragments from error messages", () => {
    const error = serializeError(new Error("Failed for artist@example.com with Bearer secret-token"));
    expect(error.error_message).toBe("Failed for [redacted-email] with Bearer [redacted]");
  });

  test("always exposes a bounded release identifier", () => {
    expect(getReleaseId().length).toBeGreaterThan(0);
    expect(getReleaseId().length).toBeLessThanOrEqual(12);
  });
});
