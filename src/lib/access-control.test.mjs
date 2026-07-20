import { describe, expect, test } from "bun:test";
import { hasRole, isAppRole } from "./access-control.ts";

describe("access control", () => {
  test("recognizes only supported database roles", () => {
    expect(isAppRole("artist")).toBe(true);
    expect(isAppRole("producer")).toBe(true);
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("owner")).toBe(false);
    expect(isAppRole({ role: "admin" })).toBe(false);
  });

  test("requires the explicit role instead of inferring privilege", () => {
    expect(hasRole(["artist"], "admin")).toBe(false);
    expect(hasRole(["artist", "producer"], "admin")).toBe(false);
    expect(hasRole(["artist", "admin"], "admin")).toBe(true);
  });
});
