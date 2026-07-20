import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { getCatalogProduct } from "@/lib/product-catalog";
import { entitlementCreateSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabase
    .from("product_entitlements")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entitlements: data ?? [] });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const parsed = await parseJson(request, entitlementCreateSchema);
  if (parsed.response) return parsed.response;

  const product = getCatalogProduct(parsed.data.product_id);
  if (!product) return NextResponse.json({ error: "Unknown marketplace product" }, { status: 404 });
  if (product.priceCents > 0) {
    return NextResponse.json({ error: "Secure checkout is required for this product." }, { status: 402 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("product_entitlements")
    .upsert(
      {
        owner_id: user.id,
        product_id: product.id,
        product_type: product.type,
        title: product.title,
        price_cents: product.priceCents,
        currency: "usd",
        source: "dev_unlock",
        metadata: {
          detail: product.detail,
          price: product.price,
          tags: product.tags,
        },
      },
      { onConflict: "owner_id,product_id" },
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entitlement: data });
}
