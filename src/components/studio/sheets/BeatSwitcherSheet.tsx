"use client";

import { PrivateBeatImportSheet } from "@/components/studio/sheets/PrivateBeatImportSheet";
import type { BeatLockerRow, PrivateBeatImportInput } from "@/hooks/use-rapwriter-data";
import { resolveBeatPreviewUrl } from "@/lib/beat-playback";
import type { StarterBeat } from "@/lib/starter-beats";
import { getBeatDurationSeconds, toBeatSnapshot } from "@/lib/studio/beat-snapshot";
import { trackMarketplaceEvent } from "@/lib/studio/telemetry";
import type { MarketplaceBeat, SelectedBeat } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Check, Headphones, Pause, Play, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function BeatSwitcherSheet({
  open,
  signedIn,
  currentBeat,
  starterBeats,
  lockerBeats,
  marketplaceBeats,
  marketplaceLoading,
  marketplaceError,
  onClose,
  onPreviewStart,
  onImportBeat,
  onAuthRequired,
  onUseBeat,
  onUseStarterBeat,
}: {
  open: boolean;
  signedIn: boolean;
  currentBeat: SelectedBeat;
  starterBeats: StarterBeat[];
  lockerBeats: BeatLockerRow[];
  marketplaceBeats: MarketplaceBeat[];
  marketplaceLoading: boolean;
  marketplaceError: string | null;
  onClose: () => void;
  onPreviewStart: () => void;
  onImportBeat: (input: PrivateBeatImportInput) => Promise<BeatLockerRow | null>;
  onAuthRequired: () => void;
  onUseBeat: (beat: BeatLockerRow) => void;
  onUseStarterBeat: (beat: StarterBeat) => void;
}) {
  const [tab, setTab] = useState<"locker" | "preview">("locker");
  const [previewingBeatId, setPreviewingBeatId] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [starterCollection, setStarterCollection] = useState("all");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopSample = useCallback(() => {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      previewAudioRef.current = null;
    }
    setPreviewingBeatId(null);
    setPreviewProgress(0);
  }, []);

  useEffect(() => {
    if (!open) {
      stopSample();
      setImportOpen(false);
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open, stopSample]);

  useEffect(() => stopSample, [stopSample]);

  const toggleMarketplaceSample = async (beat: MarketplaceBeat) => {
    if (previewingBeatId === beat.id) {
      stopSample();
      return;
    }

    stopSample();
    onPreviewStart();
    setPreviewError(null);
    const snapshot = toBeatSnapshot(beat);
    const previewUrl = resolveBeatPreviewUrl(snapshot);
    if (!previewUrl) {
      setPreviewError("This producer has not added a playable preview yet.");
      return;
    }

    const audio = new Audio(previewUrl);
    const sampleLength = Math.max(1, Math.min(30, getBeatDurationSeconds(snapshot)));
    previewAudioRef.current = audio;
    setPreviewingBeatId(beat.id);
    audio.ontimeupdate = () => {
      const elapsed = Math.min(sampleLength, audio.currentTime);
      setPreviewProgress((elapsed / sampleLength) * 100);
      if (audio.currentTime >= sampleLength) stopSample();
    };
    audio.onended = stopSample;
    audio.onerror = () => {
      stopSample();
      setPreviewError("This preview could not be played.");
    };

    try {
      await audio.play();
      trackMarketplaceEvent("beat_play", beat.id);
    } catch {
      stopSample();
      setPreviewError("Tap again to start this preview.");
    }
  };

  if (!open) return null;

  const lockerByBeatId = new Map(lockerBeats.map((beat) => [beat.beat_id, beat]));
  const starterCollections = Array.from(new Map(starterBeats.filter((beat) => beat.collectionSlug && beat.collection).map((beat) => [beat.collectionSlug!, beat.collection!])).entries());
  const visibleStarterBeats = starterCollection === "all" ? starterBeats : starterBeats.filter((beat) => beat.collectionSlug === starterCollection);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/72 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="beat-switcher-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[82svh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold/22 bg-[#0d0d0e] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="px-5 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="label-hw text-gold">Beat pocket</div>
              <h2 id="beat-switcher-title" className="mt-1 text-xl font-semibold">Change the beat.</h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">Writing stays open. Your lyrics do not move.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close beat picker">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-xl border border-white/10 bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setTab("locker")}
              className={cn("min-h-9 rounded-lg text-xs font-semibold transition-colors", tab === "locker" ? "bg-gold/14 text-gold" : "text-muted-foreground")}
            >
              My Beats {starterBeats.length + lockerBeats.length > 0 ? `(${starterBeats.length + lockerBeats.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={cn("min-h-9 rounded-lg text-xs font-semibold transition-colors", tab === "preview" ? "bg-gold/14 text-gold" : "text-muted-foreground")}
            >
              30-sec Previews
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4">
          {tab === "locker" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <div className="min-w-0"><div className="label-hw text-white/50">Your Beat Locker</div><div className="mt-1 truncate text-[10px] text-muted-foreground">Switch pockets without leaving the pad.</div></div>
                <button
                  type="button"
                  onClick={() => signedIn ? setImportOpen(true) : onAuthRequired()}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/8 px-3 text-[11px] font-semibold text-gold"
                >
                  <Upload className="h-3.5 w-3.5" />Import beat
                </button>
              </div>
              {starterBeats.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <div className="label-hw text-gold/75">Included with RapWriter</div>
                  {starterCollections.length > 1 && (
                    <select value={starterCollection} onChange={(event) => setStarterCollection(event.target.value)} aria-label="Filter included beats by collection" className="min-h-8 max-w-[155px] rounded-lg border border-white/10 bg-[#0d0d0e] px-2 text-[10px] font-semibold text-white/70 outline-none focus:border-gold/35">
                      <option value="all">All collections</option>
                      {starterCollections.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                  )}
                </div>
              )}
              {visibleStarterBeats.map((beat) => {
                const active = currentBeat.id === `starter-beat-${beat.id}`;
                return (
                  <button
                    key={beat.id}
                    type="button"
                    onClick={() => onUseStarterBeat(beat)}
                    className={cn(
                      "flex min-h-[68px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active ? "border-gold/40 bg-gold/10" : "border-white/10 bg-white/[0.025] hover:border-gold/25",
                    )}
                  >
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", active ? "border-gold/45 bg-gold text-black" : "border-gold/25 bg-gold/8 text-gold")}>
                      {active ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{beat.title}</span>
                      <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {[beat.producer, beat.genre, beat.featured ? "Featured" : "Included"].filter(Boolean).join(" - ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-gold">{active ? "Active" : "Use"}</span>
                  </button>
                );
              })}
              {starterBeats.length > 0 && lockerBeats.length > 0 && <div className="px-1 pb-1 pt-3 label-hw text-white/45">Saved and licensed</div>}
              {lockerBeats.map((beat) => {
                const active = currentBeat.id === beat.beat_id;
                return (
                  <button
                    key={beat.id}
                    type="button"
                    onClick={() => onUseBeat(beat)}
                    className={cn(
                      "flex min-h-[68px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active ? "border-gold/40 bg-gold/10" : "border-white/10 bg-white/[0.025] hover:border-gold/25",
                    )}
                  >
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", active ? "border-gold/45 bg-gold text-black" : "border-gold/25 bg-gold/8 text-gold")}>
                      {active ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{beat.title}</span>
                      <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {[beat.producer, beat.bpm ? `${beat.bpm} BPM` : null, beat.license === "Favorite" ? "Saved" : beat.license].filter(Boolean).join(" - ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-gold">{active ? "Active" : "Use"}</span>
                  </button>
                );
              })}
              {starterBeats.length === 0 && lockerBeats.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center">
                  <Headphones className="mx-auto h-5 w-5 text-gold" />
                  <div className="mt-3 text-sm font-semibold">{signedIn ? "Your Beat Locker is ready." : "Sign in to open your Beat Locker."}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Save or license beats in Studio Store, then switch them here without leaving Writer Flow.</p>
                </div>
              )}
            </div>
          )}

          {tab === "preview" && (
            <div className="space-y-2">
              {marketplaceBeats.slice(0, 12).map((beat) => {
                const ownedBeat = lockerByBeatId.get(beat.id);
                const previewing = previewingBeatId === beat.id;
                return (
                  <div key={beat.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
                    <div className="flex min-h-[72px] items-center gap-3 px-3 py-2.5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-gold/20 bg-gold/8 text-xs font-semibold text-gold" style={{ background: beat.art, backgroundPosition: "center", backgroundSize: "cover" }}>
                        {beat.glyph}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{beat.title}</span>
                        <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {[beat.producer, beat.bpm ? `${beat.bpm} BPM` : null, "30 sec"].filter(Boolean).join(" - ")}
                        </span>
                      </span>
                      {ownedBeat ? (
                        <button type="button" onClick={() => onUseBeat(ownedBeat)} className="min-h-9 shrink-0 rounded-full border border-gold/35 bg-gold/10 px-3 text-[10px] font-semibold text-gold">
                          Use
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void toggleMarketplaceSample(beat)}
                          className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", previewing ? "border-gold bg-gold text-black" : "border-gold/35 bg-gold/10 text-gold")}
                          aria-label={previewing ? `Pause ${beat.title} preview` : `Play 30 second preview of ${beat.title}`}
                        >
                          {previewing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
                        </button>
                      )}
                    </div>
                    {previewing && <div className="h-0.5 bg-white/8"><div className="h-full bg-gold transition-[width] duration-150" style={{ width: `${previewProgress}%` }} /></div>}
                  </div>
                );
              })}
              {marketplaceLoading && <div className="py-10 text-center text-xs text-muted-foreground">Loading producer previews...</div>}
              {!marketplaceLoading && marketplaceBeats.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center text-sm text-muted-foreground">
                  {marketplaceError ?? "Producer previews will appear after beats are approved."}
                </div>
              )}
              {previewError && <div className="rounded-xl border border-rec/25 bg-rec/10 p-3 text-xs text-rec">{previewError}</div>}
              <p className="px-2 pt-2 text-center text-[10px] leading-relaxed text-muted-foreground">Previews stop at 30 seconds. Full session use unlocks from your Beat Locker.</p>
            </div>
          )}
        </div>
      </section>
      {signedIn && (
        <PrivateBeatImportSheet
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={async (input) => {
            const imported = await onImportBeat(input);
            if (imported) onUseBeat(imported);
            return imported;
          }}
        />
      )}
    </div>
  );
}
