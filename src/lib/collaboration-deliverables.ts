export const COLLABORATION_FILE_BUCKET = "collaboration-files";
export const MAX_COLLABORATION_FILE_BYTES = 250 * 1024 * 1024;

const mimeExtensions: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/vnd.wave": "wav",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

export function collaborationFileExtension(mimeType: string) {
  return mimeExtensions[mimeType.toLowerCase()] ?? null;
}

export function collaborationFileError(file: { name: string; type: string; size: number }) {
  if (!file.name.trim() || file.name.length > 180) return "Use a file name under 180 characters.";
  if (!collaborationFileExtension(file.type)) return "Upload an MP3, M4A, WAV, OGG, WebM, or ZIP file.";
  if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_COLLABORATION_FILE_BYTES) return "Deliverables must be under 250 MB.";
  return null;
}

export function collaborationFilePath(requestId: string, producerId: string, mimeType: string, fileId: string) {
  const extension = collaborationFileExtension(mimeType);
  if (!extension) throw new Error("Unsupported collaboration file type.");
  return `${requestId}/${producerId}/${fileId}.${extension}`;
}

export function ownsCollaborationFilePath(path: string, requestId: string, producerId: string) {
  return path.startsWith(`${requestId}/${producerId}/`) && !path.includes("..") && path.length <= 500;
}
