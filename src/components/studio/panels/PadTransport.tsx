"use client";

import { BeatWaveform } from "@/components/studio/waveform/BeatWaveform";
import { EMPTY_BEAT } from "@/lib/studio/beat-snapshot";
import { formatDuration } from "@/lib/studio/format";
import type { SelectedBeat } from "@/lib/studio/types";
import type { RecordingMode } from "@/components/studio/state/use-rough-take";
import { cn } from "@/lib/utils";
import { Headphones, Mic, Pause, Play, RefreshCw, Square, X } from "lucide-react";
import { useState } from "react";

export function PadTransport({
  beat,
  playing,
  recording,
  recordingMode,
  compact,
  currentTime,
  duration,
  error,
  onToggleBeat,
  onSeek,
  onSeekCommit,
  onChangeBeat,
  onToggleRecording,
  onRecordingModeChange,
}: {
  beat: SelectedBeat;
  playing: boolean;
  recording: boolean;
  recordingMode: RecordingMode;
  compact: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  onToggleBeat: () => void;
  onSeek: (seconds: number) => void;
  onSeekCommit: () => void;
  onChangeBeat: () => void;
  onToggleRecording: (mode?: RecordingMode) => void;
  onRecordingModeChange: (mode: RecordingMode) => void;
}) {
  const [recordFlowOpen, setRecordFlowOpen] = useState(false);
  const hasBeat = beat.id !== EMPTY_BEAT.id;

  const beginRecording = (mode: RecordingMode) => {
    onRecordingModeChange(mode);
    setRecordFlowOpen(false);
    onToggleRecording(mode);
  };

  return (
    <>
      <div className={cn(
        "border border-gold/15 bg-[#151516]/96 shadow-[0_14px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[border-radius,padding] duration-200",
        compact ? "rounded-xl px-2 py-1.5" : "rounded-2xl px-3 py-2",
      )}>
        <div className={cn("flex items-center", compact ? "gap-2" : "gap-3")}>
          <button
            onClick={hasBeat ? onToggleBeat : onChangeBeat}
            disabled={recording}
            className={cn("grid shrink-0 place-items-center rounded-full bg-gold text-black disabled:cursor-not-allowed disabled:opacity-45", compact ? "h-9 w-9" : "h-11 w-11")}
            aria-label={hasBeat ? (playing ? "Pause beat" : "Play beat") : "Choose a beat"}
          >
            {!hasBeat ? <Headphones className="h-4 w-4" /> : playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {hasBeat ? (
                <>
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold">{beat.title}</div>
                  <button
                    type="button"
                    onClick={onChangeBeat}
                    disabled={recording}
                    className={cn("grid shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-muted-foreground transition-colors hover:border-gold/30 hover:text-gold disabled:cursor-not-allowed disabled:opacity-35", compact ? "h-7 w-7" : "h-8 w-8")}
                    aria-label={recording ? "Stop recording to change beat" : "Change beat"}
                    title={recording ? "Stop recording to change beat" : "Change beat"}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button type="button" onClick={onChangeBeat} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-gold">
                  Choose a beat
                </button>
              )}
            </div>
            <div className={cn("mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground", compact && "hidden")}>
              {hasBeat ? `${formatDuration(currentTime)} / ${formatDuration(duration)} - ${[beat.producer, beat.bpm ? `${beat.bpm} BPM` : null, beat.key].filter(Boolean).join(" - ")}` : "Locker, included beats, or import your own"}
            </div>
            {hasBeat && <BeatWaveform beat={beat} currentTime={currentTime} duration={duration} active={playing || recording} recording={recording} compact={compact} onSeek={onSeek} onSeekCommit={onSeekCommit} />}
            {error && <div className="mt-1 text-[10px] text-rec">{error}</div>}
          </div>
          <button
            onClick={() => recording ? onToggleRecording() : setRecordFlowOpen(true)}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center rounded-xl border font-semibold",
              compact ? "h-10 min-w-[48px] px-1 text-[9px]" : "h-12 min-w-[58px] px-2 text-[10px]",
              recording ? "border-rec bg-rec/18 text-rec" : "border-rec/50 bg-rec/12 text-rec",
            )}
            aria-label={recording ? "Stop recording" : `Start ${recordingMode === "vocals_only" ? "vocal" : "rough take"} recording`}
          >
            {recording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-3.5 w-3.5" />}
            <span className="mt-0.5">{recording ? "Stop" : "Start"}</span>
          </button>
        </div>
      </div>

      {recordFlowOpen && !recording && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="record-flow-title">
          <button type="button" className="absolute inset-0 bg-black/68 backdrop-blur-sm" onClick={() => setRecordFlowOpen(false)} aria-label="Close recording options" />
          <div className="relative w-full max-w-[430px] rounded-t-2xl border border-white/12 bg-[#101011] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_70px_rgba(0,0,0,0.7)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-hw text-gold">Record</div>
                <h2 id="record-flow-title" className="mt-1 text-lg font-semibold">Choose what you hear.</h2>
                <p className="mt-1 text-xs text-muted-foreground">Your lyrics stay open while the take records.</p>
              </div>
              <button type="button" onClick={() => setRecordFlowOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close recording options">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["with_beat", "vocals_only"] as const).map((mode) => {
                const modeDisabled = mode === "with_beat" && !hasBeat;
                const modeActive = hasBeat ? recordingMode === mode : mode === "vocals_only";
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => beginRecording(mode)}
                    disabled={modeDisabled}
                    className={cn(
                      "flex min-h-24 flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      modeActive ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-white/[0.03] text-white hover:border-white/20",
                    )}
                  >
                    {mode === "with_beat" ? <Headphones className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    <span>
                      <span className="block text-sm font-semibold">{mode === "with_beat" ? "With beat" : "Vocals only"}</span>
                      <span className="mt-1 block text-[10px] font-normal leading-4 text-muted-foreground">{mode === "with_beat" ? (hasBeat ? "Capture the pocket." : "Choose a beat first.") : "Capture a clean vocal."}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
