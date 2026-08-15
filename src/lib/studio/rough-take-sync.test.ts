import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ROUGH_TAKE_SYNC_MS,
  getRoughTakeLogicalTime,
  getRoughTakeReviewBeatTime,
  getRoughTakeVocalMediaTime,
  normalizeRoughTakeSyncMs,
} from "@/lib/studio/rough-take-sync";

describe("rough take review sync", () => {
  test("starts from a conservative device default and clamps user calibration", () => {
    expect(DEFAULT_ROUGH_TAKE_SYNC_MS).toBe(150);
    expect(normalizeRoughTakeSyncMs(450)).toBe(300);
    expect(normalizeRoughTakeSyncMs(-450)).toBe(-300);
    expect(normalizeRoughTakeSyncMs(Number.NaN)).toBe(150);
  });

  test("positive sync advances vocals while preserving logical review time", () => {
    expect(getRoughTakeVocalMediaTime(2, 10, 150)).toBe(2.15);
    expect(getRoughTakeLogicalTime(2.15, 10, 150)).toBeCloseTo(2);
    expect(getRoughTakeReviewBeatTime(4, 2, 30, 150)).toBe(6);
  });

  test("negative sync advances the beat so vocals land later", () => {
    expect(getRoughTakeVocalMediaTime(2, 10, -120)).toBe(2);
    expect(getRoughTakeLogicalTime(2, 10, -120)).toBe(2);
    expect(getRoughTakeReviewBeatTime(4, 2, 30, -120)).toBeCloseTo(6.12);
  });
});
