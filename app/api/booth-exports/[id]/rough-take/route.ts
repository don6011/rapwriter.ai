import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { membershipErrorResponse, requireMembershipEntitlement } from "@/lib/server/membership-access";

type RouteContext = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function GET(_request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Export not found." }, { status: 404 });

  try {
    await requireMembershipEntitlement(supabase, user.id, "artist", "premium_exports");
  } catch (membershipError) {
    return membershipErrorResponse(membershipError);
  }

  const { data: boothExport, error } = await supabase
    .from("booth_exports")
    .select("rough_take_id")
    .eq("id", id.data)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!boothExport?.rough_take_id) return NextResponse.json({ error: "No rough take is attached to this export." }, { status: 404 });

  const { data: roughTake, error: roughTakeError } = await supabase
    .from("rough_takes")
    .select("storage_bucket,storage_path")
    .eq("id", boothExport.rough_take_id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (roughTakeError) return NextResponse.json({ error: roughTakeError.message }, { status: 500 });
  if (!roughTake) return NextResponse.json({ error: "Rough take is no longer available." }, { status: 404 });

  const { data, error: signError } = await supabase.storage.from(roughTake.storage_bucket).createSignedUrl(roughTake.storage_path, 60 * 5, { download: true });
  if (signError) return NextResponse.json({ error: "Rough take download is unavailable." }, { status: 500 });
  const redirect = NextResponse.redirect(data.signedUrl, 307);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}
