"use client";

import { PerformanceRead } from "@/components/studio/panels/PerformanceRead";
import { RecordReadinessJourney } from "@/components/studio/panels/RecordReadinessJourney";
import { BoothReadyLane } from "@/components/studio/primitives/BoothReadyLane";
import { getRecordReadiness } from "@/lib/studio/booth-ready";
import type { BoothReadyResult, EnvironmentIntelligence } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

export function BoothReadyPanel({
  result,
  environmentIntel,
  onPrimaryAction,
}: {
  result: BoothReadyResult;
  environmentIntel: EnvironmentIntelligence;
  onPrimaryAction: () => void;
}) {
  const readiness = getRecordReadiness(result);
  const metrics = [
    ["Structure", result.metrics.structure],
    ["Completion", result.metrics.completion],
    ["Cadence", result.metrics.cadence],
    ["Hook", result.metrics.hook],
    ["Originality", result.metrics.originality],
    ["Replay", result.metrics.replay],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/20 bg-gold/8 p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="label-hw text-gold/80">Record Readiness</div>
            <div className="mt-2 text-xl font-semibold text-white">{readiness.label}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-semibold text-gold">{result.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <div className={cn("rounded-full px-3 py-1 text-xs", readiness.certified ? "bg-emerald-500/14 text-emerald-300" : "bg-white/8 text-muted-foreground")}>
            {readiness.certified ? "Certified" : "In progress"}
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{readiness.detail}</p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="label-hw text-white/45">Best next action</div>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-white/88">{result.nextAction}</p>
        </div>
        <button onClick={onPrimaryAction} className="gold-seal mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
          {result.primaryActionLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <RecordReadinessJourney readiness={readiness} />

      <details className="group rounded-xl border border-white/10 bg-black/24">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-white/78">
          Why this status?
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-white/10 p-3">
          <div>
            <div className="label-hw text-gold/80">{environmentIntel.boothFocusTitle}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{environmentIntel.boothFocusBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {environmentIntel.focusMetrics.map((item) => (
                <span key={item} className="rounded-full border border-gold/20 bg-gold/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-gold">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <BoothReadyLane title="Lyrics" score={result.lyricScore} detail={result.locked ? "Draft check" : "Review active"} />
            <BoothReadyLane
              title="Performance"
              score={result.performanceScore}
              detail={result.performance.takeSaved ? "Take saved" : result.performance.takeExists ? "Take unsaved" : "No take yet"}
            />
          </div>

          <PerformanceRead performance={result.performance} />

          <div>
            <div className="label-hw">Readiness checks</div>
            <div className="mt-3 space-y-2">
              {result.checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                      item.complete ? "border-emerald-400/30 bg-emerald-500/14 text-emerald-300" : "border-white/15 bg-white/5 text-muted-foreground",
                    )}
                  >
                    {item.complete ? <Check className="h-3 w-3" /> : ""}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", item.complete ? "text-white/90" : "text-muted-foreground")}>{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums text-white/80">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>

          {result.blockers.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <div className="label-hw">Certification notes</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.blockers[0]}</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
