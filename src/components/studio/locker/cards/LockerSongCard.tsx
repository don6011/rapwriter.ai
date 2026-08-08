"use client";

import { LockerRemoveButton } from "@/components/studio/locker/cards/LockerRemoveButton";
import type { RoughTakeRow, SongLockerRow } from "@/hooks/use-rapwriter-data";
import { formatDuration, formatShortDate } from "@/lib/studio/format";
import { lockerSnapshotNumber, lockerSongProgress } from "@/lib/studio/locker-snapshot";
import { cn } from "@/lib/utils";
import { ChevronDown, FileText, Mic, Play } from "lucide-react";
import { useState } from "react";

export function LockerSongCard({ song, takes, live, onResume, onPrepare, onRemove }: { song: SongLockerRow; takes: RoughTakeRow[]; live: boolean; onResume: () => void; onPrepare: () => void; onRemove: () => void }) {
  const progress = lockerSongProgress(song);
  const bars = lockerSnapshotNumber(song.snapshot, "totalBars", "total_bars");
  const [takesOpen, setTakesOpen] = useState(false);
  return (
    <article className="rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="label-hw text-gold/75">Song</span>{live && <span className="rounded-full bg-emerald-400/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Live</span>}</div>
          <h2 className="mt-2 truncate text-base font-semibold">{song.title}</h2>
          <div className="mt-1 text-[11px] text-muted-foreground">{bars !== null ? `${bars} bars / ` : ""}Saved {formatShortDate(song.updated_at || song.created_at)}</div>
        </div>
        <span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]", song.booth_ready ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300" : "border-gold/20 bg-gold/8 text-gold")}>{song.booth_ready ? "Booth Ready" : "Draft"}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="min-w-0 flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} /></div><div className="mt-1.5 text-[10px] text-muted-foreground">{progress}% written</div></div>
        <div className="flex shrink-0 items-center gap-2"><LockerRemoveButton label={`Remove ${song.title}`} onRemove={onRemove} /><button type="button" onClick={onPrepare} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/68 transition-colors hover:border-gold/25 hover:text-gold" aria-label={`Prepare ${song.title} for Booth`} title="Prepare for Booth"><FileText className="h-4 w-4" /></button><button type="button" onClick={onResume} className="flex min-h-10 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold"><Play className="h-3.5 w-3.5 fill-current" />Resume</button></div>
      </div>
      {takes.length > 0 && (
        <div className="mt-3 border-t border-white/8 pt-3">
          <button type="button" onClick={() => setTakesOpen((current) => !current)} className="flex min-h-9 w-full items-center justify-between gap-3 text-left" aria-expanded={takesOpen}>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/68"><Mic className="h-3.5 w-3.5 text-gold" />{takes.length} saved {takes.length === 1 ? "take" : "takes"}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", takesOpen && "rotate-180")} />
          </button>
          {takesOpen && (
            <div className="mt-2 space-y-2">
              {takes.slice(0, 3).map((take, index) => (
                <div key={take.id} className="rounded-xl border border-white/8 bg-black/24 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                    <span>{index === 0 ? "Latest" : formatShortDate(take.created_at)} / {take.section_name}</span>
                    <span className="tabular-nums">{formatDuration(take.duration_seconds)}</span>
                  </div>
                  <audio controls preload="none" src={take.signed_url} className="h-9 w-full" />
                </div>
              ))}
              {takes.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">Showing the 3 newest takes.</div>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
