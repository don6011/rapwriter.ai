import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import {
  beatLicenseEntitlementId,
  producerBeatIdFromCatalogId,
  PRODUCER_BEAT_BUCKET,
} from "@/lib/producer-beat-media";
import { createAdminClient } from "@/lib/supabase/admin";

const PRIVATE_BUCKET = "artist-beats";
const idSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const parsedId = idSchema.safeParse((await context.params).id);
  if (!parsedId.success) return NextResponse.json({ error: "Beat not found." }, { status: 404 });

  const { data: beat, error } = await supabase
    .from("beat_locker")
    .select("beat_id, license, beat_snapshot")
    .eq("id", parsedId.data)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const snapshot = beat?.beat_snapshot && typeof beat.beat_snapshot === "object" ? beat.beat_snapshot as Record<string, unknown> : null;
  const privatePath = typeof snapshot?.audioPath === "string" ? snapshot.audioPath : null;
  if (snapshot?.source === "private_import") {
    if (!privatePath || !privatePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Beat not found." }, { status: 404 });
    }
    const { data, error: signError } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(privatePath, 60 * 5);
    if (signError || !data?.signedUrl) return NextResponse.json({ error: "Private beat playback is unavailable." }, { status: 500 });
    const redirect = NextResponse.redirect(data.signedUrl, 307);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  const producerBeatId = producerBeatIdFromCatalogId(beat?.beat_id);
  if (!producerBeatId || !beat?.license) return NextResponse.json({ error: "Beat not found." }, { status: 404 });
  const { data: entitlement, error: entitlementError } = await supabase
    .from("product_entitlements")
    .select("id")
    .eq("owner_id", user.id)
    .eq("product_id", beatLicenseEntitlementId(producerBeatId, beat.license))
    .eq("product_type", "beat_license")
    .maybeSingle();
  if (entitlementError) return NextResponse.json({ error: "Beat access could not be verified." }, { status: 500 });
  if (!entitlement) return NextResponse.json({ error: "A verified beat license is required." }, { status: 403 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Licensed beat delivery is unavailable." }, { status: 503 });
  }
  const { data: producerBeat, error: producerBeatError } = await admin
    .from("producer_beats")
    .select("audio_path")
    .eq("id", producerBeatId)
    .maybeSingle();
  if (producerBeatError) return NextResponse.json({ error: "Licensed beat delivery failed." }, { status: 500 });
  if (!producerBeat?.audio_path) return NextResponse.json({ error: "Licensed beat audio is unavailable." }, { status: 404 });

  const { data, error: signError } = await admin.storage.from(PRODUCER_BEAT_BUCKET).createSignedUrl(producerBeat.audio_path, 60 * 5);
  if (signError || !data?.signedUrl) return NextResponse.json({ error: "Licensed beat playback is unavailable." }, { status: 500 });
  const redirect = NextResponse.redirect(data.signedUrl, 307);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}
