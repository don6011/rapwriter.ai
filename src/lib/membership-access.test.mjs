import { describe, expect, test } from "bun:test";
import { membershipAccessCopy, membershipAccessNotice } from "./client/membership-access.ts";

describe("membership access responses", () => {
  test("turns an artist capability response into plan-aware copy", () => {
    const notice = membershipAccessNotice({
      error: "Upgrade your membership to use this feature.",
      code: "upgrade_required",
      audience: "artist",
      feature: "hook_doctor",
      current_plan: "artist_free",
      recommended_plan: "artist_pro",
    }, 402);

    expect(notice?.feature).toBe("hook_doctor");
    expect(membershipAccessCopy(notice)).toBe("Hook Doctor is included with Prep Studio Pro.");
  });

  test("keeps producer limits contextual and reassures users about their work", () => {
    const notice = membershipAccessNotice({
      code: "usage_limit_reached",
      audience: "producer",
      feature: "beat_uploads",
      current_plan: "producer_free",
      recommended_plan: "producer_pro",
      usage: 5,
      limit: 5,
    }, 429);

    expect(membershipAccessCopy(notice)).toBe("Beat uploads limit reached (5/5). Your work is safe.");
  });

  test("ignores untrusted codes and mismatched response statuses", () => {
    expect(membershipAccessNotice({ code: "upgrade_required" }, 500)).toBeNull();
    expect(membershipAccessNotice({ code: "admin_required" }, 402)).toBeNull();
  });
});
