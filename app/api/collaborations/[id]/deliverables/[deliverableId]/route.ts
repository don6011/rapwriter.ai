import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { collaborationDeliverableReviewSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string; deliverableId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { id: requestId, deliverableId } = await params;
  if (!uuidPattern.test(requestId) || !uuidPattern.test(deliverableId)) {
    return NextResponse.json({ error: "Invalid delivery." }, { status: 400 });
  }
  const parsed = await parseJson(request, collaborationDeliverableReviewSchema);
  if (parsed.response) return parsed.response;

  const { data: collaboration, error } = await supabase
    .from("producer_collaboration_requests")
    .select("id, artist_id, status, handoff_status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!collaboration) return NextResponse.json({ error: "Collaboration not found." }, { status: 404 });
  if (collaboration.artist_id !== user.id) return NextResponse.json({ error: "Only the artist can review this delivery." }, { status: 403 });
  if (collaboration.status !== "accepted" || collaboration.handoff_status !== "delivered") {
    return NextResponse.json({ error: "This delivery is no longer waiting for review." }, { status: 409 });
  }

  const nextStatus = parsed.data.action === "approve" ? "approved" : "revision_requested";
  const { data, error: updateError } = await createAdminClient()
    .from("producer_collaboration_deliverables")
    .update({
      status: nextStatus,
      artist_feedback: parsed.data.feedback || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", deliverableId)
    .eq("request_id", requestId)
    .eq("status", "delivered")
    .select("id, request_id, version_number, title, status, artist_feedback, reviewed_at")
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This delivery changed. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ deliverable: data });
}
