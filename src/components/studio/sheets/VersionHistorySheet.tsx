"use client";

import { formatVersionTime, versionSourceLabel } from "@/lib/studio/format";
import type { SectionVersion, VersionHistoryStatus } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { History, RefreshCw, X } from "lucide-react";

export function VersionHistorySheet({
  open,
  sectionName,
  currentContent,
  versions,
  status,
  error,
  onClose,
  onRestore,
}: {
  open: boolean;
  sectionName: string;
  currentContent: string;
  versions: SectionVersion[];
  status: VersionHistoryStatus;
  error: string | null;
  onClose: () => void;
  onRestore: (versionId: string) => void;
}) {
  if (!open) return null;

  const visibleVersions = versions.filter((version, index) => index === 0 || version.content !== versions[index - 1].content);
  const restoring = status === "restoring";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/72 px-3 pb-3 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        className="flex max-h-[82svh] w-full max-w-[430px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.58)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gold/85">
              <History className="h-4 w-4" />
              <span className="label-hw">Revision History</span>
            </div>
            <h2 id="version-history-title" className="mt-2 truncate text-xl font-semibold">{sectionName} snapshots</h2>
            <p className="mt-1 text-xs text-muted-foreground">Restoring keeps your current draft in history.</p>
          </div>
          <button type="button" onClick={onClose} disabled={restoring} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close revision history">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {status === "loading" && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin text-gold" />
              <span className="text-sm">Loading snapshots...</span>
            </div>
          )}

          {error && status !== "loading" && (
            <div className="rounded-2xl border border-rec/25 bg-rec/10 p-4 text-sm leading-relaxed text-rec">{error}</div>
          )}

          {status === "ready" && !error && visibleVersions.length === 0 && (
            <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
              <History className="h-6 w-6 text-gold/65" />
              <div className="mt-3 text-sm font-semibold">No earlier snapshots yet</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">History begins after the next synced change.</p>
            </div>
          )}

          {visibleVersions.length > 0 && (
            <div className="space-y-2">
              {visibleVersions.map((version) => {
                const isCurrent = version.content === currentContent;
                return (
                  <article key={version.id} className={cn("rounded-2xl border p-3", isCurrent ? "border-emerald-400/25 bg-emerald-500/[0.06]" : "border-white/10 bg-black/24")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-white/90">{versionSourceLabel(version.source)}</span>
                          {isCurrent && <span className="rounded-full bg-emerald-500/14 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Current</span>}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {formatVersionTime(version.created_at)} - {version.bar_count} bars - {version.word_count} words
                        </div>
                      </div>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => onRestore(version.id)}
                          disabled={restoring}
                          className="min-h-9 shrink-0 rounded-xl border border-gold/30 bg-gold/8 px-3 text-xs font-semibold text-gold disabled:opacity-45"
                        >
                          {restoring ? "Restoring..." : "Restore"}
                        </button>
                      )}
                    </div>
                    <pre className="mt-3 max-h-20 overflow-hidden whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/65">{version.content || "Empty section"}</pre>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
