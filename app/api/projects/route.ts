import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { projectCreateSchema, projectPatchSchema } from "@/lib/schemas";
import { membershipErrorResponse, requireMembershipLimit } from "@/lib/server/membership-access";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const parsed = await parseJson(request, projectCreateSchema);
  if (parsed.response) return parsed.response;

  const { count, error: countError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .neq("status", "archived");
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  try {
    await requireMembershipLimit(supabase, user.id, "artist", "active_projects", count ?? 0);
  } catch (error) {
    return membershipErrorResponse(error);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Project id is required" }, { status: 400 });

  const parsed = projectPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { id: _id, ...patch } = { ...parsed.data, id };
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", _id)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
