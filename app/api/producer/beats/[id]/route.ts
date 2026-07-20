import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { getProducerBeatBlockers, getProducerProfileBlockers } from "@/lib/producer-release";
import { producerBeatUpdateSchema } from "@/lib/schemas";

const BUCKET = "producer-beats";
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;
const AUDIO_MIME_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"]);
const ARTWORK_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("png")) return "png";
  return "jpg";
}

function optionalText(value: FormDataEntryValue | null) {
  const text = value?.toString().trim() ?? "";
  return text || null;
}

function parsePrice(value: FormDataEntryValue | null) {
  const price = Number(value?.toString() ?? 0);
  return Number.isFinite(price) ? Math.round(price) : Number.NaN;
}

async function signedUrl(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
  path: string | null,
) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const beatId = (await params).id;
  if (!uuidPattern.test(beatId)) return NextResponse.json({ error: "Invalid beat." }, { status: 400 });

  const { data: current, error: currentError } = await supabase
    .from("producer_beats")
    .select("*")
    .eq("id", beatId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Beat not found." }, { status: 404 });

  const formData = await request.formData();
  const action = formData.get("action")?.toString() ?? "save";

  if (action === "archive" || action === "restore") {
    const status = action === "archive" ? "archived" : "draft";
    const { data, error } = await supabase
      .from("producer_beats")
      .update({ status })
      .eq("id", beatId)
      .eq("owner_id", user.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      beat: {
        ...data,
        audio_url: await signedUrl(supabase, data.audio_path),
        artwork_url: await signedUrl(supabase, data.artwork_path),
      },
    });
  }

  if (action !== "save" && action !== "submit") {
    return NextResponse.json({ error: "Invalid catalog action." }, { status: 400 });
  }

  const audio = formData.get("audio");
  const artwork = formData.get("artwork");
  const hasReplacementAudio = audio instanceof File && audio.size > 0;
  const hasReplacementArtwork = artwork instanceof File && artwork.size > 0;
  if (hasReplacementAudio && (audio.size > MAX_AUDIO_BYTES || !AUDIO_MIME_TYPES.has(audio.type))) {
    return NextResponse.json({ error: "Replacement audio must be an MP3, M4A, WAV, OGG, or WebM file under 200 MB." }, { status: 400 });
  }
  if (hasReplacementArtwork && (artwork.size > MAX_ARTWORK_BYTES || !ARTWORK_MIME_TYPES.has(artwork.type))) {
    return NextResponse.json({ error: "Replacement artwork must be a JPEG, PNG, or WebP image under 10 MB." }, { status: 400 });
  }

  const durationValue = optionalText(formData.get("duration_seconds"));
  if (hasReplacementAudio && !durationValue) {
    return NextResponse.json({ error: "Replacement audio duration is required." }, { status: 400 });
  }

  const bpmValue = optionalText(formData.get("bpm"));
  const parsed = producerBeatUpdateSchema.safeParse({
    title: formData.get("title")?.toString() ?? "",
    bpm: bpmValue ? Number(bpmValue) : null,
    duration_seconds: durationValue ? Number(durationValue) : Number(current.duration_seconds ?? 0),
    musical_key: optionalText(formData.get("musical_key")),
    genre: optionalText(formData.get("genre")),
    mood: optionalText(formData.get("mood")),
    region: optionalText(formData.get("region")),
    tags: (formData.get("tags")?.toString() ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    license_tiers: [
      { license: "Lease", price: parsePrice(formData.get("lease_price")) },
      { license: "Premium Lease", price: parsePrice(formData.get("premium_price")) },
      { license: "Exclusive", price: parsePrice(formData.get("exclusive_price")) },
    ],
    submit: action === "submit",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid beat details." }, { status: 400 });
  }

  if (action === "submit") {
    const [{ data: profile, error: profileError }, { data: business, error: businessError }] = await Promise.all([
      supabase.from("producer_profiles").select("*").eq("owner_id", user.id).maybeSingle(),
      supabase.from("producer_business_settings").select("*").eq("owner_id", user.id).maybeSingle(),
    ]);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });

    const profileBlockers = getProducerProfileBlockers(profile, business);
    const profileCanQueueBeat = profile?.status === "submitted" || profile?.status === "approved";
    if (!profileCanQueueBeat || profileBlockers.length) {
      const blockers = profileCanQueueBeat
        ? profileBlockers
        : ["Submit your completed producer profile before submitting beats.", ...profileBlockers];
      return NextResponse.json({ error: blockers[0], blockers }, { status: 422 });
    }

    const beatBlockers = getProducerBeatBlockers({
      ...parsed.data,
      audio_path: hasReplacementAudio ? "pending-upload" : current.audio_path,
      artwork_path: hasReplacementArtwork ? "pending-upload" : current.artwork_path,
    });
    if (beatBlockers.length) {
      return NextResponse.json({ error: beatBlockers[0], blockers: beatBlockers }, { status: 422 });
    }
  }

  const newPaths: string[] = [];
  let audioPath = current.audio_path as string;
  let artworkPath = current.artwork_path as string | null;

  try {
    if (hasReplacementAudio) {
      audioPath = `${user.id}/beats/${crypto.randomUUID()}.${extensionForMime(audio.type)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(audioPath, audio, { contentType: audio.type, upsert: false });
      if (error) throw error;
      newPaths.push(audioPath);
    }

    if (hasReplacementArtwork) {
      artworkPath = `${user.id}/artwork/${crypto.randomUUID()}.${extensionForMime(artwork.type)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(artworkPath, artwork, { contentType: artwork.type, upsert: false });
      if (error) throw error;
      newPaths.push(artworkPath);
    }

    const { data, error } = await supabase
      .from("producer_beats")
      .update({
        title: parsed.data.title,
        bpm: parsed.data.bpm,
        duration_seconds: parsed.data.duration_seconds,
        musical_key: parsed.data.musical_key,
        genre: parsed.data.genre,
        mood: parsed.data.mood,
        region: parsed.data.region,
        tags: parsed.data.tags,
        license_tiers: parsed.data.license_tiers,
        audio_path: audioPath,
        artwork_path: artworkPath,
        status: parsed.data.submit ? "submitted" : "draft",
        submitted_at: parsed.data.submit ? new Date().toISOString() : null,
        reviewed_at: null,
        reviewed_by: null,
        admin_notes: parsed.data.submit ? null : current.admin_notes,
      })
      .eq("id", beatId)
      .eq("owner_id", user.id)
      .select("*")
      .single();

    if (error) throw error;

    const replacedPaths = [
      audioPath !== current.audio_path ? current.audio_path as string : null,
      artworkPath !== current.artwork_path ? current.artwork_path as string | null : null,
    ].filter((path): path is string => Boolean(path));
    if (replacedPaths.length) await supabase.storage.from(BUCKET).remove(replacedPaths);

    return NextResponse.json({
      beat: {
        ...data,
        audio_url: await signedUrl(supabase, data.audio_path),
        artwork_url: await signedUrl(supabase, data.artwork_path),
      },
    });
  } catch (error) {
    if (newPaths.length) await supabase.storage.from(BUCKET).remove(newPaths);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beat could not be updated." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { supabase, user, response } = await requireRole("producer");
  if (response) return response;

  const beatId = (await params).id;
  if (!uuidPattern.test(beatId)) return NextResponse.json({ error: "Invalid beat." }, { status: 400 });

  const { data: beat, error: beatError } = await supabase
    .from("producer_beats")
    .select("id, status, audio_path, artwork_path")
    .eq("id", beatId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (beatError) return NextResponse.json({ error: beatError.message }, { status: 500 });
  if (!beat) return NextResponse.json({ error: "Beat not found." }, { status: 404 });
  if (!(["draft", "rejected", "archived"] as string[]).includes(beat.status)) {
    return NextResponse.json({ error: "Archive this beat before permanently deleting it." }, { status: 409 });
  }

  const { error } = await supabase
    .from("producer_beats")
    .delete()
    .eq("id", beat.id)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paths = [beat.audio_path, beat.artwork_path].filter((path): path is string => Boolean(path));
  const cleanup = paths.length ? await supabase.storage.from(BUCKET).remove(paths) : { error: null };
  return NextResponse.json({ deleted: true, cleanup_warning: cleanup.error?.message ?? null });
}
