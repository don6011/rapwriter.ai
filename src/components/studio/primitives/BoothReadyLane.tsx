"use client";

export function BoothReadyLane({ title, score, detail }: { title: string; score: number; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/24 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="label-hw">{title}</div>
        <div className="text-sm font-semibold text-gold">{score}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gold" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
