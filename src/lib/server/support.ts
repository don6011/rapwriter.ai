import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipForUser } from "@/lib/server/membership";

export const SUPPORT_BUCKET = "support-attachments";
export const SUPPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SUPPORT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]);

export async function supportContext(userId: string) {
  const admin = createAdminClient();
  const [membership, entitlement] = await Promise.all([
    getMembershipForUser(admin as never, userId).catch(() => null),
    admin.from("user_subscriptions").select("provider,status,audience,plan_id").eq("owner_id", userId).in("status", ["active", "trialing", "past_due"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    membership_snapshot: membership ? {
      artist: membership.artist ? { plan_id: membership.artist.plan.id, plan_name: membership.artist.plan.name, source: membership.artist.source } : null,
      producer: membership.producer ? { plan_id: membership.producer.plan.id, plan_name: membership.producer.plan.name, source: membership.producer.source } : null,
    } : {},
    entitlement_source: entitlement.data?.provider ?? membership?.artist?.source ?? membership?.producer?.source ?? "free",
  };
}

export async function recordSupportAnalytics(ownerId: string, eventName: string, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  await admin.from("growth_events").insert({ owner_id: ownerId, event_name: eventName, metadata });
}

export async function notifySupportUser(ownerId: string, title: string, body: string, ticketId: string, ticketNumber: string) {
  const admin = createAdminClient();
  await admin.from("user_notifications").insert({
    owner_id: ownerId,
    type: "support_ticket",
    title,
    body,
    action_url: `/support?ticket=${ticketId}`,
    entity_type: "support_ticket",
    entity_id: ticketId,
    metadata: { ticket_number: ticketNumber },
  });
}

export async function sendSupportEmail(input: { to: string | null; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_FROM_EMAIL;
  if (!apiKey || !from || !input.to) return { sent: false, reason: "not_configured" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
  });
  if (!response.ok) return { sent: false, reason: "provider_error" as const };
  return { sent: true };
}

export async function signSupportAttachments<T extends { storage_path: string }>(rows: T[]) {
  const admin = createAdminClient();
  return Promise.all(rows.map(async (row) => {
    const { data } = await admin.storage.from(SUPPORT_BUCKET).createSignedUrl(row.storage_path, 60 * 10);
    return { ...row, signed_url: data?.signedUrl ?? null };
  }));
}
