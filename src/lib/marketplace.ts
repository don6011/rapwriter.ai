export type License = "Lease" | "Premium Lease" | "Exclusive" | "Stems + Exclusive";

export type EmotionalTag =
  | "Pain"
  | "Victory"
  | "Motivation"
  | "Heartbreak"
  | "Late Night Drive"
  | "Strip Club"
  | "Storytelling"
  | "Hustle"
  | "Love"
  | "Soul"
  | "Street"
  | "Club";

export type Beat = {
  id: string;
  title: string;
  producer: string;
  producerId: string;
  verified?: boolean;
  bpm: number;
  key: string;
  mood: string;
  region: string;
  tags: string[];
  duration: string;
  art: string;
  glyph: string;
  prices: { license: License; price: number }[];
  plays: number;
  tag?: string;
  boothReadyScore: number;
  completionRate: number;
  tracksFinished: number;
  writingNow: number;
  emotionalTags: EmotionalTag[];
};

export type Producer = {
  id: string;
  name: string;
  handle: string;
  city: string;
  bio: string;
  verified: boolean;
  sales: number;
  followers: number;
  rating: number;
  avatar: string;
  banner: string;
  glyph: string;
};

const HANDOFF_KEY = "rapwriter:pending-beat";

export function setPendingBeat(beat: Beat) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(beat));
}

export function consumePendingBeat(): Beat | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(HANDOFF_KEY);
  if (!stored) return null;
  sessionStorage.removeItem(HANDOFF_KEY);
  try {
    const parsed = JSON.parse(stored) as Partial<Beat>;
    if (typeof parsed.id === "string" && typeof parsed.title === "string") return parsed as Beat;
  } catch {
    return null;
  }
  return null;
}
