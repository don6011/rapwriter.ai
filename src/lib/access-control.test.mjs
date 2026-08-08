import { describe, expect, test } from "bun:test";
import { hasAnyRole, hasRole, isAppRole, isStaff } from "./access-control.ts";

describe("access control", () => {
  test("recognizes only supported database roles", () => {
    expect(isAppRole("artist")).toBe(true);
    expect(isAppRole("producer")).toBe(true);
    expect(isAppRole("moderator")).toBe(true);
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("owner")).toBe(false);
    expect(isAppRole({ role: "admin" })).toBe(false);
  });

  test("requires the explicit role instead of inferring privilege", () => {
    expect(hasRole(["artist"], "admin")).toBe(false);
    expect(hasRole(["artist", "producer"], "admin")).toBe(false);
    expect(hasRole(["artist", "admin"], "admin")).toBe(true);
  });

  test("separates staff access from owner-only admin authority", () => {
    expect(isStaff(["artist", "moderator"])).toBe(true);
    expect(isStaff(["artist"])).toBe(false);
    expect(hasAnyRole(["artist", "moderator"], ["moderator", "admin"])).toBe(true);
    expect(hasRole(["artist", "moderator"], "admin")).toBe(false);
  });
});
