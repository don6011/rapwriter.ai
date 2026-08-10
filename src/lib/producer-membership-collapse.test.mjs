import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("Producer HQ free membership", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20260809164848_collapse_producer_membership.sql", import.meta.url),
    "utf8",
  );
  const finalMigration = readFileSync(
    new URL("../../supabase/migrations/20260809193000_finalize_producer_membership_collapse.sql", import.meta.url),
    "utf8",
  );
  const membershipCard = readFileSync(new URL("../components/MembershipCard.tsx", import.meta.url), "utf8");
  const producerPortal = readFileSync(new URL("../components/ProducerPortal.tsx", import.meta.url), "utf8");

  test("copies Producer Pro capabilities into the free plan and retires the paid plan", () => {
    expect(migration).toContain("entitlements = pro_plan.entitlements");
    expect(migration).toContain("'beat_uploads', -1");
    expect(migration).toContain("where id = 'producer_pro'");
    expect(migration).toContain("'retired', true");
    expect(finalMigration).toContain("is_active = false");
    expect(finalMigration).toContain("where 'producer_pro' = any(included_plan_ids)");
    expect(finalMigration).not.toContain("insert into public.user_subscriptions");
  });

  test("removes producer upgrade selection from user-facing surfaces", () => {
    expect(membershipCard).not.toContain('label="All Access"');
    expect(membershipCard).not.toContain("producerUpgrades");
    expect(producerPortal).not.toContain("Explore Producer Pro");
    expect(producerPortal).not.toContain('plan_id: producerUpgrade?.id ?? "producer_pro"');
    expect(producerPortal).toContain("All Producer HQ tools included");
  });
});
