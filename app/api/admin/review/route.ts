import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getProducerBeatBlockers, getProducerProfileBlockers } from "@/lib/producer-release";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "producer-beats";
const STARTER_BUCKET = "starter-beats";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  target: z.enum(["profile", "beat"]),
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  admin_notes: z.string().trim().max(1000).optional(),
  featured: z.boolean().optional(),
});

async function signBeatAssets(supabase: ReturnType<typeof createAdminClient>, beat: Record<string, unknown>) {
  const audioPath = typeof beat.audio_path === "string" ? beat.audio_path : null;
  const artworkPath = typeof beat.artwork_path === "string" ? beat.artwork_path : null;
  const [audio, artwork] = await Promise.all([
    audioPath ? supabase.storage.from(BUCKET).createSignedUrl(audioPath, 60 * 20) : Promise.resolve({ data: null }),
    artworkPath ? supabase.storage.from(BUCKET).createSignedUrl(artworkPath, 60 * 20) : Promise.resolve({ data: null }),
  ]);

  return {
    ...beat,
    audio_url: audio.data?.signedUrl ?? null,
    artwork_url: artwork.data?.signedUrl ?? null,
  };
}

async function signStarterBeat(supabase: ReturnType<typeof createAdminClient>, beat: Record<string, unknown>) {
  const audioPath = typeof beat.audio_path === "string" ? beat.audio_path : null;
  const audioBucket = typeof beat.audio_bucket === "string" ? beat.audio_bucket : STARTER_BUCKET;
  const audio = audioPath
    ? await supabase.storage.from(audioBucket).createSignedUrl(audioPath, 60 * 20)
    : { data: null };
  return { ...beat, audio_url: audio.data?.signedUrl ?? null };
}

export async function GET() {
  const admin = await requireRole("admin");
  if (admin.response) return admin.response;

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      {
        configured: false,
        error: err instanceof Error ? err.message : "Supabase admin client is not configured.",
        profiles: [],
        beats: [],
        starter_beats: [],
        accounts: [],
      },
      { status: 200 },
    );
  }

  const [
    { data: profiles, error: profilesError },
    { data: beats, error: beatsError },
    { data: starterBeats, error: starterBeatsError },
    { data: activity, error: activityError },
    { count: adminCount, error: adminCountError },
    { data: accountPage, error: accountsError },
  ] = await Promise.all([
    supabase
      .from("producer_profiles")
      .select("id, owner_id, display_name, handle, city, country, bio, genres, specialties, status, verified, is_public, submitted_at, reviewed_at, created_at, updated_at, producer_business_settings(onboarding_completed, business_email)")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("producer_beats")
      .select("*, producer_profiles(display_name, handle, city, status, verified)")
      .order("updated_at", { ascending: false })
      .limit(150),
    supabase
      .from("starter_beats")
      .select("id, slug, title, producer_name, producer_profile_id, source_type, rights_holder, audio_bucket, audio_path, artwork_path, duration_seconds, bpm, musical_key, genre, mood, tags, attribution, is_active, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("producer_release_reviews")
      .select("id, target_type, target_id, from_status, to_status, notes, blockers, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
  if (beatsError) return NextResponse.json({ error: beatsError.message }, { status: 500 });
  if (starterBeatsError) return NextResponse.json({ error: starterBeatsError.message }, { status: 500 });
  if (activityError) return NextResponse.json({ error: activityError.message }, { status: 500 });
  if (adminCountError) return NextResponse.json({ error: adminCountError.message }, { status: 500 });
  if (accountsError) return NextResponse.json({ error: accountsError.message }, { status: 500 });

  const [signedBeats, signedStarterBeats] = await Promise.all([
    Promise.all((beats ?? []).map((beat) => signBeatAssets(supabase, beat))),
    Promise.all((starterBeats ?? []).map((beat) => signStarterBeat(supabase, beat))),
  ]);
  const profileOwnerIds = new Set((profiles ?? []).map((profile) => profile.owner_id));
  const accounts = (accountPage.users ?? []).map((user) => ({
    id: user.id,
    email: user.email ?? null,
    has_producer_profile: profileOwnerIds.has(user.id),
  }));

  return NextResponse.json(
    {
      configured: true,
      profiles: profiles ?? [],
      beats: signedBeats,
      starter_beats: signedStarterBeats,
      accounts,
      activity: activity ?? [],
      security: { admin_count: adminCount ?? 0 },
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function PATCH(request: Request) {
  const admin = await requireRole("admin");
  if (admin.response || !admin.user) return admin.response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "admin-review",
    limit: 120,
    windowSeconds: 60 * 60,
    identity: admin.user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Supabase admin client is not configured." }, { status: 500 });
  }

  if (parsed.data.target === "profile") {
    const { data: current, error: currentError } = await supabase
      .from("producer_profiles")
      .select("*, producer_business_settings(onboarding_completed, business_email)")
      .eq("id", parsed.data.id)
      .single();

    if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
    const businessValue = current.producer_business_settings as unknown;
    const business = Array.isArray(businessValue) ? businessValue[0] ?? null : businessValue;
    const blockers = getProducerProfileBlockers(current, business as { onboarding_completed?: boolean; business_email?: string } | null);
    if (parsed.data.status === "approved" && blockers.length) {
      return NextResponse.json({ error: blockers[0], blockers }, { status: 422 });
    }
    if (parsed.data.status === "rejected" && !parsed.data.admin_notes) {
      return NextResponse.json({ error: "Add a review note before rejecting a producer profile." }, { status: 422 });
    }

    const { data, error } = await supabase.rpc("apply_producer_release_review", {
      p_target_type: "profile",
      p_target_id: parsed.data.id,
      p_reviewer_id: admin.user!.id,
      p_status: parsed.data.status,
      p_notes: parsed.data.admin_notes ?? null,
      p_blockers: blockers,
      p_featured: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data, blockers });
  }

  const { data: current, error: currentError } = await supabase
    .from("producer_beats")
    .select("*, producer_profiles(id, owner_id, status, is_public)")
    .eq("id", parsed.data.id)
    .single();

  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  const profileValue = current.producer_profiles as unknown;
  const profile = (Array.isArray(profileValue) ? profileValue[0] ?? null : profileValue) as {
    status?: string;
    is_public?: boolean;
  } | null;
  const blockers = getProducerBeatBlockers(current);
  if (profile?.status !== "approved" || !profile.is_public) {
    blockers.unshift("Approve the producer profile before approving this beat.");
  }
  if (parsed.data.status === "approved" && blockers.length) {
    return NextResponse.json({ error: blockers[0], blockers }, { status: 422 });
  }
  if (parsed.data.status === "rejected" && !parsed.data.admin_notes) {
    return NextResponse.json({ error: "Add a review note before rejecting a beat." }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("apply_producer_release_review", {
    p_target_type: "beat",
    p_target_id: parsed.data.id,
    p_reviewer_id: admin.user!.id,
    p_status: parsed.data.status,
    p_notes: parsed.data.admin_notes ?? null,
    p_blockers: blockers,
    p_featured: parsed.data.featured ?? false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ beat: data, blockers });
}
