import { createHash } from "node:crypto";
import { z } from "zod";
import { aiFeatureRegistry, estimateAiCostMicros, resolveModelForTier, type AiFeatureCode, type AiModelTier } from "@/lib/ai-features";
import { consumeMembershipUsage, MembershipAccessError, requireMembershipEntitlement } from "@/lib/server/membership-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type FeatureConfig = {
  feature_code: AiFeatureCode;
  enabled: boolean;
  required_entitlement: string | null;
  model_tier: AiModelTier;
  timeout_ms: number;
  max_output_tokens: number;
  daily_limits: Record<string, number>;
};

type PromptVersion = { id: string; version: number; system_prompt: string; output_schema: Record<string, unknown> };

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly code: "ai_unavailable" | "feature_disabled" | "invalid_ai_response" | "ai_timeout" | "daily_limit_reached" | "ai_configuration_error",
    readonly status: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export async function executeAiFeature<T>(input: {
  supabase: ServerSupabaseClient;
  ownerId: string;
  requestId: string;
  feature: AiFeatureCode;
  payload: Record<string, unknown>;
  outputName: string;
  outputSchema: z.ZodType<T>;
  safeMetadata?: Record<string, string | number | boolean | null>;
}) {
  const admin = createAdminClient();
  const existing = await admin
    .from("ai_request_results")
    .select("response_payload")
    .eq("owner_id", input.ownerId)
    .eq("request_id", input.requestId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing.error) throw new AiGatewayError("AI request history is temporarily unavailable.", "ai_unavailable", 503);
  if (existing.data?.response_payload) {
    return { data: input.outputSchema.parse(existing.data.response_payload), cached: true, usageId: null, model: null };
  }

  const [{ data: config, error: configError }, { data: prompt, error: promptError }] = await Promise.all([
    admin.from("ai_feature_configs").select("feature_code,enabled,required_entitlement,model_tier,timeout_ms,max_output_tokens,daily_limits").eq("feature_code", input.feature).maybeSingle(),
    admin.from("ai_prompt_versions").select("id,version,system_prompt,output_schema").eq("feature_code", input.feature).eq("active", true).maybeSingle(),
  ]);
  if (configError || promptError || !config || !prompt) {
    throw new AiGatewayError("This studio intelligence feature is not configured yet.", "ai_configuration_error", 503);
  }
  const featureConfig = config as FeatureConfig;
  const promptVersion = prompt as PromptVersion;
  if (!featureConfig.enabled) throw new AiGatewayError("This studio intelligence feature is temporarily paused.", "feature_disabled", 503);

  const definition = aiFeatureRegistry[input.feature];
  const workspace = await requireMembershipEntitlement(
    input.supabase,
    input.ownerId,
    input.feature === "producer_intelligence" ? "producer" : "artist",
    featureConfig.required_entitlement || definition.entitlement,
  );
  const monthlyLimitValue = workspace.limits[definition.monthlyLimit];
  const monthlyLimit = typeof monthlyLimitValue === "number" ? monthlyLimitValue : null;
  const monthlyUsage = workspace.usage[definition.usageMetric] ?? 0;
  if (monthlyLimit === null) {
    throw new MembershipAccessError("This membership allowance is temporarily unavailable.", "membership_unavailable", 503);
  }
  if (monthlyLimit >= 0 && monthlyUsage >= monthlyLimit) {
    await recordAiEvent(admin, input.ownerId, "ai_limit_reached", input.feature, { period: "monthly", plan_id: workspace.plan.id });
    throw new MembershipAccessError("You have used this month's allowance.", "usage_limit_reached", 429, {
      audience: workspace.audience,
      feature: featureConfig.required_entitlement || definition.entitlement,
      current_plan: workspace.plan.id,
      recommended_plan: workspace.audience === "artist" ? "artist_pro" : "producer_pro",
      usage: monthlyUsage,
      limit: monthlyLimit,
    });
  }
  const dailyLimit = numericDailyLimit(featureConfig.daily_limits, workspace.plan.id);
  if (dailyLimit >= 0) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count, error } = await admin
      .from("ai_usage_ledger")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", input.ownerId)
      .eq("feature_code", input.feature)
      .eq("status", "succeeded")
      .gte("created_at", since.toISOString());
    if (error) throw new AiGatewayError("AI usage is temporarily unavailable.", "ai_unavailable", 503);
    if ((count ?? 0) >= dailyLimit) {
      await recordAiEvent(admin, input.ownerId, "ai_limit_reached", input.feature, { period: "daily", plan_id: workspace.plan.id });
      throw new AiGatewayError("You have reached today's limit for this studio tool.", "daily_limit_reached", 429);
    }
  }

  const { data: ledger, error: ledgerError } = await admin.from("ai_usage_ledger").insert({
    owner_id: input.ownerId,
    request_id: input.requestId,
    feature_code: input.feature,
    prompt_version_id: promptVersion.id,
    membership_plan_id: workspace.plan.id,
    metadata: input.safeMetadata ?? {},
  }).select("id").single();
  if (ledgerError) {
    if (ledgerError.code === "23505") throw new AiGatewayError("This request is already being processed.", "ai_unavailable", 409);
    throw new AiGatewayError("AI usage could not be recorded.", "ai_unavailable", 503);
  }
  await recordAiEvent(admin, input.ownerId, "ai_feature_started", input.feature, { model_tier: featureConfig.model_tier, prompt_version: promptVersion.version });

  const started = Date.now();
  const tier = featureConfig.model_tier;
  const model = resolveModelForTier(tier);
  try {
    const response = await callOpenAi({
      ownerId: input.ownerId,
      model,
      timeoutMs: featureConfig.timeout_ms,
      maxOutputTokens: featureConfig.max_output_tokens,
      outputName: input.outputName,
      jsonSchema: promptVersion.output_schema,
      systemPrompt: promptVersion.system_prompt,
      payload: input.payload,
    });
    const parsed = input.outputSchema.parse(JSON.parse(response.outputText));
    await consumeMembershipUsage(input.supabase, input.ownerId, workspace.audience, {
      entitlement: featureConfig.required_entitlement || definition.entitlement,
      limitKey: definition.monthlyLimit,
      metric: definition.usageMetric,
    });
    const cost = estimateAiCostMicros(tier, response.usage);
    await Promise.all([
      admin.from("ai_usage_ledger").update({
        status: "succeeded",
        model,
        provider_request_id: response.id,
        input_tokens: response.usage.inputTokens,
        cached_input_tokens: response.usage.cachedInputTokens,
        output_tokens: response.usage.outputTokens,
        estimated_cost_micros: cost,
        latency_ms: Date.now() - started,
        completed_at: new Date().toISOString(),
      }).eq("id", ledger.id),
      admin.from("ai_request_results").insert({ owner_id: input.ownerId, request_id: input.requestId, feature_code: input.feature, response_payload: parsed }),
      recordAiEvent(admin, input.ownerId, "ai_feature_completed", input.feature, { model_tier: tier, prompt_version: promptVersion.version }),
    ]);
    return { data: parsed, cached: false, usageId: ledger.id as string, model };
  } catch (error) {
    const normalized = normalizeGatewayError(error);
    await Promise.all([
      admin.from("ai_usage_ledger").update({ status: "failed", model, error_code: normalized.code, latency_ms: Date.now() - started, completed_at: new Date().toISOString() }).eq("id", ledger.id),
      recordAiEvent(admin, input.ownerId, "ai_feature_failed", input.feature, { code: normalized.code }),
    ]);
    throw normalized;
  }
}

export async function callOpenAi(input: {
  ownerId: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  outputName: string;
  jsonSchema: Record<string, unknown>;
  systemPrompt: string;
  payload: Record<string, unknown>;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}) {
  const key = input.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiGatewayError("Studio intelligence is not connected yet.", "ai_configuration_error", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await (input.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        store: false,
        safety_identifier: createHash("sha256").update(`rapwriter-ai:${input.ownerId}`).digest("hex"),
        max_output_tokens: input.maxOutputTokens,
        input: [
          { role: "system", content: [{ type: "input_text", text: input.systemPrompt }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(input.payload) }] },
        ],
        text: { format: { type: "json_schema", name: input.outputName, strict: true, schema: input.jsonSchema } },
      }),
    });
    if (!response.ok) {
      if (response.status === 429) throw new AiGatewayError("Studio intelligence is busy. Give it a moment, then try again.", "ai_unavailable", 429);
      throw new AiGatewayError("Studio intelligence is temporarily unavailable.", "ai_unavailable", 503);
    }
    const body = await response.json() as OpenAiResponse;
    const outputText = body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new AiGatewayError("Studio intelligence returned an incomplete result.", "invalid_ai_response", 502);
    return {
      id: body.id ?? null,
      outputText,
      usage: {
        inputTokens: body.usage?.input_tokens ?? 0,
        cachedInputTokens: body.usage?.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new AiGatewayError("Studio intelligence took too long. Your lyrics are safe; try again.", "ai_timeout", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function numericDailyLimit(limits: Record<string, number>, planId: string) {
  const value = limits[planId];
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function normalizeGatewayError(error: unknown) {
  if (error instanceof AiGatewayError || error instanceof MembershipAccessError) return error;
  if (error instanceof z.ZodError || error instanceof SyntaxError) return new AiGatewayError("Studio intelligence returned a result that could not be verified.", "invalid_ai_response", 502);
  return new AiGatewayError("Studio intelligence is temporarily unavailable.", "ai_unavailable", 503);
}

async function recordAiEvent(admin: ReturnType<typeof createAdminClient>, ownerId: string, eventName: string, feature: AiFeatureCode, metadata: Record<string, unknown>) {
  await admin.from("growth_events").insert({ owner_id: ownerId, event_name: eventName, metadata: { feature, ...metadata } });
}

type OpenAiResponse = {
  id?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
};
