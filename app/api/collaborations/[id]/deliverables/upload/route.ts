import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import {
  COLLABORATION_FILE_BUCKET,
  collaborationFileError,
  collaborationFilePath,
} from "@/lib/collaboration-deliverables";
import { collaborationDeliverableUploadSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const requestId = (await params).id;
  if (!uuidPattern.test(requestId)) return NextResponse.json({ error: "Invalid collaboration." }, { status: 400 });

  const parsed = await parseJson(request, collaborationDeliverableUploadSchema);
  if (parsed.response) return parsed.response;
  const fileError = collaborationFileError({
    name: parsed.data.file_name,
    type: parsed.data.mime_type,
    size: parsed.data.byte_size,
  });
  if (fileError) return NextResponse.json({ error: fileError }, { status: 422 });

  const { data: collaboration, error } = await supabase
    .from("producer_collaboration_requests")
    .select("id, producer_id, status, handoff_status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!collaboration) return NextResponse.json({ error: "Collaboration not found." }, { status: 404 });
  if (collaboration.producer_id !== user.id) return NextResponse.json({ error: "Only the producer can deliver session files." }, { status: 403 });
  if (collaboration.status !== "accepted" || !["not_started", "revision_requested"].includes(collaboration.handoff_status)) {
    return NextResponse.json({ error: "This session is not ready for another delivery." }, { status: 409 });
  }

  const path = collaborationFilePath(requestId, user.id, parsed.data.mime_type, crypto.randomUUID());
  const { data, error: signedError } = await createAdminClient()
    .storage
    .from(COLLABORATION_FILE_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 });

  return NextResponse.json({ bucket: COLLABORATION_FILE_BUCKET, path, token: data.token });
}
