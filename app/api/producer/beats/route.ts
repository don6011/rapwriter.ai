import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getProducerBeatBlockers, getProducerProfileBlockers } from "@/lib/producer-release";
import { producerBeatUpdateSchema } from "@/lib/schemas";

const BUCKET = "producer-beats";
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;
const AUDIO_MIME_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"]);
const ARTWORK_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "bin";
}

function splitTags(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parsePrice(value: FormDataEntryValue | null, fallback: number) {
  const next = Number(value?.toString() ?? fallback);
  return Number.isFinite(next) && next >= 0 ? Math.round(next) : fallback;
}

async function signedUrl(supabase: Awaited<ReturnType<typeof requireRole>>["supabase"], path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "producer-beat-upload",
    limit: 20,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const [{ data: profile, error: profileError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from("producer_profiles").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_business_settings").select("*").eq("owner_id", user.id).maybeSingle(),
  ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Complete producer onboarding before uploading beats." }, { status: 409 });

  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "Beat audio file is required." }, { status: 400 });
  if (audio.size < 1 || audio.size > MAX_AUDIO_BYTES || !AUDIO_MIME_TYPES.has(audio.type)) {
    return NextResponse.json({ error: "Upload an MP3, M4A, WAV, OGG, or WebM beat under 200 MB." }, { status: 400 });
  }

  const artwork = formData.get("artwork");
  if (artwork instanceof File && artwork.size > 0 && (artwork.size > MAX_ARTWORK_BYTES || !ARTWORK_MIME_TYPES.has(artwork.type))) {
    return NextResponse.json({ error: "Artwork must be a JPEG, PNG, or WebP image under 10 MB." }, { status: 400 });
  }

  const bpmValue = formData.get("bpm")?.toString().trim();
  const durationSeconds = Number(formData.get("duration_seconds") ?? 0);
  const status = formData.get("submit")?.toString() === "true" ? "submitted" : "draft";
  const lease = parsePrice(formData.get("lease_price"), 49);
  const premium = parsePrice(formData.get("premium_price"), 149);
  const exclusive = parsePrice(formData.get("exclusive_price"), 899);
  const parsed = producerBeatUpdateSchema.safeParse({
    title: formData.get("title")?.toString() ?? "",
    bpm: bpmValue ? Number(bpmValue) : null,
    duration_seconds: durationSeconds,
    musical_key: formData.get("musical_key")?.toString().trim() || null,
    genre: formData.get("genre")?.toString().trim() || null,
    mood: formData.get("mood")?.toString().trim() || null,
    region: formData.get("region")?.toString().trim() || null,
    tags: splitTags(formData.get("tags")),
    license_tiers: [
      { license: "Lease", price: lease },
      { license: "Premium Lease", price: premium },
      { license: "Exclusive", price: exclusive },
    ],
    submit: status === "submitted",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid beat details." }, { status: 400 });
  }

  if (status === "submitted") {
    const profileBlockers = getProducerProfileBlockers(profile, business);
    const profileCanQueueBeat = profile.status === "submitted" || profile.status === "approved";
    if (!profileCanQueueBeat || profileBlockers.length) {
      const blockers = profileCanQueueBeat
        ? profileBlockers
        : ["Submit your completed producer profile before submitting beats.", ...profileBlockers];
      return NextResponse.json({ error: blockers[0], blockers }, { status: 422 });
    }
    const beatBlockers = getProducerBeatBlockers({
      ...parsed.data,
      audio_path: "pending-upload",
      artwork_path: artwork instanceof File && artwork.size > 0 ? "pending-upload" : null,
    });
    if (beatBlockers.length) {
      return NextResponse.json({ error: beatBlockers[0], blockers: beatBlockers }, { status: 422 });
    }
  }

  const audioPath = `${user.id}/beats/${crypto.randomUUID()}.${extensionForMime(audio.type)}`;
  const { error: audioError } = await supabase.storage.from(BUCKET).upload(audioPath, audio, {
    contentType: audio.type,
    upsert: false,
  });
  if (audioError) return NextResponse.json({ error: audioError.message }, { status: 500 });

  let artworkPath: string | null = null;
  if (artwork instanceof File && artwork.size > 0) {
    artworkPath = `${user.id}/artwork/${crypto.randomUUID()}.${extensionForMime(artwork.type)}`;
    const { error: artworkError } = await supabase.storage.from(BUCKET).upload(artworkPath, artwork, {
      contentType: artwork.type,
      upsert: false,
    });
    if (artworkError) {
      await supabase.storage.from(BUCKET).remove([audioPath]);
      return NextResponse.json({ error: artworkError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("producer_beats")
    .insert({
      owner_id: user.id,
      producer_profile_id: profile.id,
      title: parsed.data.title,
      bpm: parsed.data.bpm,
      duration_seconds: parsed.data.duration_seconds,
      musical_key: parsed.data.musical_key,
      genre: parsed.data.genre,
      mood: parsed.data.mood,
      region: parsed.data.region,
      tags: parsed.data.tags,
      license_tiers: parsed.data.license_tiers,
      audio_bucket: BUCKET,
      audio_path: audioPath,
      artwork_path: artworkPath,
      status,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([audioPath, artworkPath].filter((path): path is string => Boolean(path)));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    return NextResponse.json(
      {
        beat: {
          ...data,
          audio_url: await signedUrl(supabase, audioPath),
          artwork_url: artworkPath ? await signedUrl(supabase, artworkPath) : null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        beat: { ...data, audio_url: null, artwork_url: null },
        warning: err instanceof Error ? err.message : "Uploaded files could not be previewed yet.",
      },
      { status: 201 },
    );
  }
}
