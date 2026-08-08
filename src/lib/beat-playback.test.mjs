import { describe, expect, test } from "bun:test";
import { clampBeatSeekTime, resolveBeatPreviewUrl } from "./beat-playback.ts";

const beatId = "11111111-1111-4111-8111-111111111111";

describe("beat playback", () => {
  test("recovers stock and producer media routes from persisted beat IDs", () => {
    expect(resolveBeatPreviewUrl({ id: `starter-beat-${beatId}` })).toBe(
      `/api/starter-beats/${beatId}/media?kind=audio`,
    );
    expect(resolveBeatPreviewUrl({ id: `producer-beat-${beatId}` })).toBe(
      `/api/marketplace/beats/${beatId}/media?kind=audio`,
    );
  });

  test("keeps explicit secure playback URLs authoritative", () => {
    expect(resolveBeatPreviewUrl({ id: "private", previewUrl: "/api/locker/beats/private/media" })).toBe(
      "/api/locker/beats/private/media",
    );
  });

  test("clamps seeking to playable media bounds", () => {
    expect(clampBeatSeekTime(42.5, 120)).toBe(42.5);
    expect(clampBeatSeekTime(-10, 120)).toBe(0);
    expect(clampBeatSeekTime(200, 120)).toBeCloseTo(119.95);
    expect(clampBeatSeekTime(Number.NaN, 120)).toBe(0);
  });
});
