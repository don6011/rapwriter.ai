"use client";

import { StudioAirPanel } from "@/components/studio/panels/StudioAirPanel";
import type { StudioPack } from "@/lib/studio/types";
import { X } from "lucide-react";

export function StudioAirSheet({
  open,
  studioPack,
  activeIndex,
  playing,
  volume,
  onClose,
  onToggle,
  onVolume,
}: {
  open: boolean;
  studioPack: StudioPack;
  activeIndex: number;
  playing: boolean;
  volume: number;
  onClose: () => void;
  onToggle: (index: number) => void;
  onVolume: (volume: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Room ambience"
        className="max-h-[72svh] w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="label-hw text-gold/85">Room Ambience</div>
            <h2 className="mt-2 text-2xl font-semibold">Set the room.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Optional atmosphere for focus. The beat and lyrics stay in control.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close room ambience">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(72svh-8rem)] overflow-y-auto p-4">
          <StudioAirPanel
            studioPack={studioPack}
            activeIndex={activeIndex}
            playing={playing}
            volume={volume}
            onToggle={onToggle}
            onVolume={onVolume}
          />
        </div>
      </section>
    </div>
  );
}
