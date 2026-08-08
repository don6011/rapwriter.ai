"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, LockKeyhole } from "lucide-react";

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
  return (
    <div className="mt-4 first:mt-0">
      <div className="label-hw">{title}</div>
      <div className="relative mt-2">
        <div className="flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 pr-8 touch-pan-x [mask-image:linear-gradient(to_right,#000_0,#000_calc(100%-2.25rem),transparent_100%)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <div className="pointer-events-none absolute inset-y-0 right-0 grid w-7 place-items-center text-gold/65" aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
