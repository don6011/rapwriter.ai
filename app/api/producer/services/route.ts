import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { producerServiceSchema } from "@/lib/schemas";
import { membershipErrorResponse, requireMembershipEntitlement, requireMembershipLimit } from "@/lib/server/membership-access";

export async function GET() {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;
  const { data, error } = await supabase
    .from("producer_services")
    .select("id, service_type, title, description, starting_price_cents, turnaround_days, is_active, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingServiceTable(error)) return NextResponse.json({ services: [], foundation_ready: false });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ services: data ?? [], foundation_ready: true });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;
  const parsed = await parseJson(request, producerServiceSchema);
  if (parsed.response) return parsed.response;

  const [{ data: profile, error: profileError }, { count, error: countError }] = await Promise.all([
    supabase.from("producer_profiles").select("id, status").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_services").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("is_active", true),
  ]);
  if (profileError || countError) {
    const setupError = profileError ?? countError;
    if (setupError && isMissingServiceTable(setupError)) return NextResponse.json({ error: "Producer service setup is pending." }, { status: 503 });
    return NextResponse.json({ error: setupError?.message }, { status: 500 });
  }
  if (!profile) return NextResponse.json({ error: "Complete your producer profile before publishing services." }, { status: 409 });

  try {
    await requireMembershipEntitlement(supabase, user.id, "producer", "service_listings");
    await requireMembershipLimit(supabase, user.id, "producer", "service_listings", count ?? 0);
  } catch (error) {
    return membershipErrorResponse(error);
  }

  const { data, error } = await supabase
    .from("producer_services")
    .insert({ owner_id: user.id, producer_profile_id: profile.id, ...parsed.data })
    .select("id, service_type, title, description, starting_price_cents, turnaround_days, is_active, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ service: data }, { status: 201 });
}

function isMissingServiceTable(error: { code?: string; message?: string }) {
  return error.code === "42P01"
    || error.code === "PGRST205"
    || Boolean(error.message?.includes("Could not find the table") && error.message.includes("schema cache"));
}
