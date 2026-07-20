import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { producerPlaylistSaveSchema } from "@/lib/schemas";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { supabase, response } = await requireRole("producer");
  if (response) return response;

  const playlistId = (await params).id;
  if (!uuidPattern.test(playlistId)) return NextResponse.json({ error: "Invalid playlist." }, { status: 400 });

  const parsed = await parseJson(request, producerPlaylistSaveSchema);
  if (parsed.response) return parsed.response;

  const { data, error } = await supabase.rpc("save_producer_playlist", {
    p_playlist_id: playlistId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_beat_ids: parsed.data.beat_ids,
    p_status: parsed.data.status,
  });

  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "22023" || error.code === "42501" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ playlist: data });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const playlistId = (await params).id;
  if (!uuidPattern.test(playlistId)) return NextResponse.json({ error: "Invalid playlist." }, { status: 400 });

  const { error } = await supabase
    .from("producer_playlists")
    .delete()
    .eq("id", playlistId)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
