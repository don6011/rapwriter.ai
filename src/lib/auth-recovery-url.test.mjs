import { describe, expect, test } from "bun:test";
import { recoveryModeUrl, recoverySessionFromHash } from "./auth-recovery-url.ts";

describe("auth recovery URLs", () => {
  test("reads a complete legacy recovery session", () => {
    expect(recoverySessionFromHash("#access_token=access&refresh_token=refresh&type=recovery")).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  test("rejects incomplete and non-recovery hashes", () => {
    expect(recoverySessionFromHash("#access_token=access&type=recovery")).toBeNull();
    expect(recoverySessionFromHash("#access_token=access&refresh_token=refresh&type=signup")).toBeNull();
  });

  test("removes credentials while preserving safe query state", () => {
    expect(recoveryModeUrl("https://rapwriter.ai/?next=studio#access_token=secret&type=recovery")).toBe(
      "/?next=studio&auth_mode=recovery",
    );
  });
});
