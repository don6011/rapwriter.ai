import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { beatLicenseEntitlementId, producerBeatIdFromCatalogId } from "@/lib/producer-beat-media";
import { beatLockerSchema } from "@/lib/schemas";

const PRIVATE_BEAT_BUCKET = "artist-beats";

function withLockerPlayback<T extends { id: string; beat_id: string; license: string | null; beat_snapshot: Record<string, unknown> | null }>(beat: T, entitlements: Set<string>) {
  const safeSnapshot = { ...beat.beat_snapshot };
  delete safeSnapshot.audioBucket;
  delete safeSnapshot.audioPath;
  delete safeSnapshot.audioUrl;
  delete safeSnapshot.originalFileName;
  if (beat.beat_snapshot?.source === "private_import") {
    return {
      ...beat,
      beat_snapshot: {
        ...safeSnapshot,
        previewUrl: `/api/locker/beats/${beat.id}/media`,
      },
    };
  }

  const producerBeatId = producerBeatIdFromCatalogId(beat.beat_id);
  if (!producerBeatId) return { ...beat, beat_snapshot: safeSnapshot };
  const entitlementId = beat.license ? beatLicenseEntitlementId(producerBeatId, beat.license) : null;
  const licensed = Boolean(entitlementId && entitlements.has(entitlementId));
  return {
    ...beat,
    beat_snapshot: {
      ...safeSnapshot,
      source: licensed ? "licensed_producer" : "approved_producer",
      previewUrl: licensed
        ? `/api/locker/beats/${beat.id}/media`
        : `/api/marketplace/beats/${producerBeatId}/media?kind=audio`,
    },
  };
}

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const [beatResult, entitlementResult] = await Promise.all([
    supabase.from("beat_locker").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("product_entitlements").select("product_id").eq("owner_id", user.id).eq("product_type", "beat_license"),
  ]);
  if (beatResult.error) return NextResponse.json({ error: beatResult.error.message }, { status: 500 });
  if (entitlementResult.error) return NextResponse.json({ error: entitlementResult.error.message }, { status: 500 });
  const entitlements = new Set((entitlementResult.data ?? []).map((row) => row.product_id));
  return NextResponse.json(
    { beats: (beatResult.data ?? []).map((beat) => withLockerPlayback(beat, entitlements)) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const parsed = await parseJson(request, beatLockerSchema);
  if (parsed.response) return parsed.response;
  if (parsed.data.license !== "Favorite") {
    return NextResponse.json({ error: "Purchased licenses are added after verified checkout." }, { status: 403 });
  }
  const safeSnapshot = { ...(parsed.data.beat_snapshot ?? {}) };
  delete safeSnapshot.audioBucket;
  delete safeSnapshot.audioPath;
  delete safeSnapshot.audioUrl;
  const { data, error } = await supabase.from("beat_locker").upsert(
    { ...parsed.data, price: 0, license: "Favorite", stripe_checkout_session_id: null, beat_snapshot: safeSnapshot, owner_id: user.id },
    { onConflict: "owner_id,beat_id,license" },
  ).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ beat: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Beat id is required." }, { status: 400 });

  const { data: beat, error: readError } = await supabase
    .from("beat_locker")
    .select("id, beat_snapshot")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!beat) return NextResponse.json({ error: "Beat not found." }, { status: 404 });

  const snapshot = beat.beat_snapshot && typeof beat.beat_snapshot === "object" ? beat.beat_snapshot as Record<string, unknown> : {};
  const storagePath = typeof snapshot.audioPath === "string" ? snapshot.audioPath : null;
  if (snapshot.source === "private_import" && storagePath) {
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Private beat storage path is invalid." }, { status: 409 });
    }
    const { error: storageError } = await supabase.storage.from(PRIVATE_BEAT_BUCKET).remove([storagePath]);
    if (storageError && !storageError.message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: "Could not remove the private beat audio." }, { status: 500 });
    }
  }

  const { error } = await supabase.from("beat_locker").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
