import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { createRequestId, getReleaseId } from "@/lib/observability";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const requestId = createRequestId(request.headers.get("x-request-id"));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const isApiMutation = request.nextUrl.pathname.startsWith("/api/")
    && !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const isWebhook = request.nextUrl.pathname === "/api/stripe/webhook";

  if (isApiMutation && !isWebhook && !hasValidRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      {
        status: 403,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Request-ID": requestId,
          "X-RapWriter-Release": getReleaseId(),
        },
      },
    );
  }

  const response = await updateSession(request, requestHeaders);
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-RapWriter-Release", getReleaseId());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
