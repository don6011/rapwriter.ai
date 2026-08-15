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

type ReviewAudioBuffers = {
  key: string;
  vocal: AudioBuffer;
  beat: AudioBuffer | null;
};

type ReviewClock = {
  contextStartTime: number;
  logicalStartTime: number;
};

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
  const reviewContextRef = useRef<AudioContext | null>(null);
  const reviewVocalSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const reviewBeatSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const reviewBuffersRef = useRef<ReviewAudioBuffers | null>(null);
  const reviewBufferLoadRef = useRef<Promise<ReviewAudioBuffers> | null>(null);
  const reviewClockRef = useRef<ReviewClock | null>(null);
  const reviewFrameRef = useRef<number | null>(null);
  const reviewGenerationRef = useRef(0);
  const reviewModeRef = useRef<"web-audio" | "elements" | null>(null);
  const reviewStartPendingRef = useRef(false);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [reviewTime, setReviewTime] = useState(0);
  const [resumeOffset, setResumeOffset] = useState(roughTakeDuration);
  const [dismissed, setDismissed] = useState(saved);
  const [syncOffsetMs, setSyncOffsetMs] = useState(DEFAULT_ROUGH_TAKE_SYNC_MS);
  const [audioDeviceChanged, setAudioDeviceChanged] = useState(false);
  const [reviewWithBeat, setReviewWithBeat] = useState(true);
  const [compatibilityPlayback, setCompatibilityPlayback] = useState(false);
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
    reviewGenerationRef.current += 1;
    reviewVocalSourceRef.current?.stop();
    reviewBeatSourceRef.current?.stop();
    reviewVocalSourceRef.current = null;
    reviewBeatSourceRef.current = null;
    reviewClockRef.current = null;
    reviewModeRef.current = null;
    reviewStartPendingRef.current = false;
    if (reviewFrameRef.current !== null) window.cancelAnimationFrame(reviewFrameRef.current);
    reviewFrameRef.current = null;
    setReviewPlaying(false);
    setReviewTime(0);
    setResumeOffset(roughTakeDuration);
    setReviewWithBeat(true);
    setCompatibilityPlayback(false);
  }, [beat?.id, roughTakeDuration, roughTakeUrl]);

  useEffect(() => () => {
    audioRef.current?.pause();
    reviewBeatRef.current?.pause();
    reviewGenerationRef.current += 1;
    reviewVocalSourceRef.current?.stop();
    reviewBeatSourceRef.current?.stop();
    if (reviewFrameRef.current !== null) window.cancelAnimationFrame(reviewFrameRef.current);
    void reviewContextRef.current?.close();
  }, []);

  useEffect(() => {
    if (recording) setDismissed(false);
  }, [recording]);

  useEffect(() => {
    if (overlay && saved && !recording) setDismissed(true);
  }, [overlay, recording, saved]);

  if ((!recording && !roughTakeUrl && !error) || (overlay && dismissed)) return null;

  const currentWebAudioReviewTime = () => {
    const context = reviewContextRef.current;
    const clock = reviewClockRef.current;
    if (!context || !clock) return reviewTime;
    return Math.min(roughTakeDuration, clock.logicalStartTime + Math.max(0, context.currentTime - clock.contextStartTime));
  };

  const stopWebAudioReview = () => {
    reviewGenerationRef.current += 1;
    if (reviewFrameRef.current !== null) window.cancelAnimationFrame(reviewFrameRef.current);
    reviewFrameRef.current = null;
    try {
      reviewVocalSourceRef.current?.stop();
      reviewBeatSourceRef.current?.stop();
    } catch {
      // A source can already be stopped by its natural end.
    }
    reviewVocalSourceRef.current = null;
    reviewBeatSourceRef.current = null;
    reviewClockRef.current = null;
  };

  const loadWebAudioReview = async () => {
    if (!roughTakeUrl) throw new Error("No rough take is available.");
    const key = `${roughTakeUrl}|${beatPreviewUrl ?? ""}`;
    if (reviewBuffersRef.current?.key === key) return reviewBuffersRef.current;
    if (reviewBufferLoadRef.current) return reviewBufferLoadRef.current;

    const context = reviewContextRef.current ?? new AudioContext();
    reviewContextRef.current = context;
    const decodeUrl = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Review audio could not be loaded.");
      return context.decodeAudioData(await response.arrayBuffer());
    };
    const load = Promise.all([decodeUrl(roughTakeUrl), beatPreviewUrl ? decodeUrl(beatPreviewUrl) : Promise.resolve(null)])
      .then(([vocal, loadedBeat]) => {
        const buffers = { key, vocal, beat: loadedBeat } satisfies ReviewAudioBuffers;
        reviewBuffersRef.current = buffers;
        return buffers;
      })
      .finally(() => {
        reviewBufferLoadRef.current = null;
      });
    reviewBufferLoadRef.current = load;
    return load;
  };

  const startWebAudioReview = async (logicalTime: number, requestedSyncMs: number, includeBeat: boolean) => {
    const context = reviewContextRef.current ?? new AudioContext();
    reviewContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    const loadGeneration = reviewGenerationRef.current;
    const buffers = await loadWebAudioReview();
    if (reviewGenerationRef.current !== loadGeneration) throw new Error("Review playback was canceled.");
    stopWebAudioReview();

    const generation = reviewGenerationRef.current;
    const vocal = context.createBufferSource();
    vocal.buffer = buffers.vocal;
    vocal.connect(context.destination);
    const appliedSyncMs = includeBeat ? requestedSyncMs : 0;
    const vocalOffset = Math.min(Math.max(0, buffers.vocal.duration - 0.001), getRoughTakeVocalMediaTime(logicalTime, roughTakeDuration, appliedSyncMs));
    const startAt = context.currentTime + 0.04;
    reviewVocalSourceRef.current = vocal;

    if (includeBeat && buffers.beat) {
      const reviewBeat = context.createBufferSource();
      reviewBeat.buffer = buffers.beat;
      reviewBeat.connect(context.destination);
      const requestedBeatOffset = getRoughTakeReviewBeatTime(beatStartTime, logicalTime, beatDuration, appliedSyncMs);
      const beatOffset = Math.min(Math.max(0, buffers.beat.duration - 0.001), requestedBeatOffset);
      reviewBeat.start(startAt, beatOffset);
      reviewBeatSourceRef.current = reviewBeat;
    }

    reviewClockRef.current = { contextStartTime: startAt, logicalStartTime: logicalTime };
    reviewModeRef.current = "web-audio";
    vocal.onended = () => {
      if (reviewGenerationRef.current !== generation) return;
      stopWebAudioReview();
      setReviewPlaying(false);
      setReviewTime(0);
      setResumeOffset(roughTakeDuration);
    };
    vocal.start(startAt, vocalOffset);
    setReviewPlaying(true);

    const updateClock = () => {
      if (reviewGenerationRef.current !== generation) return;
      const nextTime = currentWebAudioReviewTime();
      setReviewTime(nextTime);
      setResumeOffset(nextTime);
      reviewFrameRef.current = window.requestAnimationFrame(updateClock);
    };
    reviewFrameRef.current = window.requestAnimationFrame(updateClock);
  };

  const seekReview = (seconds: number) => {
    const nextTime = Math.max(0, Math.min(seconds, roughTakeDuration));
    if (reviewModeRef.current === "web-audio" && reviewPlaying) {
      stopWebAudioReview();
      setReviewTime(nextTime);
      setResumeOffset(nextTime);
      void startWebAudioReview(nextTime, syncOffsetMs, reviewWithBeat).catch(() => setReviewPlaying(false));
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = reviewWithBeat ? getRoughTakeVocalMediaTime(nextTime, roughTakeDuration, syncOffsetMs) : nextTime;
    setReviewTime(nextTime);
    setResumeOffset(nextTime);

    const reviewBeat = reviewBeatRef.current;
    if (!reviewBeat || !beat) return;
    reviewBeat.currentTime = getRoughTakeReviewBeatTime(beatStartTime, nextTime, getBeatDurationSeconds(beat), syncOffsetMs);
  };

  const updateReviewSync = (requestedSyncMs: number) => {
    const nextSyncMs = normalizeRoughTakeSyncMs(requestedSyncMs);
    const webAudioTime = reviewModeRef.current === "web-audio" && reviewPlaying ? currentWebAudioReviewTime() : null;
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
    if (webAudioTime !== null) {
      stopWebAudioReview();
      setReviewTime(webAudioTime);
      void startWebAudioReview(webAudioTime, nextSyncMs, reviewWithBeat).catch(() => setReviewPlaying(false));
    }
  };

  const toggleReview = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (reviewPlaying) {
      if (reviewModeRef.current === "web-audio") {
        const pausedAt = currentWebAudioReviewTime();
        stopWebAudioReview();
        setReviewTime(pausedAt);
        setResumeOffset(pausedAt);
      } else {
        audio.pause();
        reviewBeatRef.current?.pause();
      }
      setReviewPlaying(false);
      return;
    }
    if (reviewStartPendingRef.current) return;
    reviewStartPendingRef.current = true;
    onReviewStart();
    setWebAudioSessionType("playback");
    try {
      await startWebAudioReview(reviewTime, syncOffsetMs, reviewWithBeat);
      setCompatibilityPlayback(false);
      reviewStartPendingRef.current = false;
      return;
    } catch {
      // Older WebViews and cross-origin media fall back to element playback.
      stopWebAudioReview();
      reviewModeRef.current = "elements";
      setCompatibilityPlayback(true);
      reviewStartPendingRef.current = false;
    }
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
    const webAudioTime = reviewModeRef.current === "web-audio" && reviewPlaying ? currentWebAudioReviewTime() : null;
    setReviewWithBeat(nextReviewWithBeat);
    if (webAudioTime !== null) {
      stopWebAudioReview();
      setReviewTime(webAudioTime);
      void startWebAudioReview(webAudioTime, syncOffsetMs, nextReviewWithBeat).catch(() => setReviewPlaying(false));
      return;
    }
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
              const fallbackBeat = reviewBeatRef.current;
              if (reviewModeRef.current === "elements" && reviewWithBeat && reviewPlaying && fallbackBeat && beat) {
                const expectedBeatTime = getRoughTakeReviewBeatTime(beatStartTime, nextTime, getBeatDurationSeconds(beat), syncOffsetMs);
                if (Math.abs(fallbackBeat.currentTime - expectedBeatTime) > 0.035) fallbackBeat.currentTime = expectedBeatTime;
              }
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
            <button onClick={() => void toggleReview()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-black" aria-label={reviewPlaying ? "Pause rough take" : "Play rough take"}>
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
              {compatibilityPlayback && (
                <p className="mb-2.5 rounded-lg border border-amber-400/25 bg-amber-400/8 px-2.5 py-2 text-[10px] leading-4 text-amber-200" role="status">
                  Compatibility playback active. RapWriter is correcting sync continuously.
                </p>
              )}
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
