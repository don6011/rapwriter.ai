import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { producerFollowSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "producer-beats";

type RouteContext = { params: Promise<{ handle: string }> };

type ProfileRow = {
  id: string;
  owner_id: string;
  display_name: string;
  handle: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  studio_name: string | null;
  years_producing: number | null;
  bio: string | null;
  genres: string[];
  specialties: string[];
  avatar_path: string | null;
  banner_path: string | null;
  website_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  beatstars_url: string | null;
  status: string;
  verified: boolean;
  is_public: boolean;
};

type BeatRow = {
  id: string;
  title: string;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  mood: string | null;
  region: string | null;
  tags: string[];
  license_tiers: Array<{ license: string; price: number }>;
  audio_path: string;
  artwork_path: string | null;
  duration_seconds: number;
  metadata: { featured?: boolean } | null;
};

type PlaylistRow = {
  id: string;
  title: string;
  description: string | null;
  producer_playlist_items: Array<{ beat_id: string; position: number }> | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const handle = normalizeHandle((await params).handle);
  if (!handle) return NextResponse.json({ error: "Producer not found." }, { status: 404 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Storefront is not configured." }, { status: 503 });
  }

  const viewerId = await getViewerId();
  const { data, error } = await admin
    .from("producer_profiles")
    .select("id, owner_id, display_name, handle, city, state, country, studio_name, years_producing, bio, genres, specialties, avatar_path, banner_path, website_url, instagram_url, youtube_url, beatstars_url, status, verified, is_public")
    .eq("handle", handle)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const profile = data as ProfileRow | null;
  const isPublic = profile?.status === "approved" && profile.is_public;
  const ownerPreview = Boolean(profile && viewerId === profile.owner_id && !isPublic);
  if (!profile || (!isPublic && !ownerPreview)) {
    return NextResponse.json({ error: "Producer storefront is not live." }, { status: 404 });
  }

  const [beatsResult, playlistsResult, metricsResult, followCountResult, followingResult, avatarResult, bannerResult] = await Promise.all([
    admin
      .from("producer_beats")
      .select("id, title, bpm, musical_key, genre, mood, region, tags, license_tiers, audio_path, artwork_path, duration_seconds, metadata")
      .eq("producer_profile_id", profile.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    admin
      .from("producer_playlists")
      .select("id, title, description, producer_playlist_items(beat_id, position)")
      .eq("producer_profile_id", profile.id)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    admin
      .from("producer_metrics")
      .select("profile_views, beat_plays, favorites, beat_adds, followers, sales")
      .eq("producer_profile_id", profile.id)
      .maybeSingle(),
    admin.from("producer_follows").select("id", { head: true, count: "exact" }).eq("producer_profile_id", profile.id),
    viewerId
      ? admin.from("producer_follows").select("id").eq("producer_profile_id", profile.id).eq("follower_id", viewerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.avatar_path ? admin.storage.from(BUCKET).createSignedUrl(profile.avatar_path, 60 * 20) : Promise.resolve({ data: null, error: null }),
    profile.banner_path ? admin.storage.from(BUCKET).createSignedUrl(profile.banner_path, 60 * 20) : Promise.resolve({ data: null, error: null }),
  ]);

  for (const result of [beatsResult, playlistsResult, metricsResult, followCountResult, followingResult]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const beats = ((beatsResult.data ?? []) as BeatRow[]).map((beat) => serializeBeat(beat, profile));
  const beatIds = new Set(beats.map((beat) => beat.id));
  const collections = ((playlistsResult.data ?? []) as unknown as PlaylistRow[]).map((playlist) => ({
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    beatIds: (playlist.producer_playlist_items ?? [])
      .sort((a, b) => a.position - b.position)
      .map((item) => item.beat_id)
      .filter((id) => beatIds.has(id)),
  }));

  return NextResponse.json({
    profile: {
      id: profile.id,
      displayName: profile.display_name,
      handle: profile.handle ?? handle,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      studioName: profile.studio_name,
      yearsProducing: profile.years_producing,
      bio: profile.bio,
      genres: profile.genres,
      specialties: profile.specialties,
      verified: profile.verified,
      avatarUrl: avatarResult.data?.signedUrl ?? null,
      bannerUrl: bannerResult.data?.signedUrl ?? null,
      social: {
        website: safeExternalUrl(profile.website_url),
        instagram: safeExternalUrl(profile.instagram_url),
        youtube: safeExternalUrl(profile.youtube_url),
        beatstars: safeExternalUrl(profile.beatstars_url),
      },
    },
    beats,
    collections,
    metrics: metricsResult.data ?? { profile_views: 0, beat_plays: 0, favorites: 0, beat_adds: 0, followers: 0, sales: 0 },
    followerCount: followCountResult.count ?? 0,
    following: Boolean(followingResult.data),
    signedIn: Boolean(viewerId),
    ownerPreview,
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const parsed = await parseJson(request, producerFollowSchema);
  if (parsed.response) return parsed.response;

  const handle = normalizeHandle((await params).handle);
  const { data: profile, error: profileError } = await supabase
    .from("producer_profiles")
    .select("id")
    .eq("handle", handle)
    .eq("status", "approved")
    .eq("is_public", true)
    .maybeSingle();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Producer storefront is not live." }, { status: 404 });

  if (parsed.data.action === "follow") {
    const { error } = await supabase.from("producer_follows").insert({
      follower_id: user.id,
      producer_profile_id: profile.id,
    });
    if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("producer_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("producer_profile_id", profile.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = createAdminClient();
  const { count } = await admin.from("producer_follows").select("id", { head: true, count: "exact" }).eq("producer_profile_id", profile.id);
  await admin
    .from("producer_metrics")
    .update({ followers: count ?? 0 })
    .eq("producer_profile_id", profile.id);
  return NextResponse.json({ following: parsed.data.action === "follow", followerCount: count ?? 0 });
}

function serializeBeat(beat: BeatRow, profile: ProfileRow) {
  return {
    id: beat.id,
    marketplaceId: `producer-beat-${beat.id}`,
    title: beat.title,
    producer: profile.display_name,
    producerId: `producer-${profile.id}`,
    bpm: beat.bpm ?? 0,
    key: beat.musical_key ?? "Key not listed",
    genre: beat.genre ?? "Independent",
    mood: beat.mood ?? beat.genre ?? "Independent",
    region: beat.region ?? profile.city ?? "Online",
    tags: beat.tags,
    duration: formatDuration(beat.duration_seconds),
    durationSeconds: beat.duration_seconds,
    audioUrl: `/api/marketplace/beats/${beat.id}/media?kind=audio`,
    artworkUrl: beat.artwork_path ? `/api/marketplace/beats/${beat.id}/media?kind=artwork` : null,
    licenseTiers: beat.license_tiers,
    featured: Boolean(beat.metadata?.featured),
  };
}

async function getViewerId() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch {
    return null;
  }
}

function normalizeHandle(value: string) {
  return decodeURIComponent(value).trim().replace(/^@+/, "").toLowerCase();
}

function formatDuration(seconds: number) {
  if (!seconds) return "Preview";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
