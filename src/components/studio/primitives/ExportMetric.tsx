"use client";

export function ExportMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-2 text-center"><div className="text-xl font-semibold tabular-nums text-gold">{value}</div><div className="mt-1 truncate text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div></div>;
}
