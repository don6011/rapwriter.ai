import { describe, expect, test } from "bun:test";
import { estimateAiCostMicros, producerActionFeature, resolveModelForTier } from "./ai-features.ts";
import { producerActionEntitlement } from "./producer-actions.ts";

describe("production AI routing", () => {
  test("maps each writing pass to a membership capability and gateway feature", () => {
    expect(producerActionEntitlement("pocket")).toBe("ghostwriter");
    expect(producerActionEntitlement("hook")).toBe("hook_doctor");
    expect(producerActionEntitlement("rewrite")).toBe("rewrite");
    expect(producerActionEntitlement("commercial")).toBe("commercial_pass");
    expect(producerActionFeature("hook")).toBe("hook_doctor");
    expect(producerActionFeature("pocket")).toBe("pocket_adjustment");
  });

  test("resolves model tiers from one configurable boundary", () => {
    const env = { OPENAI_MODEL_FAST: "fast-model", OPENAI_MODEL_BALANCED: "balanced-model", OPENAI_MODEL_ADVANCED: "advanced-model" };
    expect(resolveModelForTier("fast", env)).toBe("fast-model");
    expect(resolveModelForTier("balanced", env)).toBe("balanced-model");
    expect(resolveModelForTier("advanced", env)).toBe("advanced-model");
  });

  test("estimates token cost without storing prompt content", () => {
    const cost = estimateAiCostMicros("balanced", { inputTokens: 1000, cachedInputTokens: 400, outputTokens: 200 }, {});
    expect(cost).toBe(4600);
  });
});
