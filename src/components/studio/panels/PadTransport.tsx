"use client";

import { BeatWaveform } from "@/components/studio/waveform/BeatWaveform";
import { formatDuration } from "@/lib/studio/format";
import type { SelectedBeat } from "@/lib/studio/types";
import type { RecordingMode } from "@/components/studio/state/use-rough-take";
import { cn } from "@/lib/utils";
import { Mic, Pause, Play, RefreshCw, Square } from "lucide-react";

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
  onToggleRecording: () => void;
  onRecordingModeChange: (mode: RecordingMode) => void;
}) {
  return (
    <div className={cn(
      "border border-gold/15 bg-[#151516]/96 shadow-[0_14px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[border-radius,padding] duration-200",
      compact ? "rounded-xl px-2 py-1.5" : "rounded-2xl px-3 py-2",
    )}>
      <div className={cn("flex items-center", compact ? "gap-2" : "gap-3")}>
      <button onClick={onToggleBeat} className={cn("grid shrink-0 place-items-center rounded-full bg-gold text-black", compact ? "h-9 w-9" : "h-11 w-11")} aria-label={playing ? "Pause beat" : "Play beat"}>
        {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{beat.title}</div>
          <button
            type="button"
            onClick={onChangeBeat}
            className={cn("grid shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-muted-foreground transition-colors hover:border-gold/30 hover:text-gold", compact ? "h-7 w-7" : "h-8 w-8")}
            aria-label="Change beat"
            title="Change beat"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className={cn("mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground", compact && "hidden")}>
          {formatDuration(currentTime)} / {formatDuration(duration)} - {[beat.producer, beat.bpm ? `${beat.bpm} BPM` : null, beat.key].filter(Boolean).join(" - ")}
        </div>
        <BeatWaveform beat={beat} currentTime={currentTime} duration={duration} active={playing || recording} recording={recording} compact={compact} onSeek={onSeek} onSeekCommit={onSeekCommit} />
        {error && <div className="mt-1 text-[10px] text-rec">{error}</div>}
      </div>
      <button
        onClick={onToggleRecording}
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
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-white/8 pt-1.5">
        <span className="pl-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/42">Record</span>
        <div className="flex rounded-lg border border-white/10 bg-black/25 p-0.5" role="group" aria-label="Recording mode">
          {(["with_beat", "vocals_only"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={recording}
              onClick={() => onRecordingModeChange(mode)}
              className={cn(
                "min-h-7 rounded-md px-2.5 text-[9px] font-semibold transition-colors disabled:cursor-not-allowed",
                recordingMode === mode ? "bg-gold/14 text-gold" : "text-white/48 hover:text-white/75",
              )}
              aria-pressed={recordingMode === mode}
            >
              {mode === "with_beat" ? "With beat" : "Vocals only"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
