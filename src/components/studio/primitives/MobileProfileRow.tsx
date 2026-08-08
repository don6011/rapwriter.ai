"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";

export function MobileProfileRow({
  icon: Icon,
  title,
  value,
  href,
  onClick,
  disabled = false,
  muted = false,
}: {
  icon: typeof Home;
  title: string;
  value: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  const content = (
    <>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", muted ? "border-white/10 bg-white/[0.03] text-muted-foreground" : "border-gold/20 bg-gold/8 text-gold")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </>
  );

  if (href) {
    return (
      <a href={href} className={cn("flex w-full items-center gap-3 rounded-2xl border border-white/10 p-3 text-left", muted ? "bg-white/[0.025]" : "bg-[#111113]")}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("flex w-full items-center gap-3 rounded-2xl border border-white/10 p-3 text-left disabled:opacity-60", muted ? "bg-white/[0.025]" : "bg-[#111113]")}> 
      {content}
    </button>
  );
}
