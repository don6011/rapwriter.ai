import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: bun run import:starter-beats -- path/to/manifest.json");

const absoluteManifestPath = resolve(manifestPath);
const manifest = JSON.parse(await readFile(absoluteManifestPath, "utf8"));
if (!Array.isArray(manifest) || manifest.length === 0) throw new Error("The starter beat manifest must contain at least one beat.");

for (const [index, beat] of manifest.entries()) {
  const required = ["file", "slug", "title", "producer", "rightsHolder", "source", "duration"];
  const missing = required.filter((key) => beat[key] === undefined || beat[key] === null || beat[key] === "");
  if (missing.length) throw new Error(`Beat ${index + 1} is missing: ${missing.join(", ")}.`);

  const args = [
    "--use-system-ca",
    "scripts/import-starter-beat.mjs",
    "--file", resolve(beat.file),
    "--slug", String(beat.slug),
    "--title", String(beat.title),
    "--producer", String(beat.producer),
    "--rights-holder", String(beat.rightsHolder),
    "--source", String(beat.source),
    "--duration", String(beat.duration),
  ];

  append(args, "artwork", beat.artwork ? resolve(beat.artwork) : null);
  append(args, "bpm", beat.bpm);
  append(args, "key", beat.key);
  append(args, "genre", beat.genre);
  append(args, "mood", beat.mood);
  append(args, "tags", arrayValue(beat.tags));
  append(args, "collection", beat.collection);
  append(args, "energy", beat.energy);
  append(args, "writing-fit", arrayValue(beat.writingFit));
  append(args, "attribution", beat.attribution);
  append(args, "order", beat.order ?? index * 10);
  append(args, "featured", Boolean(beat.featured));
  append(args, "draft", beat.status === "draft");

  console.log(`[${index + 1}/${manifest.length}] Importing ${beat.title}...`);
  await run(process.execPath, args);
}

console.log(`Imported ${manifest.length} starter beats.`);

function append(args, key, value) {
  if (value === undefined || value === null || value === "") return;
  args.push(`--${key}`, String(value));
}

function arrayValue(value) {
  return Array.isArray(value) ? value.join(",") : value;
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", rejectPromise);
    child.on("exit", (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`Importer exited with code ${code}.`)));
  });
}
