export function analyzePenLines(text: string) {
  const lines = text
    .split("\n")
    .map((line, index) => ({ number: index + 1, text: line.trimEnd() }))
    .filter((line) => line.text.trim());
  const keys = lines.map((line) => getPenRhymeKey(line.text));
  const keyCounts = keys.reduce<Map<string, number>>((counts, key) => {
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map());
  const analyzed = lines.map((line, index) => {
    const words = line.text.match(/[A-Za-z0-9']+/g) ?? [];
    const syllables = words.reduce((total, word) => total + estimateSyllables(word), 0);
    const rhymeKey = keys[index];
    return { ...line, syllables, rhymeKey, rhymeCount: rhymeKey ? keyCounts.get(rhymeKey) ?? 0 : 0 };
  });
  return {
    lines: analyzed,
    totalSyllables: analyzed.reduce((total, line) => total + line.syllables, 0),
  };
}

export function getPenRhymeKey(line: string) {
  const ending = (line.match(/[A-Za-z0-9']+(?=[^A-Za-z0-9']*$)/)?.[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ending) return "";
  return ending.match(/[aeiouy]+[^aeiouy]*$/)?.[0] ?? ending.slice(-3);
}

export function estimateSyllables(word: string) {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return 0;
  const groups = normalized.replace(/(?:[^l]e|ed|es)$/i, "").match(/[aeiouy]+/g)?.length ?? 1;
  return Math.max(1, groups);
}

export function linesFor(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}
