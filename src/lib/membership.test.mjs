import { describe, expect, test } from "bun:test";
import { entitlementLimit, hasEntitlement, isSubscriptionEffective, resolveMembership } from "./membership.ts";

const now = new Date("2026-07-20T12:00:00.000Z");
const plans = [
  {
    id: "artist_free",
    audience: "artist",
    tier: 0,
    name: "RapWriter Free",
    tagline: "Start writing.",
    monthly_price_cents: 0,
    annual_price_cents: 0,
    currency: "usd",
    entitlements: {
      writing_pad: true,
      ghostwriter: true,
      full_pen_view: false,
      hook_doctor: false,
      commercial_pass: false,
      performance_coach: false,
    },
    limits: { active_projects: 3, ghostwriter_actions_monthly: 3 },
    metadata: {},
  },
  {
    id: "artist_pro",
    audience: "artist",
    tier: 1,
    name: "RapWriter Pro",
    tagline: "Sharpen your pen.",
    monthly_price_cents: 1499,
    annual_price_cents: 14990,
    currency: "usd",
    entitlements: {
      writing_pad: true,
      ghostwriter: true,
      full_pen_view: true,
      hook_doctor: true,
      commercial_pass: true,
      performance_coach: false,
    },
    limits: { active_projects: -1, ghostwriter_actions_monthly: 80 },
    metadata: {},
  },
  {
    id: "artist_studio",
    audience: "artist",
    tier: 2,
    name: "Prep Studio Elite",
    tagline: "Build a professional creative practice.",
    monthly_price_cents: 2999,
    annual_price_cents: 29990,
    currency: "usd",
    entitlements: {
      writing_pad: true,
      ghostwriter: true,
      full_pen_view: true,
      hook_doctor: true,
      commercial_pass: true,
      performance_coach: true,
    },
    limits: { active_projects: -1, ghostwriter_actions_monthly: 250 },
    metadata: {},
  },
  {
    id: "producer_free",
    audience: "producer",
    tier: 0,
    name: "Producer Free",
    tagline: "Build your storefront.",
    monthly_price_cents: 0,
    annual_price_cents: 0,
    currency: "usd",
    entitlements: { producer_storefront: true, producer_intelligence: false },
    limits: { beat_uploads: 5 },
    metadata: {},
  },
  {
    id: "producer_pro",
    audience: "producer",
    tier: 1,
    name: "Producer Pro",
    tagline: "Build a serious business.",
    monthly_price_cents: 2499,
    annual_price_cents: 24990,
    currency: "usd",
    entitlements: { producer_storefront: true, producer_intelligence: true, collections: true },
    limits: { beat_uploads: -1, collections: -1 },
    metadata: {},
  },
];

function subscription(overrides = {}) {
  return {
    id: "sub-1",
    plan_id: "artist_pro",
    audience: "artist",
    status: "active",
    provider: "stripe",
    current_period_start: "2026-07-01T00:00:00.000Z",
    current_period_end: "2026-08-01T00:00:00.000Z",
    trial_end: null,
    grace_period_end: null,
    cancel_at_period_end: false,
    ...overrides,
  };
}

describe("membership resolution", () => {
  test("defaults each enabled workspace to its free plan", () => {
    const result = resolveMembership({ roles: ["artist", "producer"], plans, now });
    expect(result.artist?.plan.id).toBe("artist_free");
    expect(result.producer?.plan.id).toBe("producer_free");
    expect(result.artist?.source).toBe("free");
  });

  test("uses active server subscription state for capabilities", () => {
    const result = resolveMembership({ roles: ["artist"], plans, subscriptions: [subscription()], now });
    expect(result.artist?.plan.id).toBe("artist_pro");
    expect(hasEntitlement(result, "artist", "full_pen_view")).toBe(true);
    expect(entitlementLimit(result, "artist", "ghostwriter_actions_monthly")).toBe(80);
  });

  test("keeps canceled access through the paid period", () => {
    expect(isSubscriptionEffective(subscription({ status: "canceled" }), now)).toBe(true);
    expect(isSubscriptionEffective(subscription({ status: "canceled", current_period_end: "2026-07-19T00:00:00.000Z" }), now)).toBe(false);
  });

  test("honors a bounded grace period and rejects expired past due access", () => {
    expect(isSubscriptionEffective(subscription({ status: "past_due", grace_period_end: "2026-07-22T00:00:00.000Z" }), now)).toBe(true);
    expect(isSubscriptionEffective(subscription({ status: "past_due", grace_period_end: "2026-07-19T00:00:00.000Z" }), now)).toBe(false);
  });

  test("applies active capability and limit grants centrally", () => {
    const result = resolveMembership({
      roles: ["artist"],
      plans,
      now,
      grants: [
        { audience: "artist", entitlement_key: "full_pen_view", entitlement_value: true, starts_at: "2026-07-01T00:00:00.000Z", ends_at: null },
        { audience: "artist", entitlement_key: "limit.active_projects", entitlement_value: 10, starts_at: "2026-07-01T00:00:00.000Z", ends_at: "2026-08-01T00:00:00.000Z" },
      ],
    });
    expect(hasEntitlement(result, "artist", "full_pen_view")).toBe(true);
    expect(entitlementLimit(result, "artist", "active_projects")).toBe(10);
  });

  test("does not create a Producer membership without the role", () => {
    const result = resolveMembership({ roles: ["artist"], plans, now });
    expect(result.producer).toBeNull();
  });

  test("keeps capability boundaries distinct across Free, Pro, and Elite", () => {
    const free = resolveMembership({ roles: ["artist"], plans, now });
    const pro = resolveMembership({ roles: ["artist"], plans, subscriptions: [subscription()], now });
    const elite = resolveMembership({
      roles: ["artist"],
      plans,
      subscriptions: [subscription({ plan_id: "artist_studio" })],
      now,
    });

    expect(hasEntitlement(free, "artist", "ghostwriter")).toBe(true);
    expect(hasEntitlement(free, "artist", "hook_doctor")).toBe(false);
    expect(hasEntitlement(pro, "artist", "hook_doctor")).toBe(true);
    expect(hasEntitlement(pro, "artist", "performance_coach")).toBe(false);
    expect(hasEntitlement(elite, "artist", "performance_coach")).toBe(true);
  });

  test("keeps Producer Pro separate from artist membership", () => {
    const result = resolveMembership({
      roles: ["artist", "producer"],
      plans,
      subscriptions: [subscription({ id: "producer-sub", audience: "producer", plan_id: "producer_pro" })],
      now,
    });

    expect(result.artist?.plan.id).toBe("artist_free");
    expect(result.producer?.plan.id).toBe("producer_pro");
    expect(hasEntitlement(result, "producer", "producer_intelligence")).toBe(true);
  });
});
