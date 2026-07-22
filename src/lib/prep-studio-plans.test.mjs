import { describe, expect, test } from "bun:test";
import { prepStudioTier, prepStudioTiers, withPrepStudioPresentation } from "./prep-studio-plans.ts";

describe("Prep Studio plan presentation", () => {
  test("uses stable subscription IDs for Free, Pro, and Elite", () => {
    expect(prepStudioTiers.map((tier) => tier.id)).toEqual(["artist_free", "artist_pro", "artist_studio"]);
  });

  test("publishes the launch monthly prices", () => {
    expect(prepStudioTier("artist_pro")?.monthlyPriceCents).toBe(1499);
    expect(prepStudioTier("artist_studio")?.monthlyPriceCents).toBe(2999);
  });

  test("normalizes legacy database presentation without changing plan identity", () => {
    const plan = withPrepStudioPresentation({
      id: "artist_studio",
      audience: "artist",
      tier: 2,
      name: "RapWriter Studio",
      tagline: "Build serious records.",
      monthly_price_cents: 2799,
      annual_price_cents: 27990,
      currency: "usd",
      entitlements: {},
      limits: {},
      metadata: {},
    });
    expect(plan.id).toBe("artist_studio");
    expect(plan.name).toBe("Prep Studio Elite");
    expect(plan.monthly_price_cents).toBe(2999);
  });
});
