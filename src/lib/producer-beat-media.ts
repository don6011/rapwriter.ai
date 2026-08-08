export const PRODUCER_BEAT_BUCKET = "producer-beats";
export const PRODUCER_BEAT_PREVIEW_SECONDS = 30;
export const MAX_PRODUCER_BEAT_PREVIEW_BYTES = 16 * 1024 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCER_BEAT_PREFIX = "producer-beat-";

type BeatPreviewMetadata = {
  preview_path?: unknown;
  preview_duration_seconds?: unknown;
};

export function producerBeatIdFromCatalogId(value: string | null | undefined) {
  if (!value) return null;
  const candidate = value.startsWith(PRODUCER_BEAT_PREFIX)
    ? value.slice(PRODUCER_BEAT_PREFIX.length)
    : value;
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

export function getProducerBeatPreviewPath(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const path = (metadata as BeatPreviewMetadata).preview_path;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export function getProducerBeatPreviewDuration(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = Number((metadata as BeatPreviewMetadata).preview_duration_seconds);
  return Number.isInteger(value) && value >= 1 && value <= PRODUCER_BEAT_PREVIEW_SECONDS ? value : null;
}

export function isOwnedProducerPreviewPath(path: string | null, ownerId: string, masterPath?: string | null) {
  if (!path || path === masterPath || path.includes("..") || path.startsWith("/")) return false;
  return path.startsWith(`${ownerId}/previews/`);
}

export function beatLicenseEntitlementId(producerBeatId: string, license: string) {
  const normalizedLicense = license.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `beat-license:${producerBeatId}:${normalizedLicense || "license"}`;
}

export function producerBeatPreviewMetadata(previewPath: string, durationSeconds: number, current: unknown = {}) {
  const metadata = current && typeof current === "object" && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  return {
    ...metadata,
    preview_path: previewPath,
    preview_duration_seconds: Math.max(1, Math.min(PRODUCER_BEAT_PREVIEW_SECONDS, Math.round(durationSeconds))),
    preview_version: 1,
  };
}

