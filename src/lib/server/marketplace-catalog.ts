import { createAdminClient } from "@/lib/supabase/admin";
import type { Beat, EmotionalTag, License, Producer } from "@/lib/marketplace";

type ProducerProfileRow = {
  id: string;
  display_name: string;
  handle: string | null;
  city: string | null;
  bio: string | null;
  verified: boolean;
};

type ProducerBeatRow = {
  id: string;
  producer_profile_id: string;
  title: string;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  mood: string | null;
  region: string | null;
  tags: string[];
  license_tiers: Array<{ license: License; price: number }>;
  artwork_path: string | null;
  duration_seconds: number;
  metadata: { featured?: boolean } | null;
};

type ProducerMetricsRow = {
  producer_profile_id: string;
  followers: number;
  sales: number;
  beat_plays: number;
};

type BeatMetricsRow = {
  beat_id: string;
  plays: number;
  favorites: number;
  project_adds: number;
  session_count: number;
  tracks_finished: number;
  writing_now: number;
  completion_rate: number;
  booth_ready_score: number;
};

export type MarketplaceBeat = Beat & {
  previewUrl: string;
  artworkUrl?: string;
  source: "producer";
};

export async function loadApprovedMarketplaceCatalog(limit = 100) {
  const supabase = createAdminClient();
  const [beatResult, profileResult, metricResult, beatMetricResult] = await Promise.all([
    supabase
      .from("producer_beats")
      .select("id, producer_profile_id, title, bpm, musical_key, genre, mood, region, tags, license_tiers, artwork_path, duration_seconds, metadata")
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("producer_profiles")
      .select("id, display_name, handle, city, bio, verified")
      .eq("status", "approved")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("producer_metrics")
      .select("producer_profile_id, followers, sales, beat_plays"),
    supabase
      .from("marketplace_beat_metrics")
      .select("beat_id, plays, favorites, project_adds, session_count, tracks_finished, writing_now, completion_rate, booth_ready_score"),
  ]);

  if (beatResult.error) throw new Error(beatResult.error.message);
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (metricResult.error) throw new Error(metricResult.error.message);
  if (beatMetricResult.error) throw new Error(beatMetricResult.error.message);

  const profiles = (profileResult.data ?? []) as ProducerProfileRow[];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const metrics = new Map(
    ((metricResult.data ?? []) as ProducerMetricsRow[]).map((metric) => [metric.producer_profile_id, metric]),
  );
  const beatMetrics = new Map(
    ((beatMetricResult.data ?? []) as BeatMetricsRow[]).map((metric) => [metric.beat_id, metric]),
  );
  const beats = ((beatResult.data ?? []) as ProducerBeatRow[])
    .filter((beat) => profileMap.has(beat.producer_profile_id))
    .map((beat) => toMarketplaceBeat(beat, profileMap.get(beat.producer_profile_id)!, beatMetrics.get(beat.id)));

  return {
    beats,
    producers: profiles.map((profile) => toMarketplaceProducer(profile, metrics.get(profile.id))),
  };
}

function toMarketplaceBeat(beat: ProducerBeatRow, profile: ProducerProfileRow, metrics?: BeatMetricsRow): MarketplaceBeat {
  const producerId = `producer-${profile.id}`;
  const tags = sanitizeTags(beat.tags, beat.genre, beat.mood);
  const previewUrl = marketplaceBeatMediaUrl(beat.id, "audio");
  const artworkUrl = beat.artwork_path ? marketplaceBeatMediaUrl(beat.id, "artwork") : undefined;
  const metadata = beat.metadata ?? {};

  return {
    id: `producer-beat-${beat.id}`,
    title: beat.title,
    producer: profile.display_name,
    producerId,
    verified: profile.verified,
    bpm: beat.bpm ?? 0,
    key: beat.musical_key ?? "Key not listed",
    mood: beat.mood ?? beat.genre ?? "Independent",
    region: beat.region ?? profile.city ?? "Online",
    tags: tags.slice(0, 4),
    duration: formatDuration(beat.duration_seconds),
    art: artworkUrl ? `url('${artworkUrl}')` : producerGradient(producerId),
    glyph: glyphFor(beat.title),
    prices: normalizePrices(beat.license_tiers),
    plays: positiveInteger(metrics?.plays),
    tag: metadata.featured ? "FEATURED" : "PRODUCER",
    boothReadyScore: boundedScore(metrics?.booth_ready_score),
    completionRate: boundedScore(metrics?.completion_rate),
    tracksFinished: positiveInteger(metrics?.tracks_finished),
    writingNow: positiveInteger(metrics?.writing_now),
    emotionalTags: tagsToEmotionalTags(tags),
    previewUrl,
    artworkUrl,
    source: "producer",
  };
}

function toMarketplaceProducer(profile: ProducerProfileRow, metrics?: ProducerMetricsRow): Producer {
  const id = `producer-${profile.id}`;
  return {
    id,
    name: profile.display_name,
    handle: profile.handle ? `@${profile.handle}` : "@producer",
    city: profile.city ?? "Online",
    bio: profile.bio ?? "Independent producer in RapWriter Studio Store.",
    verified: profile.verified,
    sales: positiveInteger(metrics?.sales),
    followers: positiveInteger(metrics?.followers),
    rating: 0,
    avatar: producerGradient(id),
    banner: producerGradient(`${id}-banner`),
    glyph: glyphFor(profile.display_name),
  };
}

function marketplaceBeatMediaUrl(beatId: string, kind: "audio" | "artwork") {
  return `/api/marketplace/beats/${beatId}/media?kind=${kind}`;
}

function normalizePrices(prices: Array<{ license: License; price: number }>) {
  return (prices ?? []).filter(
    (tier) => typeof tier.license === "string" && Number.isInteger(tier.price) && tier.price > 0,
  );
}

function sanitizeTags(tags: string[], genre?: string | null, mood?: string | null) {
  return [...(tags ?? []), genre, mood]
    .filter((tag): tag is string => Boolean(tag?.trim()))
    .map((tag) => tag.trim());
}

function tagsToEmotionalTags(tags: string[]): EmotionalTag[] {
  const allowed: EmotionalTag[] = ["Pain", "Victory", "Motivation", "Heartbreak", "Late Night Drive", "Strip Club", "Storytelling", "Hustle", "Love", "Soul", "Street", "Club"];
  return tags.filter((tag): tag is EmotionalTag => allowed.includes(tag as EmotionalTag)).slice(0, 4);
}

function formatDuration(seconds: number) {
  if (!seconds) return "Preview";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function boundedScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function glyphFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "RW";
}

function producerGradient(seed: string) {
  const palettes = [
    "linear-gradient(135deg, #0a0a1a 0%, #1a1438 55%, #c9a84c 130%)",
    "linear-gradient(135deg, #1a0f08 0%, #3d2410 55%, #d4842a 130%)",
    "linear-gradient(135deg, #051a1a 0%, #0d3838 55%, #5cbdb9 130%)",
    "linear-gradient(135deg, #2d0a1f 0%, #5c1840 55%, #e8b84a 130%)",
  ];
  const index = Math.abs([...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palettes.length;
  return palettes[index];
}
