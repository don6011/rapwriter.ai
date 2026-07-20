import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(url, "NEXT_PUBLIC_SUPABASE_URL is required.");
assert(publicKey, "A Supabase publishable or anon key is required.");
assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required.");

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const runId = randomUUID();
const password = `Rw!${randomUUID()}aA9`;
const createdUserIds = [];

function userClient() {
  return createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? "unknown database error"}`);
  return result.data;
}

function denied(result, label) {
  assert(result.error, `${label}: operation unexpectedly succeeded`);
}

function hidden(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? "unexpected query error"}`);
  assert.deepEqual(result.data, [], `${label}: another user's row was visible`);
}

async function createTestUser(suffix) {
  const email = `rapwriter.lifecycle.${runId}.${suffix}@example.com`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Lifecycle ${suffix.toUpperCase()}` },
  });
  assert.equal(result.error, null, `create ${suffix} user: ${result.error?.message ?? "unknown auth error"}`);
  assert(result.data.user, `create ${suffix} user: no user returned`);
  createdUserIds.push(result.data.user.id);

  const client = userClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, `sign in ${suffix}: ${signIn.error?.message ?? "unknown auth error"}`);
  return { client, user: result.data.user };
}

async function run() {
  const artistA = await createTestUser("a");
  const artistB = await createTestUser("b");

  const projectA = ok(
    await artistA.client.from("projects").insert({ owner_id: artistA.user.id, title: "Lifecycle A", project_type: "Single" }).select().single(),
    "artist A creates project",
  );
  ok(
    await artistB.client.from("projects").insert({ owner_id: artistB.user.id, title: "Lifecycle B", project_type: "Single" }).select().single(),
    "artist B creates project",
  );

  const songA = ok(
    await artistA.client.from("songs").insert({ owner_id: artistA.user.id, project_id: projectA.id, title: "Isolation Record" }).select().single(),
    "artist A creates song",
  );

  hidden(await artistB.client.from("projects").select("id").eq("id", projectA.id), "artist B cannot read artist A project");
  hidden(await artistB.client.from("songs").select("id").eq("id", songA.id), "artist B cannot read artist A song");
  hidden(
    await artistB.client.from("projects").update({ title: "Taken Over" }).eq("id", projectA.id).select("id"),
    "artist B cannot update artist A project",
  );

  denied(
    await artistB.client.from("songs").insert({ owner_id: artistB.user.id, project_id: projectA.id, title: "Cross-linked song" }).select("id"),
    "artist B cannot attach a song to artist A project",
  );
  denied(
    await artistB.client.from("projects").insert({ owner_id: artistA.user.id, title: "Spoofed project" }).select("id"),
    "artist B cannot spoof artist A ownership",
  );

  const firstSave = ok(
    await artistA.client.rpc("save_ghost_studio_session", {
      p_session_id: null,
      p_project_id: projectA.id,
      p_song_id: songA.id,
      p_beat_id: null,
      p_beat_snapshot: {},
      p_mode: "midnight",
      p_ambiance: "vinyl",
      p_section_content: { Hook: "First line\nSecond line" },
      p_active_section: "Hook",
      p_song_state: 1,
      p_completion_pct: 25,
      p_booth_score: 18,
      p_total_bars: 2,
      p_expected_revision: null,
      p_playback_position_seconds: 12,
      p_studio_dna: { goal: "finish_song" },
      p_client_updated_at: new Date().toISOString(),
    }),
    "artist A starts session",
  );
  assert.equal(firstSave.conflict, false, "first session save should not conflict");
  assert.equal(firstSave.session.revision, 1, "first session revision should be 1");

  const resumedSave = ok(
    await artistA.client.rpc("save_ghost_studio_session", {
      p_session_id: firstSave.session.id,
      p_project_id: projectA.id,
      p_song_id: songA.id,
      p_beat_id: null,
      p_beat_snapshot: {},
      p_mode: "midnight",
      p_ambiance: "vinyl",
      p_section_content: { Hook: "First line\nSecond line\nThird line" },
      p_active_section: "Hook",
      p_song_state: 1,
      p_completion_pct: 38,
      p_booth_score: 24,
      p_total_bars: 3,
      p_expected_revision: 1,
      p_playback_position_seconds: 28,
      p_studio_dna: { goal: "finish_song" },
      p_client_updated_at: new Date().toISOString(),
    }),
    "artist A resumes session",
  );
  assert.equal(resumedSave.session.revision, 2, "resume should advance the revision");

  const staleSave = ok(
    await artistA.client.rpc("save_ghost_studio_session", {
      p_session_id: firstSave.session.id,
      p_project_id: projectA.id,
      p_song_id: songA.id,
      p_beat_id: null,
      p_beat_snapshot: {},
      p_mode: "midnight",
      p_ambiance: "vinyl",
      p_section_content: { Hook: "Stale overwrite" },
      p_active_section: "Hook",
      p_song_state: 1,
      p_completion_pct: 13,
      p_booth_score: 10,
      p_total_bars: 1,
      p_expected_revision: 1,
      p_playback_position_seconds: 4,
      p_studio_dna: {},
      p_client_updated_at: new Date().toISOString(),
    }),
    "stale autosave returns conflict",
  );
  assert.equal(staleSave.conflict, true, "stale autosave must be rejected as a conflict");
  assert.equal(staleSave.session.revision, 2, "stale autosave must preserve the current revision");

  const crossSession = await artistB.client.rpc("save_ghost_studio_session", {
    p_session_id: null,
    p_project_id: projectA.id,
    p_song_id: songA.id,
    p_beat_id: null,
    p_beat_snapshot: {},
    p_mode: "midnight",
    p_ambiance: "vinyl",
    p_section_content: { Hook: "Cross account" },
    p_active_section: "Hook",
    p_song_state: 1,
    p_completion_pct: 13,
    p_booth_score: 10,
    p_total_bars: 1,
    p_expected_revision: null,
    p_playback_position_seconds: 0,
    p_studio_dna: {},
    p_client_updated_at: new Date().toISOString(),
  });
  denied(crossSession, "artist B cannot resume artist A session");

  const hookA = ok(
    await artistA.client.from("hook_locker").insert({
      owner_id: artistA.user.id,
      project_id: projectA.id,
      song_id: songA.id,
      title: "Lifecycle Hook",
      content: "First line\nSecond line\nThird line",
    }).select().single(),
    "artist A saves hook",
  );
  const beatA = ok(
    await artistA.client.from("beat_locker").insert({ owner_id: artistA.user.id, beat_id: `lifecycle-${runId}`, title: "Lifecycle Beat", license: "Favorite" }).select().single(),
    "artist A saves beat",
  );
  const lockedSongA = ok(
    await artistA.client.from("song_locker").insert({ owner_id: artistA.user.id, project_id: projectA.id, song_id: songA.id, title: "Lifecycle Song" }).select().single(),
    "artist A saves song",
  );

  hidden(await artistB.client.from("hook_locker").select("id").eq("id", hookA.id), "artist B cannot read artist A hook");
  hidden(await artistB.client.from("beat_locker").select("id").eq("id", beatA.id), "artist B cannot read artist A beat");
  hidden(await artistB.client.from("song_locker").select("id").eq("id", lockedSongA.id), "artist B cannot read artist A saved song");
  denied(
    await artistB.client.from("hook_locker").insert({ owner_id: artistB.user.id, project_id: projectA.id, song_id: songA.id, title: "Cross hook", content: "Blocked" }).select("id"),
    "artist B cannot attach a hook to artist A song",
  );

  const producerA = ok(
    await artistA.client.from("producer_profiles").insert({ owner_id: artistA.user.id, display_name: "Lifecycle Producer", handle: `lifecycle-${runId}` }).select().single(),
    "artist A creates producer workspace",
  );
  ok(
    await artistA.client.from("producer_beats").insert({
      owner_id: artistA.user.id,
      producer_profile_id: producerA.id,
      title: "Lifecycle Upload",
      audio_path: `${artistA.user.id}/lifecycle.wav`,
    }).select().single(),
    "producer A creates beat draft",
  );
  denied(
    await artistB.client.from("producer_beats").insert({
      owner_id: artistB.user.id,
      producer_profile_id: producerA.id,
      title: "Cross producer upload",
      audio_path: `${artistB.user.id}/cross.wav`,
    }).select("id"),
    "producer B cannot attach a beat to producer A profile",
  );

  console.log("Authenticated lifecycle passed:");
  console.log("  - two disposable verified users created and signed in");
  console.log("  - projects, songs, autosave revisions, resume, and conflicts verified");
  console.log("  - project, Locker, session, and producer cross-user access denied");
}

try {
  await run();
} finally {
  for (const userId of createdUserIds.reverse()) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error) console.error(`Cleanup failed for ${userId}: ${cleanup.error.message}`);
  }
}
