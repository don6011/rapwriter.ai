import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import {
  COLLABORATION_FILE_BUCKET,
  collaborationFileError,
  ownsCollaborationFilePath,
} from "@/lib/collaboration-deliverables";
import { collaborationDeliverableCreateSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deliverableSelect = "id, request_id, sender_id, version_number, title, note, storage_bucket, storage_path, file_name, mime_type, byte_size, status, artist_feedback, delivered_at, reviewed_at, created_at, updated_at";
type RouteContext = { params: Promise<{ id: string }> };
type Deliverable = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  [key: string]: unknown;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const requestId = (await params).id;
  if (!uuidPattern.test(requestId)) return NextResponse.json({ error: "Invalid collaboration." }, { status: 400 });

  const { data: collaboration, error: requestError } = await supabase
    .from("producer_collaboration_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });
  if (!collaboration) return NextResponse.json({ error: "Collaboration not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("producer_collaboration_deliverables")
    .select(deliverableSelect)
    .eq("request_id", requestId)
    .order("version_number", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deliverables: await withSignedDownloads((data ?? []) as Deliverable[]) });
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const requestId = (await params).id;
  if (!uuidPattern.test(requestId)) return NextResponse.json({ error: "Invalid collaboration." }, { status: 400 });
  const parsed = await parseJson(request, collaborationDeliverableCreateSchema);
  if (parsed.response) return parsed.response;

  const fileError = collaborationFileError({ name: parsed.data.file_name, type: parsed.data.mime_type, size: parsed.data.byte_size });
  if (fileError) return NextResponse.json({ error: fileError }, { status: 422 });
  if (!ownsCollaborationFilePath(parsed.data.storage_path, requestId, user.id)) {
    return NextResponse.json({ error: "That upload does not belong to this session." }, { status: 403 });
  }

  const { data: collaboration, error: requestError } = await supabase
    .from("producer_collaboration_requests")
    .select("id, producer_id, status, handoff_status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });
  if (!collaboration) return NextResponse.json({ error: "Collaboration not found." }, { status: 404 });
  if (collaboration.producer_id !== user.id) return NextResponse.json({ error: "Only the producer can deliver session files." }, { status: 403 });
  if (collaboration.status !== "accepted" || !["not_started", "revision_requested"].includes(collaboration.handoff_status)) {
    return NextResponse.json({ error: "This session is not ready for another delivery." }, { status: 409 });
  }

  const admin = createAdminClient();
  const slash = parsed.data.storage_path.lastIndexOf("/");
  const directory = parsed.data.storage_path.slice(0, slash);
  const objectName = parsed.data.storage_path.slice(slash + 1);
  const { data: objects, error: storageError } = await admin.storage
    .from(COLLABORATION_FILE_BUCKET)
    .list(directory, { limit: 10, search: objectName });
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  if (!objects?.some((object) => object.name === objectName)) {
    return NextResponse.json({ error: "Finish uploading the file before creating the delivery." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("producer_collaboration_deliverables")
    .insert({
      request_id: requestId,
      sender_id: user.id,
      title: parsed.data.title,
      note: parsed.data.note,
      storage_bucket: COLLABORATION_FILE_BUCKET,
      storage_path: parsed.data.storage_path,
      file_name: parsed.data.file_name,
      mime_type: parsed.data.mime_type,
      byte_size: parsed.data.byte_size,
      status: "delivered",
    })
    .select(deliverableSelect)
    .single();
  if (error) {
    await admin.storage.from(COLLABORATION_FILE_BUCKET).remove([parsed.data.storage_path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const [deliverable] = await withSignedDownloads([data as Deliverable]);
  return NextResponse.json({ deliverable }, { status: 201 });
}

async function withSignedDownloads(deliverables: Deliverable[]) {
  const admin = createAdminClient();
  return Promise.all(deliverables.map(async (deliverable) => {
    const { data } = await admin.storage
      .from(deliverable.storage_bucket)
      .createSignedUrl(deliverable.storage_path, 600, { download: deliverable.file_name });
    return { ...deliverable, download_url: data?.signedUrl ?? null };
  }));
}
