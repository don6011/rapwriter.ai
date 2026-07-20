import { describe, expect, test } from "bun:test";
import { hasValidRequestOrigin } from "./api/origin.ts";
import { rateLimitIdentityHash } from "./api/rate-limit.ts";

describe("API request protection", () => {
  test("accepts same-origin mutations and rejects foreign browser origins", () => {
    const sameOrigin = new Request("https://rapwriter.ai/api/projects", {
      method: "POST",
      headers: { origin: "https://rapwriter.ai", host: "rapwriter.ai" },
    });
    const foreignOrigin = new Request("https://rapwriter.ai/api/projects", {
      method: "POST",
      headers: { origin: "https://example.com", host: "rapwriter.ai" },
    });

    expect(hasValidRequestOrigin(sameOrigin)).toBe(true);
    expect(hasValidRequestOrigin(foreignOrigin)).toBe(false);
  });

  test("honors forwarded production hosts", () => {
    const request = new Request("http://internal:3000/api/songs", {
      method: "PATCH",
      headers: {
        origin: "https://rapwriter.ai",
        host: "internal:3000",
        "x-forwarded-host": "rapwriter.ai",
        "x-forwarded-proto": "https",
      },
    });

    expect(hasValidRequestOrigin(request)).toBe(true);
  });

  test("hashes normalized identities without storing raw user data", () => {
    const first = rateLimitIdentityHash(" Artist@Example.com ");
    const second = rateLimitIdentityHash("artist@example.com");

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("artist");
  });
});
