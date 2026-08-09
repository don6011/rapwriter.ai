import type { PlanDefinition } from "@/lib/membership";

export type PrepStudioTier = {
  id: "artist_free" | "artist_pro";
  shortName: "Free" | "Pro";
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  outcome: string;
  previewBenefits: [string, string];
  decisionLabel: string;
};

export const prepStudioTiers: PrepStudioTier[] = [
  {
    id: "artist_free",
    shortName: "Free",
    name: "RapWriter Free",
    tagline: "Start the record.",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    outcome: "Write, save, and experience the studio.",
    previewBenefits: ["Write and save songs", "Skyline + Midnight included"],
    decisionLabel: "Start here",
  },
  {
    id: "artist_pro",
    shortName: "Pro",
    name: "RapWriter Pro",
    tagline: "Finish the record.",
    monthlyPriceCents: 799,
    annualPriceCents: 5900,
    outcome: "Turn complete drafts into records ready for the booth.",
    previewBenefits: ["Ghostwriter + AI family", "All 15 studio rooms"],
    decisionLabel: "Finish the record",
  },
];

export function prepStudioTier(planId: string) {
  return prepStudioTiers.find((tier) => tier.id === planId) ?? null;
}

export function withPrepStudioPresentation(plan: PlanDefinition): PlanDefinition {
  if (plan.id === "artist_studio") {
    return { ...plan, name: "RapWriter Pro", tagline: "Legacy access" };
  }
  const tier = prepStudioTier(plan.id);
  if (!tier) return plan;
  return {
    ...plan,
    name: tier.name,
    tagline: tier.tagline,
  };
}
