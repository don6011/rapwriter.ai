"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function StudioDnaChoice({
  title,
  value,
  options,
  onSelect,
}: {
  title: string;
  value: string;
  options: Array<{ value: string; label: string; locked?: boolean }>;
  onSelect: (value: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollControls = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollBack(rail.scrollLeft > 4);
    setCanScrollForward(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollControls();
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(updateScrollControls);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [options.length, updateScrollControls]);

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(160, rail.clientWidth * 0.72), behavior: "smooth" });
  }

  return (
    <div className="mt-4 first:mt-0">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <div className="label-hw">{title}</div>
        {(canScrollBack || canScrollForward) && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => scroll(-1)} disabled={!canScrollBack} className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-gold transition-colors disabled:text-white/18" aria-label={`Show previous ${title.toLowerCase()} options`}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => scroll(1)} disabled={!canScrollForward} className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-gold transition-colors disabled:text-white/18" aria-label={`Show more ${title.toLowerCase()} options`}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-2">
        <div ref={railRef} onScroll={updateScrollControls} className="flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 touch-pan-x [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              aria-pressed={value === option.value}
              className={cn(
                "inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                value === option.value ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground",
              )}
            >
              {option.locked && <LockKeyhole className="h-3 w-3" />}
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
