"use client";

import { TakeWaveform } from "@/components/studio/waveform/TakeWaveform";
import { resolveBeatPreviewUrl } from "@/lib/beat-playback";
import type { RoughTakeAnalysis } from "@/lib/booth-ready-v2";
import { getBeatDurationSeconds } from "@/lib/studio/beat-snapshot";
import { formatDuration } from "@/lib/studio/format";
import type { SelectedBeat } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function RoughTakeStrip({
  recording,
  recordingSeconds,
  roughTakeUrl,
  roughTakeDuration,
  error,
  saved,
  saving,
  analyzing,
  analysis,
  beat,
  beatStartTime,
  compact = false,
  onDelete,
  onSave,
}: {
  recording: boolean;
  recordingSeconds: number;
  roughTakeUrl: string | null;
  roughTakeDuration: number;
  error: string | null;
  saved: boolean;
  saving: boolean;
  analyzing: boolean;
  analysis: RoughTakeAnalysis | null;
  beat: SelectedBeat | null;
  beatStartTime: number;
  compact?: boolean;
  onDelete: () => void;
  onSave: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reviewBeatRef = useRef<HTMLAudioElement | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [reviewTime, setReviewTime] = useState(0);
  const beatPreviewUrl = beat ? resolveBeatPreviewUrl(beat) : null;

  useEffect(() => {
    audioRef.current?.pause();
    reviewBeatRef.current?.pause();
    setReviewPlaying(false);
    setReviewTime(0);
  }, [beat?.id, roughTakeUrl]);

  useEffect(() => () => {
    audioRef.current?.pause();
    reviewBeatRef.current?.pause();
  }, []);

  if (!recording && !roughTakeUrl && !error) return null;

  const toggleReview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (reviewPlaying) {
      audio.pause();
      reviewBeatRef.current?.pause();
      setReviewPlaying(false);
      return;
    }
    const reviewBeat = reviewBeatRef.current;
    if (reviewBeat) {
      const beatDuration = beat ? getBeatDurationSeconds(beat) : 0;
      reviewBeat.currentTime = beatDuration > 0 ? (beatStartTime + audio.currentTime) % beatDuration : beatStartTime + audio.currentTime;
      void reviewBeat.play().catch(() => undefined);
    }
    void audio.play().then(() => setReviewPlaying(true)).catch(() => {
      reviewBeat?.pause();
      setReviewPlaying(false);
    });
  };

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-black/28 p-3", compact ? "mt-3" : "mt-3")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="label-hw text-gold/85">Rough Take</div>
          <div className="mt-1 text-sm text-white/90">
            {recording ? `Recording ${formatDuration(recordingSeconds)}` : roughTakeUrl ? `${saved ? "Saved take" : "Review take"} ${formatDuration(roughTakeDuration)}` : "Mic unavailable"}
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
            recording
              ? "bg-rec/12 text-rec"
              : saved
                ? "bg-emerald-500/14 text-emerald-300"
                : "bg-gold/10 text-gold",
          )}
        >
          {recording ? "Live" : analyzing ? "Analyzing" : saved ? "Kept" : "Unsaved"}
        </div>
      </div>

      {recording && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rec/20 bg-rec/8 p-3">
          <div className="h-2.5 w-2.5 rounded-full bg-rec shadow-[0_0_18px_rgba(255,71,87,0.8)]" />
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full animate-pulse rounded-full bg-rec" style={{ width: `${Math.min(100, recordingSeconds * 3)}%` }} />
            </div>
          </div>
          <span className="text-xs tabular-nums text-rec">{formatDuration(recordingSeconds)}</span>
        </div>
      )}

      {roughTakeUrl && !recording && (
        <div className="mt-3 rounded-xl border border-white/10 bg-[#111113] p-3">
          <audio
            ref={audioRef}
            src={roughTakeUrl}
            preload="metadata"
            onTimeUpdate={(event) => {
              const nextTime = event.currentTarget.currentTime;
              setReviewTime(nextTime);
              const reviewBeat = reviewBeatRef.current;
              if (!reviewBeat || !beat) return;
              const beatDuration = getBeatDurationSeconds(beat);
              const expectedTime = beatDuration > 0 ? (beatStartTime + nextTime) % beatDuration : beatStartTime + nextTime;
              if (Math.abs(reviewBeat.currentTime - expectedTime) > 0.35) reviewBeat.currentTime = expectedTime;
            }}
            onEnded={() => {
              const reviewBeat = reviewBeatRef.current;
              reviewBeat?.pause();
              if (reviewBeat) reviewBeat.currentTime = beatStartTime;
              setReviewPlaying(false);
              setReviewTime(0);
            }}
            className="hidden"
          />
          {beatPreviewUrl && <audio ref={reviewBeatRef} src={beatPreviewUrl} preload="metadata" className="hidden" />}
          <div className="flex items-center gap-3">
            <button onClick={toggleReview} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-black" aria-label={reviewPlaying ? "Pause rough take" : "Play rough take"}>
              {reviewPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-white/85">{beatPreviewUrl ? "Listen with beat" : saved ? "Kept take" : "Listen back"}</span>
                <span className="tabular-nums text-muted-foreground">{formatDuration(reviewTime)} / {formatDuration(roughTakeDuration)}</span>
              </div>
              <TakeWaveform currentTime={reviewTime} duration={roughTakeDuration} active={reviewPlaying} saved={saved} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={onSave}
              disabled={saved || saving || analyzing}
              className={cn(
                "min-h-10 rounded-xl border px-3 text-xs font-semibold",
                saved ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-300" : "border-gold/30 bg-gold/10 text-gold",
              )}
            >
              {analyzing ? "Reading Take..." : saving ? "Saving..." : saved ? "Kept in Session" : "Keep Take"}
            </button>
            <button onClick={onDelete} className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-muted-foreground">
              Retake
            </button>
          </div>
          {(analyzing || analysis) && (
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <span>{analyzing ? "Reading delivery..." : "Delivery read"}</span>
              {analysis && <span className="font-semibold text-gold">{analysis.deliveryScore}/100</span>}
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rec">{error}</p>}
    </div>
  );
}
