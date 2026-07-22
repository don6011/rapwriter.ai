import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const beatId = (await params).id;
  if (!uuidPattern.test(beatId)) return NextResponse.json({ error: "Invalid beat." }, { status: 400 });

  const kind = new URL(request.url).searchParams.get("kind") ?? "audio";
  if (kind !== "audio" && kind !== "artwork") {
    return NextResponse.json({ error: "Invalid media type." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: beat, error } = await supabase
      .from("starter_beats")
      .select("audio_bucket, audio_path, artwork_path")
      .eq("id", beatId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!beat) return NextResponse.json({ error: "Starter Beat not found." }, { status: 404 });

    const path = kind === "audio" ? beat.audio_path : beat.artwork_path;
    if (!path) return NextResponse.json({ error: "Beat media is unavailable." }, { status: 404 });

    const { data, error: signError } = await supabase.storage
      .from(beat.audio_bucket || "starter-beats")
      .createSignedUrl(path, 60 * 60);
    if (signError || !data?.signedUrl) throw signError ?? new Error("Could not sign beat media.");

    const response = NextResponse.redirect(data.signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Starter Beat media is unavailable." },
      { status: 503 },
    );
  }
}
