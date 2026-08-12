import { expect, test } from "bun:test";
import { hasFullStarterBeatLibrary, lockedStarterBeatCount, starterBeatsForArtist, type StarterBeat } from "@/lib/starter-beats";

const beats = Array.from({ length: 10 }, (_, index) => ({ id: String(index), title: `Beat ${index + 1}` })) as StarterBeat[];

test("starter beat access stays consistent across the app", () => {
  expect(starterBeatsForArtist(beats, "artist_free")).toHaveLength(3);
  expect(lockedStarterBeatCount(beats, "artist_free")).toBe(7);
  expect(hasFullStarterBeatLibrary("artist_free")).toBe(false);
  expect(starterBeatsForArtist(beats, "artist_pro")).toHaveLength(10);
  expect(lockedStarterBeatCount(beats, "artist_pro")).toBe(0);
  expect(hasFullStarterBeatLibrary("artist_pro")).toBe(true);
});
