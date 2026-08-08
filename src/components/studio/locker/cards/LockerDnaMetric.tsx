"use client";

export function LockerDnaMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-white/8 p-4 odd:border-r [&:nth-last-child(-n+2)]:border-b-0">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 truncate text-xs font-semibold text-white/85">{value}</div>
    </div>
  );
}
