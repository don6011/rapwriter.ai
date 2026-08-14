"use client";

import { ChevronRight, History, X } from "lucide-react";

export function RevisionHistoryUpgradeSheet({ open, onClose, onUpgrade }: { open: boolean; onClose: () => void; onUpgrade: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/72 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-history-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-[430px] rounded-t-2xl border border-b-0 border-gold/22 bg-[#0d0d0e] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
              <History className="h-4 w-4" />
            </span>
            <div>
              <div className="label-hw text-gold">Revision history</div>
              <h2 id="revision-history-title" className="mt-1 text-xl font-semibold">Keep every good version.</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close revision history upgrade">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Compare revisions and bring back an earlier verse without losing the one you are writing now.</p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onUpgrade();
          }}
          className="mt-5 flex min-h-12 w-full items-center justify-between rounded-xl bg-gold px-4 text-sm font-semibold text-black transition-colors hover:bg-gold/90"
        >
          Upgrade to Pro - $7.99/mo
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="mt-2 min-h-10 w-full text-sm font-medium text-muted-foreground transition-colors hover:text-white">
          Not now
        </button>
      </section>
    </div>
  );
}
