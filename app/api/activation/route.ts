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

  let { data: session, error: sessionError } = await supabase
    .from("ghost_studio_sessions")
    .select("*")
    .eq("owner_id", user.id)
    .eq("song_id", song.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!session && !sessionError) {
    const createdSession = await supabase
      .from("ghost_studio_sessions")
      .insert({
        owner_id: user.id,
        project_id: project.id,
        song_id: song.id,
        beat_id: typeof beat?.id === "string" ? beat.id : null,
        beat_snapshot: beat ?? {},
        mode: "midnight",
        ambiance: "midnight",
        section_content: blankSections,
        active_section: "Hook",
        song_state: 0,
        completion_pct: 0,
        booth_score: 0,
        total_bars: 0,
        is_active: true,
      })
      .select("*")
      .single();
    session = createdSession.data;
    sessionError = createdSession.error;
  }

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message ?? "Could not start the first session." }, { status: 500 });
  }

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
