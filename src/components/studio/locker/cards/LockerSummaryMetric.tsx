"use client";

export function LockerSummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 px-3 text-center first:pl-0 last:pr-0">
      <div className="text-xl font-semibold tabular-nums text-white">{value}</div>
      <div className="mt-1 truncate text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
    </div>
  );
}
