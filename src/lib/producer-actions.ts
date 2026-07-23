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
  provider: "local" | "openai";
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

const fillerPattern = /\b(really|very|just|basically|literally|actually)\b/gi;
const softOpenPattern = /^(i think|i know|you know|i guess)\s+/i;

export function generateProducerAction(input: ProducerActionInput): ProducerActionDraft {
  const lines = cleanLines(input.sectionContent);
  const bpm = numberFrom(input.beat.bpm, 84);

  if (input.actionType === "hook") return buildHookDoctor(lines, input.attempt);
  if (input.actionType === "commercial") return buildCommercialPass(lines, input.attempt);
  if (input.actionType === "pocket") return buildPocketAdjustment(lines, bpm, input.attempt);
  return buildProducerRewrite(lines, input.attempt);
}

function buildHookDoctor(lines: string[], attempt: number): ProducerActionDraft {
  const tightened = lines.map(tightenLine).filter(Boolean);
  const source = tightened.length ? tightened : lines;
  const strongestIndex = findStrongestLineIndex(source, attempt);
  const strongest = source[strongestIndex] ?? source[0] ?? "";
  let revised = [...source];

  if (revised.length === 1) revised = [strongest, strongest];
  if (revised.length === 2) revised = attempt % 2 === 0 ? [...revised, strongest, revised[1]] : [...revised, revised[1], strongest];
  if (revised.length === 3) revised.push(strongest);
  if (revised.length >= 4) {
    const landingIndex = revised.length - 1;
    revised[landingIndex] = attempt % 2 === 0 ? strongest : revised[Math.max(0, strongestIndex - 1)] ?? strongest;
  }

  return draft(
    "Hook Doctor",
    revised,
    "This pass protects your language and gives the hook a clearer return point instead of introducing another idea.",
    [
      `Built the landing around: "${clip(strongest, 72)}"`,
      "Tightened filler without changing the core image.",
      revised.length > lines.length ? "Expanded the repeat pattern to make the hook easier to remember." : "Returned to the strongest line at the section landing.",
    ],
  );
}

function buildProducerRewrite(lines: string[], attempt: number): ProducerActionDraft {
  const revised = lines.map((line) => tightenLine(line, attempt)).filter(Boolean);
  const changed = revised.some((line, index) => line !== lines[index]);

  if (!changed) {
    const longestIndex = findLongestLineIndex(revised);
    const longest = revised[longestIndex] ?? "";
    const split = wordsIn(longest).length >= 7
      ? forceSplitLine(longest, Math.max(3, Math.floor(wordsIn(longest).length / 2) + (attempt % 2)))
      : splitLine(longest, 8 + (attempt % 3));
    if (split.length > 1) revised.splice(longestIndex, 1, ...split);
  }

  return draft(
    "Producer Rewrite",
    revised,
    "The rewrite keeps the artist's nouns and images, then removes soft language and overpacked setups.",
    [
      "Removed weak filler and conversational openers.",
      "Protected the original images and point of view.",
      revised.length !== lines.length ? "Opened a breath point in the longest setup." : "Kept the existing bar structure intact.",
    ],
  );
}

function buildCommercialPass(lines: string[], attempt: number): ProducerActionDraft {
  const tightened = lines.map(tightenLine).filter(Boolean);
  const strongestIndex = findStrongestLineIndex(tightened, attempt);
  const memoryLine = tightened[strongestIndex] ?? tightened[0] ?? "";
  let revised = [...tightened];

  if (revised.length < 4) {
    while (revised.length < 4) revised.push(memoryLine);
  } else {
    revised[revised.length - 1] = memoryLine;
    if (revised.length > 8) revised = revised.slice(0, 8);
  }

  return draft(
    "Commercial Pass",
    revised,
    "This pass narrows the section to one memory phrase and makes the payoff easy to identify after one listen.",
    [
      `Promoted "${clip(memoryLine, 72)}" as the memory line.`,
      "Reduced competing ideas around the payoff.",
      "Built a clear return at the end of the section.",
    ],
  );
}

function buildPocketAdjustment(lines: string[], bpm: number, attempt: number): ProducerActionDraft {
  const targetWords = bpm >= 120 ? 7 : bpm >= 92 ? 9 : 11;
  const revised = lines.flatMap((line) => {
    const tightened = tightenLine(line);
    const words = wordsIn(tightened);
    if (words.length <= targetWords + 3) return [tightened];
    return splitLine(tightened, targetWords + (attempt % 2));
  });

  return draft(
    "Pocket Adjustment",
    revised,
    `At ${bpm} BPM, this pass creates cleaner breath points and keeps dense setups from running over the pocket.`,
    [
      `Shaped lines toward roughly ${targetWords} words at ${bpm} BPM.`,
      "Split overpacked lines at natural phrase boundaries.",
      "Kept short landing lines untouched.",
    ],
  );
}

function draft(title: string, lines: string[], rationale: string, changes: string[]): ProducerActionDraft {
  return {
    title,
    proposedContent: lines.join("\n").trim(),
    rationale,
    changes: changes.slice(0, 4),
    provider: "local",
    model: null,
  };
}

function cleanLines(content: string) {
  return content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function tightenLine(line: string, attempt = 0) {
  let value = line.replace(softOpenPattern, "").replace(fillerPattern, "").replace(/\s{2,}/g, " ").trim();
  value = value.replace(/\s+([,.;!?])/g, "$1");
  if (attempt % 2 === 1) value = value.replace(/^(and|but|so)\s+/i, "");
  return value;
}

function splitLine(line: string, targetWords: number) {
  const words = wordsIn(line);
  if (words.length <= targetWords + 2) return [line];
  const punctuationIndex = findSplitIndex(words, targetWords);
  const first = words.slice(0, punctuationIndex).join(" ").replace(/,$/, "").trim();
  const second = words.slice(punctuationIndex).join(" ").trim();
  return [first, second].filter(Boolean);
}

function forceSplitLine(line: string, targetWords: number) {
  const words = wordsIn(line);
  if (words.length < 4) return [line];
  const index = findSplitIndex(words, Math.min(words.length - 2, targetWords));
  return [
    words.slice(0, index).join(" ").replace(/,$/, "").trim(),
    words.slice(index).join(" ").trim(),
  ].filter(Boolean);
}

function findSplitIndex(words: string[], target: number) {
  const lower = Math.max(3, target - 3);
  const upper = Math.min(words.length - 2, target + 3);
  for (let distance = 0; distance <= 3; distance += 1) {
    for (const index of [target - distance, target + distance]) {
      if (index >= lower && index <= upper && /[,;:]$/.test(words[index - 1] ?? "")) return index;
    }
  }
  return Math.max(2, Math.min(words.length - 2, target));
}

function findStrongestLineIndex(lines: string[], attempt: number) {
  if (!lines.length) return 0;
  const ranked = lines
    .map((line, index) => ({ index, score: scoreLine(line) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[attempt % Math.min(3, ranked.length)]?.index ?? ranked[0]?.index ?? 0;
}

function scoreLine(line: string) {
  const words = wordsIn(line);
  const concreteWords = words.filter((word) => word.length >= 5).length;
  return Math.min(words.length, 10) * 2 + concreteWords * 3 - Math.max(0, words.length - 12) * 2;
}

function findLongestLineIndex(lines: string[]) {
  return lines.reduce((best, line, index) => (wordsIn(line).length > wordsIn(lines[best] ?? "").length ? index : best), 0);
}

function wordsIn(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

function numberFrom(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
