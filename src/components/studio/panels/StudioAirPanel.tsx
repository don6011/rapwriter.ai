"use client";

import type { StudioPack } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Pause, Play, Volume2 } from "lucide-react";

export function StudioAirPanel({
  studioPack,
  activeIndex,
  playing,
  volume,
  onToggle,
  onVolume,
}: {
  studioPack: StudioPack;
  activeIndex: number;
  playing: boolean;
  volume: number;
  onToggle: (index: number) => void;
  onVolume: (volume: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/20 bg-gold/8 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="label-hw text-gold/85">{studioPack.label}</div>
          <span className={cn("rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]", playing ? "bg-emerald-400/12 text-emerald-300" : "bg-white/8 text-muted-foreground")}>{playing ? "On" : "Off"}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/72">Sound under the beat. Quiet enough to keep the writing in focus.</p>
      </div>
      <div className="space-y-2">
        {studioPack.ambience.map((item, index) => (
          <button
            type="button"
            key={item.title}
            onClick={() => onToggle(index)}
            aria-pressed={playing && activeIndex === index}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-3 text-left",
              playing && activeIndex === index ? "border-gold/35 bg-gold/8" : "border-white/10 bg-black/24",
            )}
          >
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/20 bg-gold/10 text-[11px] font-semibold text-gold">
              {playing && activeIndex === index ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/24 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
            <Volume2 className="h-4 w-4 text-gold" /> Room level
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{volume}%</span>
        </div>
        <input
          type="range"
          min="4"
          max="32"
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          className="mt-3 h-1.5 w-full accent-[var(--amber)]"
          aria-label="Studio ambience volume"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Your choice is remembered with this session. Studio Air stays off after refresh and pauses before recording.</p>
      </div>
    </div>
  );
}
