import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  identity?: string | null;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
};

export async function enforceRateLimit(request: Request, options: RateLimitOptions) {
  const identityHash = rateLimitIdentityHash(options.identity || requestClientAddress(request));

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_api_rate_limit", {
      p_scope: options.scope,
      p_identity_hash: identityHash,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });

    if (error) throw error;
    const result = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
    if (!result) throw new Error("Rate limit service returned no result.");
    if (result.allowed) return null;

    const retryAfter = Math.max(1, Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Give the studio a moment, then try again.", code: "rate_limited" },
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": String(retryAfter),
          "RateLimit-Limit": String(options.limit),
          "RateLimit-Remaining": String(result.remaining),
          "RateLimit-Reset": String(Math.ceil(new Date(result.reset_at).getTime() / 1000)),
        },
      },
    );
  } catch (error) {
    console.error(`Rate limit check failed for ${options.scope}.`, error);
    return NextResponse.json(
      { error: "The request guard is temporarily unavailable.", code: "rate_limit_unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export function rateLimitIdentityHash(identity: string) {
  return createHash("sha256").update(`rapwriter:v1:${identity.trim().toLowerCase()}`).digest("hex");
}

function requestClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown-client";
}
