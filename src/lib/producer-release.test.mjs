import { describe, expect, test } from "bun:test";
import { getProducerBeatBlockers, getProducerProfileBlockers, getProducerUploadDraftBlockers } from "./producer-release.ts";

describe("producer release readiness", () => {
  test("blocks incomplete producer profiles", () => {
    const blockers = getProducerProfileBlockers(
      { display_name: "New Producer", handle: "", city: "Memphis", country: "United States", bio: "Short", genres: [], specialties: [] },
      { onboarding_completed: false, business_email: "" },
    );
    expect(blockers).toContain("Claim a storefront handle.");
    expect(blockers).toContain("Complete producer onboarding.");
    expect(blockers.length).toBeGreaterThan(4);
  });

  test("accepts a complete release-ready beat", () => {
    expect(getProducerBeatBlockers({
      title: "First Release",
      bpm: 92,
      duration_seconds: 185,
      genre: "Trap",
      mood: "Focused",
      region: "Memphis",
      tags: ["Trap", "Focused"],
      audio_path: "user/beats/audio.mp3",
      artwork_path: "user/artwork/cover.webp",
      license_tiers: [
        { license: "Lease", price: 49 },
        { license: "Premium Lease", price: 149 },
        { license: "Exclusive", price: 899 },
      ],
    })).toEqual([]);
  });

  test("explains invalid upload fields before submission", () => {
    const blockers = getProducerUploadDraftBlockers({
      title: "Pulse Code",
      bpm: "453",
      genre: "Trap",
      mood: "Late Night",
      region: "Atlanta",
      tags: "Trap, Street",
      lease_price: "49",
      premium_price: "149",
      exclusive_price: "899",
      has_audio: true,
      has_artwork: true,
    });
    expect(blockers).toEqual(["BPM must be between 40 and 220."]);
  });
});
