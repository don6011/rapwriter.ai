import { NextResponse } from "next/server";
import type { StarterBeat } from "@/lib/starter-beats";
import { createAdminClient } from "@/lib/supabase/admin";

type StarterBeatRow = {
  id: string;
  slug: string;
  title: string;
  producer_name: string;
  producer_profile_id: string | null;
  source_type: StarterBeat["sourceType"];
  rights_holder: string;
  license_scope: StarterBeat["licenseScope"];
  duration_seconds: number;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  mood: string | null;
  tags: string[];
  collection_slug: string | null;
  energy: StarterBeat["energy"];
  writing_fit: string[];
  starter_beat_collections: { title: string } | Array<{ title: string }> | null;
  attribution: string;
  is_featured: boolean;
  preview_seconds: number;
  artwork_path: string | null;
};

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("starter_beats")
      .select("id, slug, title, producer_name, producer_profile_id, source_type, rights_holder, license_scope, duration_seconds, bpm, musical_key, genre, mood, tags, collection_slug, energy, writing_fit, attribution, is_featured, preview_seconds, artwork_path, starter_beat_collections(title)")
      .eq("status", "published")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const beats = ((data ?? []) as StarterBeatRow[]).map<StarterBeat>((beat) => ({
      id: beat.id,
      slug: beat.slug,
      title: beat.title,
      producer: beat.producer_name,
      producerProfileId: beat.producer_profile_id,
      sourceType: beat.source_type,
      rightsHolder: beat.rights_holder,
      licenseScope: beat.license_scope,
      duration: beat.duration_seconds,
      bpm: beat.bpm,
      key: beat.musical_key,
      genre: beat.genre,
      mood: beat.mood,
      tags: beat.tags ?? [],
      collectionSlug: beat.collection_slug,
      collection: Array.isArray(beat.starter_beat_collections)
        ? beat.starter_beat_collections[0]?.title ?? null
        : beat.starter_beat_collections?.title ?? null,
      energy: beat.energy,
      writingFit: beat.writing_fit ?? [],
      attribution: beat.attribution,
      featured: beat.is_featured,
      previewSeconds: beat.preview_seconds,
      previewUrl: `/api/starter-beats/${beat.id}/media?kind=audio`,
      artworkUrl: beat.artwork_path ? `/api/starter-beats/${beat.id}/media?kind=artwork` : null,
    }));

    return NextResponse.json(
      { beats },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Starter Beats are unavailable.", beats: [] },
      { status: 503 },
    );
  }
}
