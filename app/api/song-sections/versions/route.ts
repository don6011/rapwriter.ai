import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { sectionVersionRestoreSchema } from "@/lib/schemas";
import { membershipErrorResponse, requireMembershipEntitlement } from "@/lib/server/membership-access";

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  try {
    await requireMembershipEntitlement(supabase, user.id, "artist", "version_history");
  } catch (error) {
    return membershipErrorResponse(error);
  }

  const url = new URL(request.url);
  const songId = url.searchParams.get("song_id");
  const sectionKey = url.searchParams.get("section_key");

  if (!songId || !sectionKey) {
    return NextResponse.json({ error: "song_id and section_key are required" }, { status: 400 });
  }

  const { data: section, error: sectionError } = await supabase
    .from("song_sections")
    .select("id, title, section_key, content, updated_at")
    .eq("owner_id", user.id)
    .eq("song_id", songId)
    .eq("section_key", sectionKey)
    .single();

  if (sectionError) {
    if (sectionError.code === "PGRST116") return NextResponse.json({ section: null, versions: [] });
    return NextResponse.json({ error: sectionError.message }, { status: 500 });
  }

  const { data: versions, error: versionsError } = await supabase
    .from("song_section_versions")
    .select("id, version_number, content, bar_count, word_count, source, created_at")
    .eq("owner_id", user.id)
    .eq("section_id", section.id)
    .order("version_number", { ascending: false })
    .limit(20);

  if (versionsError) return NextResponse.json({ error: versionsError.message }, { status: 500 });

  return NextResponse.json({ section, versions: versions ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  try {
    await requireMembershipEntitlement(supabase, user.id, "artist", "version_history");
  } catch (error) {
    return membershipErrorResponse(error);
  }

  const parsed = await parseJson(request, sectionVersionRestoreSchema);
  if (parsed.response) return parsed.response;

  const { data, error } = await supabase.rpc("restore_song_section_version", {
    p_version_id: parsed.data.version_id,
  });

  if (error) {
    const status = error.code === "P0002" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
