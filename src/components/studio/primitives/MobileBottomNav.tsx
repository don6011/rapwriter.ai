"use client";

import type { MobileNavView } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Briefcase, Home, ShoppingCart, UserCircle } from "lucide-react";

export const navItems: { id: MobileNavView; label: string; icon: typeof Home }[] = [
  { id: "studio", label: "Studio", icon: Home },
  { id: "locker", label: "Locker", icon: Briefcase },
  { id: "market", label: "Market", icon: ShoppingCart },
  { id: "profile", label: "Profile", icon: UserCircle },
];

export function MobileBottomNav({ activeNav, onChange }: { activeNav: MobileNavView; onChange: (view: MobileNavView) => void }) {
  return (
    <nav data-testid="app-dock" aria-label="RapWriter navigation" className="fixed bottom-0 left-1/2 z-40 grid h-[84px] w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-white/10 bg-black/90 px-2 pb-4 pt-2 backdrop-blur-xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => onChange(item.id)}
            className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", activeNav === item.id ? "text-gold" : "text-muted-foreground")}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
