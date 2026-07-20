import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { sessionUpsertSchema } from "@/lib/schemas";

function sectionsFromRows(rows: Array<{ title: string; content: string }>) {
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.title] = row.content;
    return acc;
  }, {});
}

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabase
    .from("ghost_studio_sessions")
    .select("*, projects(title, project_type), songs(title)")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("last_active_at", { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const session = data?.[0] ?? null;
  if (!session) return NextResponse.json({ session: null });

  const { data: sectionRows, error: sectionError } = await supabase
    .from("song_sections")
    .select("id, section_key, title, position, content, bar_count, word_count, updated_at")
    .eq("owner_id", user.id)
    .eq("song_id", session.song_id)
    .order("position", { ascending: true });

  if (sectionError) return NextResponse.json({ error: sectionError.message }, { status: 500 });

  return NextResponse.json({
    session: {
      ...session,
      section_content: sectionRows?.length ? sectionsFromRows(sectionRows) : session.section_content,
      sections: sectionRows ?? [],
    },
  });
}

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = await parseJson(request, sessionUpsertSchema);
  if (parsed.response) return parsed.response;

  const { data, error } = await supabase.rpc("save_ghost_studio_session", {
    p_session_id: parsed.data.id ?? null,
    p_project_id: parsed.data.project_id,
    p_song_id: parsed.data.song_id,
    p_beat_id: parsed.data.beat_id ?? null,
    p_beat_snapshot: parsed.data.beat_snapshot ?? {},
    p_mode: parsed.data.mode,
    p_ambiance: parsed.data.ambiance,
    p_section_content: parsed.data.section_content,
    p_active_section: parsed.data.active_section,
    p_song_state: parsed.data.song_state,
    p_completion_pct: parsed.data.completion_pct,
    p_booth_score: parsed.data.booth_score,
    p_total_bars: parsed.data.total_bars,
    p_expected_revision: parsed.data.expected_revision ?? null,
    p_playback_position_seconds: parsed.data.playback_position_seconds,
    p_studio_dna: parsed.data.studio_dna ?? {},
    p_client_updated_at: parsed.data.client_updated_at ?? new Date().toISOString(),
  });

  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const result = data as { conflict?: boolean; session?: Record<string, unknown> } | null;
  if (result?.conflict) {
    return NextResponse.json(
      { error: "A newer version of this session is already saved.", code: "SESSION_CONFLICT", session: result.session ?? null },
      { status: 409 },
    );
  }

  return NextResponse.json({ session: result?.session ?? null });
}
