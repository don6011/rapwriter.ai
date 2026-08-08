"use client";

import { EMPTY_BEAT } from "@/lib/studio/beat-snapshot";
import type { ArtistGoal, SelectedBeat } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Award, Mic, Pencil, Sparkles } from "lucide-react";
import { useState } from "react";

export function MobileFirstSessionActivation({
  artistName,
  beat,
  onComplete,
}: {
  artistName: string;
  beat: SelectedBeat;
  onComplete: (payload: {
    artistGoal: ArtistGoal;
    projectTitle: string;
    songTitle: string;
    useBeat: boolean;
  }) => Promise<void>;
}) {
  const [artistGoal, setArtistGoal] = useState<ArtistGoal>("finish_song");
  const [projectTitle, setProjectTitle] = useState(`${artistName}'s First Project`);
  const [songTitle, setSongTitle] = useState("Untitled Song");
  const [useBeat, setUseBeat] = useState(beat.id !== EMPTY_BEAT.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goals: Array<{ id: ArtistGoal; title: string; detail: string; icon: typeof Mic }> = [
    { id: "finish_song", title: "Finish a song", detail: "Build a complete record section by section.", icon: Award },
    { id: "write_hook", title: "Write a hook", detail: "Find the idea listeners remember first.", icon: Sparkles },
    { id: "write_verse", title: "Write 16 bars", detail: "Lock the pocket and finish a full verse.", icon: Pencil },
    { id: "freestyle", title: "Freestyle", detail: "Open the pad and follow the beat.", icon: Mic },
  ];

  const submit = async () => {
    if (!projectTitle.trim() || !songTitle.trim()) {
      setError("Name the project and song to start your session.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onComplete({ artistGoal, projectTitle: projectTitle.trim(), songTitle: songTitle.trim(), useBeat });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start the session.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/88 backdrop-blur-sm sm:items-center">
      <div className="max-h-[94svh] w-full max-w-[430px] overflow-y-auto border-t border-gold/25 bg-[#0d0d0f] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 shadow-[0_-24px_80px_rgba(0,0,0,0.72)] sm:rounded-2xl sm:border">
        <div className="label-hw text-gold/85">First session</div>
        <h1 className="mt-2 text-2xl font-semibold">What are we making tonight?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Set the target. RapWriter will open the right starting point.</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const active = artistGoal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => setArtistGoal(goal.id)}
                aria-pressed={active}
                className={cn("min-h-28 rounded-xl border p-3 text-left", active ? "border-gold/65 bg-gold/10" : "border-white/10 bg-white/[0.025]")}
              >
                <Icon className={cn("h-4 w-4", active ? "text-gold" : "text-muted-foreground")} />
                <span className="mt-3 block text-sm font-semibold">{goal.title}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{goal.detail}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="label-hw text-white/55">Project</span>
            <input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} maxLength={120} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm outline-none focus:border-gold/35" />
          </label>
          <label className="block">
            <span className="label-hw text-white/55">First song</span>
            <input value={songTitle} onChange={(event) => setSongTitle(event.target.value)} maxLength={160} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm outline-none focus:border-gold/35" />
          </label>
        </div>

        <div className="mt-5">
          <div className="label-hw text-white/55">Start with</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setUseBeat(true)} disabled={beat.id === EMPTY_BEAT.id} className={cn("min-h-16 rounded-xl border px-3 text-left disabled:opacity-40", useBeat ? "border-gold/65 bg-gold/10" : "border-white/10 bg-white/[0.025]")}>
              <span className="block truncate text-xs font-semibold">{beat.id === EMPTY_BEAT.id ? "Choose a beat later" : beat.title}</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">Beat loaded</span>
            </button>
            <button type="button" onClick={() => setUseBeat(false)} className={cn("min-h-16 rounded-xl border px-3 text-left", !useBeat ? "border-gold/65 bg-gold/10" : "border-white/10 bg-white/[0.025]")}>
              <span className="block text-xs font-semibold">No beat</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">Start with the words</span>
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-rec">{error}</p>}
        <button type="button" onClick={() => void submit()} disabled={busy} className="gold-seal mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60">
          {busy ? "Preparing Studio..." : "Start Writing"}
        </button>
      </div>
    </div>
  );
}
