"use client";

import { ExportMetric } from "@/components/studio/primitives/ExportMetric";
import { ExportReviewRow } from "@/components/studio/primitives/ExportReviewRow";
import type { BoothExportCreateInput } from "@/hooks/use-rapwriter-data";
import type { BoothExportRecord } from "@/lib/booth-export";
import { downloadBoothFile } from "@/lib/studio/export-snapshot";
import { formatDuration } from "@/lib/studio/format";
import { mobileSections } from "@/lib/studio/sections";
import { ChevronRight, Download, FileText, LockKeyhole, Mic, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

export function BoothExportSheet({
  open,
  draft,
  exportRecord,
  status,
  error,
  premiumExports,
  onClose,
  onFreeze,
  onUpgrade,
}: {
  open: boolean;
  draft: BoothExportCreateInput | null;
  exportRecord: BoothExportRecord | null;
  status: "idle" | "saving" | "error";
  error: string | null;
  premiumExports: boolean;
  onClose: () => void;
  onFreeze: () => void;
  onUpgrade: () => void;
}) {
  const [downloading, setDownloading] = useState<"txt" | "pdf" | "zip" | "rough-take" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  if (!open || !draft) return null;
  const snapshot = exportRecord?.snapshot ?? draft.snapshot;
  const score = exportRecord?.booth_score ?? snapshot.boothReady.score;
  const readyChecks = snapshot.boothReady.checklist.filter((item) => item.complete).length;
  const missingSections = mobileSections.filter((section) => !(snapshot.sections[section.name] ?? "").trim());

  const handleDownload = async (format: "txt" | "pdf" | "zip" | "rough-take") => {
    if (!exportRecord || downloading) return;
    setDownloading(format);
    setDownloadError(null);
    try {
      await downloadBoothFile(exportRecord.id, format);
    } catch (downloadFailure) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : "RapWriter could not prepare this export.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/78 px-3 pt-12 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booth-export-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[90svh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-gold/20 bg-[#101011] shadow-[0_-28px_90px_rgba(0,0,0,0.72)] sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/18" />
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gold"><Download className="h-4 w-4" /><span className="label-hw">Booth Ready Export</span></div>
            <h2 id="booth-export-title" className="mt-2 truncate text-xl font-semibold">{draft.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Review the handoff, then freeze this exact version.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close Booth Ready export"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-gold/20 bg-gold/[0.07] py-4">
            <ExportMetric label="Booth Score" value={String(score)} />
            <ExportMetric label="Bars" value={String(snapshot.totalBars)} />
            <ExportMetric label="Ready" value={`${readyChecks}/${snapshot.boothReady.checklist.length}`} />
          </div>

          <section className="mt-3 rounded-2xl border border-white/10 bg-black/24 p-4">
            <div className="flex items-center justify-between gap-3"><span className="label-hw">Session Handoff</span>{exportRecord && <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Frozen V{exportRecord.version_number}</span>}</div>
            <div className="mt-3 space-y-2 text-xs">
              <ExportReviewRow label="Lyrics" value={missingSections.length === 0 ? "All sections included" : `${mobileSections.length - missingSections.length} of ${mobileSections.length} sections`} ready={missingSections.length === 0} />
              <ExportReviewRow label="Beat credits" value={typeof snapshot.beat.title === "string" ? snapshot.beat.title : "No beat selected"} ready={typeof snapshot.beat.title === "string"} />
              <ExportReviewRow label="Rough take" value={snapshot.roughTake ? `${formatDuration(snapshot.roughTake.durationSeconds)} attached` : "Not attached"} ready={Boolean(snapshot.roughTake)} />
              <ExportReviewRow label="Next move" value={snapshot.boothReady.nextAction || "Review the session"} ready />
            </div>
          </section>

          {!exportRecord ? (
            <>
              {error && <div className="mt-3 rounded-xl border border-rec/25 bg-rec/10 p-3 text-sm text-rec">{error}</div>}
              {premiumExports ? (
                <>
                  <button type="button" onClick={onFreeze} disabled={status === "saving"} className="gold-seal mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold disabled:opacity-55">
                    {status === "saving" ? <><RefreshCw className="h-4 w-4 animate-spin" />Freezing version...</> : <><ShieldCheck className="h-4 w-4" />Freeze Booth Version</>}
                  </button>
                  <p className="mt-2 px-2 text-center text-[10px] leading-relaxed text-muted-foreground">Later edits create a new version. This one stays unchanged.</p>
                </>
              ) : (
                <button type="button" onClick={onUpgrade} className="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-gold/30 bg-gold/8 px-4 text-left">
                  <span><span className="flex items-center gap-2 text-sm font-semibold text-gold"><LockKeyhole className="h-4 w-4" />Unlock Export Song</span><span className="mt-1 block text-[10px] text-muted-foreground">Included with RapWriter Pro.</span></span><ChevronRight className="h-4 w-4 shrink-0 text-gold" />
                </button>
              )}
            </>
          ) : (
            <div className="mt-4 space-y-2">
              {downloadError && <div className="rounded-xl border border-rec/25 bg-rec/10 p-3 text-xs text-rec">{downloadError}</div>}
              <button type="button" disabled={Boolean(downloading)} onClick={() => void handleDownload("txt")} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/85 disabled:opacity-55">
                <span className="inline-flex items-center gap-2">{downloading === "txt" ? <RefreshCw className="h-4 w-4 animate-spin text-gold" /> : <FileText className="h-4 w-4 text-gold" />}{downloading === "txt" ? "Preparing lyrics..." : "Lyrics sheet"}</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">TXT</span>
              </button>
              {premiumExports ? (
                <>
                  <button type="button" disabled={Boolean(downloading)} onClick={() => void handleDownload("pdf")} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/85 disabled:opacity-55">
                    <span className="inline-flex items-center gap-2">{downloading === "pdf" ? <RefreshCw className="h-4 w-4 animate-spin text-gold" /> : <FileText className="h-4 w-4 text-gold" />}{downloading === "pdf" ? "Preparing lyric book..." : "Studio lyric book"}</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">PDF</span>
                  </button>
                  <button type="button" disabled={Boolean(downloading)} onClick={() => void handleDownload("zip")} className="gold-seal flex min-h-13 w-full items-center justify-between rounded-xl px-4 text-sm font-semibold disabled:opacity-55">
                    <span className="inline-flex items-center gap-2">{downloading === "zip" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{downloading === "zip" ? "Preparing studio package..." : "Download studio package"}</span><span className="text-[10px] uppercase tracking-[0.12em]">ZIP</span>
                  </button>
                  {exportRecord.rough_take_id && (
                    <button type="button" disabled={Boolean(downloading)} onClick={() => void handleDownload("rough-take")} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/25 text-xs font-semibold text-gold disabled:opacity-55">{downloading === "rough-take" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}{downloading === "rough-take" ? "Preparing rough take..." : "Download rough take"}</button>
                  )}
                </>
              ) : (
                <button type="button" onClick={onUpgrade} className="mt-1 flex min-h-14 w-full items-center justify-between rounded-xl border border-gold/30 bg-gold/8 px-4 text-left">
                  <span><span className="flex items-center gap-2 text-sm font-semibold text-gold"><LockKeyhole className="h-4 w-4" />Full Studio Package</span><span className="mt-1 block text-[10px] text-muted-foreground">PDF, ZIP, credits, session data, and rough take.</span></span><ChevronRight className="h-4 w-4 shrink-0 text-gold" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
