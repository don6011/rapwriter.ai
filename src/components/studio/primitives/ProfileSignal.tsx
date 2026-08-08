"use client";

export function ProfileSignal({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="label-hw text-gold/80">{title}</div>
      <div className="mt-2 truncate text-xl font-semibold">{value}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
