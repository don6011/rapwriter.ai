import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { collaborationTransition, type CollaborationAction, type CollaborationStatus } from "@/lib/collaboration";
import { collaborationDecisionSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const id = (await params).id;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid collaboration." }, { status: 400 });
  const parsed = await parseJson(request, collaborationDecisionSchema);
  if (parsed.response) return parsed.response;

  const { data: current, error } = await supabase.from("producer_collaboration_requests").select("id, artist_id, producer_id, status").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Collaboration not found." }, { status: 404 });
  const actor = current.artist_id === user.id ? "artist" : current.producer_id === user.id ? "producer" : null;
  if (!actor) return NextResponse.json({ error: "You are not part of this collaboration." }, { status: 403 });
  const nextStatus = collaborationTransition(current.status as CollaborationStatus, parsed.data.action as CollaborationAction, actor);
  if (!nextStatus) return NextResponse.json({ error: "That action is not available for this request." }, { status: 409 });
  if (parsed.data.action === "counter" && parsed.data.counter_price_cents == null) {
    return NextResponse.json({ error: "Add a price before sending a counter." }, { status: 422 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: nextStatus,
    response_note: parsed.data.response_note ?? null,
    responded_at: actor === "producer" ? now : undefined,
  };
  if (parsed.data.action === "counter") update.counter_price_cents = parsed.data.counter_price_cents;
  if (nextStatus === "accepted") update.accepted_at = now;
  if (nextStatus === "completed") update.completed_at = now;
  Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);

  const admin = createAdminClient();
  const { data, error: updateError } = await admin.from("producer_collaboration_requests").update(update).eq("id", id).eq("status", current.status).select("*").maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This request changed. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ request: data });
}
