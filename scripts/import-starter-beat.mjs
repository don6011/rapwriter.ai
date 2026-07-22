import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));
const required = ["file", "slug", "title", "producer", "rights-holder", "source", "duration"];
for (const key of required) {
  if (!args[key]) throw new Error(`Missing --${key}.`);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug)) throw new Error("--slug must use lowercase kebab-case.");
if (!["suno_licensed", "producer_donated"].includes(args.source)) throw new Error("Unsupported --source.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase environment variables are missing.");

const file = await readFile(args.file);
const extension = extname(args.file).toLowerCase();
const contentTypes = { ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".webm": "audio/webm" };
const contentType = contentTypes[extension];
if (!contentType) throw new Error("Starter Beats must be WAV, MP3, M4A, OGG, or WebM files.");
if (file.byteLength > 200 * 1024 * 1024) throw new Error("Starter Beat exceeds the 200 MB limit.");

const duration = Math.round(Number(args.duration));
if (!Number.isFinite(duration) || duration < 1 || duration > 1800) throw new Error("--duration must be between 1 and 1800 seconds.");

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const digest = createHash("sha256").update(file).digest("hex").slice(0, 16);
const audioPath = `catalog/${args.slug}/${digest}${extension}`;
const { data: existing, error: existingError } = await supabase
  .from("starter_beats")
  .select("id, audio_bucket, audio_path")
  .eq("slug", args.slug)
  .maybeSingle();
if (existingError) throw existingError;

if (existing?.audio_path !== audioPath) {
  const { error: uploadError } = await supabase.storage.from("starter-beats").upload(audioPath, file, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) throw uploadError;
}

const record = {
  slug: args.slug,
  title: args.title,
  producer_name: args.producer,
  source_type: args.source,
  rights_holder: args["rights-holder"],
  license_scope: "rapwriter_starter_nonexclusive",
  audio_bucket: "starter-beats",
  audio_path: audioPath,
  duration_seconds: duration,
  bpm: args.bpm ? Number(args.bpm) : null,
  musical_key: args.key || null,
  genre: args.genre || null,
  mood: args.mood || null,
  tags: splitList(args.tags),
  attribution: args.attribution || `Included with RapWriter. Courtesy of ${args.producer}.`,
  sort_order: Number(args.order || 0),
  is_active: true,
  metadata: {
    original_file_name: basename(args.file),
    imported_sha256: createHash("sha256").update(file).digest("hex"),
  },
};

const { data: beat, error: upsertError } = await supabase
  .from("starter_beats")
  .upsert(record, { onConflict: "slug" })
  .select("id, slug, title, audio_path")
  .single();
if (upsertError) {
  if (!existing || existing.audio_path !== audioPath) await supabase.storage.from("starter-beats").remove([audioPath]);
  throw upsertError;
}

if (existing?.audio_path && existing.audio_path !== audioPath) {
  await supabase.storage.from(existing.audio_bucket || "starter-beats").remove([existing.audio_path]);
}

console.log(JSON.stringify({ imported: beat, bytes: file.byteLength }, null, 2));

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

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}
