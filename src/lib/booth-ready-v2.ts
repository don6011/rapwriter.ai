export type RoughTakeAnalysis = {
  version: "booth-ready-v2";
  durationSeconds: number;
  sampleRate: number;
  peakDb: number;
  rmsDb: number;
  silencePct: number;
  clippingPct: number;
  dynamicRangeDb: number;
  consistency: number;
  vocalPresence: number;
  deliveryScore: number;
  findings: string[];
};

export type LyricAnalysis = {
  totalWords: number;
  totalLines: number;
  uniqueWordPct: number;
  cadenceConsistency: number;
  endRhymePct: number;
  hookReplay: number;
  fillerPct: number;
  actions: string[];
};

const fillerWords = new Set(["uh", "um", "like", "really", "very", "just"]);
const ignoredRhymeWords = new Set(["the", "and", "but", "for", "that", "this", "with", "from", "you", "your"]);

export async function analyzeRoughTakeAudio(blob: Blob): Promise<RoughTakeAnalysis> {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error("Audio analysis is not available in this browser.");

  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const frameSize = Math.max(256, Math.round(buffer.sampleRate * 0.05));
    const frameRms: number[] = [];
    let squareSum = 0;
    let sampleCount = 0;
    let peak = 0;
    let clipped = 0;

    for (let offset = 0; offset < buffer.length; offset += frameSize) {
      const end = Math.min(buffer.length, offset + frameSize);
      let frameSquareSum = 0;
      let frameSamples = 0;
      for (let index = offset; index < end; index += 1) {
        let sample = 0;
        for (const channel of channels) sample += channel[index] ?? 0;
        sample /= channels.length;
        const absolute = Math.abs(sample);
        peak = Math.max(peak, absolute);
        if (absolute >= 0.985) clipped += 1;
        const square = sample * sample;
        squareSum += square;
        frameSquareSum += square;
        sampleCount += 1;
        frameSamples += 1;
      }
      frameRms.push(Math.sqrt(frameSquareSum / Math.max(1, frameSamples)));
    }

    const rms = Math.sqrt(squareSum / Math.max(1, sampleCount));
    const activeFrames = frameRms.filter((value) => value >= 0.012);
    const frameDb = activeFrames.map(toDb).sort((a, b) => a - b);
    const silencePct = percent(frameRms.filter((value) => value < 0.012).length, frameRms.length);
    const clippingPct = percent(clipped, sampleCount, 2);
    const lowDb = percentile(frameDb, 0.15, -48);
    const highDb = percentile(frameDb, 0.85, -18);
    const dynamicRangeDb = round(Math.max(0, highDb - lowDb), 1);
    const meanDb = frameDb.length ? frameDb.reduce((sum, value) => sum + value, 0) / frameDb.length : -60;
    const deviation = frameDb.length
      ? Math.sqrt(frameDb.reduce((sum, value) => sum + (value - meanDb) ** 2, 0) / frameDb.length)
      : 20;
    const consistency = score(100 - deviation * 8);
    const rmsDb = round(toDb(rms), 1);
    const peakDb = round(toDb(peak), 1);
    const vocalPresence = score(100 - Math.abs(rmsDb - -20) * 5 - Math.max(0, silencePct - 35) * 0.7);
    const clippingHealth = score(100 - clippingPct * 40);
    const silenceHealth = score(100 - Math.max(0, silencePct - 24) * 2.2);
    const dynamicsHealth = score(100 - Math.abs(dynamicRangeDb - 13) * 4.2);
    const deliveryScore = score(vocalPresence * 0.3 + consistency * 0.28 + clippingHealth * 0.2 + silenceHealth * 0.12 + dynamicsHealth * 0.1);

    return {
      version: "booth-ready-v2",
      durationSeconds: round(buffer.duration, 1),
      sampleRate: buffer.sampleRate,
      peakDb,
      rmsDb,
      silencePct,
      clippingPct,
      dynamicRangeDb,
      consistency,
      vocalPresence,
      deliveryScore,
      findings: buildAudioFindings({ rmsDb, silencePct, clippingPct, dynamicRangeDb, consistency }),
    };
  } finally {
    void context.close();
  }
}

export function analyzeLyrics(sections: Record<string, string>): LyricAnalysis {
  const sectionLines = Object.entries(sections).flatMap(([section, text]) =>
    text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => ({ section, line, words: tokenize(line) })),
  );
  const words = sectionLines.flatMap((item) => item.words);
  const uniqueWordPct = percent(new Set(words).size, words.length);
  const lineLengths = sectionLines.map((item) => item.words.length).filter(Boolean);
  const averageLength = average(lineLengths);
  const lengthDeviation = standardDeviation(lineLengths, averageLength);
  const cadenceConsistency = score(100 - (lengthDeviation / Math.max(1, averageLength)) * 120);
  const rhymeEndings = sectionLines
    .map((item) => item.words[item.words.length - 1])
    .filter((word): word is string => Boolean(word) && !ignoredRhymeWords.has(word))
    .map(rhymeKey);
  const rhymeCounts = new Map<string, number>();
  rhymeEndings.forEach((ending) => rhymeCounts.set(ending, (rhymeCounts.get(ending) ?? 0) + 1));
  const rhymedLines = rhymeEndings.filter((ending) => (rhymeCounts.get(ending) ?? 0) > 1).length;
  const endRhymePct = percent(rhymedLines, rhymeEndings.length);
  const hookLines = sectionLines.filter((item) => item.section === "Hook").map((item) => normalizeLine(item.line));
  const repeatedHookLines = hookLines.filter((line, index) => hookLines.indexOf(line) !== index).length;
  const hookAnchor = mostFrequentContentWord(sectionLines.filter((item) => item.section === "Hook").flatMap((item) => item.words));
  const hookAnchorUses = hookAnchor ? hookLines.filter((line) => line.includes(hookAnchor)).length : 0;
  const hookReplay = score(repeatedHookLines * 35 + hookAnchorUses * 18 + Math.min(28, hookLines.length * 7));
  const fillerPct = percent(words.filter((word) => fillerWords.has(word)).length, words.length, 1);

  const actions: string[] = [];
  if (cadenceConsistency < 55) actions.push("Tighten the longest line so the delivery lands in one pocket.");
  if (endRhymePct < 35 && sectionLines.length >= 4) actions.push("Connect two more line endings with a shared rhyme sound.");
  if (hookReplay < 55) actions.push("Repeat one anchor phrase in the hook so listeners can return it.");
  if (uniqueWordPct < 48 && words.length >= 24) actions.push("Replace one repeated filler word with a concrete image.");
  if (!actions.length) actions.push("The lyric shape is controlled. Rehearse breath points against the beat.");

  return {
    totalWords: words.length,
    totalLines: sectionLines.length,
    uniqueWordPct,
    cadenceConsistency,
    endRhymePct,
    hookReplay,
    fillerPct,
    actions: actions.slice(0, 3),
  };
}

function buildAudioFindings(input: Pick<RoughTakeAnalysis, "rmsDb" | "silencePct" | "clippingPct" | "dynamicRangeDb" | "consistency">) {
  const findings: string[] = [];
  if (input.clippingPct > 0.5) findings.push("Back off the mic or input gain; the take is clipping.");
  if (input.rmsDb < -30) findings.push("Move closer to the mic or raise the input level slightly.");
  if (input.rmsDb > -11) findings.push("Lower the input level to leave headroom for the vocal chain.");
  if (input.silencePct > 48) findings.push("Trim the long gaps or perform the section in one continuous pass.");
  if (input.consistency < 55) findings.push("Keep the vocal distance steady through louder lines.");
  if (input.dynamicRangeDb < 5) findings.push("Add more contrast between setup lines and the payoff.");
  if (!findings.length) findings.push("Recording level and delivery shape are ready for a closer producer pass.");
  return findings.slice(0, 3);
}

function tokenize(value: string) {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function normalizeLine(value: string) {
  return tokenize(value).join(" ");
}

function rhymeKey(word: string) {
  const cleaned = word.replace(/(?:ing|ed|es|s)$/i, "");
  return cleaned.slice(-Math.min(3, cleaned.length));
}

function mostFrequentContentWord(words: string[]) {
  const ignored = new Set(["and", "the", "that", "with", "this", "from", "your", "you", "for", "but", "not", "are", "was"]);
  const counts = new Map<string, number>();
  words.filter((word) => word.length > 3 && !ignored.has(word)).forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function toDb(value: number) {
  return value > 0 ? 20 * Math.log10(value) : -60;
}

function percentile(values: number[], position: number, fallback: number) {
  if (!values.length) return fallback;
  return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * position)))] ?? fallback;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[], mean: number) {
  return values.length ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) : 0;
}

function percent(value: number, total: number, decimals = 0) {
  return total ? round((value / total) * 100, decimals) : 0;
}

function score(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function round(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
