"use client";

import { mobileSections } from "@/lib/studio/sections";
import type { PadActionStatus, SelectedBeat } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { ChevronRight, X } from "lucide-react";

export function NewSongSheet({
  open,
  title,
  startSection,
  useCurrentBeat,
  beat,
  projectTitle,
  status,
  onTitle,
  onStartSection,
  onUseCurrentBeat,
  onClose,
  onCreate,
}: {
  open: boolean;
  title: string;
  startSection: string;
  useCurrentBeat: boolean;
  beat: SelectedBeat;
  projectTitle: string | null;
  status: PadActionStatus;
  onTitle: (value: string) => void;
  onStartSection: (value: string) => void;
  onUseCurrentBeat: (value: boolean) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-3xl border border-white/10 bg-[#111113] p-5 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label-hw text-gold/85">New Song</div>
            <h2 className="mt-2 text-2xl font-semibold">Set the session.</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close new song">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-5 block">
          <span className="label-hw">Song title</span>
          <input
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            maxLength={160}
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-semibold outline-none placeholder:text-white/30"
            placeholder="Untitled Draft"
            autoFocus
          />
        </label>

        {projectTitle && <div className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2 text-xs text-gold">Adding to <span className="font-semibold">{projectTitle}</span></div>}

        <div className="mt-5">
          <div className="label-hw">Start writing in</div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [overscroll-behavior-x:contain] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
            {mobileSections.slice(0, 4).map((item) => (
              <button
                key={item.name}
                onClick={() => onStartSection(item.name)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold",
                  startSection === item.name ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onUseCurrentBeat(!useCurrentBeat)}
          className={cn(
            "mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left",
            useCurrentBeat ? "border-gold/30 bg-gold/8" : "border-white/10 bg-black/24",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold">{useCurrentBeat ? "Current beat attached" : "Start without beat"}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {useCurrentBeat ? `${beat.title} - ${beat.producer ?? "Selected beat"}` : "You can attach a beat later."}
            </div>
          </div>
          <span className={cn("h-6 w-11 rounded-full border p-0.5 transition-colors", useCurrentBeat ? "border-gold/40 bg-gold/30" : "border-white/10 bg-white/5")}>
            <span className={cn("block h-5 w-5 rounded-full bg-white transition-transform", useCurrentBeat && "translate-x-5 bg-gold")} />
          </span>
        </button>

        {status.message && status.state === "error" && <div className="mt-3 rounded-xl border border-rec/25 bg-rec/10 p-3 text-sm text-rec">{status.message}</div>}

        <button
          onClick={onCreate}
          disabled={status.state === "saving"}
          className="gold-seal mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          {status.state === "saving" ? "Creating..." : "Create Song"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
