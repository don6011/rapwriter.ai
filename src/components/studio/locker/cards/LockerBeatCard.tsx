"use client";

import { LockerRemoveButton } from "@/components/studio/locker/cards/LockerRemoveButton";
import type { BeatLockerRow } from "@/hooks/use-rapwriter-data";
import { lockerBeatArt } from "@/lib/studio/locker-snapshot";
import { Headphones, Play } from "lucide-react";

export function LockerBeatCard({ beat, onUse, onRemove }: { beat: BeatLockerRow; onUse: () => void; onRemove: () => void }) {
  const favorite = beat.license?.toLowerCase() === "favorite";
  return (
    <article className="rounded-2xl border border-white/10 bg-[#111113] p-3">
      <div className="flex gap-3">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/20" style={{ background: lockerBeatArt(beat) }}><Headphones className="h-5 w-5 text-gold" /><div className="absolute inset-x-2 bottom-2 h-0.5 rounded-full bg-gold/65" /></div>
        <div className="min-w-0 flex-1 py-1"><div className="flex items-center justify-between gap-2"><span className="label-hw text-gold/75">{favorite ? "Favorite" : beat.license || "Saved Beat"}</span>{beat.price !== null && beat.price > 0 && <span className="text-[10px] text-muted-foreground">${beat.price}</span>}</div><h2 className="mt-2 truncate text-base font-semibold">{beat.title}</h2><div className="mt-1 truncate text-[11px] text-muted-foreground">{beat.producer || "Independent producer"}</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3"><div className="min-w-0 truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{[beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key, beat.mood].filter(Boolean).join(" / ")}</div><div className="flex shrink-0 items-center gap-2"><LockerRemoveButton label={`Remove ${beat.title}`} onRemove={onRemove} /><button type="button" onClick={onUse} className="flex min-h-10 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold"><Play className="h-3.5 w-3.5 fill-current" />Load</button></div></div>
    </article>
  );
}
