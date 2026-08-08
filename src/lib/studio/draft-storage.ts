"use client";

import { defaultStudioRoomId } from "@/lib/studio-room-access";
import { beatSnapshotFromRecord, EMPTY_BEAT } from "@/lib/studio/beat-snapshot";
import { defaultStudioDna } from "@/lib/studio/dna";
import { getStudioPack } from "@/lib/studio/packs";
import { mobileSections } from "@/lib/studio/sections";
import type { MobileDraftRecord, StudioDna, StudioPackId } from "@/lib/studio/types";

export const MOBILE_DRAFT_KEY = "rapwriter:v4:mobile-shell-draft";

export const MOBILE_STUDIO_PACK_KEY = "rapwriter:v2:studio-pack";

export const MOBILE_STUDIO_DNA_KEY = "rapwriter:v3:studio-dna";

export function mobileDraftStorageKey(ownerId: string | null) {
  return `${MOBILE_DRAFT_KEY}:${ownerId ?? "guest"}`;
}

export function readMobileDraftRecord(ownerId: string | null): MobileDraftRecord | null {
  try {
    const ownerKey = mobileDraftStorageKey(ownerId);
    const guestKey = mobileDraftStorageKey(null);
    const raw = window.localStorage.getItem(ownerKey)
      ?? (ownerId ? window.localStorage.getItem(guestKey) : null)
      ?? window.localStorage.getItem(MOBILE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.ownerId === "string" && candidate.ownerId !== ownerId) return null;

    if (candidate.version === 3 && candidate.sections && typeof candidate.sections === "object" && !Array.isArray(candidate.sections)) {
      const sections = normalizeDraftSections(candidate.sections);
      const activeSection = mobileSections.some((item) => item.name === candidate.activeSection)
        ? String(candidate.activeSection)
        : "Hook";
      const studioPackId = getStudioPack(typeof candidate.studioPackId === "string" ? candidate.studioPackId : null).id;
      const studioDna = normalizeStudioDna(candidate.studioDna, studioPackId);
      const beat = candidate.beat && typeof candidate.beat === "object" && !Array.isArray(candidate.beat)
        ? beatSnapshotFromRecord(candidate.beat as Record<string, unknown>) ?? EMPTY_BEAT
        : EMPTY_BEAT;
      const updatedAt = validIsoDate(candidate.updatedAt) ?? new Date().toISOString();

      return {
        version: 3,
        ownerId: typeof candidate.ownerId === "string" ? candidate.ownerId : null,
        updatedAt,
        syncedAt: validIsoDate(candidate.syncedAt),
        unsynced: candidate.unsynced === true,
        projectId: typeof candidate.projectId === "string" ? candidate.projectId : null,
        songId: typeof candidate.songId === "string" ? candidate.songId : null,
        sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : null,
        baseRevision: typeof candidate.baseRevision === "number" && Number.isInteger(candidate.baseRevision)
          ? candidate.baseRevision
          : null,
        sections,
        activeSection,
        beat,
        studioPackId,
        studioDna,
        playbackPositionSeconds: typeof candidate.playbackPositionSeconds === "number" && Number.isFinite(candidate.playbackPositionSeconds)
          ? Math.max(0, candidate.playbackPositionSeconds)
          : 0,
      };
    }

    const legacySections = normalizeDraftSections(candidate);
    const hasLegacyLyrics = mobileSections.some((item) => typeof candidate[item.name] === "string");
    if (!hasLegacyLyrics) return null;
    return {
      version: 3,
      ownerId: null,
      updatedAt: new Date().toISOString(),
      syncedAt: null,
      unsynced: true,
      projectId: null,
      songId: null,
      sessionId: null,
      baseRevision: null,
      sections: legacySections,
      activeSection: "Hook",
      beat: EMPTY_BEAT,
      studioPackId: defaultStudioRoomId,
      studioDna: defaultStudioDna,
      playbackPositionSeconds: 0,
    };
  } catch {
    return null;
  }
}

export function writeMobileDraftRecord(draft: MobileDraftRecord) {
  try {
    window.localStorage.setItem(mobileDraftStorageKey(draft.ownerId), JSON.stringify(draft));
  } catch {
    // The editor remains usable even if browser storage is unavailable.
  }
}

export function normalizeDraftSections(value: object) {
  const record = value as Record<string, unknown>;
  return mobileSections.reduce<Record<string, string>>((sections, item) => {
    const content = record[item.name];
    sections[item.name] = typeof content === "string" ? content : "";
    return sections;
  }, {});
}

export function normalizeStudioDna(value: unknown, fallbackEnvironment: StudioPackId): StudioDna {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const airCandidate = candidate.studioAir && typeof candidate.studioAir === "object" && !Array.isArray(candidate.studioAir)
    ? candidate.studioAir as Record<string, unknown>
    : {};
  const activeIndex = typeof airCandidate.activeIndex === "number" && Number.isInteger(airCandidate.activeIndex)
    ? Math.max(0, Math.min(2, airCandidate.activeIndex))
    : defaultStudioDna.studioAir.activeIndex;
  const volume = typeof airCandidate.volume === "number" && Number.isFinite(airCandidate.volume)
    ? Math.max(4, Math.min(32, airCandidate.volume))
    : defaultStudioDna.studioAir.volume;
  return {
    environment: getStudioPack(typeof candidate.environment === "string" ? candidate.environment : fallbackEnvironment).id,
    goal: typeof candidate.goal === "string" ? candidate.goal : defaultStudioDna.goal,
    style: typeof candidate.style === "string" ? candidate.style : defaultStudioDna.style,
    mood: typeof candidate.mood === "string" ? candidate.mood : defaultStudioDna.mood,
    producer: typeof candidate.producer === "string" ? candidate.producer : defaultStudioDna.producer,
    studioAir: { activeIndex, volume },
  };

}

export function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
