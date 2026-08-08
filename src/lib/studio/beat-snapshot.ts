import type { BeatLockerRow, SongRow } from "@/hooks/use-rapwriter-data";
import type { Beat } from "@/lib/marketplace";
import type { StarterBeat } from "@/lib/starter-beats";
import type { SelectedBeat, StudioPackId } from "@/lib/studio/types";

export const PRODUCER_BEAT_ID = /^producer-beat-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export const RAW_BEAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EMPTY_BEAT = {
  id: "no-beat",
  title: "No beat selected",
  producer: "Choose from Studio Store",
  bpm: 0,
  key: "",
  mood: "",
  duration: "0:00",
};

export function beatSnapshotFromRecord(snapshot: Record<string, unknown>) {
  if (typeof snapshot?.id !== "string" || typeof snapshot.title !== "string") return null;
  return {
    ...snapshot,
    id: snapshot.id,
    title: snapshot.title,
    producer: typeof snapshot.producer === "string" ? snapshot.producer : undefined,
    bpm: typeof snapshot.bpm === "number" ? snapshot.bpm : undefined,
    key: typeof snapshot.key === "string" ? snapshot.key : undefined,
    mood: typeof snapshot.mood === "string" ? snapshot.mood : undefined,
  };
}

export function beatSnapshotFromSong(song: SongRow | null) {
  return song ? beatSnapshotFromRecord(song.beat_snapshot) : null;
}

export function beatSnapshotFromLockerBeat(beat: BeatLockerRow): SelectedBeat {
  const savedSnapshot = beatSnapshotFromRecord(beat.beat_snapshot);
  return {
    ...(savedSnapshot ?? {}),
    id: beat.beat_id,
    title: beat.title,
    producer: beat.producer ?? savedSnapshot?.producer,
    bpm: beat.bpm ?? savedSnapshot?.bpm,
    key: beat.musical_key ?? savedSnapshot?.key,
    mood: beat.mood ?? savedSnapshot?.mood,
  };
}

export function beatSnapshotFromStarterBeat(beat: StarterBeat): SelectedBeat {
  return {
    id: `starter-beat-${beat.id}`,
    title: beat.title,
    producer: beat.producer,
    bpm: beat.bpm ?? undefined,
    key: beat.key ?? undefined,
    mood: beat.mood ?? beat.genre ?? undefined,
    genre: beat.genre ?? undefined,
    duration: beat.duration,
    previewUrl: beat.previewUrl,
    source: "starter",
    starterBeatId: beat.id,
    licenseScope: beat.licenseScope,
    attribution: beat.attribution,
  };
}

export function lockerSnapshotBeat(snapshot: Record<string, unknown>) {
  const beat = snapshot.beat;
  if (!beat || typeof beat !== "object" || Array.isArray(beat)) return null;
  return beatSnapshotFromRecord(beat as Record<string, unknown>);
}

export function toBeatSnapshot(beat: Beat) {
  const candidate = beat as Beat & { previewUrl?: string; audioUrl?: string };
  return {
    id: beat.id,
    title: beat.title,
    producer: beat.producer,
    bpm: beat.bpm,
    key: beat.key,
    mood: beat.mood,
    region: beat.region,
    duration: beat.duration,
    boothReadyScore: beat.boothReadyScore,
    previewUrl: candidate.previewUrl ?? candidate.audioUrl,
  };
}

export function getBeatDurationSeconds(beat: SelectedBeat) {
  if (typeof beat.duration === "number") return beat.duration;
  if (typeof beat.duration === "string") {
    const [mins, secs] = beat.duration.split(":").map((part) => Number(part));
    if (Number.isFinite(mins) && Number.isFinite(secs)) return mins * 60 + secs;
  }
  return 222;
}

export function getStudioRoomProductId(id: StudioPackId) {
  return `studio-room-${id}`;
}
