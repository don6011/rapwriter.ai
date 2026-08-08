import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;

  const { data, error } = await supabase
    .from("commerce_orders")
    .select(`
      *,
      commerce_order_items(*),
      beat_license_grants(*),
      commerce_order_events(id, event_type, previous_status, new_status, reason, details, created_at)
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  return NextResponse.json(
    { order: data },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
