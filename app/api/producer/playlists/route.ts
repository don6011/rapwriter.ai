import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { producerPlaylistSaveSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const { supabase, response } = await requireRole("producer");
  if (response) return response;

  const parsed = await parseJson(request, producerPlaylistSaveSchema);
  if (parsed.response) return parsed.response;

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
