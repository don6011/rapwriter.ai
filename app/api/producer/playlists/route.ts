import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { producerPlaylistSaveSchema } from "@/lib/schemas";
import { membershipErrorResponse, requireMembershipEntitlement, requireMembershipLimit } from "@/lib/server/membership-access";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const parsed = await parseJson(request, producerPlaylistSaveSchema);
  if (parsed.response) return parsed.response;

  const { count, error: countError } = await supabase
    .from("producer_playlists")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  try {
    await requireMembershipEntitlement(supabase, user.id, "producer", "collections");
    await requireMembershipLimit(supabase, user.id, "producer", "collections", count ?? 0);
  } catch (error) {
    return membershipErrorResponse(error);
  }

  const { data, error } = await supabase.rpc("save_producer_playlist", {
    p_playlist_id: null,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_beat_ids: parsed.data.beat_ids,
    p_status: parsed.data.status,
  });

  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "22023" || error.code === "42501" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ playlist: data }, { status: 201 });
}
