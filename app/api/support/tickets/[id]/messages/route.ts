import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { parseJson } from "@/lib/api/json";
import { ticketAllowsCustomerReply, ticketReplySchema } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordSupportAnalytics } from "@/lib/server/support";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const limited = await enforceRateLimit(request, { scope: "support-ticket-reply", limit: 30, windowSeconds: 3600, identity: user.id });
  if (limited) return limited;
  const { id } = await context.params;
  const parsed = await parseJson(request, ticketReplySchema);
  if (parsed.response) return parsed.response;
  const { data: ticket } = await supabase.from("support_tickets").select("id,status").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (!ticketAllowsCustomerReply(ticket.status)) return NextResponse.json({ error: "This ticket is closed to replies." }, { status: 409 });
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: message, error } = await admin.from("support_messages").insert({ ticket_id: id, sender_id: user.id, sender_type: "customer", body: parsed.data.body }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await Promise.all([
    admin.from("support_tickets").update({ status: ticket.status === "waiting_on_customer" ? "in_progress" : ticket.status, last_response_at: now, last_customer_response_at: now }).eq("id", id),
    admin.from("support_events").insert({ ticket_id: id, actor_id: user.id, event_type: "customer_replied" }),
    recordSupportAnalytics(user.id, "ticket_replied", { sender_type: "customer" }),
  ]);
  return NextResponse.json({ message }, { status: 201 });
}
