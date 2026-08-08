"use client";

import type { BoothReadyResult } from "@/lib/studio/types";

export function PerformanceRead({ performance }: { performance: BoothReadyResult["performance"] }) {
  const analysis = performance.analysis;
  if (!performance.takeExists) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/24 p-3">
        <div className="label-hw">Recording read</div>
        <p className="mt-2 text-sm text-muted-foreground">Record a rough take to unlock delivery, level, silence, and clipping feedback.</p>
      </div>
    );
  }

  if (performance.analyzing) {
    return (
      <div className="rounded-xl border border-gold/20 bg-gold/8 p-3">
        <div className="label-hw text-gold/85">Recording read</div>
        <p className="mt-2 text-sm text-white/75">Analyzing the take for delivery control and recording health...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/24 p-3">
        <div className="label-hw">Recording read</div>
        <p className="mt-2 text-sm text-muted-foreground">This take can be reviewed, but detailed performance data is not available.</p>
      </div>
    );
  }

  const reads = [
    ["Voice", analysis.vocalPresence],
    ["Control", analysis.consistency],
    ["Silence", `${analysis.silencePct}%`],
    ["Clipping", `${analysis.clippingPct}%`],
  ] as const;

  return (
    <div className="rounded-xl border border-white/10 bg-black/24 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="label-hw">Recording read</div>
        <span className="text-sm font-semibold text-gold">{analysis.deliveryScore}/100</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {reads.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/8 bg-white/[0.03] px-1.5 py-2 text-center">
            <div className="text-xs font-semibold tabular-nums text-white/85">{value}</div>
            <div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs leading-relaxed text-muted-foreground">
        {analysis.findings.map((finding) => (
          <div key={finding} className="flex gap-2">
            <span className="text-gold">+</span>
            <span>{finding}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
