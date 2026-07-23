import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { producerServiceSchema } from "@/lib/schemas";
import { membershipErrorResponse, requireMembershipEntitlement } from "@/lib/server/membership-access";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;
  const id = (await params).id;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid service." }, { status: 400 });
  const parsed = await parseJson(request, producerServiceSchema.partial());
  if (parsed.response) return parsed.response;
  try {
    await requireMembershipEntitlement(supabase, user.id, "producer", "service_listings");
  } catch (error) {
    return membershipErrorResponse(error);
  }
  const { data, error } = await supabase.from("producer_services").update(parsed.data).eq("id", id).eq("owner_id", user.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  return NextResponse.json({ service: data });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;
  const id = (await params).id;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid service." }, { status: 400 });
  const { error } = await supabase.from("producer_services").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
