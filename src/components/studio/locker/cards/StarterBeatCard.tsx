"use client";

import type { StarterBeat } from "@/lib/starter-beats";
import { formatDuration } from "@/lib/studio/format";
import { starterBeatArt } from "@/lib/studio/locker-snapshot";
import { Headphones, Play } from "lucide-react";

export function StarterBeatCard({ beat, onUse }: { beat: StarterBeat; onUse: () => void }) {
  return (
    <article className="rounded-2xl border border-gold/20 bg-[#111113] p-3">
      <div className="flex gap-3">
        <div
          className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/25 bg-cover bg-center"
          style={{ background: starterBeatArt(beat) }}
        >
          <Headphones className="h-5 w-5 text-gold" />
          <div className="absolute inset-x-2 bottom-2 h-0.5 rounded-full bg-gold/70" />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="label-hw text-gold/80">{beat.collection ?? "RapWriter Originals"}</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">{beat.featured ? "Featured" : "Included"}</span>
          </div>
          <h2 className="mt-2 truncate text-base font-semibold">{beat.title}</h2>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{beat.producer}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
        <div className="min-w-0 truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null, formatDuration(beat.duration)].filter(Boolean).join(" / ")}
        </div>
        <button type="button" onClick={onUse} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold">
          <Play className="h-3.5 w-3.5 fill-current" />Load
        </button>
      </div>
    </article>
  );
}
