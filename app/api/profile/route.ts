import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { accountRoleSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data) return NextResponse.json({ profile: data });

  const fallbackProfile = {
    id: user.id,
    email: user.email ?? null,
    display_name: user.email?.split("@")[0] ?? "RapWriter Artist",
    artist_name: user.email?.split("@")[0] ?? "RapWriter Artist",
    plan: "free",
  };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(fallbackProfile)
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ profile: inserted });
}

export async function PATCH(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const parsed = await parseJson(request, accountRoleSchema);
  if (parsed.response) return parsed.response;

  const admin = createAdminClient();
  const roles = parsed.data.account_type === "artist"
    ? ["artist"]
    : ["artist", "producer"];

  const { error: roleError } = await admin.from("user_roles").upsert(
    roles.map((role) => ({ user_id: user.id, role, granted_by: user.id })),
    { onConflict: "user_id,role" },
  );

  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      account_type: parsed.data.account_type,
      role_onboarding_completed: true,
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile });
}
