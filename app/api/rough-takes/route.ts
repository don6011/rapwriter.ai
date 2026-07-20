import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { roughTakeAnalysisSchema, roughTakeUploadSchema } from "@/lib/schemas";

const BUCKET = "rough-takes";
const MAX_ROUGH_TAKE_BYTES = 50 * 1024 * 1024;
const AUDIO_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"]);

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

async function signedUrl(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  const songId = searchParams.get("song_id");

  if (sessionId && !roughTakeUploadSchema.shape.session_id.safeParse(sessionId).success) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }
  if (songId && !roughTakeUploadSchema.shape.song_id.safeParse(songId).success) {
    return NextResponse.json({ error: "Invalid song." }, { status: 400 });
  }

  let query = supabase
    .from("rough_takes")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (sessionId) query = query.eq("session_id", sessionId);
  else if (songId) query = query.eq("song_id", songId);

  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ roughTake: null });

  try {
    return NextResponse.json({ roughTake: { ...data, signed_url: await signedUrl(supabase, data.storage_path) } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load rough take." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "rough-take-upload",
    limit: 30,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Rough take file is required." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_ROUGH_TAKE_BYTES || !AUDIO_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Rough takes must be valid audio files under 50 MB." }, { status: 400 });
  }

  let beatSnapshot: Record<string, unknown> = {};
  const rawBeatSnapshot = formData.get("beat_snapshot")?.toString();
  if (rawBeatSnapshot) {
    try {
      const parsedSnapshot = JSON.parse(rawBeatSnapshot);
      if (!parsedSnapshot || Array.isArray(parsedSnapshot) || typeof parsedSnapshot !== "object") throw new Error("invalid");
      beatSnapshot = parsedSnapshot as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Beat snapshot is invalid." }, { status: 400 });
    }
  }

  const metadata = roughTakeUploadSchema.safeParse({
    project_id: formData.get("project_id")?.toString() || null,
    song_id: formData.get("song_id")?.toString() || null,
    session_id: formData.get("session_id")?.toString() || null,
    section_name: formData.get("section_name")?.toString() || "Hook",
    duration_seconds: Number(formData.get("duration_seconds") ?? 0),
    beat_id: formData.get("beat_id")?.toString() || null,
    beat_snapshot: beatSnapshot,
    beat_position_seconds: Number(formData.get("beat_position_seconds") ?? 0),
  });
  if (!metadata.success) {
    return NextResponse.json({ error: metadata.error.issues[0]?.message ?? "Rough take details are invalid." }, { status: 400 });
  }

  const { project_id: projectId, song_id: songId, session_id: sessionId } = metadata.data;
  if (projectId) {
    const { data, error } = await supabase.from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (songId) {
    let query = supabase.from("songs").select("id").eq("id", songId).eq("owner_id", user.id);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Song not found in this project." }, { status: 404 });
  }
  if (sessionId) {
    let query = supabase.from("ghost_studio_sessions").select("id").eq("id", sessionId).eq("owner_id", user.id);
    if (projectId) query = query.eq("project_id", projectId);
    if (songId) query = query.eq("song_id", songId);
    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Session not found for this song." }, { status: 404 });
  }

  const rawAnalysis = formData.get("analysis")?.toString();
  let analysis: ReturnType<typeof roughTakeAnalysisSchema.parse> | null = null;
  if (rawAnalysis) {
    try {
      analysis = roughTakeAnalysisSchema.parse(JSON.parse(rawAnalysis));
    } catch {
      return NextResponse.json({ error: "Rough take analysis is invalid." }, { status: 400 });
    }
  }
  const mimeType = file.type;
  const path = `${user.id}/${songId ?? "unsorted"}/${crypto.randomUUID()}.${extensionForMime(mimeType)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("rough_takes")
    .insert({
      owner_id: user.id,
      project_id: projectId,
      song_id: songId,
      session_id: sessionId,
      section_name: metadata.data.section_name,
      duration_seconds: metadata.data.duration_seconds,
      mime_type: mimeType,
      storage_bucket: BUCKET,
      storage_path: path,
      beat_id: metadata.data.beat_id ?? null,
      beat_snapshot: metadata.data.beat_snapshot ?? {},
      beat_position_seconds: metadata.data.beat_position_seconds,
      analysis: analysis ?? {},
      analysis_version: analysis?.version ?? "booth-ready-v2",
      analyzed_at: analysis ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    return NextResponse.json({ roughTake: { ...data, signed_url: await signedUrl(supabase, path) } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not sign rough take." }, { status: 500 });
  }
}
