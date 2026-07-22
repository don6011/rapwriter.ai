import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/api/json";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { membershipErrorResponse, requireMembershipLimit } from "@/lib/server/membership-access";
import { privateBeatImportCompleteSchema, privateBeatImportSchema } from "@/lib/schemas";

const BUCKET = "artist-beats";
const PRIVATE_LICENSE = "Private Import";
const AUDIO_TYPES: Record<string, { extension: "mp3" | "wav"; contentType: string }> = {
  "audio/mpeg": { extension: "mp3", contentType: "audio/mpeg" },
  "audio/mp3": { extension: "mp3", contentType: "audio/mpeg" },
  "audio/wav": { extension: "wav", contentType: "audio/wav" },
  "audio/x-wav": { extension: "wav", contentType: "audio/x-wav" },
  "audio/wave": { extension: "wav", contentType: "audio/wav" },
  "audio/vnd.wave": { extension: "wav", contentType: "audio/wav" },
};

function audioType(fileName: string, mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (AUDIO_TYPES[normalized]) return AUDIO_TYPES[normalized];
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "mp3") return AUDIO_TYPES["audio/mpeg"];
  if (extension === "wav") return AUDIO_TYPES["audio/wav"];
  return null;
}

async function enforceImportAllowance(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
) {
  const { count, error } = await supabase
    .from("beat_locker")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("license", PRIVATE_LICENSE);
  if (error) throw error;
  await requireMembershipLimit(supabase, userId, "artist", "private_beat_imports", count ?? 0);
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "private-beat-import-prepare",
    limit: 12,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = await parseJson(request, privateBeatImportSchema);
  if (parsed.response) return parsed.response;
  const fileType = audioType(parsed.data.file_name, parsed.data.mime_type);
  if (!fileType) {
    return NextResponse.json({ error: "Choose an MP3 or WAV beat." }, { status: 400 });
  }

  try {
    await enforceImportAllowance(supabase, user.id);
  } catch (error) {
    return membershipErrorResponse(error);
  }

  const path = `${user.id}/${crypto.randomUUID()}.${fileType.extension}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: "Could not prepare the private upload." }, { status: 500 });

  return NextResponse.json({
    upload: {
      bucket: BUCKET,
      path: data.path,
      token: data.token,
      contentType: fileType.contentType,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "private-beat-import-complete",
    limit: 12,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const parsed = await parseJson(request, privateBeatImportCompleteSchema);
  if (parsed.response) return parsed.response;
  const input = parsed.data;
  const fileType = audioType(input.file_name, input.content_type);
  if (!fileType || input.content_type !== fileType.contentType || !input.storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Private upload details are invalid." }, { status: 400 });
  }

  try {
    await enforceImportAllowance(supabase, user.id);
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([input.storage_path]);
    return membershipErrorResponse(error);
  }

  const fileName = input.storage_path.slice(input.storage_path.lastIndexOf("/") + 1);
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(user.id, { search: fileName, limit: 2 });
  const storedFile = files?.find((file) => file.name === fileName);
  const storedSize = Number(storedFile?.metadata?.size ?? 0);
  if (listError || !storedFile || !Number.isFinite(storedSize) || storedSize !== input.file_size) {
    await supabase.storage.from(BUCKET).remove([input.storage_path]);
    return NextResponse.json({ error: "The uploaded beat could not be verified." }, { status: 409 });
  }

  const beatId = `private-beat-${crypto.randomUUID()}`;
  const snapshot = {
    id: beatId,
    title: input.title,
    producer: input.producer || "Your upload",
    bpm: input.bpm ?? undefined,
    key: input.musical_key ?? undefined,
    duration: input.duration_seconds,
    source: "private_import",
    audioBucket: BUCKET,
    audioPath: input.storage_path,
    originalFileName: input.file_name,
    rightsConfirmed: true,
  };
  const { data: beat, error } = await supabase
    .from("beat_locker")
    .insert({
      owner_id: user.id,
      beat_id: beatId,
      title: input.title,
      producer: input.producer || "Your upload",
      bpm: input.bpm,
      musical_key: input.musical_key,
      mood: "Private",
      license: PRIVATE_LICENSE,
      price: 0,
      beat_snapshot: snapshot,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([input.storage_path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    beat: {
      ...beat,
      beat_snapshot: {
        id: snapshot.id,
        title: snapshot.title,
        producer: snapshot.producer,
        bpm: snapshot.bpm,
        key: snapshot.key,
        duration: snapshot.duration,
        source: snapshot.source,
        rightsConfirmed: snapshot.rightsConfirmed,
        previewUrl: `/api/locker/beats/${beat.id}/media`,
      },
    },
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Private upload path is invalid." }, { status: 400 });
  }
  const { data: attachedBeat, error: lookupError } = await supabase
    .from("beat_locker")
    .select("id")
    .eq("owner_id", user.id)
    .contains("beat_snapshot", { audioPath: path })
    .limit(1)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not verify the private upload." }, { status: 500 });
  if (attachedBeat) return NextResponse.json({ error: "This beat is already in your Locker." }, { status: 409 });
  await supabase.storage.from(BUCKET).remove([path]);
  return new NextResponse(null, { status: 204 });
}
