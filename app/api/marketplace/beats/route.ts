import { NextResponse } from "next/server";
import { loadApprovedMarketplaceCatalog } from "@/lib/server/marketplace-catalog";

export async function GET() {
  try {
    const catalog = await loadApprovedMarketplaceCatalog(100);
    return NextResponse.json(
      { configured: true, ...catalog },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        error: error instanceof Error ? error.message : "Marketplace feed is unavailable.",
        beats: [],
        producers: [],
      },
      { status: 503 },
    );
  }
}
