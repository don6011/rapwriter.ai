"use client";

import type { RoughTakeRow } from "@/hooks/use-rapwriter-data";
import { formatDuration, formatShortDate } from "@/lib/studio/format";
import { cn } from "@/lib/utils";
import { Mic2, Pause, Play } from "lucide-react";

export function LockerVocalCard({
  take,
  songTitle,
  previewing,
  previewProgress,
  onPreview,
}: {
  take: RoughTakeRow;
  songTitle: string;
  previewing: boolean;
  previewProgress: number;
  onPreview: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#111113] p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPreview}
          className={cn(
            "relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border",
            previewing ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-300" : "border-gold/20 bg-gold/8 text-gold",
          )}
          aria-label={previewing ? `Pause ${take.section_name} vocal` : `Play ${take.section_name} vocal`}
        >
          {previewing ? <Pause className="h-4 w-4 fill-current" /> : <Mic2 className="h-4 w-4" />}
          <span className="absolute inset-x-2 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-white/15"><span className="block h-full bg-current transition-[width] duration-150" style={{ width: `${previewProgress}%` }} /></span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="label-hw text-gold/75">Saved vocal</div>
          <h2 className="mt-1.5 truncate text-sm font-semibold">{take.section_name} take</h2>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{songTitle}</p>
        </div>
        <button type="button" onClick={onPreview} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold">
          {previewing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          {previewing ? "Pause" : "Play"}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <span>{formatDuration(take.duration_seconds)}</span>
        <span>{formatShortDate(take.created_at)}</span>
      </div>
    </article>
  );
}
