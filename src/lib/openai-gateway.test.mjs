import { describe, expect, test } from "bun:test";
import { AiGatewayError, callOpenAi } from "./server/ai-gateway.ts";

const base = {
  ownerId: "00000000-0000-4000-8000-000000000001",
  model: "test-model",
  timeoutMs: 50,
  maxOutputTokens: 100,
  outputName: "test_output",
  jsonSchema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } },
  systemPrompt: "Return the requested test structure and no additional content.",
  payload: { action: "test" },
  apiKey: "test-key",
};

describe("OpenAI Responses provider boundary", () => {
  test("extracts a structured response and usage without logging content", async () => {
    const result = await callOpenAi({
      ...base,
      fetchImpl: async () => new Response(JSON.stringify({
        id: "resp_test",
        output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }],
        usage: { input_tokens: 20, output_tokens: 5, input_tokens_details: { cached_tokens: 4 } },
      }), { status: 200 }),
    });
    expect(result.outputText).toBe('{"ok":true}');
    expect(result.usage).toEqual({ inputTokens: 20, cachedInputTokens: 4, outputTokens: 5 });
  });

  test("rejects a malformed provider result", async () => {
    expect(callOpenAi({ ...base, fetchImpl: async () => new Response(JSON.stringify({ output: [] }), { status: 200 }) }))
      .rejects.toMatchObject({ code: "invalid_ai_response", status: 502 });
  });

  test("turns a provider timeout into a stable retryable error", async () => {
    const fetchImpl = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    try {
      await callOpenAi({ ...base, timeoutMs: 5, fetchImpl });
      throw new Error("Expected timeout");
    } catch (error) {
      expect(error).toBeInstanceOf(AiGatewayError);
      expect(error.code).toBe("ai_timeout");
      expect(error.status).toBe(504);
    }
  });
});
