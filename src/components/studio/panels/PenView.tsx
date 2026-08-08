"use client";

import { analyzePenLines } from "@/lib/studio/prosody";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { useMemo } from "react";

export function PenView({ sectionName, text }: { sectionName: string; text: string }) {
  const analysis = useMemo(() => analyzePenLines(text), [text]);
  const rhymeGroups = useMemo(() => {
    const groups = new Map<string, string>();
    let groupIndex = 0;
    for (const line of analysis.lines) {
      if (!line.rhymeKey || line.rhymeCount < 2 || groups.has(line.rhymeKey)) continue;
      groups.set(line.rhymeKey, String.fromCharCode(65 + (groupIndex % 26)));
      groupIndex += 1;
    }
    return groups;
  }, [analysis.lines]);

  if (!analysis.lines.length) {
    return (
      <div className="grid min-h-[54svh] place-items-center bg-white/[0.012] px-8 text-center">
        <div>
          <Pencil className="mx-auto h-5 w-5 text-gold" />
          <div className="mt-3 text-sm font-semibold">Write a few lines first.</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Pen View will map line endings, syllables, and rhyme connections without changing your lyrics.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-[54svh] overflow-hidden bg-white/[0.012]" aria-label={`${sectionName} Pen View analysis`}>
      <div className="flex items-center justify-between border-b border-white/8 bg-black/18 px-4 py-3 backdrop-blur-lg">
        <div>
          <div className="label-hw text-gold/80">Pen View</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/38">Matching endings / syllables</div>
        </div>
        <div className="text-right text-[10px] text-white/45">
          <div>{analysis.totalSyllables} syllables</div>
          <div className="mt-1">{rhymeGroups.size} rhyme groups</div>
        </div>
      </div>
      <ol className="divide-y divide-white/[0.06] px-2 py-2">
        {analysis.lines.map((line) => {
          const group = line.rhymeKey ? rhymeGroups.get(line.rhymeKey) : undefined;
          const endingMatch = line.text.match(/([A-Za-z0-9']+)([^A-Za-z0-9']*)$/);
          const endingStart = endingMatch?.index ?? line.text.length;
          return (
            <li key={`${line.number}-${line.text}`} className="grid grid-cols-[1.75rem_1fr_auto] gap-2 rounded-lg px-2 py-3">
              <span className="pt-1 text-right font-mono text-[10px] tabular-nums text-white/28">{line.number}</span>
              <p className="min-w-0 whitespace-pre-wrap font-sans text-[16px] leading-7 text-white/88">
                {line.text.slice(0, endingStart)}
                {endingMatch ? (
                  <span className={cn("font-semibold", group ? "text-gold" : "text-white/82")}>
                    {endingMatch[1]}
                    {endingMatch[2]}
                  </span>
                ) : null}
              </p>
              <div className="flex min-w-8 flex-col items-end gap-1 pt-1">
                {group ? <span className="grid h-5 w-5 place-items-center rounded-full border border-gold/35 bg-gold/10 text-[9px] font-bold text-gold">{group}</span> : null}
                <span className="text-[9px] tabular-nums text-white/32">{line.syllables} syl</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
