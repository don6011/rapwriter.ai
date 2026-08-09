import type { BeatLockerRow, SongLockerRow } from "@/hooks/use-rapwriter-data";
import type { StarterBeat } from "@/lib/starter-beats";
import { clampScore } from "@/lib/studio/booth-ready";
import { mobileSections } from "@/lib/studio/sections";

export function lockerSongProgress(song: SongLockerRow) {
  const sections = sectionsFromLockerSnapshot(song.snapshot);
  if (sections) {
    const writtenBars = Object.values(sections).reduce((total, content) => total + content.split(/\r?\n/).filter((line) => line.trim()).length, 0);
    const targetBars = mobileSections.reduce((total, section) => total + section.target, 0);
    return clampScore((writtenBars / targetBars) * 100);
  }
  const stored = lockerSnapshotNumber(song.snapshot, "completionPct", "completion_pct");
  return stored !== null ? clampScore(stored) : song.booth_ready ? 100 : 0;
}

export function lockerSongBarCount(song: SongLockerRow) {
  const sections = sectionsFromLockerSnapshot(song.snapshot);
  if (!sections) return lockerSnapshotNumber(song.snapshot, "totalBars", "total_bars") ?? 0;
  return Object.values(sections).reduce((total, content) => total + content.split(/\r?\n/).filter((line) => line.trim()).length, 0);
}

export function lockerSnapshotNumber(snapshot: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function sectionsFromLockerSnapshot(snapshot: Record<string, unknown>) {
  const rawSections = snapshot.sections;
  if (!rawSections || typeof rawSections !== "object" || Array.isArray(rawSections)) return null;
  return Object.entries(rawSections).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") acc[key] = value;
    return acc;
  }, {});
}

export function mostFrequent(values: string[]) {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

export function lockerBeatArt(beat: BeatLockerRow) {
  const art = beat.beat_snapshot.art;
  if (typeof art === "string" && art.includes("gradient")) return art;
  return "linear-gradient(145deg, #211407 0%, #0c0c0d 55%, #6b4510 125%)";
}

export function starterBeatArt(beat: StarterBeat) {
  if (beat.artworkUrl) return `center / cover no-repeat url('${beat.artworkUrl}')`;
  if (beat.genre?.toLowerCase().includes("trap")) return "linear-gradient(145deg, #25110b 0%, #100d12 55%, #6f2f0d 125%)";
  return "linear-gradient(145deg, #112126 0%, #0c0d10 56%, #6b5418 125%)";
}
