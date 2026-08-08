"use client";

import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export function LockerRemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => armed ? onRemove() : setArmed(true)}
      className={cn("flex min-h-10 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-semibold", armed ? "border-rec/35 bg-rec/10 text-rec" : "border-white/10 text-muted-foreground")}
      aria-label={armed ? `Confirm ${label.toLowerCase()}` : label}
      title={armed ? "Tap again to remove" : label}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {armed && "Remove"}
    </button>
  );
}
