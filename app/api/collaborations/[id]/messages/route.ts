import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { collaborationMessageSchema } from "@/lib/schemas";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const id = (await params).id;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid collaboration." }, { status: 400 });
  const { data, error } = await supabase.from("producer_collaboration_messages").select("id, request_id, sender_id, body, created_at").eq("request_id", id).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const id = (await params).id;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid collaboration." }, { status: 400 });
  const parsed = await parseJson(request, collaborationMessageSchema);
  if (parsed.response) return parsed.response;
  const { data, error } = await supabase.from("producer_collaboration_messages").insert({ request_id: id, sender_id: user.id, body: parsed.data.body }).select("*").single();
  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Messaging opens after the producer accepts." : error.message }, { status });
  }
  return NextResponse.json({ message: data }, { status: 201 });
}
