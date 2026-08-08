import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));
if (!args.slug) throw new Error("Missing --slug.");
if (!args.artwork) throw new Error("Missing --artwork.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase environment variables are missing.");

const extension = extname(args.artwork).toLowerCase();
const contentTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const contentType = contentTypes[extension];
if (!contentType) throw new Error("Starter Beat artwork must be JPEG, PNG, or WebP.");

const artwork = await readFile(args.artwork);
if (artwork.byteLength > 10 * 1024 * 1024) {
  throw new Error("Starter Beat artwork exceeds the 10 MB limit.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: beat, error: beatError } = await supabase
  .from("starter_beats")
  .select("id, slug, title, audio_bucket, artwork_path")
  .eq("slug", args.slug)
  .single();
if (beatError) throw beatError;

const digest = createHash("sha256").update(artwork).digest("hex").slice(0, 16);
const artworkPath = `catalog/${beat.slug}/artwork-${digest}${extension}`;
const bucket = beat.audio_bucket || "starter-beats";
const { error: uploadError } = await supabase.storage.from(bucket).upload(artworkPath, artwork, {
  contentType,
  cacheControl: "31536000",
  upsert: false,
});
if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) throw uploadError;

const { error: updateError } = await supabase
  .from("starter_beats")
  .update({ artwork_path: artworkPath })
  .eq("id", beat.id);
if (updateError) {
  if (beat.artwork_path !== artworkPath) {
    await supabase.storage.from(bucket).remove([artworkPath]);
  }
  throw updateError;
}

if (beat.artwork_path && beat.artwork_path !== artworkPath) {
  await supabase.storage.from(bucket).remove([beat.artwork_path]);
}

console.log(
  JSON.stringify(
    {
      updated: { id: beat.id, slug: beat.slug, title: beat.title, artwork_path: artworkPath },
      bytes: artwork.byteLength,
    },
    null,
    2,
  ),
);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) continue;
    parsed[token.slice(2)] = values[index + 1] ?? "";
    index += 1;
  }
  return parsed;
}
