"use client";

import { getProgressPct } from "@/lib/studio/format";
import { buildTakeWaveBars } from "@/lib/studio/waveform";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function TakeWaveform({
  currentTime,
  duration,
  active,
  saved,
}: {
  currentTime: number;
  duration: number;
  active: boolean;
  saved: boolean;
}) {
  const bars = useMemo(() => buildTakeWaveBars(34), []);
  const progressPct = getProgressPct(currentTime, duration);
  return (
    <div className="mt-2 flex h-6 items-center gap-[2px] overflow-hidden rounded-full bg-white/[0.04] px-1.5">
      {bars.map((height, index) => {
        const lit = (index / Math.max(1, bars.length - 1)) * 100 <= progressPct;
        return (
          <span
            key={`take-${index}`}
            className={cn(
              "w-[2px] rounded-full transition-colors",
              lit ? (saved ? "bg-emerald-300" : "bg-gold") : "bg-white/16",
              active && lit && "shadow-[0_0_8px_rgba(246,199,72,0.55)]",
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
