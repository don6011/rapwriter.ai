"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function ExportReviewRow({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return <div className="flex items-start gap-2"><span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border", ready ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300" : "border-white/12 text-muted-foreground")}>{ready && <Check className="h-2.5 w-2.5" />}</span><span className="min-w-0"><span className="font-semibold text-white/82">{label}</span><span className="ml-1 text-muted-foreground">/ {value}</span></span></div>;
}
