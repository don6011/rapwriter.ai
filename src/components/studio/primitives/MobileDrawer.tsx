"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function MobileDrawer({ title, children, defaultOpen = false, open: controlledOpen, onOpenChange }: { title: string; children: ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111113]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="label-hw">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("border-t border-white/10 p-4", !open && "hidden")}>{children}</div>
    </div>
  );
}
