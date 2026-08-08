"use client";

import { BeatWaveform } from "@/components/studio/waveform/BeatWaveform";
import { formatDuration } from "@/lib/studio/format";
import type { SelectedBeat } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Mic, Pause, Play, RefreshCw } from "lucide-react";

export function PadTransport({
  beat,
  playing,
  recording,
  compact,
  currentTime,
  duration,
  error,
  onToggleBeat,
  onSeek,
  onSeekCommit,
  onChangeBeat,
  onToggleRecording,
}: {
  beat: SelectedBeat;
  playing: boolean;
  recording: boolean;
  compact: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  onToggleBeat: () => void;
  onSeek: (seconds: number) => void;
  onSeekCommit: () => void;
  onChangeBeat: () => void;
  onToggleRecording: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center border border-gold/15 bg-[#151516]/96 shadow-[0_14px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[height,border-radius,padding,gap] duration-200",
      compact ? "h-14 gap-2 rounded-xl px-2 py-1" : "gap-3 rounded-2xl px-3 py-2",
    )}>
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
          "grid shrink-0 place-items-center rounded-full border",
          compact ? "h-9 w-9" : "h-11 w-11",
          recording ? "border-rec bg-rec/18 text-rec" : "border-rec/50 bg-rec/12 text-rec",
        )}
        aria-label={recording ? "Stop recording" : "Record rough take"}
      >
        <Mic className="h-4 w-4" />
      </button>
    </div>
  );
}
