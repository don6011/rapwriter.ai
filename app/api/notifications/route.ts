import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";

export const dynamic = "force-dynamic";

const notificationUpdateSchema = z
  .object({
    notification_id: z.string().uuid().optional(),
    mark_all: z.literal(true).optional(),
  })
  .refine((value) => Boolean(value.notification_id) !== Boolean(value.mark_all), {
    message: "Choose one notification or mark all as read.",
  });

const notificationSelect = "id, type, title, body, action_url, actor_id, entity_type, entity_id, metadata, read_at, created_at";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("user_notifications")
      .select(notificationSelect)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .is("read_at", null),
  ]);
  if (error || countError) {
    const setupPending = error?.code === "42P01" || error?.code === "PGRST205";
    if (setupPending) return NextResponse.json({ notifications: [], unread_count: 0, foundation_ready: false });
    return NextResponse.json({ error: (error ?? countError)?.message }, { status: 500 });
  }

  return NextResponse.json(
    { notifications: data ?? [], unread_count: count ?? 0, foundation_ready: true },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function PATCH(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const parsed = await parseJson(request, notificationUpdateSchema);
  if (parsed.response) return parsed.response;

  const { data: updated, error } = await supabase.rpc("mark_user_notifications_read", {
    p_notification_id: parsed.data.notification_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: Number(updated) || 0 });
}
