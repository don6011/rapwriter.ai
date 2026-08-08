import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  action: z.enum(["activate", "pause", "close", "capacity"]),
  max_claims: z.number().int().positive().optional(),
});

export async function GET() {
  const admin = await requireRole("admin");
  if (admin.response) return admin.response;
  const supabase = createAdminClient();
  const [{ data: campaigns, error }, { data: grants, error: grantsError }] = await Promise.all([
    supabase.from("launch_campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("membership_grants").select("campaign_id,status,starts_at,ends_at,created_at,metadata").not("campaign_id", "is", null),
  ]);
  if (error || grantsError) return NextResponse.json({ error: "Campaign operations are unavailable." }, { status: 503 });
  const now = Date.now();
  return NextResponse.json({ campaigns: (campaigns ?? []).map((campaign) => {
    const rows = (grants ?? []).filter((grant) => grant.campaign_id === campaign.id);
    return {
      ...campaign,
      remaining_slots: Math.max(0, campaign.max_claims - campaign.claim_count),
      claims_today: rows.filter((grant) => Date.parse(grant.created_at) >= new Date().setHours(0, 0, 0, 0)).length,
      active_memberships: rows.filter((grant) => grant.status === "active" && (!grant.ends_at || Date.parse(grant.ends_at) > now)).length,
      expired_memberships: rows.filter((grant) => grant.status === "expired" || (grant.ends_at && Date.parse(grant.ends_at) <= now)).length,
    };
  }) });
}

export async function PATCH(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const admin = await requireRole("admin");
  if (admin.response || !admin.user) return admin.response;
  const rateLimit = await enforceRateLimit(request, { scope: "admin-campaigns", limit: 80, windowSeconds: 3600, identity: admin.user.id });
  if (rateLimit) return rateLimit;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid campaign action." }, { status: 400 });
  const supabase = createAdminClient();
  const { data: campaign, error: loadError } = await supabase.from("launch_campaigns").select("id,max_claims,claim_count,ends_at").eq("slug", parsed.data.slug).single();
  if (loadError || !campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const changes: Record<string, unknown> = {};
  if (parsed.data.action === "activate") changes.is_active = true;
  if (parsed.data.action === "pause") changes.is_active = false;
  if (parsed.data.action === "close") { changes.is_active = false; changes.ends_at = new Date().toISOString(); }
  if (parsed.data.action === "capacity") {
    if (!parsed.data.max_claims || parsed.data.max_claims < campaign.claim_count) {
      return NextResponse.json({ error: `Capacity cannot be below ${campaign.claim_count} existing claims.` }, { status: 422 });
    }
    changes.max_claims = parsed.data.max_claims;
  }
  const { data, error } = await supabase.from("launch_campaigns").update(changes).eq("id", campaign.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ campaign: data });
}
