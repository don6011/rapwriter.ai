"use client";

import { TakeWaveform } from "@/components/studio/waveform/TakeWaveform";
import { getTakeResumeBeatTime, resolveBeatPreviewUrl } from "@/lib/beat-playback";
import type { RoughTakeAnalysis } from "@/lib/booth-ready-v2";
import { getBeatDurationSeconds } from "@/lib/studio/beat-snapshot";
import { formatDuration } from "@/lib/studio/format";
import { setWebAudioSessionType } from "@/lib/studio/audio-session";
import {
  DEFAULT_ROUGH_TAKE_SYNC_MS,
  getRoughTakeLogicalTime,
  getRoughTakeReviewBeatTime,
  getRoughTakeVocalMediaTime,
  MAX_ROUGH_TAKE_SYNC_MS,
  MIN_ROUGH_TAKE_SYNC_MS,
  normalizeRoughTakeSyncMs,
  ROUGH_TAKE_SYNC_STORAGE_KEY,
} from "@/lib/studio/rough-take-sync";
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
  overlay = false,
  onDelete,
  onSave,
  onContinue,
  onReviewStart,
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
  overlay?: boolean;
  onDelete: () => void;
  onSave: () => void;
  onContinue: (takeOffsetSeconds: number) => void;
  onReviewStart: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reviewBeatRef = useRef<HTMLAudioElement | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [reviewTime, setReviewTime] = useState(0);
  const [resumeOffset, setResumeOffset] = useState(roughTakeDuration);
  const [dismissed, setDismissed] = useState(saved);
  const [syncOffsetMs, setSyncOffsetMs] = useState(DEFAULT_ROUGH_TAKE_SYNC_MS);
  const [audioDeviceChanged, setAudioDeviceChanged] = useState(false);
  const [reviewWithBeat, setReviewWithBeat] = useState(true);
  const beatPreviewUrl = beat ? resolveBeatPreviewUrl(beat) : null;
  const beatDuration = beat ? getBeatDurationSeconds(beat) : 0;
  const resumeBeatTime = getTakeResumeBeatTime(beatStartTime, resumeOffset, beatDuration);

  useEffect(() => {
    try {
      const storedSync = window.localStorage.getItem(ROUGH_TAKE_SYNC_STORAGE_KEY);
      if (storedSync !== null) setSyncOffsetMs(normalizeRoughTakeSyncMs(Number(storedSync)));
    } catch {
      // Private browsing or managed devices can make localStorage unavailable.
    }
  }, []);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    const handleDeviceChange = () => setAudioDeviceChanged(true);
    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, []);

  useEffect(() => {
    audioRef.current?.pause();
    reviewBeatRef.current?.pause();
    setReviewPlaying(false);
    setReviewTime(0);
    setResumeOffset(roughTakeDuration);
    setReviewWithBeat(true);
  }, [beat?.id, roughTakeDuration, roughTakeUrl]);

  useEffect(() => () => {
    audioRef.current?.pause();
    reviewBeatRef.current?.pause();
  }, []);

  useEffect(() => {
    if (recording) setDismissed(false);
  }, [recording]);

  useEffect(() => {
    if (overlay && saved && !recording) setDismissed(true);
  }, [overlay, recording, saved]);

  if ((!recording && !roughTakeUrl && !error) || (overlay && dismissed)) return null;

  const seekReview = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(seconds, roughTakeDuration));
    audio.currentTime = reviewWithBeat ? getRoughTakeVocalMediaTime(nextTime, roughTakeDuration, syncOffsetMs) : nextTime;
    setReviewTime(nextTime);
    setResumeOffset(nextTime);

    const reviewBeat = reviewBeatRef.current;
    if (!reviewBeat || !beat) return;
    reviewBeat.currentTime = getRoughTakeReviewBeatTime(beatStartTime, nextTime, getBeatDurationSeconds(beat), syncOffsetMs);
  };

  const updateReviewSync = (requestedSyncMs: number) => {
    const nextSyncMs = normalizeRoughTakeSyncMs(requestedSyncMs);
    setSyncOffsetMs(nextSyncMs);
    setAudioDeviceChanged(false);
    try {
      window.localStorage.setItem(ROUGH_TAKE_SYNC_STORAGE_KEY, String(nextSyncMs));
    } catch {
      // The control still works for this session when persistence is unavailable.
    }

    const audio = audioRef.current;
    if (audio) audio.currentTime = getRoughTakeVocalMediaTime(reviewTime, roughTakeDuration, nextSyncMs);
    const reviewBeat = reviewBeatRef.current;
    if (reviewBeat && beat) {
      reviewBeat.currentTime = getRoughTakeReviewBeatTime(beatStartTime, reviewTime, getBeatDurationSeconds(beat), nextSyncMs);
    }
  };

  const toggleReview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (reviewPlaying) {
      audio.pause();
      reviewBeatRef.current?.pause();
      setReviewPlaying(false);
      return;
    }
    onReviewStart();
    setWebAudioSessionType("playback");
    const reviewBeat = reviewBeatRef.current;
    const beatDuration = beat ? getBeatDurationSeconds(beat) : 0;
    audio.currentTime = reviewWithBeat ? getRoughTakeVocalMediaTime(reviewTime, roughTakeDuration, syncOffsetMs) : reviewTime;
    if (reviewBeat) {
      reviewBeat.currentTime = getRoughTakeReviewBeatTime(beatStartTime, reviewTime, beatDuration, syncOffsetMs);
    }

    const vocalPlayback = audio.play();
    const beatPlayback = reviewWithBeat ? (reviewBeat?.play() ?? Promise.resolve()) : Promise.resolve();
    void Promise.all([vocalPlayback, beatPlayback]).then(() => {
      if (reviewBeat && reviewWithBeat) {
        const logicalAudioTime = getRoughTakeLogicalTime(audio.currentTime, roughTakeDuration, syncOffsetMs);
        const alignedBeatTime = getRoughTakeReviewBeatTime(beatStartTime, logicalAudioTime, beatDuration, syncOffsetMs);
        if (Math.abs(reviewBeat.currentTime - alignedBeatTime) > 0.08) reviewBeat.currentTime = alignedBeatTime;
      }
      setReviewPlaying(true);
    }).catch(() => {
      audio.pause();
      reviewBeat?.pause();
      setReviewPlaying(false);
    });
  };

  const toggleReviewBeat = () => {
    const nextReviewWithBeat = !reviewWithBeat;
    setReviewWithBeat(nextReviewWithBeat);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = nextReviewWithBeat ? getRoughTakeVocalMediaTime(reviewTime, roughTakeDuration, syncOffsetMs) : reviewTime;
    }
    const reviewBeat = reviewBeatRef.current;
    if (!reviewBeat) return;
    if (!nextReviewWithBeat) {
      reviewBeat.pause();
      return;
    }
    if (!reviewPlaying || !beat) return;
    reviewBeat.currentTime = getRoughTakeReviewBeatTime(beatStartTime, reviewTime, getBeatDurationSeconds(beat), syncOffsetMs);
    void reviewBeat.play().catch(() => setReviewWithBeat(false));
  };

  const content = recording && overlay ? (
    <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-rec/25 bg-[#160b0e]/94 px-3.5 shadow-[0_16px_48px_rgba(0,0,0,0.48)] backdrop-blur-xl" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rec/45" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rec" />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/88">Recording rough take</span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-rec">{formatDuration(recordingSeconds)}</span>
    </div>
  ) : (
    <div className={cn("rounded-2xl border border-white/10 bg-[#0d0d0f]/96 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl", !overlay && (compact ? "mt-3" : "mt-3"))}>
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

      {recording && !overlay && (
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
              const nextTime = reviewWithBeat ? getRoughTakeLogicalTime(event.currentTarget.currentTime, roughTakeDuration, syncOffsetMs) : event.currentTarget.currentTime;
              setReviewTime(nextTime);
              setResumeOffset(nextTime);
            }}
            onEnded={(event) => {
              const reviewBeat = reviewBeatRef.current;
              reviewBeat?.pause();
              if (reviewBeat) reviewBeat.currentTime = beatStartTime;
              event.currentTarget.currentTime = reviewWithBeat ? getRoughTakeVocalMediaTime(0, roughTakeDuration, syncOffsetMs) : 0;
              setReviewPlaying(false);
              setReviewTime(0);
              setResumeOffset(roughTakeDuration);
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
                <span className="font-medium text-white/85">{beatPreviewUrl ? (reviewWithBeat ? "Listen with beat" : "Captured audio only") : saved ? "Kept take" : "Listen back"}</span>
                <span className="tabular-nums text-muted-foreground">{formatDuration(reviewTime)} / {formatDuration(roughTakeDuration)}</span>
              </div>
              <TakeWaveform currentTime={reviewTime} duration={roughTakeDuration} active={reviewPlaying} saved={saved} onSeek={seekReview} />
            </div>
          </div>
          {beatPreviewUrl && (
            <div className="mt-3 rounded-xl border border-white/8 bg-black/25 px-3 py-2.5">
              {audioDeviceChanged && (
                <div className="mb-2.5 flex items-center justify-between gap-3 rounded-lg border border-gold/25 bg-gold/8 px-2.5 py-2 text-[10px] text-gold" role="status">
                  <span>Audio device changed — re-check sync.</span>
                  <button type="button" onClick={() => setAudioDeviceChanged(false)} className="shrink-0 text-white/55 underline-offset-2 hover:text-white/80 hover:underline">
                    Dismiss
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-semibold text-white/75">Backing beat</span>
                <button type="button" onClick={toggleReviewBeat} className={cn("rounded-full border px-2.5 py-1 font-semibold", reviewWithBeat ? "border-gold/30 bg-gold/10 text-gold" : "border-white/12 bg-white/[0.03] text-white/55")} aria-pressed={reviewWithBeat}>
                  {reviewWithBeat ? "On" : "Off"}
                </button>
              </div>
              {reviewWithBeat ? (
                <>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-semibold text-white/75">Review sync</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-gold">{syncOffsetMs > 0 ? "+" : ""}{syncOffsetMs} ms</span>
                      <button type="button" onClick={() => updateReviewSync(DEFAULT_ROUGH_TAKE_SYNC_MS)} className="text-white/45 underline-offset-2 hover:text-white/70 hover:underline">
                        Reset
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={MIN_ROUGH_TAKE_SYNC_MS}
                    max={MAX_ROUGH_TAKE_SYNC_MS}
                    step={5}
                    value={syncOffsetMs}
                    onChange={(event) => updateReviewSync(Number(event.currentTarget.value))}
                    className="mt-2 h-8 w-full accent-[#ffcc33]"
                    aria-label="Review vocal sync"
                    aria-valuetext={syncOffsetMs === 0 ? "No timing adjustment" : `${Math.abs(syncOffsetMs)} milliseconds ${syncOffsetMs > 0 ? "earlier" : "later"}`}
                  />
                  <div className="flex justify-between text-[9px] uppercase tracking-[0.12em] text-white/35">
                    <span>Vocals later</span>
                    <span>Vocals earlier</span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-white/42">Move right if vocals sound late. Saved on this device.</p>
                </>
              ) : (
                <p className="mt-2 text-[10px] leading-4 text-white/45">Use this for a take recorded through the phone speaker so RapWriter does not add a second beat.</p>
              )}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {saved ? (
              <button onClick={() => onContinue(resumeOffset)} className="min-h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/12 px-3 text-xs font-semibold text-emerald-300">
                Continue at {formatDuration(resumeBeatTime)}
              </button>
            ) : (
              <button
                onClick={onSave}
                disabled={saving || analyzing}
                className="min-h-10 rounded-xl border border-gold/30 bg-gold/10 px-3 text-xs font-semibold text-gold"
              >
                {analyzing ? "Reading Take..." : saving ? "Saving..." : "Keep Take"}
              </button>
            )}
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

  if (!overlay) return content;

  return (
    <div
      className={cn("fixed inset-0 z-[70] flex items-end justify-center", recording ? "pointer-events-none" : "")}
      role={recording ? "status" : "dialog"}
      aria-modal={recording ? undefined : true}
      aria-label={recording ? "Recording rough take" : "Review rough take"}
    >
      {!recording && <div className="absolute inset-0 bg-black/64 backdrop-blur-sm" aria-hidden="true" />}
      <div className="pointer-events-auto relative w-full max-w-[430px] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!recording && <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25" />}
        {content}
      </div>
    </div>
  );
}
