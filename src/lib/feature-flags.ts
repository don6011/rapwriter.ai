export function isAiGenerationEnabled() {
  return process.env.NEXT_PUBLIC_AI_GENERATION_ENABLED === "true";
}
