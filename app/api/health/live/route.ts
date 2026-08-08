import { NextResponse } from "next/server";
import { getReleaseId, getRequestId } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(
    {
      status: "ok",
      release: getReleaseId(),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-ID": getRequestId(request),
      },
    },
  );
}
