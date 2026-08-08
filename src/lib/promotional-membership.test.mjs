import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migration = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20260803120000_promotional_membership_engine.sql", import.meta.url)), "utf8");

describe("promotional membership migration contract", () => {
  test("locks campaign inventory and enforces one claim per user", () => {
    expect(migration).toContain("where slug = campaign_slug for update");
    expect(migration).toContain("membership_grants_campaign_owner_idx");
    expect(migration).toContain("exception when unique_violation");
  });

  test("keeps paid access ahead of promotional access", () => {
    expect(migration).toContain("case source when 'paid' then 2 else 1 end desc");
  });

  test("keeps badges permanent and promo grants bounded", () => {
    expect(migration).toContain("unique (owner_id, badge_code)");
    expect(migration).toContain("now() + make_interval(days => v_campaign.duration_days)");
  });

  test("ships exact launch inventory without auto-activating it", () => {
    expect(migration).toContain("'founding_artist_2026'");
    expect(migration).toContain("'artist_pro', 1000, 30");
    expect(migration).toContain("'founding_producer_2026'");
    expect(migration).toContain("'producer_pro', 500, 90");
  });
});
