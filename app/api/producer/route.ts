import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { producerUpgradeAccountType, type AccountType } from "@/lib/account-role";
import { getProducerBeatBlockers, getProducerProfileBlockers } from "@/lib/producer-release";
import { getMembershipForUser } from "@/lib/server/membership";
import { producerProfileUpsertSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "producer-beats";

async function signProducerBeatAssets(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
  beat: Record<string, unknown>,
) {
  const audioPath = typeof beat.audio_path === "string" ? beat.audio_path : null;
  const artworkPath = typeof beat.artwork_path === "string" ? beat.artwork_path : null;
  const [audio, artwork] = await Promise.all([
    audioPath ? supabase.storage.from(BUCKET).createSignedUrl(audioPath, 60 * 60) : Promise.resolve({ data: null, error: null }),
    artworkPath ? supabase.storage.from(BUCKET).createSignedUrl(artworkPath, 60 * 60) : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    ...beat,
    audio_url: audio.data?.signedUrl ?? null,
    artwork_url: artwork.data?.signedUrl ?? null,
  };
}

export async function GET() {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  let membership;
  try {
    membership = await getMembershipForUser(supabase, user.id);
  } catch {
    return NextResponse.json({ error: "Producer membership is temporarily unavailable." }, { status: 503 });
  }

  const { data: producerPlans, error: producerPlansError } = await supabase
    .from("subscription_plans")
    .select("id, audience, tier, name, tagline, monthly_price_cents, annual_price_cents, currency, entitlements, limits, metadata")
    .eq("audience", "producer")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("tier");
  if (producerPlansError) return NextResponse.json({ error: producerPlansError.message }, { status: 500 });

  const { data: profile, error: profileError } = await supabase
    .from("producer_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const [beatsResult, playlistsResult, settingsResult, billingResult, metricsResult, reviewsResult] = await Promise.all([
    supabase.from("producer_beats").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("producer_playlists").select("*, producer_playlist_items(*)").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("producer_business_settings").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_billing_accounts").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_metrics").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_release_reviews").select("*").eq("producer_owner_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

  if (beatsResult.error) return NextResponse.json({ error: beatsResult.error.message }, { status: 500 });
  if (playlistsResult.error) return NextResponse.json({ error: playlistsResult.error.message }, { status: 500 });
  for (const result of [settingsResult, billingResult, metricsResult, reviewsResult]) {
    if (result.error && result.error.code !== "42P01") return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const signedBeats = await Promise.all((beatsResult.data ?? []).map((beat) => signProducerBeatAssets(supabase, beat)));

  const profileBlockers = getProducerProfileBlockers(profile, settingsResult.data);
  const beatReadiness = Object.fromEntries(
    (beatsResult.data ?? []).map((beat) => [beat.id, getProducerBeatBlockers(beat)]),
  );

  return NextResponse.json({
    profile,
    beats: signedBeats,
    playlists: playlistsResult.data ?? [],
    business: settingsResult.data ?? null,
    billing: billingResult.data ?? { plan: "free", stripe_status: "not_connected", payouts_enabled: false, charges_enabled: false, verification: {} },
    membership,
    plans: producerPlans ?? [],
    metrics: metricsResult.data ?? emptyProducerMetrics(),
    reviews: reviewsResult.data ?? [],
    release_readiness: buildReleaseReadiness(profile, beatsResult.data ?? [], profileBlockers, beatReadiness),
    foundation_ready: !settingsResult.error,
  });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "producer-profile-save",
    limit: 60,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = await parseJson(request, producerProfileUpsertSchema);
  if (parsed.response) return parsed.response;

  const profile = {
    owner_id: user.id,
    display_name: parsed.data.display_name,
    handle: parsed.data.handle ?? null,
    city: parsed.data.city ?? null,
    studio_name: parsed.data.studio_name || null,
    state: parsed.data.state || null,
    country: parsed.data.country,
    years_producing: parsed.data.years_producing ?? null,
    bio: parsed.data.bio ?? null,
    genres: parsed.data.genres,
    specialties: parsed.data.specialties,
    website_url: parsed.data.website_url || null,
    instagram_url: parsed.data.instagram_url || null,
    youtube_url: parsed.data.youtube_url || null,
    beatstars_url: parsed.data.beatstars_url || null,
  };

  const { data, error } = await supabase
    .from("producer_profiles")
    .upsert(profile, { onConflict: "owner_id" })
    .select("*")
    .single();

  if (error) {
    const migrationHint = error.code === "42703" ? " Apply producer_economy_foundation migration first." : "";
    return NextResponse.json({ error: `${error.message}${migrationHint}` }, { status: 500 });
  }

  const onboardingCompleted = Boolean(
    parsed.data.display_name.trim() &&
      parsed.data.city?.trim() &&
      parsed.data.country.trim() &&
      parsed.data.specialties.length > 0 &&
      parsed.data.license_settings.lease >= 0,
  );

  const { data: business, error: businessError } = await supabase
    .from("producer_business_settings")
    .upsert(
      {
        owner_id: user.id,
        producer_profile_id: data.id,
        business_email: parsed.data.business_email || user.email || null,
        contact_preference: parsed.data.contact_preference,
        license_settings: parsed.data.license_settings,
        default_license_terms: parsed.data.default_license_terms || null,
        automatic_delivery: parsed.data.automatic_delivery,
        onboarding_step: parsed.data.onboarding_step,
        onboarding_completed: onboardingCompleted,
      },
      { onConflict: "owner_id" },
    )
    .select("*")
    .single();

  if (businessError) {
    const migrationHint = businessError.code === "42P01" ? " Apply producer_economy_foundation migration first." : "";
    return NextResponse.json({ error: `${businessError.message}${migrationHint}` }, { status: 500 });
  }

  const profileBlockers = getProducerProfileBlockers(data, business);
  if (parsed.data.submit && profileBlockers.length) {
    return NextResponse.json(
      { error: profileBlockers[0], blockers: profileBlockers },
      { status: 422 },
    );
  }

  let savedProfile = data;
  try {
    const admin = createAdminClient();
    const initialization = await Promise.all([
      admin.from("user_roles").upsert(
        { user_id: user.id, role: "producer", granted_by: user.id },
        { onConflict: "user_id,role" },
      ),
      admin.from("producer_billing_accounts").upsert({ owner_id: user.id, producer_profile_id: data.id }, { onConflict: "owner_id" }),
      admin.from("producer_metrics").upsert({ owner_id: user.id, producer_profile_id: data.id }, { onConflict: "producer_profile_id" }),
    ]);
    const initializationError = initialization.find((result) => result.error)?.error;
    if (initializationError) throw initializationError;
    if (parsed.data.submit) {
      const { data: submittedProfile, error: submitError } = await admin
        .from("producer_profiles")
        .update({
          status: "submitted",
          is_public: false,
          submitted_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq("id", data.id)
        .eq("owner_id", user.id)
        .select("*")
        .single();
      if (submitError) throw submitError;
      savedProfile = submittedProfile;
    }
  } catch (adminError) {
    return NextResponse.json({ error: adminError instanceof Error ? adminError.message : "Could not initialize producer business account." }, { status: 500 });
  }

  const { data: accountProfile, error: accountProfileError } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (accountProfileError) return NextResponse.json({ error: accountProfileError.message }, { status: 500 });

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      account_type: producerUpgradeAccountType(accountProfile?.account_type as AccountType | null),
      role_onboarding_completed: true,
      onboarding_completed: onboardingCompleted,
      artist_name: parsed.data.display_name,
    })
    .eq("id", user.id);

  if (profileUpdateError) return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });

  return NextResponse.json({
    profile: savedProfile,
    business,
    onboarding_completed: onboardingCompleted,
    release_readiness: {
      profile_blockers: profileBlockers,
      profile_ready: profileBlockers.length === 0,
    },
  });
}

function buildReleaseReadiness(
  profile: Record<string, unknown> | null,
  beats: Array<Record<string, unknown>>,
  profileBlockers: string[],
  beatReadiness: Record<string, string[]>,
) {
  const approvedBeat = beats.find((beat) => beat.status === "approved");
  const submittedBeat = beats.find((beat) => beat.status === "submitted");
  const releasableBeat = beats.find((beat) => (beatReadiness[String(beat.id)] ?? []).length === 0);
  let phase = "profile";
  let nextAction = profileBlockers[0] ?? "Complete your producer profile.";

  if (profile && profileBlockers.length === 0) {
    if (profile.status === "submitted") {
      phase = "profile_review";
      nextAction = "Profile in review. You can submit beats while you wait.";
    } else if (profile.status !== "approved") {
      phase = "submit_profile";
      nextAction = "Submit your producer profile for review.";
    } else if (approvedBeat) {
      phase = "live";
      nextAction = "Your first release is live in Studio Store.";
    } else if (submittedBeat) {
      phase = "beat_review";
      nextAction = "Your beat is waiting for admin review.";
    } else if (releasableBeat) {
      phase = "submit_beat";
      nextAction = "Submit your release-ready beat for review.";
    } else if (beats.length) {
      const firstBeat = beats[0];
      phase = "finish_beat";
      nextAction = (beatReadiness[String(firstBeat.id)] ?? [])[0] ?? "Finish your beat metadata.";
    } else {
      phase = "upload_beat";
      nextAction = "Upload your first beat.";
    }
  }

  return {
    phase,
    next_action: nextAction,
    profile_ready: profileBlockers.length === 0,
    profile_blockers: profileBlockers,
    beat_blockers: beatReadiness,
    live_beat_count: beats.filter((beat) => beat.status === "approved").length,
  };
}

function emptyProducerMetrics() {
  return {
    profile_views: 0,
    beat_plays: 0,
    favorites: 0,
    beat_adds: 0,
    followers: 0,
    sales: 0,
    repeat_customers: 0,
    revenue_cents: 0,
    revenue_month_cents: 0,
    revenue_year_cents: 0,
    average_listen_seconds: 0,
    top_city: null,
    top_state: null,
  };
}
