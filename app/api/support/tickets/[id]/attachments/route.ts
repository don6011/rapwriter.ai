import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { SUPPORT_BUCKET, SUPPORT_MAX_FILE_BYTES, SUPPORT_MIME_TYPES } from "@/lib/server/support";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const limited = await enforceRateLimit(request, { scope: "support-attachment", limit: 15, windowSeconds: 3600, identity: user.id });
  if (limited) return limited;
  const { id } = await context.params;
  const { data: ticket } = await supabase.from("support_tickets").select("id,status").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !SUPPORT_MIME_TYPES.has(file.type) || file.size < 1 || file.size > SUPPORT_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Attach a PNG, JPG, WebP, PDF, or text file under 10 MB." }, { status: 400 });
  }
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "file";
  const path = `${id}/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(SUPPORT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data, error } = await supabase.from("support_attachments").insert({ ticket_id: id, uploader_id: user.id, storage_path: path, file_name: file.name.slice(0, 180), mime_type: file.type, size_bytes: file.size }).select("id,file_name,mime_type,size_bytes,created_at").single();
  if (error) {
    await supabase.storage.from(SUPPORT_BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ attachment: data }, { status: 201 });
}
