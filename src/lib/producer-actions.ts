export const producerActionTypes = ["hook", "rewrite", "commercial", "pocket"] as const;

export type ProducerActionType = (typeof producerActionTypes)[number];

export const producerActionEntitlements: Record<ProducerActionType, string> = {
  hook: "hook_doctor",
  rewrite: "rewrite",
  commercial: "commercial_pass",
  pocket: "ghostwriter",
};

export function producerActionEntitlement(actionType: ProducerActionType) {
  return producerActionEntitlements[actionType];
}

export type ProducerActionInput = {
  actionType: ProducerActionType;
  sectionName: string;
  sectionContent: string;
  attempt: number;
  beat: Record<string, unknown>;
  studioDna: {
    environment: string;
    goal: string;
    style: string;
    mood: string;
    producer: string;
  };
};

export type ProducerActionDraft = {
  title: string;
  proposedContent: string;
  rationale: string;
  changes: string[];
  provider: "openai";
  model: string | null;
};

export type ProducerActionProposal = {
  id: string;
  actionType: ProducerActionType;
  title: string;
  sectionName: string;
  originalContent: string;
  proposedContent: string;
  rationale: string;
  changes: string[];
  attempt: number;
  provider: string;
  status: "previewed" | "accepted" | "rejected" | "reverted";
};
