import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { firstSessionActivationSchema } from "@/lib/schemas";

const blankSections = {
  Hook: "",
  "Verse 1": "",
  "Verse 2": "",
  Bridge: "",
  Outro: "",
};

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const parsed = await parseJson(request, firstSessionActivationSchema);
  if (parsed.response) return parsed.response;

  const { data: account, error: accountError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if (account.account_type === "producer") {
    return NextResponse.json({ error: "Artist workspace required." }, { status: 403 });
  }

  const beat = parsed.data.beat && parsed.data.beat.id !== "no-beat" ? parsed.data.beat : null;
  let { data: project, error: projectReadError } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .contains("metadata", { source: "activation" })
    .maybeSingle();

  if (projectReadError) return NextResponse.json({ error: projectReadError.message }, { status: 500 });

  if (!project) {
    const createdProject = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: parsed.data.project_title,
        project_type: "Single",
        status: "draft",
        artwork: {},
        metadata: { source: "activation", artist_goal: parsed.data.artist_goal },
      })
      .select("*")
      .single();

    if (createdProject.error?.code === "23505") {
      const existingProject = await supabase
        .from("projects")
        .select("*")
        .eq("owner_id", user.id)
        .contains("metadata", { source: "activation" })
        .single();
      project = existingProject.data;
      projectReadError = existingProject.error;
    } else {
      project = createdProject.data;
      projectReadError = createdProject.error;
    }
  }

  if (projectReadError || !project) {
    return NextResponse.json({ error: projectReadError?.message ?? "Could not create the first project." }, { status: 500 });
  }

  let { data: song, error: songError } = await supabase
    .from("songs")
    .select("*")
    .eq("owner_id", user.id)
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!song && !songError) {
    const createdSong = await supabase
      .from("songs")
      .insert({
        owner_id: user.id,
        project_id: project.id,
        title: parsed.data.song_title,
        track_number: 1,
        song_state: 0,
        sections: blankSections,
        active_section: "Hook",
        beat_id: typeof beat?.id === "string" ? beat.id : null,
        beat_snapshot: beat ?? {},
      })
      .select("*")
      .single();
    song = createdSong.data;
    songError = createdSong.error;
  }

  if (songError || !song) {
    return NextResponse.json({ error: songError?.message ?? "Could not create the first song." }, { status: 500 });
  }

  const { data: activeSessions, error: sessionReadError } = await supabase
    .from("ghost_studio_sessions")
    .select("*")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("last_active_at", { ascending: false })
    .limit(1);

  if (sessionReadError) return NextResponse.json({ error: sessionReadError.message }, { status: 500 });

  let currentSession = activeSessions?.[0] ?? null;
  let session: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: saveResult, error: sessionError } = await supabase.rpc("save_ghost_studio_session", {
      p_session_id: currentSession?.id ?? null,
      p_project_id: project.id,
      p_song_id: song.id,
      p_beat_id: typeof beat?.id === "string" ? beat.id : null,
      p_beat_snapshot: beat ?? {},
      p_mode: "skyline-loft",
      p_ambiance: "skyline-loft",
      p_section_content: blankSections,
      p_active_section: "Hook",
      p_song_state: 0,
      p_completion_pct: 0,
      p_booth_score: 0,
      p_total_bars: 0,
      p_expected_revision: currentSession?.revision ?? null,
      p_playback_position_seconds: 0,
      p_studio_dna: currentSession?.studio_dna ?? {},
      p_client_updated_at: new Date().toISOString(),
    });
    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

    const result = saveResult as { conflict?: boolean; session?: Record<string, unknown> } | null;
    if (!result?.conflict) {
      session = result?.session ?? null;
      break;
    }
    currentSession = result.session ?? null;
  }

  if (!session) return NextResponse.json({ error: "Could not start the first session. Please try again." }, { status: 409 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({
      artist_goal: parsed.data.artist_goal,
      first_session_completed: true,
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ profile, project, song, session }, { status: 201 });
}
