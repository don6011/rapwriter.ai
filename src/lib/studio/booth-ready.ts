import { analyzeLyrics, type LyricAnalysis, type RoughTakeAnalysis } from "@/lib/booth-ready-v2";
import { countBars } from "@/lib/studio/bars";
import type { BoothReadyResult, RecordReadiness, RecordReadinessStage } from "@/lib/studio/types";

export function scoreBoothReady(
  sections: Record<string, string>,
  completionPct: number,
  lyricAnalysis: LyricAnalysis,
  performanceInput: {
    activeSection: string;
    roughTakeDuration: number;
    roughTakeSaved: boolean;
    roughTakeSection: string | null;
    roughTakeExists: boolean;
    roughTakeAnalyzing: boolean;
    roughTakeAnalysis: RoughTakeAnalysis | null;
  },
): BoothReadyResult {
  const hookBars = countBars(sections.Hook);
  const verse1Bars = countBars(sections["Verse 1"]);
  const verse2Bars = countBars(sections["Verse 2"]);
  const bridgeBars = countBars(sections.Bridge);

  const structure = clampScore(
    (hookBars >= 4 ? 24 : hookBars * 6) +
      (verse1Bars >= 12 ? 34 : verse1Bars * 2.8) +
      (verse2Bars >= 8 ? 22 : verse2Bars * 2.7) +
      (bridgeBars > 0 ? 10 : 0) +
      (countBars(sections.Outro) > 0 ? 10 : 0),
  );
  const completion = clampScore(completionPct);
  const evidenceMultiplier = 0.35 + (lyricAnalysis.analysisConfidence / 100) * 0.65;
  const cadence = clampScore(lyricAnalysis.cadenceConsistency * evidenceMultiplier);
  const hook = clampScore((Math.min(25, hookBars * 3.125) + lyricAnalysis.hookReplay * 0.75) * evidenceMultiplier);
  const diversityShape = clampScore(100 - Math.abs(lyricAnalysis.uniqueWordPct - 72) * 1.8 - lyricAnalysis.fillerPct * 1.5);
  const originalityEvidenceCap = Math.round(30 + (lyricAnalysis.analysisConfidence / 100) * 55);
  const originality = Math.min(85, originalityEvidenceCap, diversityShape);
  const replay = clampScore((lyricAnalysis.hookReplay * 0.75 + lyricAnalysis.endRhymePct * 0.25) * evidenceMultiplier);
  const lyricScore = clampScore(structure * 0.2 + completion * 0.24 + cadence * 0.14 + hook * 0.18 + originality * 0.12 + replay * 0.12);
  const takeExists = performanceInput.roughTakeExists;
  const takeSaved = performanceInput.roughTakeSaved;
  const sectionMatched = !performanceInput.roughTakeSection || performanceInput.roughTakeSection === performanceInput.activeSection;
  const durationScore = clampScore((performanceInput.roughTakeDuration / 60) * 100);
  const audioAnalysis = performanceInput.roughTakeAnalysis;
  const performanceScore = audioAnalysis
    ? clampScore(
        audioAnalysis.deliveryScore * 0.55 +
          audioAnalysis.vocalPresence * 0.15 +
          audioAnalysis.consistency * 0.15 +
          (takeSaved ? 10 : 3) +
          (sectionMatched ? 5 : 1),
      )
    : clampScore((takeExists ? 25 : 0) + (takeSaved ? 20 : 0) + (sectionMatched ? 10 : 4) + durationScore * 0.25);
  const score = clampScore(lyricScore * 0.72 + performanceScore * 0.28);

  const blockers: string[] = [];
  if (hookBars < 4) blockers.push("Hook needs at least 4 strong bars.");
  if (verse1Bars < 12) blockers.push("Verse 1 needs more complete thought and momentum.");
  if (completionPct < 45) blockers.push("Song needs more sections before a booth check.");
  if (cadence < 45) blockers.push("Line lengths are uneven; tighten the flow.");
  if (lyricAnalysis.endRhymePct < 30 && lyricAnalysis.totalLines >= 4) blockers.push("More line endings need to connect through rhyme.");
  if (lyricAnalysis.hookReplay < 45 && hookBars >= 4) blockers.push("The hook needs one repeatable anchor phrase.");
  if (!takeExists && completionPct >= 45) blockers.push(`Record a rough take for ${performanceInput.activeSection}.`);
  if (takeExists && !takeSaved) blockers.push("Save the rough take so it stays attached to the session.");
  if (takeSaved && performanceInput.roughTakeDuration < 20) blockers.push("Record a longer take to judge delivery.");
  if (audioAnalysis && audioAnalysis.deliveryScore < 75) blockers.push(...audioAnalysis.findings);

  const locked = completionPct < 45 || hookBars < 4 || verse1Bars < 8;
  const nextAction = locked
    ? blockers[0] ?? "Keep writing to unlock Booth Ready."
    : !takeExists
      ? `Record a rough take for ${performanceInput.activeSection}.`
      : !takeSaved
        ? "Save the rough take so Booth Ready can remember it."
        : score >= 75
      ? "Booth Ready certified. Rehearse once more, then prepare the studio handoff."
      : blockers[0] ?? "Strengthen the hook or finish another section.";
  const primaryAction: BoothReadyResult["primaryAction"] = locked
    ? "write"
    : !takeExists
      ? "record"
      : !takeSaved
        ? "save_take"
        : "review";
  const primaryActionLabel =
    primaryAction === "record"
      ? `Record ${performanceInput.activeSection}`
      : primaryAction === "save_take"
        ? "Keep Rough Take"
        : primaryAction === "review"
          ? score >= 75
            ? "Prepare for Booth"
            : "Open Producer Pass"
          : hookBars < 4
            ? `Write ${Math.max(1, 4 - hookBars)} Hook Bars`
            : `Write ${Math.max(1, 12 - verse1Bars)} Verse Bars`;
  const lockedReason = locked ? blockers[0] ?? "Keep writing to unlock Booth Ready." : "Booth Ready preview is unlocked.";
  const checklist = [
    {
      label: "Hook foundation",
      detail: hookBars >= 4 ? `${hookBars} hook bars drafted.` : `${Math.max(1, 4 - hookBars)} more hook bars needed.`,
      complete: hookBars >= 4,
    },
    {
      label: "Verse 1 momentum",
      detail: verse1Bars >= 12 ? `${verse1Bars} verse bars drafted.` : `${Math.max(1, 12 - verse1Bars)} more verse bars needed.`,
      complete: verse1Bars >= 12,
    },
    {
      label: "Song completion",
      detail: completionPct >= 45 ? `${completionPct}% complete.` : `Reach 45% completion. Current: ${completionPct}%.`,
      complete: completionPct >= 45,
    },
    {
      label: "Rough take",
      detail: takeSaved ? "Saved to this session." : takeExists ? "Recorded, but not kept yet." : "Record a take to judge delivery.",
      complete: takeSaved,
    },
    {
      label: "Cadence control",
      detail: cadence >= 55 ? "Line lengths are in a usable pocket." : "Tighten line length before recording.",
      complete: cadence >= 55,
    },
  ];
  const improvements = [
    hookBars >= 4 ? `Hook structure unlocked at ${hookBars} bars.` : `Hook is forming: ${hookBars}/4 unlock bars.`,
    lyricAnalysis.actions[0] ?? (verse1Bars >= 8 ? "Verse 1 has enough shape to evaluate." : `Verse 1 needs ${Math.max(1, 8 - verse1Bars)} more bars before scoring opens up.`),
    audioAnalysis
      ? `Delivery analysis is active at ${audioAnalysis.deliveryScore}/100.`
      : takeSaved
        ? "The take is saved; record a fresh pass to add detailed delivery analysis."
        : takeExists
          ? "Rough take recorded. Save it to keep performance progress."
          : "Lyrics are being scored; performance unlocks after a rough take.",
  ];

  return {
    score,
    lyricScore,
    performanceScore,
    locked,
    nextAction,
    primaryAction,
    primaryActionLabel,
    lockedReason,
    checklist,
    improvements,
    metrics: { structure, completion, cadence, hook, originality, replay },
    performance: {
      takeExists,
      takeSaved,
      duration: performanceInput.roughTakeDuration,
      sectionMatched,
      analyzing: performanceInput.roughTakeAnalyzing,
      analysis: audioAnalysis,
    },
    lyricAnalysis,
    blockers: [...new Set(blockers)].slice(0, 5),
  };
}

export function boothReadyFromLockerSnapshot(snapshot: Record<string, unknown>, sections: Record<string, string>, completionPct: number) {
  const analysis = analyzeLyrics(sections);
  const fallback = scoreBoothReady(sections, completionPct, analysis, {
    activeSection: "Hook",
    roughTakeDuration: 0,
    roughTakeSaved: false,
    roughTakeSection: null,
    roughTakeExists: false,
    roughTakeAnalyzing: false,
    roughTakeAnalysis: null,
  });
  const stored = snapshot.boothReady;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fallback;
  const record = stored as Record<string, unknown>;
  const number = (key: string, current: number) => typeof record[key] === "number" && Number.isFinite(record[key]) ? clampScore(record[key] as number) : current;
  const string = (key: string, current: string) => typeof record[key] === "string" ? (record[key] as string).slice(0, 300) : current;
  const checklist = Array.isArray(record.checklist)
    ? record.checklist.filter((item): item is { label: string; detail: string; complete: boolean } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).label === "string" && typeof (item as Record<string, unknown>).detail === "string" && typeof (item as Record<string, unknown>).complete === "boolean")).slice(0, 12)
    : fallback.checklist;
  const improvements = Array.isArray(record.improvements) ? record.improvements.filter((item): item is string => typeof item === "string").slice(0, 12) : fallback.improvements;
  return {
    ...fallback,
    score: fallback.score,
    lyricScore: fallback.lyricScore,
    performanceScore: number("performanceScore", fallback.performanceScore),
    nextAction: string("nextAction", fallback.nextAction),
    checklist,
    improvements,
    metrics: fallback.metrics,
  };
}

export function getRecordReadiness(result: BoothReadyResult): RecordReadiness {
  const stages: RecordReadinessStage[] = [
    { id: "draft", label: "Draft" },
    { id: "session_ready", label: "Session Ready" },
    { id: "producer_pass", label: "Producer Pass" },
    { id: "booth_ready", label: "Booth Ready" },
  ];
  const sessionReady = !result.locked && result.metrics.completion >= 45;
  const producerPassReady =
    sessionReady &&
    result.lyricScore >= 55 &&
    result.metrics.structure >= 55 &&
    result.metrics.hook >= 45;
  const certified =
    producerPassReady &&
    result.score >= 75 &&
    result.metrics.completion >= 75 &&
    result.metrics.cadence >= 55 &&
    result.performance.takeSaved;
  const currentIndex = certified ? 3 : producerPassReady ? 2 : sessionReady ? 1 : 0;

  if (certified) {
    return {
      currentIndex,
      label: "Booth Ready Certified",
      detail: "The record has cleared its core writing, structure, cadence, and rough-take checks.",
      stages,
      certified,
    };
  }
  if (producerPassReady) {
    return {
      currentIndex,
      label: "Producer Pass",
      detail: "The song is built. Resolve the highest-impact lyric or performance note before certification.",
      stages,
      certified,
    };
  }
  if (sessionReady) {
    return {
      currentIndex,
      label: "Session Ready",
      detail: "The structure is ready for rehearsal. Record a rough take and listen for what the page cannot reveal.",
      stages,
      certified,
    };
  }
  return {
    currentIndex,
    label: "Draft",
    detail: "Build the hook and first verse until the record has enough structure for a meaningful review.",
    stages,
    certified,
  };
}

export function getSongState(completionPct: number, boothScore: number): { label: string; tone: "muted" | "gold" | "green" } {
  if (completionPct >= 75 && boothScore >= 70) return { label: "Booth Ready", tone: "green" };
  if (completionPct >= 55) return { label: "Session Ready", tone: "gold" };
  if (completionPct >= 18) return { label: "Draft", tone: "gold" };
  return { label: "Idea", tone: "muted" };
}

export function isRoughTakeAnalysis(value: unknown): value is RoughTakeAnalysis {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RoughTakeAnalysis>;
  return (
    candidate.version === "booth-ready-v2" &&
    typeof candidate.deliveryScore === "number" &&
    typeof candidate.vocalPresence === "number" &&
    typeof candidate.consistency === "number" &&
    Array.isArray(candidate.findings)
  );
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}
