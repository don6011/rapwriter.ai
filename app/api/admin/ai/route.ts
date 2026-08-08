import { NextResponse } from "next/server";
import { z } from "zod";
import { aiFeatureCodes } from "@/lib/ai-features";
import { requireAnyRole } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  feature_code: z.enum(aiFeatureCodes),
  enabled: z.boolean().optional(),
  model_tier: z.enum(["fast", "balanced", "advanced"]).optional(),
  timeout_ms: z.number().int().min(3000).max(60000).optional(),
  max_output_tokens: z.number().int().min(100).max(8000).optional(),
}).refine((value) => Object.keys(value).length > 1, "Choose a setting to update.");

export async function GET() {
  const staff = await requireAnyRole(["moderator", "admin"]);
  if (staff.response) return staff.response;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: features, error: featureError }, { data: usage, error: usageError }] = await Promise.all([
    admin.from("ai_feature_configs").select("feature_code,display_name,enabled,required_entitlement,model_tier,timeout_ms,max_output_tokens,supports_streaming,updated_at").order("display_name"),
    admin.from("ai_usage_ledger").select("feature_code,status,input_tokens,output_tokens,estimated_cost_micros,latency_ms,error_code,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
  ]);
  if (featureError || usageError) return NextResponse.json({ error: featureError?.message ?? usageError?.message }, { status: 500 });
  const rows = usage ?? [];
  const succeeded = rows.filter((row) => row.status === "succeeded");
  return NextResponse.json({
    features: features ?? [],
    permissions: { can_manage: staff.roles.includes("admin") },
    summary: {
      requests_24h: rows.length,
      failures_24h: rows.filter((row) => row.status === "failed").length,
      estimated_cost_micros_24h: rows.reduce((sum, row) => sum + Number(row.estimated_cost_micros || 0), 0),
      average_latency_ms_24h: succeeded.length ? Math.round(succeeded.reduce((sum, row) => sum + Number(row.latency_ms || 0), 0) / succeeded.length) : 0,
    },
    recent_failures: rows.filter((row) => row.status === "failed").slice(0, 8).map((row) => ({ feature_code: row.feature_code, error_code: row.error_code, created_at: row.created_at })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const staff = await requireAnyRole(["admin"]);
  if (staff.response || !staff.user) return staff.response;
  const limited = await enforceRateLimit(request, { scope: "admin-ai", limit: 60, windowSeconds: 3600, identity: staff.user.id });
  if (limited) return limited;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid AI control." }, { status: 400 });
  const { feature_code, ...changes } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.from("ai_feature_configs").update({ ...changes, updated_by: staff.user.id }).eq("feature_code", feature_code).select("feature_code,display_name,enabled,required_entitlement,model_tier,timeout_ms,max_output_tokens,supports_streaming,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feature: data });
}
