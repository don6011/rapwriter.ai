import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("collapsed Market", () => {
  const market = readFileSync(new URL("../components/PremiumMarketplace.tsx", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../components/studio/state/use-marketplace-feed.ts", import.meta.url), "utf8");

  test("contains only membership and beat commerce", () => {
    expect(market.split("\n").length).toBeLessThan(500);
    expect(market).toContain("Membership & beats");
    expect(market).toContain("Buying beats is open to every RapWriter account.");
    expect(market).not.toContain("bundleProducts");
    expect(market).not.toContain("writingPackProducts");
    expect(market).not.toContain("studioRoomProducts");
    expect(market).not.toContain("vocal_chain");
  });

  test("distinguishes an empty producer catalog from a failed feed", () => {
    expect(market).toContain("No producer drops yet");
    expect(market).toContain("Producer beats could not load");
    expect(feed).toContain("The producer feed is temporarily unavailable");
  });

  test("makes the active tier and Pro price explicit", () => {
    expect(market).toContain("Current");
    expect(market).toContain("Upgrade to Pro - $7.99/mo");
    expect(market).toContain("RapWriter Pro is active.");
    expect(market).not.toContain("Your finishing studio is active.");
  });
});
