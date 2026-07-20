"use client";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  subtitle?: string;
  className?: string;
};

export function BrandLogo({ compact = false, subtitle, className }: BrandLogoProps) {
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gold/35 bg-black/80 shadow-[0_0_22px_-10px_var(--amber)]",
          className,
        )}
      >
        <img
          src="/brand/rapwriter-mark.webp"
          alt="RapWriter.ai"
          className="h-[135%] w-[135%] object-contain"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="h-12 w-[8.25rem] overflow-hidden rounded-md">
        <img
          src="/brand/rapwriter-logo-tight.webp"
          alt="RapWriter.ai"
          className="h-full w-full object-contain object-left"
          draggable={false}
        />
      </span>
      {subtitle && (
        <span className="hidden sm:block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {subtitle}
        </span>
      )}
    </span>
  );
}
