export function hasValidRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.slice(0, -1);
  const expectedOrigin = host ? `${protocol}://${host}` : requestUrl.origin;

  try {
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
