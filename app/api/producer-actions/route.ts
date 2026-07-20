import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { producerActionCreateSchema } from "@/lib/schemas";
import { generateProducerActionWithProvider } from "@/lib/server/producer-action-provider";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "producer-actions",
    limit: 20,
    windowSeconds: 5 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = await parseJson(request, producerActionCreateSchema);
  if (parsed.response) return parsed.response;

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("id, project_id")
    .eq("id", parsed.data.song_id)
    .eq("project_id", parsed.data.project_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (songError) return NextResponse.json({ error: songError.message }, { status: 500 });
  if (!song) return NextResponse.json({ error: "Song not found." }, { status: 404 });

  if (parsed.data.session_id) {
    const { data: session, error: sessionError } = await supabase
      .from("ghost_studio_sessions")
      .select("id")
      .eq("id", parsed.data.session_id)
      .eq("song_id", parsed.data.song_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const draft = await generateProducerActionWithProvider({
    actionType: parsed.data.action_type,
    sectionName: parsed.data.section_name,
    sectionContent: parsed.data.section_content,
    attempt: parsed.data.attempt,
    beat: parsed.data.beat,
    studioDna: parsed.data.studio_dna,
  });

  const sectionKey = toSectionKey(parsed.data.section_name);
  const { data: action, error } = await supabase
    .from("producer_actions")
    .insert({
      owner_id: user.id,
      project_id: parsed.data.project_id,
      song_id: parsed.data.song_id,
      session_id: parsed.data.session_id ?? null,
      section_name: parsed.data.section_name,
      section_key: sectionKey,
      action_type: parsed.data.action_type,
      attempt: parsed.data.attempt,
      input_content: parsed.data.section_content,
      proposed_content: draft.proposedContent,
      rationale: draft.rationale,
      changes: draft.changes,
      context: {
        beat: parsed.data.beat,
        studio_dna: parsed.data.studio_dna,
      },
      provider: draft.provider,
      model: draft.model,
    })
    .select("id, action_type, attempt, input_content, proposed_content, rationale, changes, provider, status, section_name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      proposal: {
        id: action.id,
        actionType: action.action_type,
        title: draft.title,
        sectionName: action.section_name,
        originalContent: action.input_content,
        proposedContent: action.proposed_content,
        rationale: action.rationale,
        changes: action.changes,
        attempt: action.attempt,
        provider: action.provider,
        status: action.status,
      },
    },
    { status: 201 },
  );
}

function toSectionKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
