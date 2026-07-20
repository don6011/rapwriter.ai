import { z } from "zod";
import {
  generateProducerAction,
  type ProducerActionDraft,
  type ProducerActionInput,
} from "@/lib/producer-actions";

const responseSchema = z.object({
  proposedContent: z.string().min(1).max(20_000),
  rationale: z.string().min(1).max(600),
  changes: z.array(z.string().min(1).max(180)).min(1).max(4),
});

const actionTitles = {
  hook: "Hook Doctor",
  rewrite: "Producer Rewrite",
  commercial: "Commercial Pass",
  pocket: "Pocket Adjustment",
} as const;

export async function generateProducerActionWithProvider(input: ProducerActionInput): Promise<ProducerActionDraft> {
  const key = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_PRODUCER_MODEL?.trim();
  if (!key || !model) return generateProducerAction(input);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1_200,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: producerSystemPrompt(input.actionType),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  section: input.sectionName,
                  lyrics: input.sectionContent,
                  attempt: input.attempt,
                  beat: input.beat,
                  studioDna: input.studioDna,
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "rapwriter_producer_revision",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["proposedContent", "rationale", "changes"],
              properties: {
                proposedContent: { type: "string" },
                rationale: { type: "string" },
                changes: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      }),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) throw new Error(`OpenAI producer provider returned ${response.status}.`);
    const payload = (await response.json()) as OpenAIResponse;
    const outputText = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("OpenAI producer provider returned no revision.");

    const parsed = responseSchema.parse(JSON.parse(outputText));
    return {
      title: actionTitles[input.actionType],
      proposedContent: parsed.proposedContent.trim(),
      rationale: parsed.rationale,
      changes: parsed.changes,
      provider: "openai",
      model,
    };
  } catch (error) {
    console.error("Producer model provider failed; using local engine.", error);
    return generateProducerAction(input);
  }
}

function producerSystemPrompt(actionType: ProducerActionInput["actionType"]) {
  const passDirection = {
    hook: "Strengthen the hook's memory phrase and return pattern.",
    rewrite: "Tighten weak setups and overpacked lines while protecting the original idea.",
    commercial: "Clarify one memorable payoff without making the writing generic.",
    pocket: "Improve cadence, breath points, and line density for the supplied BPM.",
  }[actionType];

  return [
    "You are RapWriter's in-session producer. Revise, do not ghostwrite a different artist.",
    passDirection,
    "Preserve the artist's point of view, core nouns, images, slang, and explicitness level.",
    "Do not add named artists, copyrighted lyrics, or claims about commercial success.",
    "Return only the requested structured result. Keep changes concise and practical.",
  ].join(" ");
}

type OpenAIResponse = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};
