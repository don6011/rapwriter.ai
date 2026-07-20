import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { marketplaceEventSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VIEWER_COOKIE = "rapwriter_market_viewer";
const producerBeatPattern = /^(?:producer-beat-)?([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const rateLimit = await enforceRateLimit(request, {
    scope: "marketplace-events",
    limit: 120,
    windowSeconds: 60,
  });
  if (rateLimit) return rateLimit;

  const parsed = marketplaceEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid Marketplace event." }, { status: 400 });

  const beatId = parsed.data.beat_id.match(producerBeatPattern)?.[1];
  if (!beatId) return NextResponse.json({ error: "Unknown beat." }, { status: 404 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const actorId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (parsed.data.event_type !== "beat_play" && !actorId) {
    return NextResponse.json({ error: "Sign in to save Marketplace activity." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: beat, error: beatError } = await admin
    .from("producer_beats")
    .select("id, producer_profile_id, status, producer_profiles!inner(status, is_public)")
    .eq("id", beatId)
    .eq("status", "approved")
    .eq("producer_profiles.status", "approved")
    .eq("producer_profiles.is_public", true)
    .maybeSingle();

  if (beatError) return NextResponse.json({ error: beatError.message }, { status: 500 });
  if (!beat) return NextResponse.json({ error: "Beat is not available." }, { status: 404 });

  const cookieStore = await cookies();
  const existingViewer = cookieStore.get(VIEWER_COOKIE)?.value;
  const anonymousViewer = existingViewer && /^[0-9a-f-]{36}$/i.test(existingViewer) ? existingViewer : randomUUID();
  const viewerKey = actorId ? `user:${actorId}` : `anon:${anonymousViewer}`;
  const viewerHash = hashValue(viewerKey);
  const bucket = parsed.data.event_type === "beat_play"
    ? String(Math.floor(Date.now() / (10 * 60 * 1000)))
    : "ever";
  const dedupeKey = hashValue(`${parsed.data.event_type}:${beat.id}:${viewerHash}:${bucket}`);

  const { error } = await admin.from("marketplace_events").insert({
    event_type: parsed.data.event_type,
    actor_id: actorId,
    anonymous_key_hash: viewerHash,
    beat_id: beat.id,
    producer_profile_id: beat.producer_profile_id,
    event_bucket: bucket,
    dedupe_key: dedupeKey,
  });

  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ accepted: true, duplicate: error?.code === "23505" }, { status: 202 });
  if (!existingViewer) {
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    response.cookies.set(VIEWER_COOKIE, anonymousViewer, {
      httpOnly: true,
      sameSite: "lax",
      secure: forwardedProtocol === "https" || new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
