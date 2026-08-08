"use client";

export function LockerEmpty({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-[#111113] p-5">
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="gold-seal mt-4 min-h-11 w-full rounded-xl px-4 text-sm font-semibold">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
