import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { beatLockerSchema } from "@/lib/schemas";

const PRIVATE_BEAT_BUCKET = "artist-beats";

function withPrivatePlayback<T extends { id: string; beat_snapshot: Record<string, unknown> | null }>(beat: T) {
  if (beat.beat_snapshot?.source !== "private_import") return beat;
  const safeSnapshot = { ...beat.beat_snapshot };
  delete safeSnapshot.audioBucket;
  delete safeSnapshot.audioPath;
  delete safeSnapshot.originalFileName;
  return {
    ...beat,
    beat_snapshot: {
      ...safeSnapshot,
      previewUrl: `/api/locker/beats/${beat.id}/media`,
    },
  };
}

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { data, error } = await supabase.from("beat_locker").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { beats: (data ?? []).map(withPrivatePlayback) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const parsed = await parseJson(request, beatLockerSchema);
  if (parsed.response) return parsed.response;
  const { data, error } = await supabase.from("beat_locker").upsert({ ...parsed.data, owner_id: user.id }, { onConflict: "owner_id,beat_id,license" }).select("*").single();
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
