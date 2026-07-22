import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getProducerBeatBlockers } from "@/lib/producer-release";
import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCER_BUCKET = "producer-beats";
const STARTER_BUCKET = "starter-beats";
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;
const AUDIO_MIME_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"]);
const ARTWORK_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const deleteSchema = z.object({
  content_type: z.enum(["producer_profile", "producer_beat", "starter_beat"]),
  id: z.string().uuid(),
  confirmation: z.literal("REMOVE"),
});

const profileSchema = z.object({
  owner_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(80),
  handle: z.string().trim().min(2).max(40).regex(/^[a-z0-9._-]+$/i).optional(),
  city: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(1000).optional(),
  genres: z.array(z.string().trim().min(1).max(60)).max(12),
});

const producerBeatSchema = z.object({
  producer_profile_id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  duration_seconds: z.number().int().min(1).max(7200),
  bpm: z.number().int().min(40).max(220).nullable(),
  musical_key: z.string().trim().max(40).nullable(),
  genre: z.string().trim().max(80).nullable(),
  mood: z.string().trim().max(80).nullable(),
  region: z.string().trim().max(80).nullable(),
  tags: z.array(z.string().trim().min(1).max(60)).max(12),
  lease_price: z.number().int().min(0).max(1_000_000),
  premium_price: z.number().int().min(0).max(1_000_000),
  exclusive_price: z.number().int().min(0).max(1_000_000),
  publish: z.boolean(),
  featured: z.boolean(),
});

const starterBeatSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  title: z.string().trim().min(1).max(160),
  producer_name: z.string().trim().min(1).max(160),
  rights_holder: z.string().trim().min(1).max(200),
  source_type: z.enum(["suno_licensed", "producer_donated"]),
  duration_seconds: z.number().int().min(1).max(1800),
  bpm: z.number().int().min(40).max(220).nullable(),
  musical_key: z.string().trim().max(40).nullable(),
  genre: z.string().trim().max(80).nullable(),
  mood: z.string().trim().max(80).nullable(),
  tags: z.array(z.string().trim().min(1).max(60)).max(12),
  attribution: z.string().trim().max(500).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireRole("admin");
  if (admin.response || !admin.user) return admin.response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "admin-marketplace-create",
    limit: 60,
    windowSeconds: 60 * 60,
    identity: admin.user.id,
  });
  if (rateLimit) return rateLimit;

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin storage is unavailable." }, { status: 500 });
  }

  const formData = await request.formData();
  const contentType = formData.get("content_type")?.toString();
  if (contentType === "producer_profile") return createProducerProfile(supabase, formData);
  if (contentType === "producer_beat") return createProducerBeat(supabase, admin.user.id, formData);
  if (contentType === "starter_beat") return createStarterBeat(supabase, formData);
  return NextResponse.json({ error: "Choose a supported Marketplace content type." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const admin = await requireRole("admin");
  if (admin.response || !admin.user) return admin.response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "admin-marketplace-delete",
    limit: 40,
    windowSeconds: 60 * 60,
    identity: admin.user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm the permanent removal before continuing." }, { status: 400 });

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin storage is unavailable." }, { status: 500 });
  }

  if (parsed.data.content_type === "producer_beat") return removeProducerBeat(supabase, parsed.data.id);
  if (parsed.data.content_type === "starter_beat") return removeStarterBeat(supabase, parsed.data.id);
  return removeProducerProfile(supabase, parsed.data.id);
}

async function createProducerProfile(supabase: ReturnType<typeof createAdminClient>, formData: FormData) {
  const parsed = profileSchema.safeParse({
    owner_id: text(formData, "owner_id"),
    display_name: text(formData, "display_name"),
    handle: nullableText(formData, "handle")?.replace(/^@+/, "").toLowerCase() || undefined,
    city: nullableText(formData, "city") || undefined,
    bio: nullableText(formData, "bio") || undefined,
    genres: splitList(formData.get("genres")),
  });
  if (!parsed.success) return invalidResponse(parsed.error.issues[0]?.message);

  const { data: owner, error: ownerError } = await supabase.auth.admin.getUserById(parsed.data.owner_id);
  if (ownerError || !owner.user) return NextResponse.json({ error: "Choose an existing RapWriter account." }, { status: 404 });

  const { data, error } = await supabase
    .from("producer_profiles")
    .insert({
      owner_id: parsed.data.owner_id,
      display_name: parsed.data.display_name,
      handle: parsed.data.handle ?? null,
      city: parsed.data.city ?? null,
      bio: parsed.data.bio ?? null,
      genres: parsed.data.genres,
      specialties: parsed.data.genres,
      status: "draft",
      verified: false,
      is_public: false,
    })
    .select("id, display_name, handle, status")
    .single();
  if (error) return NextResponse.json({ error: friendlyDatabaseError(error.message, "That account already has a producer profile.") }, { status: 409 });
  return NextResponse.json({ created: data, content_type: "producer_profile" }, { status: 201 });
}

async function createProducerBeat(supabase: ReturnType<typeof createAdminClient>, reviewerId: string, formData: FormData) {
  const parsed = producerBeatSchema.safeParse({
    producer_profile_id: text(formData, "producer_profile_id"),
    title: text(formData, "title"),
    duration_seconds: numberValue(formData, "duration_seconds"),
    bpm: optionalNumberValue(formData, "bpm"),
    musical_key: nullableText(formData, "musical_key"),
    genre: nullableText(formData, "genre"),
    mood: nullableText(formData, "mood"),
    region: nullableText(formData, "region"),
    tags: splitList(formData.get("tags")),
    lease_price: numberValue(formData, "lease_price", 49),
    premium_price: numberValue(formData, "premium_price", 149),
    exclusive_price: numberValue(formData, "exclusive_price", 899),
    publish: formData.get("publish")?.toString() === "true",
    featured: formData.get("featured")?.toString() === "true",
  });
  if (!parsed.success) return invalidResponse(parsed.error.issues[0]?.message);

  const audio = formData.get("audio");
  const artwork = formData.get("artwork");
  const fileError = validateFiles(audio, artwork);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
  if (!(audio instanceof File)) return NextResponse.json({ error: "Beat audio is required." }, { status: 400 });
  const artworkFile = artwork instanceof File && artwork.size > 0 ? artwork : null;

  const { data: profile, error: profileError } = await supabase
    .from("producer_profiles")
    .select("id, owner_id, status, is_public")
    .eq("id", parsed.data.producer_profile_id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Producer profile not found." }, { status: 404 });
  if (parsed.data.publish && (profile.status !== "approved" || !profile.is_public)) {
    return NextResponse.json({ error: "Approve the producer profile before publishing its beat." }, { status: 422 });
  }

  const audioPath = `${profile.owner_id}/beats/${crypto.randomUUID()}.${extensionForMime(audio.type)}`;
  const artworkPath = artworkFile
    ? `${profile.owner_id}/artwork/${crypto.randomUUID()}.${extensionForMime(artworkFile.type)}`
    : null;
  if (parsed.data.publish) {
    const blockers = getProducerBeatBlockers({
      ...parsed.data,
      audio_path: audioPath,
      artwork_path: artworkPath,
      license_tiers: licenseTiers(parsed.data),
    });
    if (blockers.length) return NextResponse.json({ error: blockers[0], blockers }, { status: 422 });
  }

  const uploaded: string[] = [];
  try {
    const { error: audioError } = await supabase.storage.from(PRODUCER_BUCKET).upload(audioPath, audio, { contentType: audio.type, upsert: false });
    if (audioError) throw audioError;
    uploaded.push(audioPath);

    if (artworkPath && artworkFile) {
      const { error: artworkError } = await supabase.storage.from(PRODUCER_BUCKET).upload(artworkPath, artworkFile, { contentType: artworkFile.type, upsert: false });
      if (artworkError) throw artworkError;
      uploaded.push(artworkPath);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("producer_beats")
      .insert({
        owner_id: profile.owner_id,
        producer_profile_id: profile.id,
        title: parsed.data.title,
        bpm: parsed.data.bpm,
        duration_seconds: parsed.data.duration_seconds,
        musical_key: parsed.data.musical_key,
        genre: parsed.data.genre,
        mood: parsed.data.mood,
        region: parsed.data.region,
        tags: parsed.data.tags,
        license_tiers: licenseTiers(parsed.data),
        audio_bucket: PRODUCER_BUCKET,
        audio_path: audioPath,
        artwork_path: artworkPath,
        status: parsed.data.publish ? "approved" : "draft",
        submitted_at: parsed.data.publish ? now : null,
        reviewed_at: parsed.data.publish ? now : null,
        reviewed_by: parsed.data.publish ? reviewerId : null,
        metadata: { featured: parsed.data.publish && parsed.data.featured, admin_imported: true },
      })
      .select("id, title, status")
      .single();
    if (error) throw error;
    return NextResponse.json({ created: data, content_type: "producer_beat" }, { status: 201 });
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(PRODUCER_BUCKET).remove(uploaded);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The beat could not be added." }, { status: 500 });
  }
}

async function createStarterBeat(supabase: ReturnType<typeof createAdminClient>, formData: FormData) {
  const parsed = starterBeatSchema.safeParse({
    slug: text(formData, "slug").toLowerCase(),
    title: text(formData, "title"),
    producer_name: text(formData, "producer_name"),
    rights_holder: text(formData, "rights_holder"),
    source_type: text(formData, "source_type"),
    duration_seconds: numberValue(formData, "duration_seconds"),
    bpm: optionalNumberValue(formData, "bpm"),
    musical_key: nullableText(formData, "musical_key"),
    genre: nullableText(formData, "genre"),
    mood: nullableText(formData, "mood"),
    tags: splitList(formData.get("tags")),
    attribution: nullableText(formData, "attribution") || undefined,
  });
  if (!parsed.success) return invalidResponse(parsed.error.issues[0]?.message);

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size < 1 || audio.size > MAX_AUDIO_BYTES || !AUDIO_MIME_TYPES.has(audio.type)) {
    return NextResponse.json({ error: "Upload an MP3, M4A, WAV, OGG, or WebM file under 200 MB." }, { status: 400 });
  }

  const audioPath = `catalog/${parsed.data.slug}/${crypto.randomUUID()}.${extensionForMime(audio.type)}`;
  const { error: uploadError } = await supabase.storage.from(STARTER_BUCKET).upload(audioPath, audio, { contentType: audio.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("starter_beats")
    .insert({
      ...parsed.data,
      attribution: parsed.data.attribution || `Included with RapWriter. Courtesy of ${parsed.data.producer_name}.`,
      audio_bucket: STARTER_BUCKET,
      audio_path: audioPath,
      license_scope: "rapwriter_starter_nonexclusive",
      is_active: true,
      metadata: { admin_imported: true },
    })
    .select("id, slug, title, is_active")
    .single();
  if (error) {
    await supabase.storage.from(STARTER_BUCKET).remove([audioPath]);
    return NextResponse.json({ error: friendlyDatabaseError(error.message, "A starter beat already uses that slug.") }, { status: 409 });
  }
  return NextResponse.json({ created: data, content_type: "starter_beat" }, { status: 201 });
}

async function removeProducerBeat(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const { data: beat, error: readError } = await supabase.from("producer_beats").select("id, audio_bucket, audio_path, artwork_path").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!beat) return NextResponse.json({ error: "Beat not found." }, { status: 404 });
  const { error } = await supabase.from("producer_beats").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const paths = [beat.audio_path, beat.artwork_path].filter((path): path is string => Boolean(path));
  const cleanup = paths.length ? await supabase.storage.from(beat.audio_bucket || PRODUCER_BUCKET).remove(paths) : { error: null };
  return NextResponse.json({ deleted: true, cleanup_warning: cleanup.error?.message ?? null });
}

async function removeStarterBeat(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const { data: beat, error: readError } = await supabase.from("starter_beats").select("id, audio_bucket, audio_path, artwork_path").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!beat) return NextResponse.json({ error: "Starter beat not found." }, { status: 404 });
  const { error } = await supabase.from("starter_beats").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const paths = [beat.audio_path, beat.artwork_path].filter((path): path is string => Boolean(path));
  const cleanup = paths.length ? await supabase.storage.from(beat.audio_bucket || STARTER_BUCKET).remove(paths) : { error: null };
  return NextResponse.json({ deleted: true, cleanup_warning: cleanup.error?.message ?? null });
}

async function removeProducerProfile(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const [{ data: profile, error: profileError }, { data: beats, error: beatsError }] = await Promise.all([
    supabase.from("producer_profiles").select("id, avatar_path, banner_path").eq("id", id).maybeSingle(),
    supabase.from("producer_beats").select("audio_bucket, audio_path, artwork_path").eq("producer_profile_id", id),
  ]);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (beatsError) return NextResponse.json({ error: beatsError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Producer profile not found." }, { status: 404 });

  const { error } = await supabase.from("producer_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paths = [
    profile.avatar_path,
    profile.banner_path,
    ...(beats ?? []).flatMap((beat) => [beat.audio_path, beat.artwork_path]),
  ].filter((path): path is string => Boolean(path));
  const cleanup = paths.length ? await supabase.storage.from(PRODUCER_BUCKET).remove(paths) : { error: null };
  return NextResponse.json({ deleted: true, cleanup_warning: cleanup.error?.message ?? null });
}

function validateFiles(audio: FormDataEntryValue | null, artwork: FormDataEntryValue | null) {
  if (!(audio instanceof File) || audio.size < 1 || audio.size > MAX_AUDIO_BYTES || !AUDIO_MIME_TYPES.has(audio.type)) {
    return "Upload an MP3, M4A, WAV, OGG, or WebM beat under 200 MB.";
  }
  if (artwork instanceof File && artwork.size > 0 && (artwork.size > MAX_ARTWORK_BYTES || !ARTWORK_MIME_TYPES.has(artwork.type))) {
    return "Artwork must be a JPEG, PNG, or WebP image under 10 MB.";
  }
  return null;
}

function licenseTiers(values: { lease_price: number; premium_price: number; exclusive_price: number }) {
  return [
    { license: "Lease", price: values.lease_price },
    { license: "Premium Lease", price: values.premium_price },
    { license: "Exclusive", price: values.exclusive_price },
  ];
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

function text(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

function nullableText(formData: FormData, key: string) {
  return text(formData, key) || null;
}

function numberValue(formData: FormData, key: string, fallback = Number.NaN) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function optionalNumberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? numberValue(formData, key) : null;
}

function splitList(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function invalidResponse(message?: string) {
  return NextResponse.json({ error: message || "Check the required Marketplace fields." }, { status: 400 });
}

function friendlyDatabaseError(message: string, fallback: string) {
  return /duplicate|unique/i.test(message) ? fallback : message;
}
