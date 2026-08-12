export type StarterBeat = {
  id: string;
  slug: string;
  title: string;
  producer: string;
  producerProfileId: string | null;
  sourceType: "suno_licensed" | "producer_donated";
  rightsHolder: string;
  licenseScope: "rapwriter_starter_nonexclusive";
  duration: number;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  mood: string | null;
  tags: string[];
  collectionSlug: string | null;
  collection: string | null;
  energy: "low" | "medium" | "high" | null;
  writingFit: string[];
  attribution: string;
  featured: boolean;
  previewSeconds: number;
  previewUrl: string;
  artworkUrl: string | null;
};

const freeStarterBeatLimit = 3;

export function hasFullStarterBeatLibrary(artistPlanId?: string | null) {
  return Boolean(artistPlanId && artistPlanId !== "artist_free");
}

export function starterBeatsForArtist(starterBeats: StarterBeat[], artistPlanId?: string | null) {
  return hasFullStarterBeatLibrary(artistPlanId) ? starterBeats : starterBeats.slice(0, freeStarterBeatLimit);
}

export function lockedStarterBeatCount(starterBeats: StarterBeat[], artistPlanId?: string | null) {
  return Math.max(0, starterBeats.length - starterBeatsForArtist(starterBeats, artistPlanId).length);
}
