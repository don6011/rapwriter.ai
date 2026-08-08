"use client";

import { formatShortDate } from "@/lib/studio/format";
import type { ProductUnlock } from "@/lib/studio/types";
import { Check } from "lucide-react";

export function LockerOwnedCard({ unlock }: { unlock: ProductUnlock }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8"><Check className="h-4 w-4 text-gold" /></div>
      <div className="min-w-0 flex-1"><div className="label-hw text-gold/70">{unlock.category}</div><div className="mt-1 truncate text-sm font-semibold">{unlock.title}</div><div className="mt-1 text-[10px] text-muted-foreground">Owned since {formatShortDate(unlock.unlockedAt)}</div></div>
      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Owned</span>
    </article>
  );
}
