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
  attribution: string;
  artwork_path: string | null;
};

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("starter_beats")
      .select("id, slug, title, producer_name, producer_profile_id, source_type, rights_holder, license_scope, duration_seconds, bpm, musical_key, genre, mood, tags, attribution, artwork_path")
      .eq("is_active", true)
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
      attribution: beat.attribution,
      previewUrl: `/api/starter-beats/${beat.id}/media?kind=audio`,
      artworkUrl: beat.artwork_path ? `/api/starter-beats/${beat.id}/media?kind=artwork` : null,
    }));

    return NextResponse.json(
      { beats },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Starter Beats are unavailable.", beats: [] },
      { status: 503 },
    );
  }
}
