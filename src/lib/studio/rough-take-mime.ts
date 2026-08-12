const ROUGH_TAKE_MIME_CANDIDATES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

type SupportsMimeType = (mimeType: string) => boolean;

/**
 * Prefer AAC in an MP4 container where the recorder supports it. Safari records
 * this shape, while Chromium falls through to Opus/WebM.
 */
export function preferredRoughTakeMimeType(supportsMimeType: SupportsMimeType) {
  return ROUGH_TAKE_MIME_CANDIDATES.find(supportsMimeType) ?? null;
}

/**
 * Some WebKit builds leave MediaRecorder.mimeType blank after recording. Keep the
 * negotiated container so the uploaded file and its extension stay truthful.
 */
export function resolvedRoughTakeMimeType(recorderMimeType: string, negotiatedMimeType: string | null) {
  return recorderMimeType || negotiatedMimeType || "audio/webm";
}
