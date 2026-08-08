"use client";

import { LockerRemoveButton } from "@/components/studio/locker/cards/LockerRemoveButton";
import type { HookLockerRow } from "@/hooks/use-rapwriter-data";
import { formatShortDate } from "@/lib/studio/format";
import { FolderPlus } from "lucide-react";

export function LockerHookCard({ hook, onUse, onRemove }: { hook: HookLockerRow; onUse: () => void; onRemove: () => void }) {
  const lineCount = hook.content.split(/\r?\n/).filter((line) => line.trim()).length;
  return (
    <article className="rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="label-hw text-gold/75">Saved Hook</div><h2 className="mt-2 truncate text-base font-semibold">{hook.title}</h2></div><span className="shrink-0 text-[10px] text-muted-foreground">{lineCount} {lineCount === 1 ? "line" : "lines"}</span></div>
      <blockquote className="mt-3 line-clamp-3 border-l border-gold/35 pl-3 text-sm leading-relaxed text-white/76">{hook.content}</blockquote>
      <div className="mt-4 flex items-center justify-between gap-3"><div className="min-w-0 truncate text-[10px] text-muted-foreground">{hook.tags.slice(0, 2).join(" / ") || hook.source_section || formatShortDate(hook.created_at)}</div><div className="flex shrink-0 items-center gap-2"><LockerRemoveButton label={`Remove ${hook.title}`} onRemove={onRemove} /><button type="button" onClick={onUse} className="flex min-h-10 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold"><FolderPlus className="h-3.5 w-3.5" />Insert</button></div></div>
    </article>
  );
}
