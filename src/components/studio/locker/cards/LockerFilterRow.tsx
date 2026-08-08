"use client";

import { cn } from "@/lib/utils";

export function LockerFilterRow({ items, active, onChange }: { items: Array<{ id: string; label: string }>; active: string; onChange: (id: string) => void }) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onChange(item.id)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors", active === item.id ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-transparent text-muted-foreground")}>{item.label}</button>
      ))}
    </div>
  );
}
