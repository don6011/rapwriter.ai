"use client";

import { formatDuration, getProgressPct } from "@/lib/studio/format";
import { buildTakeWaveBars } from "@/lib/studio/waveform";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function TakeWaveform({
  currentTime,
  duration,
  active,
  saved,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  active: boolean;
  saved: boolean;
  onSeek?: (seconds: number) => void;
}) {
  const bars = useMemo(() => buildTakeWaveBars(34), []);
  const progressPct = getProgressPct(currentTime, duration);
  const seekFromPointer = (clientX: number, target: HTMLInputElement) => {
    if (!onSeek || duration <= 0) return;
    const bounds = target.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="relative mt-2 h-6 overflow-hidden rounded-full bg-white/[0.04]">
      <div className="flex h-full items-center gap-[2px] px-1.5">
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
      {onSeek && duration > 0 && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 z-[1] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/60",
              saved ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.55)]" : "bg-gold shadow-[0_0_10px_rgba(246,199,72,0.65)]",
            )}
            style={{ left: `${progressPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={Math.min(currentTime, duration)}
            onChange={(event) => onSeek(Number(event.target.value))}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              seekFromPointer(event.clientX, event.currentTarget);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFromPointer(event.clientX, event.currentTarget);
            }}
            onPointerUp={(event) => {
              seekFromPointer(event.clientX, event.currentTarget);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            aria-label="Seek rough take"
            aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [touch-action:none]"
          />
        </>
      )}
    </div>
  );
}
