import { describe, expect, test } from "bun:test";
import { profilePatchSchema } from "./schemas.ts";

describe("profile identity updates", () => {
  test("keeps artist identity independent from account role updates", () => {
    expect(profilePatchSchema.parse({ artist_name: "Nova" })).toEqual({ artist_name: "Nova" });
    expect(profilePatchSchema.parse({ account_type: "artist_producer" })).toEqual({ account_type: "artist_producer" });
  });

  test("rejects empty and undersized identity updates", () => {
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
    expect(profilePatchSchema.safeParse({ artist_name: "R" }).success).toBe(false);
  });
});
