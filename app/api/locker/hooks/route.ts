import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hookLockerSchema } from "@/lib/schemas";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { data, error } = await supabase.from("hook_locker").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hooks: data });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const parsed = await parseJson(request, hookLockerSchema);
  if (parsed.response) return parsed.response;
  const { data, error } = await supabase.from("hook_locker").insert({ ...parsed.data, owner_id: user.id }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hook: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Hook id is required." }, { status: 400 });
  const { error } = await supabase.from("hook_locker").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
