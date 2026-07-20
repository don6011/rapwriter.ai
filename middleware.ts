import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const isApiMutation = request.nextUrl.pathname.startsWith("/api/")
    && !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const isWebhook = request.nextUrl.pathname === "/api/stripe/webhook";

  if (isApiMutation && !isWebhook && !hasValidRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
