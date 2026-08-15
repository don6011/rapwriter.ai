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

  const { data: audio, error: downloadError } = await supabase.storage.from(roughTake.storage_bucket).download(roughTake.storage_path);
  if (downloadError || !audio) return NextResponse.json({ error: "Rough take download is unavailable." }, { status: 500 });

  const extension = roughTake.storage_path.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "m4a";
  return new NextResponse(audio, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="rapwriter-rough-take.${extension}"`,
      "Content-Length": String(audio.size),
      "Content-Type": audio.type || "audio/mp4",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
