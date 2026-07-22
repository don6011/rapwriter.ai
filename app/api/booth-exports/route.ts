import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { boothExportCreateSchema, boothExportSnapshotSchema } from "@/lib/booth-export";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabase
    .from("booth_exports")
    .select("id,project_id,song_id,session_id,rough_take_id,version_number,title,booth_score,completion_pct,total_bars,snapshot,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exports: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const rateLimit = await enforceRateLimit(request, {
    scope: "booth-export-create",
    limit: 30,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = await parseJson(request, boothExportCreateSchema);
  if (parsed.response) return parsed.response;
  const input = parsed.data;

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("id,project_id,title")
    .eq("id", input.song_id)
    .eq("project_id", input.project_id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (songError) return NextResponse.json({ error: songError.message }, { status: 500 });
  if (!song) return NextResponse.json({ error: "Song not found in this project." }, { status: 404 });

  if (input.session_id) {
    const { data: session, error } = await supabase
      .from("ghost_studio_sessions")
      .select("id")
      .eq("id", input.session_id)
      .eq("project_id", input.project_id)
      .eq("song_id", input.song_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Session not found for this song." }, { status: 404 });
  }

  if (input.rough_take_id) {
    const { data: roughTake, error } = await supabase
      .from("rough_takes")
      .select("id")
      .eq("id", input.rough_take_id)
      .eq("song_id", input.song_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!roughTake) return NextResponse.json({ error: "Rough take not found for this song." }, { status: 404 });
  }

  const snapshot = boothExportSnapshotSchema.parse(input.snapshot);
  const exportRow = {
    owner_id: user.id,
    project_id: input.project_id,
    song_id: input.song_id,
    session_id: input.session_id ?? null,
    rough_take_id: input.rough_take_id ?? null,
    title: song.title || input.title,
    booth_score: snapshot.boothReady.score,
    completion_pct: snapshot.completionPct,
    total_bars: snapshot.totalBars,
    snapshot,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: latest, error: latestError } = await supabase
      .from("booth_exports")
      .select("version_number")
      .eq("owner_id", user.id)
      .eq("song_id", input.song_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) return NextResponse.json({ error: latestError.message }, { status: 500 });

    const { data, error } = await supabase
      .from("booth_exports")
      .insert({ ...exportRow, version_number: (latest?.version_number ?? 0) + 1 })
      .select("id,project_id,song_id,session_id,rough_take_id,version_number,title,booth_score,completion_pct,total_bars,snapshot,created_at")
      .single();
    if (!error) {
      return NextResponse.json({ export: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    if (error.code !== "23505" || attempt === 1) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not create Booth Ready export." }, { status: 500 });
}
