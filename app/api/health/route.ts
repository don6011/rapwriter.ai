import { NextResponse } from "next/server";
import {
  getReleaseId,
  getRequestId,
  logEvent,
  serializeError,
} from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id", { head: true }).limit(1);
    if (error) throw error;
    const durationMs = Date.now() - startedAt;
    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        release: getReleaseId(),
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": `database;dur=${durationMs}`,
          "X-Request-ID": requestId,
        },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logEvent("error", "health.readiness_failed", {
      request_id: requestId,
      duration_ms: durationMs,
      ...serializeError(error),
    });
    return NextResponse.json(
      {
        status: "degraded",
        database: "unavailable",
        release: getReleaseId(),
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": `database;dur=${durationMs}`,
          "X-Request-ID": requestId,
        },
      },
    );
  }
}
