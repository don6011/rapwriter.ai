"use client";

import { Home } from "lucide-react";

export function AccessLaunchRow({
  icon: Icon,
  eyebrow,
  title,
  detail,
  action,
  onClick,
}: {
  icon: typeof Home;
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[82px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/[0.07] text-gold"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="label-hw block text-gold/68">{eyebrow}</span>
        <span className="mt-1 block text-sm font-semibold text-white">{title}</span>
        <span className="mt-1 block text-[10px] leading-relaxed text-white/45">{detail}</span>
      </span>
      <span className="shrink-0 text-[10px] font-semibold text-gold">{action}</span>
    </button>
  );
}
