import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import {
  boothExportFileStem,
  boothExportSnapshotSchema,
  buildBoothLyricsText,
  buildBoothPdf,
  buildBoothZip,
  type BoothExportRecord,
} from "@/lib/booth-export";
import { membershipErrorResponse, requireMembershipEntitlement } from "@/lib/server/membership-access";

type RouteContext = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();
const formatSchema = z.enum(["json", "txt", "pdf", "zip"]);

export async function GET(request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const id = idSchema.safeParse((await context.params).id);
  const format = formatSchema.safeParse(new URL(request.url).searchParams.get("format") ?? "json");
  if (!id.success || !format.success) return NextResponse.json({ error: "Export not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("booth_exports")
    .select("id,project_id,song_id,session_id,rough_take_id,version_number,title,booth_score,completion_pct,total_bars,snapshot,created_at")
    .eq("id", id.data)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Export not found." }, { status: 404 });

  const parsedSnapshot = boothExportSnapshotSchema.safeParse(data.snapshot);
  if (!parsedSnapshot.success) return NextResponse.json({ error: "Export snapshot is invalid." }, { status: 500 });
  const record = { ...data, snapshot: parsedSnapshot.data } as BoothExportRecord;
  const stem = boothExportFileStem(record);

  if (format.data === "json") {
    return NextResponse.json(record, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (format.data === "txt") {
    return downloadResponse(buildBoothLyricsText(record), "text/plain; charset=utf-8", `${stem}-lyrics.txt`);
  }

  try {
    await requireMembershipEntitlement(supabase, user.id, "artist", "premium_exports");
  } catch (membershipError) {
    return membershipErrorResponse(membershipError);
  }

  if (format.data === "pdf") {
    return downloadResponse(await buildBoothPdf(record), "application/pdf", `${stem}.pdf`);
  }
  return downloadResponse(await buildBoothZip(record), "application/zip", `${stem}.zip`);
}

function downloadResponse(body: string | Uint8Array, contentType: string, fileName: string) {
  const blob = typeof body === "string" ? new Blob([body], { type: contentType }) : new Blob([body as BlobPart], { type: contentType });
  return new NextResponse(blob, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
