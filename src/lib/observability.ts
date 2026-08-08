const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,128}$/;
const MAX_LOG_VALUE_LENGTH = 500;

type LogLevel = "info" | "warn" | "error";
type LogValue = boolean | number | string | null | undefined;

export type ObservabilityFields = Record<string, LogValue>;

export function createRequestId(candidate?: string | null) {
  const value = candidate?.trim();
  return value && REQUEST_ID_PATTERN.test(value) ? value : crypto.randomUUID();
}

export function getRequestId(request: Request) {
  return createRequestId(request.headers.get("x-request-id"));
}

export function getReleaseId() {
  const release = process.env.APP_RELEASE
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || "development";
  return release.slice(0, 12);
}

export function safeRequestPath(path: string) {
  return path.split("?")[0]?.slice(0, 240) || "/";
}

export function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { error_name: "UnknownError", error_message: "Unknown server error" };

  const digest = "digest" in error && typeof error.digest === "string" ? error.digest : undefined;
  return {
    error_name: truncate(error.name || "Error"),
    error_message: truncate(error.message || "Server error"),
    error_digest: digest ? truncate(digest) : undefined,
  };
}

export function logEvent(level: LogLevel, event: string, fields: ObservabilityFields = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "rapwriter-web",
    release: getReleaseId(),
    event: truncate(event),
    ...sanitizeFields(fields),
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

function sanitizeFields(fields: ObservabilityFields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? truncate(value) : value]),
  );
}

function truncate(value: string) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\bbearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, "[redacted-token]")
    .slice(0, MAX_LOG_VALUE_LENGTH);
}
