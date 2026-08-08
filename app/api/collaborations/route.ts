import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { collaborationRequestSchema } from "@/lib/schemas";
import { collaborationRoomIsOpen, type CollaborationStatus } from "@/lib/collaboration";
import { membershipErrorResponse, requireMembershipEntitlement, requireMembershipLimit } from "@/lib/server/membership-access";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSelect = "id, artist_id, producer_id, producer_profile_id, producer_service_id, project_id, song_id, beat_id, title, brief, budget_cents, requested_deadline, status, handoff_status, response_note, counter_price_cents, responded_at, accepted_at, completed_at, created_at, updated_at, producer_profiles(display_name, handle, avatar_path), producer_services(title, service_type), producer_beats(title, artwork_path), projects(title), songs(title)";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { data, error } = await supabase
    .from("producer_collaboration_requests")
    .select(requestSelect)
    .or(`artist_id.eq.${user.id},producer_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingCollaborationTable(error)) return NextResponse.json({ requests: [], viewer_id: user.id, foundation_ready: false });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const requests = data ?? [];
  const artistIds = [...new Set(requests.map((request) => request.artist_id))];
  const artistProfiles = artistIds.length
    ? await createAdminClient().from("profiles").select("id, artist_name, display_name").in("id", artistIds)
    : { data: [], error: null };
  const artistById = new Map((artistProfiles.data ?? []).map((profile) => [profile.id, {
    display_name: profile.artist_name || profile.display_name || "Artist",
  }]));

  return NextResponse.json({
    requests: requests.map((request) => ({
      ...request,
      artist_profile: artistById.get(request.artist_id) ?? { display_name: "Artist" },
      room_open: collaborationRoomIsOpen(request.status as CollaborationStatus),
      room_url: collaborationRoomIsOpen(request.status as CollaborationStatus)
        ? `/collaborations?request=${request.id}`
        : null,
    })),
    viewer_id: user.id,
    foundation_ready: true,
  });
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const parsed = await parseJson(request, collaborationRequestSchema);
  if (parsed.response) return parsed.response;

  const { count, error: countError } = await supabase
    .from("producer_collaboration_requests")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", user.id)
    .in("status", ["submitted", "countered", "accepted"]);
  if (countError) {
    if (isMissingCollaborationTable(countError)) return NextResponse.json({ error: "Private collaboration setup is pending." }, { status: 503 });
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  try {
    await requireMembershipEntitlement(supabase, user.id, "artist", "producer_collaboration");
    await requireMembershipLimit(supabase, user.id, "artist", "active_collaborations", count ?? 0);
  } catch (error) {
    return membershipErrorResponse(error);
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("producer_profiles")
    .select("id, owner_id")
    .eq("id", parsed.data.producer_profile_id)
    .eq("status", "approved")
    .eq("is_public", true)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile || profile.owner_id === user.id) return NextResponse.json({ error: "This producer is not available for requests." }, { status: 404 });

  if (parsed.data.producer_service_id) {
    const { data: service } = await admin.from("producer_services").select("id").eq("id", parsed.data.producer_service_id).eq("producer_profile_id", profile.id).eq("is_active", true).maybeSingle();
    if (!service) return NextResponse.json({ error: "That producer service is no longer available." }, { status: 409 });
  }
  if (parsed.data.beat_id) {
    const { data: beat } = await admin.from("producer_beats").select("id").eq("id", parsed.data.beat_id).eq("producer_profile_id", profile.id).eq("status", "approved").maybeSingle();
    if (!beat) return NextResponse.json({ error: "That beat is not available for collaboration." }, { status: 409 });
  }
  if (parsed.data.project_id) {
    const { data: project } = await supabase.from("projects").select("id").eq("id", parsed.data.project_id).eq("owner_id", user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (parsed.data.song_id) {
    const { data: song } = await supabase.from("songs").select("id").eq("id", parsed.data.song_id).eq("owner_id", user.id).maybeSingle();
    if (!song) return NextResponse.json({ error: "Song not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("producer_collaboration_requests")
    .insert({ artist_id: user.id, producer_id: profile.owner_id, ...parsed.data, status: "submitted" })
    .select(requestSelect)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

function isMissingCollaborationTable(error: { code?: string; message?: string }) {
  return error.code === "42P01"
    || error.code === "PGRST205"
    || Boolean(error.message?.includes("Could not find the table") && error.message.includes("schema cache"));
}
