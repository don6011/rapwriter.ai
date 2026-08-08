"use client";

import type { OnboardingAccountType } from "@/lib/account-role";
import { cn } from "@/lib/utils";
import { Check, Headphones, Mic, Sparkles } from "lucide-react";
import { useState } from "react";

export function MobileRoleOnboarding({
  artistName,
  onComplete,
}: {
  artistName: string;
  onComplete: (accountType: OnboardingAccountType) => Promise<void>;
}) {
  const [selected, setSelected] = useState<OnboardingAccountType>("artist");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices: Array<{
    id: OnboardingAccountType;
    title: string;
    detail: string;
    icon: typeof Mic;
  }> = [
    { id: "artist", title: "Artist", detail: "Write, record rough takes, and finish songs.", icon: Mic },
    { id: "producer", title: "Producer", detail: "Upload beats, build playlists, and run a storefront.", icon: Headphones },
    { id: "artist_producer", title: "Artist + Producer", detail: "Write records and sell your own sound.", icon: Sparkles },
  ];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onComplete(selected);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save your workspace.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[430px] border-t border-gold/25 bg-[#0d0d0f] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 shadow-[0_-24px_80px_rgba(0,0,0,0.7)] sm:rounded-2xl sm:border">
        <div className="label-hw text-gold/85">Set up your workspace</div>
        <h1 className="mt-2 text-2xl font-semibold">How will you use RapWriter, {artistName}?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Choose the workspace you need today. Your music and profile stay together.
        </p>

        <div className="mt-5 space-y-2">
          {choices.map((choice) => {
            const Icon = choice.icon;
            const active = selected === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setSelected(choice.id)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-20 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                  active ? "border-gold/70 bg-gold/10" : "border-white/10 bg-white/[0.025]",
                )}
              >
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", active ? "border-gold/45 bg-black text-gold" : "border-white/10 text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{choice.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{choice.detail}</span>
                </span>
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", active ? "border-gold bg-gold text-black" : "border-white/20")}>
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-xs text-rec">{error}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="gold-seal mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Building workspace..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
