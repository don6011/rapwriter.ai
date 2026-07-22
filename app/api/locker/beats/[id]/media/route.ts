import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";

const BUCKET = "artist-beats";
const idSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const parsedId = idSchema.safeParse((await context.params).id);
  if (!parsedId.success) return NextResponse.json({ error: "Beat not found." }, { status: 404 });

  const { data: beat, error } = await supabase
    .from("beat_locker")
    .select("beat_snapshot")
    .eq("id", parsedId.data)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const snapshot = beat?.beat_snapshot && typeof beat.beat_snapshot === "object" ? beat.beat_snapshot as Record<string, unknown> : null;
  const path = typeof snapshot?.audioPath === "string" ? snapshot.audioPath : null;
  if (snapshot?.source !== "private_import" || !path || !path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Beat not found." }, { status: 404 });
  }

  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 5);
  if (signError) return NextResponse.json({ error: "Private beat playback is unavailable." }, { status: 500 });
  const redirect = NextResponse.redirect(data.signedUrl, 307);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}
