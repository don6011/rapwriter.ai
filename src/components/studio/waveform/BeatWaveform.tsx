"use client";

import { SyntheticWaveform } from "@/components/studio/waveform/SyntheticWaveform";
import { resolveBeatPreviewUrl } from "@/lib/beat-playback";
import { formatDuration, getProgressPct } from "@/lib/studio/format";
import type { SelectedBeat } from "@/lib/studio/types";
import { buildSyntheticWaveBars } from "@/lib/studio/waveform";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

export function BeatWaveform({
  beat,
  currentTime,
  duration,
  active,
  recording = false,
  compact = false,
  onSeek,
  onSeekCommit,
}: {
  beat: SelectedBeat;
  currentTime: number;
  duration: number;
  active: boolean;
  recording?: boolean;
  compact?: boolean;
  onSeek?: (seconds: number) => void;
  onSeekCommit?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<{ destroy: () => void; setTime: (time: number) => void } | null>(null);
  const [waveReady, setWaveReady] = useState(false);
  const previewUrl = resolveBeatPreviewUrl(beat);
  const progressPct = recording ? 100 : getProgressPct(currentTime, duration);
  const visualDuration = useMemo(() => {
    if (typeof beat.duration === "number" && Number.isFinite(beat.duration)) return Math.max(1, beat.duration);
    const [minutes, seconds] = typeof beat.duration === "string" ? beat.duration.split(":").map(Number) : [];
    return Number.isFinite(minutes) && Number.isFinite(seconds) ? Math.max(1, minutes * 60 + seconds) : 1;
  }, [beat.duration]);
  const visualPeaks = useMemo(
    () => Float32Array.from(
      buildSyntheticWaveBars({ id: beat.id, bpm: beat.bpm, key: beat.key }, compact ? 64 : 96),
      (height) => height / 100,
    ),
    [beat.bpm, beat.id, beat.key, compact],
  );
  const seekFromPointer = (clientX: number, target: HTMLInputElement) => {
    if (!onSeek || duration <= 0) return;
    const bounds = target.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    onSeek(ratio * duration);
  };

  useEffect(() => {
    let mounted = true;
    setWaveReady(false);
    waveSurferRef.current?.destroy();
    waveSurferRef.current = null;

    if (!previewUrl || !containerRef.current) return;

    void import("wavesurfer.js")
      .then(({ default: WaveSurfer }) => {
        if (!mounted || !containerRef.current) return;
        const waveSurfer = WaveSurfer.create({
          container: containerRef.current,
          height: compact ? 14 : 22,
          normalize: true,
          interact: false,
          cursorWidth: 0,
          barWidth: 2,
          barGap: 2,
          barRadius: 2,
          waveColor: "rgba(255,255,255,0.18)",
          progressColor: recording ? "rgba(255,71,87,0.95)" : "rgba(246,199,72,0.95)",
        });
        waveSurfer.on("ready", () => {
          if (!mounted) return;
          setWaveReady(true);
          waveSurfer.setTime(0);
        });
        waveSurferRef.current = waveSurfer;
        void waveSurfer.load(previewUrl, [visualPeaks], visualDuration).catch((error: unknown) => {
          if (!mounted || (error instanceof DOMException && error.name === "AbortError")) return;
          setWaveReady(false);
        });
      })
      .catch(() => setWaveReady(false));

    return () => {
      mounted = false;
      waveSurferRef.current?.destroy();
      waveSurferRef.current = null;
    };
  }, [compact, previewUrl, recording, visualDuration, visualPeaks]);

  useEffect(() => {
    if (!waveReady || !waveSurferRef.current) return;
    waveSurferRef.current.setTime(Math.max(0, currentTime));
  }, [currentTime, waveReady]);

  if (previewUrl) {
    return (
      <div className={cn("relative mt-2 overflow-hidden rounded-full bg-white/[0.04]", compact ? "h-4" : "h-6")}>
        <div ref={containerRef} className="absolute inset-x-0 top-1/2 -translate-y-1/2" />
        {!waveReady && <SyntheticWaveform beat={beat} progressPct={progressPct} active={active} recording={recording} compact={compact} />}
        {onSeek && duration > 0 && !recording && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 z-[1] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/60 bg-gold shadow-[0_0_10px_rgba(246,199,72,0.65)]"
              style={{ left: `${progressPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={Math.min(currentTime, duration)}
              onChange={(event) => onSeek(Number(event.target.value))}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                seekFromPointer(event.clientX, event.currentTarget);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  seekFromPointer(event.clientX, event.currentTarget);
                }
              }}
              onPointerUp={(event) => {
                seekFromPointer(event.clientX, event.currentTarget);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                onSeekCommit?.();
              }}
              onPointerCancel={onSeekCommit}
              onKeyUp={onSeekCommit}
              onBlur={onSeekCommit}
              aria-label={`Seek ${beat.title}`}
              aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [touch-action:none]"
            />
          </>
        )}
      </div>
    );
  }

  return <SyntheticWaveform beat={beat} progressPct={progressPct} active={active} recording={recording} compact={compact} />;
}
