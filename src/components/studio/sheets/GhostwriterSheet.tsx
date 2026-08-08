"use client";

import { ProducerPassPanel } from "@/components/studio/panels/ProducerPassPanel";
import type { WorkspaceMembership } from "@/lib/membership";
import type { EnvironmentIntelligence, ProducerActionControls, SelectedBeat, StudioDna } from "@/lib/studio/types";
import { X } from "lucide-react";
import { useEffect } from "react";

export function GhostwriterSheet({
  open,
  sectionName,
  sectionText,
  beat,
  studioDna,
  environmentIntel,
  actions,
  membership,
  onUpgrade,
  onClose,
}: {
  open: boolean;
  sectionName: string;
  sectionText: string;
  beat: SelectedBeat;
  studioDna: StudioDna;
  environmentIntel: EnvironmentIntelligence;
  actions: ProducerActionControls;
  membership: WorkspaceMembership | null;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/72 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ghostwriter-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[88svh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl border border-b-0 border-gold/22 bg-[#0d0d0e] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <div className="label-hw text-gold">Producer room</div>
            <h2 id="ghostwriter-title" className="mt-1 text-xl font-semibold">Ghostwriter</h2>
            <p className="mt-1 max-w-[19rem] text-xs leading-relaxed text-muted-foreground">Sharpen what is already on the page. Every change stays yours to accept.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close Ghostwriter">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">
          <ProducerPassPanel
            sectionName={sectionName}
            sectionText={sectionText}
            beat={beat}
            studioDna={studioDna}
            environmentIntel={environmentIntel}
            actions={actions}
            membership={membership}
            onUpgrade={onUpgrade}
          />
        </div>
      </section>
    </div>
  );
}
