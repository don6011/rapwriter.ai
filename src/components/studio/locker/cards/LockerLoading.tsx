"use client";

export function LockerLoading() {
  return (
    <div className="mt-4 space-y-3" role="status" aria-label="Loading Locker">
      {[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl border border-white/8 bg-white/[0.035]" />)}
    </div>
  );
}
