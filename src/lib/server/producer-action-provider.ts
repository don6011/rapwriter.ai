import { z } from "zod";
import { producerActionFeature } from "@/lib/ai-features";
import type { ProducerActionDraft, ProducerActionInput } from "@/lib/producer-actions";
import { executeAiFeature } from "@/lib/server/ai-gateway";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

const actionDirections = {
  hook: "Strengthen the memory phrase and return pattern. Favor fewer, clearer ideas.",
  rewrite: "Tighten weak setups and overpacked lines while protecting the original idea and voice.",
  commercial: "Clarify one memorable payoff and replay point without making the writing generic.",
  pocket: "Improve cadence, breath points, and line density for the supplied BPM.",
} as const;

export async function generateProducerActionWithProvider(input: ProducerActionInput & {
  supabase: ServerSupabaseClient;
  ownerId: string;
  requestId: string;
}) {
  const feature = producerActionFeature(input.actionType);
  const result = await executeAiFeature({
    supabase: input.supabase,
    ownerId: input.ownerId,
    requestId: input.requestId,
    feature,
    outputName: "rapwriter_producer_revision",
    outputSchema: responseSchema,
    safeMetadata: {
      action_type: input.actionType,
      section_name: input.sectionName,
      attempt: input.attempt,
      has_beat: Object.keys(input.beat).length > 0,
    },
    payload: {
      requestedPass: actionDirections[input.actionType],
      section: input.sectionName,
      lyrics: input.sectionContent,
      attempt: input.attempt,
      beat: input.beat,
      studioDna: input.studioDna,
    },
  });
  const draft: ProducerActionDraft = {
    title: actionTitles[input.actionType],
    proposedContent: result.data.proposedContent.trim(),
    rationale: result.data.rationale,
    changes: result.data.changes,
    provider: "openai",
    model: result.model,
  };
  return { draft, usageId: result.usageId, cached: result.cached };
}
