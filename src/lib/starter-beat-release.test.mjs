import { describe, expect, test } from "bun:test";
import { getStarterBeatPublishBlockers, isStarterBeatPublishReady } from "./starter-beat-release.ts";

const completeBeat = {
  title: "City Shadows",
  producer_name: "N0izepack Ent",
  rights_holder: "N0izepack Ent",
  audio_path: "catalog/city-shadows/audio.wav",
  duration_seconds: 180,
  bpm: 82,
  genre: "R&B",
  mood: "Late Night",
  tags: ["Jazz", "Reflective"],
  collection_slug: "midnight-sessions",
  writing_fit: ["Melodic hooks"],
  attribution: "Included with RapWriter. Courtesy of N0izepack Ent.",
};

describe("starter beat publishing", () => {
  test("accepts a complete, attributable release", () => {
    expect(isStarterBeatPublishReady(completeBeat)).toBe(true);
    expect(getStarterBeatPublishBlockers(completeBeat)).toEqual([]);
  });

  test("keeps incomplete beats private", () => {
    const blockers = getStarterBeatPublishBlockers({ ...completeBeat, bpm: null, tags: ["Trap"], rights_holder: "" });
    expect(blockers).toContain("Add the BPM");
    expect(blockers).toContain("Add at least two discovery tags");
    expect(blockers).toContain("Confirm the rights holder");
  });
});
