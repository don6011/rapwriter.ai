import { afterEach, describe, expect, test } from "bun:test";
import { isAiGenerationEnabled } from "./feature-flags";

const originalValue = process.env.NEXT_PUBLIC_AI_GENERATION_ENABLED;

afterEach(() => {
  if (originalValue === undefined) delete process.env.NEXT_PUBLIC_AI_GENERATION_ENABLED;
  else process.env.NEXT_PUBLIC_AI_GENERATION_ENABLED = originalValue;
});

describe("AI generation feature flag", () => {
  test("defaults to hidden", () => {
    delete process.env.NEXT_PUBLIC_AI_GENERATION_ENABLED;
    expect(isAiGenerationEnabled()).toBe(false);
  });

  test("only enables for an explicit true value", () => {
    process.env.NEXT_PUBLIC_AI_GENERATION_ENABLED = "true";
    expect(isAiGenerationEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_AI_GENERATION_ENABLED = "false";
    expect(isAiGenerationEnabled()).toBe(false);
  });
});
