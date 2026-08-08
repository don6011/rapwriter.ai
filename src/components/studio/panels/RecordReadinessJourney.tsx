"use client";

import type { RecordReadiness } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function RecordReadinessJourney({ readiness }: { readiness: RecordReadiness }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/24 p-3">
      <div className="label-hw">Record journey</div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {readiness.stages.map((stage, index) => {
          const complete = index < readiness.currentIndex || readiness.certified;
          const active = index === readiness.currentIndex && !readiness.certified;
          return (
            <div key={stage.id} className="min-w-0 text-center">
              <div
                className={cn(
                  "mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold",
                  complete
                    ? "border-emerald-400/30 bg-emerald-500/14 text-emerald-300"
                    : active
                      ? "border-gold/45 bg-gold/14 text-gold"
                      : "border-white/10 bg-white/[0.03] text-white/28",
                )}
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <div className={cn("mt-2 text-[9px] font-semibold leading-tight", active ? "text-gold" : complete ? "text-white/72" : "text-white/30")}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
