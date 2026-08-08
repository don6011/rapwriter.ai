import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const claimSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/) });

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const now = new Date().toISOString();
  const [{ data, error }, { data: entitlements, error: entitlementError }] = await Promise.all([
    supabase.from("launch_campaigns")
      .select("slug,name,description,audience,max_claims,claim_count,duration_days,starts_at,ends_at,badge_code,metadata")
      .eq("is_active", true).lte("starts_at", now).gt("ends_at", now).order("starts_at"),
    supabase.rpc("get_my_entitlements"),
  ]);
  if (error || entitlementError) return NextResponse.json({ error: "Campaign access is temporarily unavailable." }, { status: 503 });
  return NextResponse.json({ campaigns: data ?? [], entitlements }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const rateLimit = await enforceRateLimit(request, { scope: "campaign-claims", limit: 10, windowSeconds: 3600, identity: user.id });
  if (rateLimit) return rateLimit;
  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid campaign." }, { status: 400 });
  const { data, error } = await supabase.rpc("claim_launch_campaign", { campaign_slug: parsed.data.slug });
  if (error) return NextResponse.json({ error: "Campaign claim failed." }, { status: 422 });
  const result = data as { success?: boolean; error?: string } | null;
  return NextResponse.json(result, { status: result?.success ? 200 : result?.error === "campaign_full" ? 409 : 422 });
}
