import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;

  const { data, error } = await supabase
    .from("beat_license_grants")
    .select("id, order_id, catalog_beat_id, beat_title, producer_name, license_name, status, terms_snapshot, granted_at")
    .eq("order_id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Beat license not found." }, { status: 404 });

  return NextResponse.json(
    { license: data },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="rapwriter-license-${id}.json"`,
      },
    },
  );
}
