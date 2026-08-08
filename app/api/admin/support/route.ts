import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { parseJson } from "@/lib/api/json";
import { supportStaffActionSchema } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySupportUser, recordSupportAnalytics, sendSupportEmail, signSupportAttachments } from "@/lib/server/support";

export const dynamic = "force-dynamic";

const queueSelect = "id,ticket_number,owner_id,category,subject,status,priority,assigned_to,created_at,updated_at,last_response_at,last_customer_response_at,last_staff_response_at";

export async function GET(request: Request) {
  const staff = await requireAnyRole(["moderator", "admin"]);
  if (staff.response) return staff.response;
  const admin = createAdminClient();
  const ticketId = new URL(request.url).searchParams.get("ticket_id");
  if (ticketId) {
    const { data: ticket, error } = await admin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    const [messages, attachments, notes, events, customer, producer, order, roles] = await Promise.all([
      admin.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at"),
      admin.from("support_attachments").select("*").eq("ticket_id", ticketId).order("created_at"),
      admin.from("support_internal_notes").select("*").eq("ticket_id", ticketId).order("created_at"),
      admin.from("support_events").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }),
      admin.auth.admin.getUserById(ticket.owner_id),
      admin.from("producer_profiles").select("id,display_name,handle,status,verified").eq("owner_id", ticket.owner_id).maybeSingle(),
      ticket.related_order_id ? admin.from("commerce_orders").select("id,order_number,status,provider,total_cents,currency,created_at").eq("id", ticket.related_order_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      admin.from("user_roles").select("role").eq("user_id", ticket.owner_id),
    ]);
    const queryError = messages.error ?? attachments.error ?? notes.error ?? events.error ?? producer.error ?? order.error ?? roles.error;
    if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
    return NextResponse.json({
      ticket,
      messages: messages.data ?? [],
      attachments: await signSupportAttachments(attachments.data ?? []),
      internal_notes: notes.data ?? [],
      events: events.data ?? [],
      customer: { id: ticket.owner_id, email: customer.data.user?.email ?? null, roles: (roles.data ?? []).map((row) => row.role) },
      producer: producer.data,
      order: order.data,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data: tickets, error } = await admin.from("support_tickets").select(queueSelect).order("updated_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map((users.data.users ?? []).map((user) => [user.id, user.email ?? "Unknown customer"]));
  const { data: staffRoles } = await admin.from("user_roles").select("user_id,role").in("role", ["moderator", "admin"]);
  const staffMembers = [...new Map((staffRoles ?? []).map((row) => [row.user_id, { id: row.user_id, email: emailById.get(row.user_id) ?? "Staff", role: row.role }])).values()];
  const rows = (tickets ?? []).map((ticket) => ({ ...ticket, customer: emailById.get(ticket.owner_id) ?? "Customer" }));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return NextResponse.json({
    tickets: rows,
    metrics: {
      open: rows.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length,
      needs_reply: rows.filter((ticket) => ["open", "in_progress"].includes(ticket.status) && (!ticket.last_staff_response_at || (ticket.last_customer_response_at && ticket.last_customer_response_at > ticket.last_staff_response_at))).length,
      waiting_on_customer: rows.filter((ticket) => ticket.status === "waiting_on_customer").length,
      resolved_today: rows.filter((ticket) => ticket.status === "resolved" && new Date(ticket.updated_at) >= today).length,
    },
    staff: staffMembers,
    current_staff_id: staff.user?.id ?? null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const staff = await requireAnyRole(["moderator", "admin"]);
  if (staff.response || !staff.user) return staff.response;
  const limited = await enforceRateLimit(request, { scope: "admin-support", limit: 120, windowSeconds: 3600, identity: staff.user.id });
  if (limited) return limited;
  const ticketId = new URL(request.url).searchParams.get("ticket_id");
  if (!ticketId) return NextResponse.json({ error: "Ticket ID is required." }, { status: 400 });
  const parsed = await parseJson(request, supportStaffActionSchema);
  if (parsed.response) return parsed.response;
  const admin = createAdminClient();
  const { data: ticket, error } = await admin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (error || !ticket) return NextResponse.json({ error: error?.message ?? "Ticket not found." }, { status: error ? 500 : 404 });
  const action = parsed.data;
  const now = new Date().toISOString();
  let eventType = "status_changed";
  let fromValue: string | null = null;
  let toValue: string | null = null;

  if (action.action === "reply") {
    const { error: replyError } = await admin.from("support_messages").insert({ ticket_id: ticketId, sender_id: staff.user.id, sender_type: "support", body: action.body });
    if (replyError) return NextResponse.json({ error: replyError.message }, { status: 500 });
    await admin.from("support_tickets").update({ status: "waiting_on_customer", last_response_at: now, last_staff_response_at: now }).eq("id", ticketId);
    eventType = "support_replied"; fromValue = ticket.status; toValue = "waiting_on_customer";
  } else if (action.action === "internal_note") {
    const { error: noteError } = await admin.from("support_internal_notes").insert({ ticket_id: ticketId, author_id: staff.user.id, body: action.body });
    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });
    eventType = "internal_note_added";
  } else if (action.action === "assign") {
    if (action.assigned_to) {
      const { data: assignee } = await admin.from("user_roles").select("user_id").eq("user_id", action.assigned_to).in("role", ["moderator", "admin"]).limit(1).maybeSingle();
      if (!assignee) return NextResponse.json({ error: "Tickets can only be assigned to Control Room staff." }, { status: 400 });
    }
    await admin.from("support_tickets").update({ assigned_to: action.assigned_to ?? null }).eq("id", ticketId);
    eventType = "assigned"; fromValue = ticket.assigned_to; toValue = action.assigned_to ?? null;
  } else if (action.action === "priority") {
    await admin.from("support_tickets").update({ priority: action.priority }).eq("id", ticketId);
    eventType = "priority_changed"; fromValue = ticket.priority; toValue = action.priority ?? null;
  } else if (action.action === "status") {
    const update: Record<string, unknown> = { status: action.status };
    if (action.status === "resolved") update.resolved_at = now;
    if (action.status === "closed") update.closed_at = now;
    if (["open", "in_progress", "waiting_on_customer"].includes(action.status ?? "")) { update.resolved_at = null; update.closed_at = null; }
    await admin.from("support_tickets").update(update).eq("id", ticketId);
    fromValue = ticket.status; toValue = action.status ?? null;
    eventType = action.status === "resolved" ? "resolved" : action.status === "closed" ? "closed" : ["resolved", "closed"].includes(ticket.status) ? "reopened" : "status_changed";
  }
  await admin.from("support_events").insert({ ticket_id: ticketId, actor_id: staff.user.id, event_type: eventType, from_value: fromValue, to_value: toValue });
  const customer = await admin.auth.admin.getUserById(ticket.owner_id);
  if (action.action === "reply" || action.action === "status") {
    const title = action.action === "reply" ? `Support replied to ${ticket.ticket_number}` : `${ticket.ticket_number} is ${action.status?.replaceAll("_", " ")}`;
    const body = action.action === "reply" ? "RapWriter Support sent a new response." : `Your support ticket status changed to ${action.status?.replaceAll("_", " ")}.`;
    await Promise.all([
      notifySupportUser(ticket.owner_id, title, body, ticket.id, ticket.ticket_number),
      sendSupportEmail({ to: customer.data.user?.email ?? null, subject: title, text: `${body} Open RapWriter Support Center to view the ticket.` }),
      action.status === "resolved" ? recordSupportAnalytics(ticket.owner_id, "ticket_resolved", { category: ticket.category }) : Promise.resolve(),
    ]);
  }
  return NextResponse.json({ success: true });
}
