"use client";

import { useMemo, useState } from "react";
import { Filter, Music2, UploadCloud } from "lucide-react";
import type { Beat } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type BeatWithPreview = Beat & {
  previewUrl?: string;
  audioUrl?: string;
};

type FilterMode = "needs-preview" | "ready" | "all";

function getPreview(beat: Beat) {
  const candidate = beat as BeatWithPreview;
  return candidate.previewUrl ?? candidate.audioUrl ?? "";
}

export function AdminOpsBoard({ beats }: { beats: Beat[] }) {
  const [filter, setFilter] = useState<FilterMode>("needs-preview");

  const visibleBeats = useMemo(() => {
    return beats
      .filter((beat) => {
        const ready = Boolean(getPreview(beat));
        if (filter === "ready") return ready;
        if (filter === "needs-preview") return !ready;
        return true;
      })
      .slice(0, 8);
  }, [beats, filter]);

  const readyCount = beats.filter((beat) => Boolean(getPreview(beat))).length;

  return (
    <section className="mt-5">
      <div className="panel rounded-3xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="label-hw text-gold">Preview Gaps</div>
            <h2 className="mt-2 text-2xl font-semibold">Beat asset readiness</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Approved Supabase inventory and its playable media status.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-black/24 px-4 py-3 text-right">
            <div className="text-2xl font-semibold text-gold">{readyCount}/{beats.length}</div>
            <div className="label-hw">Preview Files</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["needs-preview", "Needs Preview"],
            ["ready", "Ready"],
            ["all", "All Beats"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id as FilterMode)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold",
                filter === id ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-black/24 text-muted-foreground",
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {visibleBeats.map((beat) => {
            const preview = getPreview(beat);
            return (
              <div key={beat.id} className="grid gap-3 bg-black/18 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 font-mono text-xs text-gold">
                    {beat.glyph}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{beat.title}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {beat.producer} - {beat.region} - {beat.bpm} BPM
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {preview ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                      <Music2 className="h-3 w-3" />
                      Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/8 px-2.5 py-1 text-gold">
                      <UploadCloud className="h-3 w-3" />
                      {`beat-previews/${beat.id}.mp3`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {visibleBeats.length === 0 && (
            <div className="p-5 text-sm text-muted-foreground">No beats match this filter.</div>
          )}
        </div>
      </div>
    </section>
  );
}
