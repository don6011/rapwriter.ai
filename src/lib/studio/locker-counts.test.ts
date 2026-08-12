import { expect, test } from "bun:test";
import { lockerBeatCount, lockerCollectionCount, lockerSavedItemCount } from "@/lib/studio/locker-counts";

test("Locker counts include the accessible starter pocket everywhere", () => {
  expect(lockerBeatCount([], ["midnight", "city", "southern"])).toBe(3);
  expect(lockerBeatCount(["private", "city"], ["midnight", "city", "southern"])).toBe(4);
  expect(lockerSavedItemCount({ beats: 3, songs: 1, hooks: 2 })).toBe(6);
  expect(lockerCollectionCount({ beats: 4, songs: 1, hooks: 2, roughTakes: 1, ownedItems: 2 })).toBe(10);
});
