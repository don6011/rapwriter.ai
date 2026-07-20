import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { songLockerSchema } from "@/lib/schemas";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { data, error } = await supabase.from("song_locker").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ songs: data });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const parsed = await parseJson(request, songLockerSchema);
  if (parsed.response) return parsed.response;
  const { data, error } = await supabase.from("song_locker").upsert({ ...parsed.data, owner_id: user.id }, { onConflict: "owner_id,song_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ song: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Song id is required." }, { status: 400 });
  const { error } = await supabase.from("song_locker").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
