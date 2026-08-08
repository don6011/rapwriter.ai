"use client";

import type { RoughTakeRow } from "@/hooks/use-rapwriter-data";
import type { BoothExportSnapshot } from "@/lib/booth-export";
import type { BoothReadyResult } from "@/lib/studio/types";

export function buildBoothExportSnapshot({
  projectTitle,
  artistName,
  activeSection,
  sections,
  beat,
  boothReady,
  completionPct,
  totalBars,
  roughTake,
}: {
  projectTitle: string;
  artistName: string;
  activeSection: string;
  sections: Record<string, string>;
  beat: Record<string, unknown>;
  boothReady: BoothReadyResult;
  completionPct: number;
  totalBars: number;
  roughTake: RoughTakeRow | null;
}): BoothExportSnapshot {
  return {
    projectTitle,
    artistName,
    activeSection,
    sections: { ...sections },
    beat: { ...beat },
    boothReady: {
      score: boothReady.score,
      lyricScore: boothReady.lyricScore,
      performanceScore: boothReady.performanceScore,
      nextAction: boothReady.nextAction,
      checklist: boothReady.checklist.map((item) => ({ ...item })),
      improvements: [...boothReady.improvements],
      metrics: { ...boothReady.metrics },
    },
    completionPct,
    totalBars,
    roughTake: roughTake ? {
      id: roughTake.id,
      sectionName: roughTake.section_name,
      durationSeconds: roughTake.duration_seconds,
      analysis: roughTake.analysis,
    } : null,
  };
}

export function downloadBoothFile(id: string, format: "txt" | "pdf" | "zip" | "rough-take") {
  const anchor = document.createElement("a");
  anchor.href = format === "rough-take" ? `/api/booth-exports/${encodeURIComponent(id)}/rough-take` : `/api/booth-exports/${encodeURIComponent(id)}?format=${format}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
