"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultStudioRoomId } from "@/lib/studio-room-access";
import { createAmbientBuffer } from "@/lib/studio/ambient-audio";
import { defaultStudioDna } from "@/lib/studio/dna";
import {
  MOBILE_STUDIO_DNA_KEY,
  MOBILE_STUDIO_PACK_KEY,
  normalizeStudioDna,
} from "@/lib/studio/draft-storage";
import { getStudioPack } from "@/lib/studio/packs";
import type { StudioDna, StudioPackId } from "@/lib/studio/types";

export type StudioEnvironmentOptions = {
  /** Surfaces Studio Air status text in the shell's sync line. */
  onNotice: (message: string) => void;
};

export function useStudioEnvironment({ onNotice }: StudioEnvironmentOptions) {
  const [activeStudioPackId, setActiveStudioPackId] = useState<StudioPackId>(defaultStudioRoomId);
  const [studioDna, setStudioDna] = useState<StudioDna>(defaultStudioDna);
  const [studioAirPlaying, setStudioAirPlaying] = useState(false);
  const studioAirEngineRef = useRef<{ context: AudioContext; source: AudioBufferSourceNode; gain: GainNode } | null>(null);

  const activeStudioPack = getStudioPack(activeStudioPackId);

  useEffect(() => {
    const stored = window.localStorage.getItem(MOBILE_STUDIO_PACK_KEY);
    if (stored) setActiveStudioPackId(getStudioPack(stored).id);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MOBILE_STUDIO_DNA_KEY);
      if (raw) {
        const next = normalizeStudioDna(JSON.parse(raw), defaultStudioRoomId);
        setStudioDna(next);
        setActiveStudioPackId(next.environment);
      }
    } catch {
      // Studio DNA can always be rebuilt from the default session.
    }
  }, []);

  const stopStudioAir = useCallback(() => {
    const engine = studioAirEngineRef.current;
    studioAirEngineRef.current = null;
    if (engine) {
      try {
        engine.source.stop();
      } catch {
        // The ambient loop may already be stopped during navigation or a room change.
      }
      void engine.context.close();
    }
    setStudioAirPlaying(false);
  }, []);

  const toggleStudioAir = useCallback((index: number) => {
    const safeIndex = Math.max(0, Math.min(activeStudioPack.ambience.length - 1, index));
    if (studioAirPlaying && studioDna.studioAir.activeIndex === safeIndex) {
      stopStudioAir();
      return;
    }

    stopStudioAir();
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      onNotice("Studio Air is unavailable in this browser");
      return;
    }

    const context = new AudioContextClass();
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const ambience = activeStudioPack.ambience[safeIndex] ?? activeStudioPack.ambience[0];
    source.buffer = createAmbientBuffer(context, `${activeStudioPack.id}-${ambience.title}`);
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = ambience.title.toLowerCase().includes("rain") ? 5200 : 2400;
    gain.gain.value = studioDna.studioAir.volume / 100;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    studioAirEngineRef.current = { context, source, gain };
    setStudioDna((current) => ({
      ...current,
      studioAir: { ...current.studioAir, activeIndex: safeIndex },
    }));
    setStudioAirPlaying(true);
    onNotice(`${ambience.title} playing`);
  }, [activeStudioPack, onNotice, stopStudioAir, studioAirPlaying, studioDna.studioAir.activeIndex, studioDna.studioAir.volume]);

  const changeStudioAirVolume = useCallback((volume: number) => {
    const safeVolume = Math.max(4, Math.min(32, volume));
    setStudioDna((current) => ({
      ...current,
      studioAir: { ...current.studioAir, volume: safeVolume },
    }));
    const engine = studioAirEngineRef.current;
    if (engine) engine.gain.gain.setTargetAtTime(safeVolume / 100, engine.context.currentTime, 0.08);
  }, []);

  useEffect(() => {
    return () => {
      stopStudioAir();
    };
  }, [stopStudioAir]);

  const persistPack = useCallback((id: StudioPackId) => {
    window.localStorage.setItem(MOBILE_STUDIO_PACK_KEY, id);
  }, []);

  const persistDna = useCallback((dna: StudioDna) => {
    window.localStorage.setItem(MOBILE_STUDIO_DNA_KEY, JSON.stringify(dna));
  }, []);

  const hasSavedDna = useCallback(() => Boolean(window.localStorage.getItem(MOBILE_STUDIO_DNA_KEY)), []);

  return {
    activeStudioPackId,
    activeStudioPack,
    studioDna,
    studioAirPlaying,
    setActiveStudioPackId,
    setStudioDna,
    stopStudioAir,
    toggleStudioAir,
    changeStudioAirVolume,
    persistPack,
    persistDna,
    hasSavedDna,
  };
}
