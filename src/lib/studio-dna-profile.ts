export type StudioDnaTraits = {
  dominant_moods?: string[];
  preferred_bpm_range?: [number, number];
  average_line_length?: number;
  rhyme_density?: number;
  perspective?: "first_person" | "second_person" | "third_person" | "mixed";
  hook_style?: "repetitive" | "narrative" | "minimal" | "developing";
  preferred_producer_characteristics?: string[];
  recent_session_ids?: string[];
};

export function mergeStudioDnaTraits(current: StudioDnaTraits, input: {
  sessionId: string;
  sections: Record<string, string>;
  studioDna: Record<string, unknown>;
  beat: Record<string, unknown>;
}) {
  if (current.recent_session_ids?.includes(input.sessionId)) return current;
  const lines = Object.values(input.sections).flatMap((value) => value.split(/\n+/).map((line) => line.trim()).filter(Boolean));
  const words = lines.flatMap((line) => line.toLowerCase().match(/[a-z0-9']+/g) ?? []);
  const averageLineLength = lines.length ? Math.round(words.length / lines.length) : 0;
  const endings = lines.map((line) => line.toLowerCase().match(/[a-z0-9']+(?=[^a-z0-9']*$)/)?.[0]).filter(Boolean) as string[];
  const repeatedEndings = endings.filter((word, index) => endings.indexOf(word) !== index).length;
  const rhymeDensity = endings.length ? Math.round((repeatedEndings / endings.length) * 100) : 0;
  const first = words.filter((word) => ["i", "i'm", "me", "my", "mine", "we", "our"].includes(word)).length;
  const second = words.filter((word) => ["you", "your", "yours"].includes(word)).length;
  const third = words.filter((word) => ["he", "she", "they", "their", "them"].includes(word)).length;
  const perspective = perspectiveFrom(first, second, third);
  const hookLines = (input.sections.Hook ?? "").split(/\n+/).map((line) => line.trim().toLowerCase()).filter(Boolean);
  const uniqueHookLines = new Set(hookLines).size;
  const hookStyle = hookLines.length < 2 ? "developing" : uniqueHookLines < hookLines.length ? "repetitive" : hookLines.length <= 4 ? "minimal" : "narrative";
  const mood = stringValue(input.studioDna.mood);
  const producer = stringValue(input.studioDna.producer);
  const bpm = numberValue(input.beat.bpm);
  const previousRange = current.preferred_bpm_range;

  return {
    dominant_moods: uniqueRecent([...(current.dominant_moods ?? []), mood], 5),
    preferred_bpm_range: bpm ? [Math.min(previousRange?.[0] ?? bpm, bpm), Math.max(previousRange?.[1] ?? bpm, bpm)] : previousRange,
    average_line_length: rollingAverage(current.average_line_length, averageLineLength),
    rhyme_density: rollingAverage(current.rhyme_density, rhymeDensity),
    perspective,
    hook_style: hookStyle,
    preferred_producer_characteristics: uniqueRecent([...(current.preferred_producer_characteristics ?? []), producer], 5),
    recent_session_ids: uniqueRecent([...(current.recent_session_ids ?? []), input.sessionId], 20),
  } satisfies StudioDnaTraits;
}

function perspectiveFrom(first: number, second: number, third: number): StudioDnaTraits["perspective"] {
  const values = [first, second, third].filter((value) => value > 0);
  if (values.length > 1 && Math.max(...values) - Math.min(...values) <= 2) return "mixed";
  if (first >= second && first >= third) return "first_person";
  if (second >= third) return "second_person";
  return "third_person";
}

function rollingAverage(previous: number | undefined, next: number) {
  return previous === undefined ? next : Math.round(previous * 0.7 + next * 0.3);
}

function uniqueRecent(values: Array<string | null>, limit: number) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].slice(-limit);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
