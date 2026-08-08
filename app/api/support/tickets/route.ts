import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { parseJson } from "@/lib/api/json";
import { ticketCreateSchema } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordSupportAnalytics, sendSupportEmail, supportContext } from "@/lib/server/support";

export const dynamic = "force-dynamic";

const ticketListSelect = "id,ticket_number,category,subject,status,created_at,updated_at,last_response_at";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { data, error } = await supabase.from("support_tickets").select(ticketListSelect).eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordSupportAnalytics(user.id, "support_opened");
  return NextResponse.json({ tickets: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const limited = await enforceRateLimit(request, { scope: "support-ticket-create", limit: 8, windowSeconds: 3600, identity: user.id });
  if (limited) return limited;
  const parsed = await parseJson(request, ticketCreateSchema);
  if (parsed.response) return parsed.response;

  const links = parsed.data;
  if (links.related_order_id) {
    const { data } = await supabase.from("commerce_orders").select("id").eq("id", links.related_order_id).eq("buyer_id", user.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Related order was not found on your account." }, { status: 400 });
  }
  if (links.related_entitlement_id) {
    const { data } = await supabase.from("product_entitlements").select("id").eq("id", links.related_entitlement_id).eq("owner_id", user.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Related purchase was not found on your account." }, { status: 400 });
  }
  if (links.related_beat_id) {
    const { data } = await supabase.from("producer_beats").select("id").eq("id", links.related_beat_id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Related beat was not found or is not available to your account." }, { status: 400 });
  }
  if (links.related_license_id) {
    const { data } = await supabase.from("beat_license_grants").select("id").eq("id", links.related_license_id).eq("owner_id", user.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Related license was not found on your account." }, { status: 400 });
  }
  const context = await supportContext(user.id);
  const admin = createAdminClient();
  const { data: ticket, error } = await admin.from("support_tickets").insert({
    owner_id: user.id,
    category: links.category,
    subject: links.subject,
    description: links.description,
    related_order_id: links.related_order_id ?? null,
    related_entitlement_id: links.related_entitlement_id ?? null,
    related_beat_id: links.related_beat_id ?? null,
    related_license_id: links.related_license_id ?? null,
    platform: links.platform,
    app_version: links.app_version ?? process.env.APP_RELEASE ?? "development",
    membership_snapshot: context.membership_snapshot,
    entitlement_source: context.entitlement_source,
    diagnostic_context: { captured_at: new Date().toISOString() },
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await Promise.all([
    admin.from("support_events").insert({ ticket_id: ticket.id, actor_id: user.id, event_type: "created" }),
    recordSupportAnalytics(user.id, "ticket_submitted", { category: links.category }),
    sendSupportEmail({ to: user.email, subject: `${ticket.ticket_number} received`, text: `We received your RapWriter support request: ${ticket.subject}. Reply inside RapWriter to keep the conversation together.` }),
  ]);
  return NextResponse.json({ ticket }, { status: 201 });
}
