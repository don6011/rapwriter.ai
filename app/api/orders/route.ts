import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const scope = new URL(request.url).searchParams.get("scope") === "sales" ? "sales" : "purchases";
  let query = supabase
    .from("commerce_orders")
    .select(`
      id, order_number, buyer_id, seller_owner_id, status, provider, currency,
      subtotal_cents, total_cents, platform_fee_cents, seller_earnings_cents,
      created_at, paid_at, fulfilled_at, refunded_at,
      commerce_order_items(
        id, item_type, catalog_product_id, title, description, quantity,
        unit_amount_cents, line_total_cents, license_name, license_terms_snapshot,
        product_snapshot, fulfillment_status
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  query = scope === "sales" ? query.eq("seller_owner_id", user.id) : query.eq("buyer_id", user.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { orders: data ?? [], scope },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
