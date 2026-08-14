"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampBeatSeekTime, resolveBeatPreviewUrl } from "@/lib/beat-playback";
import type { Beat } from "@/lib/marketplace";
import { EMPTY_BEAT, getBeatDurationSeconds, toBeatSnapshot } from "@/lib/studio/beat-snapshot";
import { trackMarketplaceEvent } from "@/lib/studio/telemetry";
import type { SelectedBeat } from "@/lib/studio/types";

export type BeatPlaybackOptions = {
  /** Runs when the user pauses playback, so the shell can flush the session draft. */
  onPause: () => void;
};

export function useBeatPlayback({ onPause }: BeatPlaybackOptions) {
  const [playing, setPlaying] = useState(false);
  const [beatCurrentTime, setBeatCurrentTime] = useState(0);
  const [beatDuration, setBeatDuration] = useState(getBeatDurationSeconds(EMPTY_BEAT));
  const [beatError, setBeatError] = useState<string | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<SelectedBeat>(EMPTY_BEAT);

  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const beatStartedAtRef = useRef<number | null>(null);
  const beatOffsetRef = useRef(0);
  const beatTimerRef = useRef<number | null>(null);
  const beatCurrentTimeRef = useRef(0);
  const beatDurationRef = useRef(getBeatDurationSeconds(EMPTY_BEAT));
  const activePreviewBeatIdRef = useRef<string | null>(null);
  const skipNextBeatResetRef = useRef(false);

  useEffect(() => {
    beatCurrentTimeRef.current = beatCurrentTime;
  }, [beatCurrentTime]);

  useEffect(() => {
    beatDurationRef.current = beatDuration;
  }, [beatDuration]);

  const stopBeatPreview = useCallback(({ reset = false }: { reset?: boolean } = {}) => {
    if (beatTimerRef.current) window.clearInterval(beatTimerRef.current);
    beatTimerRef.current = null;
    activePreviewBeatIdRef.current = null;
    const elapsed = beatStartedAtRef.current ? (performance.now() - beatStartedAtRef.current) / 1000 : 0;
    const audioTime = beatAudioRef.current?.currentTime;
    const duration = beatDurationRef.current;
    beatOffsetRef.current = reset
      ? 0
      : typeof audioTime === "number" && Number.isFinite(audioTime)
        ? Math.min(duration, audioTime)
        : Math.min(duration, beatOffsetRef.current + elapsed);
    beatStartedAtRef.current = null;

    if (beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current = null;
    }
    setPlaying(false);
    if (reset) setBeatCurrentTime(0);
  }, []);

  async function prepareBeatPreview(beat: SelectedBeat = selectedBeat) {
    const preparedAudio = beatAudioRef.current;
    if (preparedAudio && activePreviewBeatIdRef.current === beat.id && preparedAudio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      return preparedAudio;
    }

    if (preparedAudio) stopBeatPreview({ reset: false });
    activePreviewBeatIdRef.current = beat.id;
    const duration = getBeatDurationSeconds(beat);
    setBeatDuration(duration);
    setBeatError(null);

    const previewUrl = resolveBeatPreviewUrl(beat);
    if (previewUrl) {
      const audio = new Audio(previewUrl);
      audio.preload = "metadata";
      beatAudioRef.current = audio;
      audio.ontimeupdate = () => setBeatCurrentTime(audio.currentTime);
      audio.onended = () => stopBeatPreview({ reset: true });

      await new Promise<void>((resolve, reject) => {
        const handleLoadedMetadata = () => resolve();
        const handleError = () => reject(new Error("Beat preview could not load."));

        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
          return;
        }

        audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
        audio.addEventListener("error", handleError, { once: true });
        audio.load();
      });

      if (beatAudioRef.current !== audio) return;

      const mediaDuration = Number.isFinite(audio.duration) ? audio.duration : duration;
      const resumeAt = clampBeatSeekTime(beatOffsetRef.current, mediaDuration);
      setBeatDuration(mediaDuration);
      audio.currentTime = resumeAt;
      setBeatCurrentTime(resumeAt);
      return audio;
    }

    activePreviewBeatIdRef.current = null;
    setBeatError(beat.id === EMPTY_BEAT.id ? "Choose an approved beat from Studio Store." : "This beat has no playable preview.");
    return null;
  }

  async function startBeatPreview(beat: SelectedBeat = selectedBeat) {
    const audio = await prepareBeatPreview(beat);
    if (!audio || beatAudioRef.current !== audio) return;
    await audio.play();
    trackMarketplaceEvent("beat_play", beat.id);
    setPlaying(true);
  }

  const toggleBeatPlayback = () => {
    if (playing) {
      stopBeatPreview();
      onPause();
      return;
    }
    void startBeatPreview().catch(() => {
      setBeatError("Could not start beat preview.");
      stopBeatPreview();
    });
  };

  const seekBeatPlayback = useCallback((requestedTime: number) => {
    const audio = beatAudioRef.current;
    const audioDuration = audio && Number.isFinite(audio.duration) ? audio.duration : 0;
    const duration = Math.max(audioDuration, beatDurationRef.current, 0);
    const nextTime = clampBeatSeekTime(requestedTime, duration);

    beatOffsetRef.current = nextTime;
    beatCurrentTimeRef.current = nextTime;
    if (audio) audio.currentTime = nextTime;
    setBeatCurrentTime(nextTime);
    setBeatError(null);
  }, []);

  const previewMarketplaceBeat = (beat: Beat) => {
    const snapshot = toBeatSnapshot(beat);
    if (selectedBeat.id === snapshot.id) {
      toggleBeatPlayback();
      return;
    }

    stopBeatPreview({ reset: true });
    beatOffsetRef.current = 0;
    setSelectedBeat(snapshot);
    void startBeatPreview(snapshot).catch(() => {
      setBeatError("Could not start beat preview.");
      stopBeatPreview({ reset: true });
    });
  };

  useEffect(() => {
    return () => {
      stopBeatPreview({ reset: false });
    };
  }, [stopBeatPreview]);

  useEffect(() => {
    if (skipNextBeatResetRef.current) {
      skipNextBeatResetRef.current = false;
      setBeatDuration(getBeatDurationSeconds(selectedBeat));
      setBeatError(null);
      return;
    }
    if (activePreviewBeatIdRef.current === selectedBeat.id) return;
    stopBeatPreview({ reset: true });
    setBeatDuration(getBeatDurationSeconds(selectedBeat));
    setBeatError(null);
  }, [selectedBeat, stopBeatPreview]);

  /** Swap the beat without tearing down playback position — used by draft/session hydration. */
  const selectBeatKeepingPreview = useCallback((beat: SelectedBeat) => {
    skipNextBeatResetRef.current = true;
    setSelectedBeat(beat);
  }, []);

  /** Move the transport to `seconds`, keeping both the rendered value and the two refs in step. */
  const seekTo = useCallback((seconds: number) => {
    setBeatCurrentTime(seconds);
    beatCurrentTimeRef.current = seconds;
    beatOffsetRef.current = seconds;
  }, []);

  /** Stop playback and rewind to zero. Used whenever a different beat is loaded into the session. */
  const stopPreviewAndRewind = useCallback(() => {
    stopBeatPreview({ reset: true });
    beatOffsetRef.current = 0;
    beatCurrentTimeRef.current = 0;
    setBeatCurrentTime(0);
  }, [stopBeatPreview]);

  /** Clears the transport without touching the offset ref, for the pending-beat handoff. */
  const resetTransport = useCallback(() => {
    setPlaying(false);
    setBeatCurrentTime(0);
  }, []);

  /** The live playback position, readable outside a render (draft writes, take capture). */
  const positionSeconds = useCallback(() => {
    const audioTime = beatAudioRef.current?.currentTime;
    return typeof audioTime === "number" && Number.isFinite(audioTime)
      ? audioTime
      : beatCurrentTimeRef.current;
  }, []);

  return {
    playing,
    beatCurrentTime,
    beatDuration,
    beatError,
    selectedBeat,
    setSelectedBeat,
    setBeatError,
    selectBeatKeepingPreview,
    seekTo,
    stopPreviewAndRewind,
    resetTransport,
    positionSeconds,
    stopBeatPreview,
    prepareBeatPreview,
    startBeatPreview,
    toggleBeatPlayback,
    seekBeatPlayback,
    previewMarketplaceBeat,
  };
}
