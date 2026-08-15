import { getTakeResumeBeatTime } from "@/lib/beat-playback";

export const DEFAULT_ROUGH_TAKE_SYNC_MS = 150;
export const MIN_ROUGH_TAKE_SYNC_MS = -300;
export const MAX_ROUGH_TAKE_SYNC_MS = 300;
export const ROUGH_TAKE_SYNC_STORAGE_KEY = "rapwriter.rough-take-sync-ms";

export function normalizeRoughTakeSyncMs(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_ROUGH_TAKE_SYNC_MS;
  return Math.max(MIN_ROUGH_TAKE_SYNC_MS, Math.min(MAX_ROUGH_TAKE_SYNC_MS, Math.round(value)));
}

export function getRoughTakeVocalMediaTime(logicalTime: number, duration: number, syncMs: number) {
  const safeLogicalTime = Math.max(0, Number.isFinite(logicalTime) ? logicalTime : 0);
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const vocalAdvance = Math.max(0, normalizeRoughTakeSyncMs(syncMs)) / 1000;
  return Math.min(safeDuration, safeLogicalTime + vocalAdvance);
}

export function getRoughTakeLogicalTime(mediaTime: number, duration: number, syncMs: number) {
  const safeMediaTime = Math.max(0, Number.isFinite(mediaTime) ? mediaTime : 0);
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const vocalAdvance = Math.max(0, normalizeRoughTakeSyncMs(syncMs)) / 1000;
  return Math.min(safeDuration, Math.max(0, safeMediaTime - vocalAdvance));
}

export function getRoughTakeReviewBeatTime(beatStartTime: number, logicalTime: number, beatDuration: number, syncMs: number) {
  const beatAdvance = Math.max(0, -normalizeRoughTakeSyncMs(syncMs)) / 1000;
  return getTakeResumeBeatTime(beatStartTime, logicalTime + beatAdvance, beatDuration);
}
