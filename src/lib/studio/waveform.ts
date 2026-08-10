"use client";

import type { SelectedBeat } from "@/lib/studio/types";

export function buildSyntheticWaveBars(beat: Pick<SelectedBeat, "id" | "bpm" | "key">, count: number) {
  const seed = Array.from(`${beat.id}-${beat.bpm ?? ""}-${beat.key ?? ""}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const tempo = typeof beat.bpm === "number" ? beat.bpm : 84;
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.72) * 0.5 + 0.5;
    const knock = Math.sin((index + 3) * (tempo / 92)) * 0.5 + 0.5;
    const accent = index % 8 === 0 ? 18 : index % 4 === 0 ? 10 : 0;
    return Math.max(22, Math.min(92, 24 + wave * 34 + knock * 22 + accent));
  });
}

export function buildTakeWaveBars(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const breath = Math.sin(index * 0.62) * 0.5 + 0.5;
    const consonant = Math.sin((index + 4) * 1.27) * 0.5 + 0.5;
    return Math.max(20, Math.min(88, 22 + breath * 30 + consonant * 24 + (index % 7 === 0 ? 14 : 0)));
  });
}

export function readAudioFileDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error("Invalid audio duration."));
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Audio metadata could not be read."));
    };
    audio.src = url;
  });
}
