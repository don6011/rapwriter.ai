import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { signSupportAttachments } from "@/lib/server/support";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;
  const { data: ticket, error } = await supabase.from("support_tickets").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  const [{ data: messages, error: messageError }, { data: attachments, error: attachmentError }] = await Promise.all([
    supabase.from("support_messages").select("id,ticket_id,sender_id,sender_type,body,created_at").eq("ticket_id", id).order("created_at"),
    supabase.from("support_attachments").select("id,ticket_id,message_id,file_name,mime_type,size_bytes,storage_path,created_at").eq("ticket_id", id).order("created_at"),
  ]);
  if (messageError || attachmentError) return NextResponse.json({ error: (messageError ?? attachmentError)?.message }, { status: 500 });
  return NextResponse.json({ ticket, messages: messages ?? [], attachments: await signSupportAttachments(attachments ?? []) }, { headers: { "Cache-Control": "private, no-store" } });
}
