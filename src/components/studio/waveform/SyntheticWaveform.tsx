"use client";

import type { SelectedBeat } from "@/lib/studio/types";
import { buildSyntheticWaveBars } from "@/lib/studio/waveform";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function SyntheticWaveform({
  beat,
  progressPct,
  active,
  recording,
  compact,
}: {
  beat: SelectedBeat;
  progressPct: number;
  active: boolean;
  recording: boolean;
  compact: boolean;
}) {
  const bars = useMemo(() => buildSyntheticWaveBars(beat, compact ? 32 : 42), [beat, compact]);

  return (
    <div className={cn("mt-2 flex items-center gap-[2px] overflow-hidden rounded-full bg-white/[0.04] px-1.5", compact ? "h-4" : "h-6")}>
      {bars.map((height, index) => {
        const lit = (index / Math.max(1, bars.length - 1)) * 100 <= progressPct;
        return (
          <span
            key={`${beat.id}-${index}`}
            className={cn(
              "w-[2px] rounded-full transition-colors",
              lit ? (recording ? "bg-rec" : "bg-gold") : "bg-white/16",
              active && lit && "shadow-[0_0_8px_rgba(246,199,72,0.55)]",
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
