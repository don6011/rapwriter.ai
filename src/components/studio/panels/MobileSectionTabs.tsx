"use client";

import { countBars } from "@/lib/studio/bars";
import { mobileSections } from "@/lib/studio/sections";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export function MobileSectionTabs({
  sectionContent,
  activeSection,
  onSetActiveSection,
  preview = false,
  disabled = false,
}: {
  sectionContent: Record<string, string>;
  activeSection: number;
  onSetActiveSection: (index: number) => void;
  preview?: boolean;
  disabled?: boolean;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    const activeTab = rail?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!rail || !activeTab) return;
    const centeredLeft = activeTab.offsetLeft - (rail.clientWidth - activeTab.clientWidth) / 2;
    rail.scrollTo({ left: Math.max(0, centeredLeft), behavior: "smooth" });
  }, [activeSection]);

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label="Song sections"
      className={cn(
        "flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        preview ? "-mx-1 mb-3 pb-1" : "px-4 py-3",
      )}
    >
      {mobileSections.map((item, index) => (
        <button
          key={item.name}
          type="button"
          role="tab"
          aria-selected={activeSection === index}
          disabled={disabled}
          onClick={() => onSetActiveSection(index)}
          className={cn(
            "min-h-10 shrink-0 rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md transition-[border-color,background-color,color,box-shadow]",
            preview
              ? "border-white/10 bg-black/20"
              : "border-white/12 bg-black/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
            activeSection === index && "border-gold/50 bg-gold/12 text-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(246,199,72,0.08)]",
            disabled && "cursor-not-allowed opacity-55",
          )}
        >
          {item.name} <span className="tabular-nums opacity-70">{countBars(sectionContent[item.name])}/{item.target}</span>
        </button>
      ))}
    </div>
  );
}
