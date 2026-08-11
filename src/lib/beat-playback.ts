const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STARTER_BEAT_ID = new RegExp(`^starter-beat-(${UUID_PATTERN})$`, "i");
const PRODUCER_BEAT_ID = new RegExp(`^producer-beat-(${UUID_PATTERN})$`, "i");
const RAW_BEAT_UUID = new RegExp(`^${UUID_PATTERN}$`, "i");

export type BeatPlaybackSource = {
  id: string;
  previewUrl?: unknown;
  audioUrl?: unknown;
  catalogId?: unknown;
};

export function resolveBeatPreviewUrl(beat: BeatPlaybackSource) {
  if (typeof beat.previewUrl === "string" && beat.previewUrl.trim()) return beat.previewUrl;
  if (typeof beat.audioUrl === "string" && beat.audioUrl.trim()) return beat.audioUrl;

  const starterBeatId = beat.id.match(STARTER_BEAT_ID)?.[1];
  if (starterBeatId) return `/api/starter-beats/${starterBeatId}/media?kind=audio`;

  const producerBeatId = beat.id.match(PRODUCER_BEAT_ID)?.[1];
  if (producerBeatId) return `/api/marketplace/beats/${producerBeatId}/media?kind=audio`;

  const catalogId = typeof beat.catalogId === "string" ? beat.catalogId : null;
  if (catalogId && RAW_BEAT_UUID.test(catalogId)) {
    return `/api/marketplace/beats/${catalogId}/media?kind=audio`;
  }

  return null;
}

export function clampBeatSeekTime(requestedTime: number, duration: number) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeRequestedTime = Number.isFinite(requestedTime) ? requestedTime : 0;
  const upperBound = safeDuration > 0.1 ? safeDuration - 0.05 : safeDuration;
  return Math.min(upperBound, Math.max(0, safeRequestedTime));
}

export function getTakeResumeBeatTime(beatStartTime: number, takeOffsetSeconds: number, beatDuration: number) {
  const safeStart = Number.isFinite(beatStartTime) ? Math.max(0, beatStartTime) : 0;
  const safeOffset = Number.isFinite(takeOffsetSeconds) ? Math.max(0, takeOffsetSeconds) : 0;
  const safeDuration = Number.isFinite(beatDuration) ? Math.max(0, beatDuration) : 0;
  const requestedTime = safeStart + safeOffset;

  if (safeDuration <= 0) return requestedTime;
  return requestedTime % safeDuration;
}
