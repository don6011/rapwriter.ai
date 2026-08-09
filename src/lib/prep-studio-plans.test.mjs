import { describe, expect, test } from "bun:test";
import { prepStudioTier, prepStudioTiers, withPrepStudioPresentation } from "./prep-studio-plans.ts";

describe("RapWriter plan presentation", () => {
  test("offers only Free and RapWriter Pro", () => {
    expect(prepStudioTiers.map((tier) => tier.id)).toEqual(["artist_free", "artist_pro"]);
    expect(prepStudioTier("artist_studio")).toBeNull();
  });

  test("publishes the launch monthly prices", () => {
    expect(prepStudioTier("artist_pro")?.monthlyPriceCents).toBe(799);
    expect(prepStudioTier("artist_pro")?.annualPriceCents).toBe(5900);
  });

  test("normalizes copy while keeping database prices authoritative", () => {
    const plan = withPrepStudioPresentation({
      id: "artist_pro",
      audience: "artist",
      tier: 1,
      name: "Legacy Pro",
      tagline: "Legacy copy.",
      monthly_price_cents: 799,
      annual_price_cents: 5900,
      currency: "usd",
      entitlements: {},
      limits: {},
      metadata: {},
    });
    expect(plan.id).toBe("artist_pro");
    expect(plan.name).toBe("RapWriter Pro");
    expect(plan.monthly_price_cents).toBe(799);
    expect(plan.annual_price_cents).toBe(5900);
  });

  test("presents grandfathered Elite access under the RapWriter Pro name", () => {
    const plan = withPrepStudioPresentation({
      id: "artist_studio",
      audience: "artist",
      tier: 2,
      name: "Prep Studio Elite",
      tagline: "Old copy",
      monthly_price_cents: 2999,
      annual_price_cents: 29990,
      currency: "usd",
      entitlements: {},
      limits: {},
      metadata: { retired: true },
    });

    expect(plan.name).toBe("RapWriter Pro");
    expect(plan.tagline).toBe("Legacy access");
  });
});
