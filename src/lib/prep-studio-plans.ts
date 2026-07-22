import type { PlanDefinition } from "@/lib/membership";

export type PrepStudioTier = {
  id: "artist_free" | "artist_pro" | "artist_studio";
  shortName: "Free" | "Pro" | "Elite";
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  outcome: string;
  previewBenefits: [string, string];
  decisionLabel: string;
  featured?: boolean;
};

export const prepStudioTiers: PrepStudioTier[] = [
  {
    id: "artist_free",
    shortName: "Free",
    name: "Prep Studio Free",
    tagline: "Start the record.",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    outcome: "Write, save, and experience the studio.",
    previewBenefits: ["Write and save songs", "Booth Ready Lite"],
    decisionLabel: "Start here",
  },
  {
    id: "artist_pro",
    shortName: "Pro",
    name: "Prep Studio Pro",
    tagline: "Finish better records.",
    monthlyPriceCents: 1499,
    annualPriceCents: 14990,
    outcome: "Finish songs faster and make every section stronger.",
    previewBenefits: ["Stronger hooks", "Faster finishes"],
    decisionLabel: "Recommended",
    featured: true,
  },
  {
    id: "artist_studio",
    shortName: "Elite",
    name: "Prep Studio Elite",
    tagline: "Turn serious records into a career.",
    monthlyPriceCents: 2999,
    annualPriceCents: 29990,
    outcome: "Prepare records for consistent, serious releases.",
    previewBenefits: ["Performance coaching", "Release intelligence"],
    decisionLabel: "Career mode",
  },
];

export function prepStudioTier(planId: string) {
  return prepStudioTiers.find((tier) => tier.id === planId) ?? null;
}

export function withPrepStudioPresentation(plan: PlanDefinition): PlanDefinition {
  const tier = prepStudioTier(plan.id);
  if (!tier) return plan;
  return {
    ...plan,
    name: tier.name,
    tagline: tier.tagline,
    monthly_price_cents: tier.monthlyPriceCents,
    annual_price_cents: tier.annualPriceCents,
  };
}
