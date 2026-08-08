export const aiFeatureCodes = [
  "ghostwriter",
  "hook_doctor",
  "rewrite",
  "commercial_pass",
  "pocket_adjustment",
  "studio_coach",
  "booth_ready",
  "studio_dna",
  "performance_analysis",
  "producer_intelligence",
] as const;

export type AiFeatureCode = (typeof aiFeatureCodes)[number];
export type AiModelTier = "fast" | "balanced" | "advanced";

export const aiFeatureRegistry: Record<AiFeatureCode, {
  label: string;
  entitlement: string;
  usageMetric: string;
  monthlyLimit: string;
}> = {
  ghostwriter: { label: "Ghostwriter", entitlement: "ghostwriter", usageMetric: "ghostwriter_actions", monthlyLimit: "ghostwriter_actions_monthly" },
  hook_doctor: { label: "Hook Doctor", entitlement: "hook_doctor", usageMetric: "ghostwriter_actions", monthlyLimit: "ghostwriter_actions_monthly" },
  rewrite: { label: "Producer Rewrite", entitlement: "rewrite", usageMetric: "ghostwriter_actions", monthlyLimit: "ghostwriter_actions_monthly" },
  commercial_pass: { label: "Commercial Pass", entitlement: "commercial_pass", usageMetric: "ghostwriter_actions", monthlyLimit: "ghostwriter_actions_monthly" },
  pocket_adjustment: { label: "Pocket Adjustment", entitlement: "ghostwriter", usageMetric: "ghostwriter_actions", monthlyLimit: "ghostwriter_actions_monthly" },
  studio_coach: { label: "Studio Coach", entitlement: "producer_notes", usageMetric: "studio_coach_actions", monthlyLimit: "priority_ai_actions_monthly" },
  booth_ready: { label: "Advanced Booth Ready", entitlement: "advanced_booth_ready", usageMetric: "booth_ready_actions", monthlyLimit: "priority_ai_actions_monthly" },
  studio_dna: { label: "Studio DNA", entitlement: "studio_dna_full", usageMetric: "studio_dna_actions", monthlyLimit: "priority_ai_actions_monthly" },
  performance_analysis: { label: "Performance Coach", entitlement: "performance_coach", usageMetric: "performance_analysis_actions", monthlyLimit: "priority_ai_actions_monthly" },
  producer_intelligence: { label: "Producer Intelligence", entitlement: "producer_intelligence", usageMetric: "producer_intelligence_actions", monthlyLimit: "priority_ai_actions_monthly" },
};

export function producerActionFeature(action: "hook" | "rewrite" | "commercial" | "pocket"): AiFeatureCode {
  return {
    hook: "hook_doctor",
    rewrite: "rewrite",
    commercial: "commercial_pass",
    pocket: "pocket_adjustment",
  }[action] as AiFeatureCode;
}

export function resolveModelForTier(tier: AiModelTier, env: NodeJS.ProcessEnv = process.env) {
  const models: Record<AiModelTier, string> = {
    fast: env.OPENAI_MODEL_FAST?.trim() || "gpt-5.6-luna",
    balanced: env.OPENAI_MODEL_BALANCED?.trim() || env.OPENAI_PRODUCER_MODEL?.trim() || "gpt-5.6-terra",
    advanced: env.OPENAI_MODEL_ADVANCED?.trim() || "gpt-5.6-sol",
  };
  return models[tier];
}

export function estimateAiCostMicros(
  tier: AiModelTier,
  usage: { inputTokens: number; cachedInputTokens?: number; outputTokens: number },
  env: NodeJS.ProcessEnv = process.env,
) {
  const defaults = {
    fast: { input: 1, cached: 0.1, output: 6 },
    balanced: { input: 2.5, cached: 0.25, output: 15 },
    advanced: { input: 5, cached: 0.5, output: 30 },
  }[tier];
  const prefix = `OPENAI_${tier.toUpperCase()}`;
  const inputRate = numberEnv(env[`${prefix}_INPUT_USD_PER_MILLION`], defaults.input);
  const cachedRate = numberEnv(env[`${prefix}_CACHED_INPUT_USD_PER_MILLION`], defaults.cached);
  const outputRate = numberEnv(env[`${prefix}_OUTPUT_USD_PER_MILLION`], defaults.output);
  const cached = Math.min(usage.inputTokens, Math.max(0, usage.cachedInputTokens ?? 0));
  const uncached = Math.max(0, usage.inputTokens - cached);
  return Math.max(0, Math.round(uncached * inputRate + cached * cachedRate + usage.outputTokens * outputRate));
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
