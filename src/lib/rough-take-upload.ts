export const MAX_ROUGH_TAKE_BYTES = 50 * 1024 * 1024;

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

export function normalizeRoughTakeMimeType(value: string) {
  const mimeType = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return SUPPORTED_AUDIO_MIME_TYPES.has(mimeType) ? mimeType : null;
}

export function roughTakeExtension(mimeType: string) {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  if (mimeType === "audio/ogg") return "ogg";
  return "webm";
}
