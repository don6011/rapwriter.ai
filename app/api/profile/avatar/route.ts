import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { hasValidRequestOrigin } from "@/lib/api/origin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "profile-avatars";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { user, response } = await requireUser();
  if (response) return response;

  const rateLimit = await enforceRateLimit(request, {
    scope: "profile-avatar-upload",
    limit: 10,
    windowSeconds: 60 * 60,
    identity: user.id,
  });
  if (rateLimit) return rateLimit;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a profile photo." }, { status: 400 });
  }
  const extension = IMAGE_TYPES[file.type.toLowerCase()];
  if (!extension) {
    return NextResponse.json({ error: "Choose a JPG, PNG, or WebP photo." }, { status: 415 });
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Profile photos must be smaller than 5 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, extension)) {
    return NextResponse.json({ error: "This file does not appear to be a valid image." }, { status: 415 });
  }

  const admin = createAdminClient();
  const path = `${user.id}/avatar.${extension}`;
  const previousPaths = (["jpg", "png", "webp"] as const)
    .map((candidate) => `${user.id}/avatar.${candidate}`)
    .filter((candidate) => candidate !== path);
  if (previousPaths.length) await admin.storage.from(BUCKET).remove(previousPaths);

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: true,
  });
  if (uploadError) {
    return NextResponse.json({ error: "Your profile photo could not be uploaded." }, { status: 500 });
  }

  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email ?? null,
      avatar_url: versionedUrl,
    }, { onConflict: "id" })
    .select("*")
    .single();
  if (profileError) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "Your profile photo could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { user, response } = await requireUser();
  if (response) return response;

  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove(
    (["jpg", "png", "webp"] as const).map((extension) => `${user.id}/avatar.${extension}`),
  );
  const { data: profile, error } = await admin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "The crown logo could not be restored." }, { status: 500 });

  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
}

function matchesImageSignature(bytes: Uint8Array, extension: "jpg" | "png" | "webp") {
  if (extension === "jpg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === "png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}
