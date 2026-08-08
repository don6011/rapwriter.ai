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
const createdStorageObjects = [];

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

async function uploadLifecycleAudio(path, label) {
  const wavHeader = Buffer.from("RIFF$\0\0\0WAVEfmt \u0010\0\0\0\u0001\0\u0001\0D\u00ac\0\0\u0088X\u0001\0\u0002\0\u0010\0data\0\0\0\0", "binary");
  const result = await admin.storage.from("producer-beats").upload(path, wavHeader, {
    contentType: "audio/wav",
    upsert: false,
  });
  ok(result, label);
  createdStorageObjects.push({ bucket: "producer-beats", path });
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
  const staffC = await createTestUser("c");

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
  const masterPath = `${artistA.user.id}/lifecycle-${runId}.wav`;
  const previewPath = `${artistA.user.id}/previews/lifecycle-${runId}.wav`;
  const producerBeatA = ok(
    await artistA.client.from("producer_beats").insert({
      owner_id: artistA.user.id,
      producer_profile_id: producerA.id,
      title: "Lifecycle Upload",
      audio_path: masterPath,
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

  ok(
    await admin.from("producer_profiles").update({ status: "approved", is_public: true }).eq("id", producerA.id).select().single(),
    "admin approves producer A profile",
  );
  denied(
    await admin.from("producer_beats").update({ status: "approved" }).eq("id", producerBeatA.id).select("id"),
    "admin cannot approve a producer beat without a separate Store preview",
  );
  await uploadLifecycleAudio(masterPath, "lifecycle producer master is stored");
  await uploadLifecycleAudio(previewPath, "lifecycle producer preview is stored");
  ok(
    await admin.from("producer_beats").update({
      metadata: {
        preview_path: previewPath,
        preview_duration_seconds: 30,
        preview_version: 1,
      },
    }).eq("id", producerBeatA.id).select().single(),
    "producer beat receives secure preview metadata",
  );
  ok(
    await admin.from("producer_beats").update({ status: "approved" }).eq("id", producerBeatA.id).select().single(),
    "admin approves producer A beat",
  );

  const collaboration = ok(
    await artistB.client.from("producer_collaboration_requests").insert({
      artist_id: artistB.user.id,
      producer_id: artistA.user.id,
      producer_profile_id: producerA.id,
      beat_id: producerBeatA.id,
      title: "Lifecycle collaboration",
      brief: "Build a focused record around the approved lifecycle beat.",
      status: "submitted",
    }).select().single(),
    "artist B requests an approved producer collaboration",
  );
  hidden(
    await staffC.client.from("producer_collaboration_requests").select("id").eq("id", collaboration.id),
    "nonparticipant cannot read a private collaboration",
  );
  denied(
    await artistB.client.from("producer_collaboration_messages").insert({
      request_id: collaboration.id,
      sender_id: artistB.user.id,
      body: "This must stay closed until acceptance.",
    }).select("id"),
    "collaboration messaging stays closed before acceptance",
  );
  hidden(
    await artistA.client.from("producer_collaboration_requests").update({ status: "accepted" }).eq("id", collaboration.id).select("id"),
    "participants cannot bypass the collaboration transition endpoint",
  );
  ok(
    await admin.from("producer_collaboration_requests").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", collaboration.id).select().single(),
    "collaboration is accepted through the privileged transition boundary",
  );
  const collaborationMessage = ok(
    await artistB.client.from("producer_collaboration_messages").insert({
      request_id: collaboration.id,
      sender_id: artistB.user.id,
      body: "The accepted workspace is ready.",
    }).select().single(),
    "accepted collaboration allows participant messaging",
  );
  hidden(
    await staffC.client.from("producer_collaboration_messages").select("id").eq("id", collaborationMessage.id),
    "nonparticipant cannot read collaboration messages",
  );
  denied(
    await staffC.client.from("producer_collaboration_messages").insert({
      request_id: collaboration.id,
      sender_id: staffC.user.id,
      body: "A nonparticipant must not enter this workspace.",
    }).select("id"),
    "nonparticipant cannot send collaboration messages",
  );

  denied(
    await admin.rpc("admin_manage_account", {
      p_actor_id: artistA.user.id,
      p_subject_id: artistB.user.id,
      p_action: "premium_granted",
      p_reason: "Unauthorized lifecycle grant attempt",
      p_details: { plan_id: "artist_pro", duration_days: 30 },
    }),
    "non-admin actor cannot use account operations through the service boundary",
  );
  ok(
    await admin.from("user_roles").upsert({ user_id: staffC.user.id, role: "admin", granted_by: staffC.user.id }, { onConflict: "user_id,role" }).select().single(),
    "staff C receives the temporary lifecycle admin role",
  );
  ok(
    await admin.rpc("admin_manage_account", {
      p_actor_id: staffC.user.id,
      p_subject_id: artistB.user.id,
      p_action: "premium_granted",
      p_reason: "Lifecycle premium support grant",
      p_details: { plan_id: "artist_pro", duration_days: 30 },
    }),
    "admin grants temporary artist premium",
  );
  const premiumGrant = ok(
    await admin.from("user_subscriptions").select("id, provider, status").eq("owner_id", artistB.user.id).eq("provider", "admin").eq("status", "active").single(),
    "premium grant is persisted",
  );
  assert.equal(premiumGrant.provider, "admin", "support access must remain separate from Stripe billing");

  ok(
    await admin.rpc("admin_manage_account", {
      p_actor_id: staffC.user.id,
      p_subject_id: artistA.user.id,
      p_action: "moderator_granted",
      p_reason: "Lifecycle moderator assignment",
      p_details: {},
    }),
    "admin grants moderator access",
  );
  ok(
    await admin.from("user_roles").select("user_id").eq("user_id", artistA.user.id).eq("role", "moderator").single(),
    "moderator role is persisted",
  );
  ok(
    await admin.rpc("admin_manage_account", {
      p_actor_id: staffC.user.id,
      p_subject_id: artistA.user.id,
      p_action: "moderator_revoked",
      p_reason: "Lifecycle moderator removal",
      p_details: {},
    }),
    "admin revokes moderator access",
  );

  ok(
    await admin.rpc("admin_manage_account", {
      p_actor_id: staffC.user.id,
      p_subject_id: artistB.user.id,
      p_action: "account_suspended",
      p_reason: "Lifecycle suspension verification",
      p_details: { duration_days: 1, internal_note: "Disposable test account only." },
    }),
    "admin suspends an account with a recorded reason",
  );
  const suspendedControl = ok(
    await admin.from("account_controls").select("status, reason, expires_at").eq("owner_id", artistB.user.id).single(),
    "suspension is persisted",
  );
  assert.equal(suspendedControl.status, "suspended", "account must be suspended");
  assert(suspendedControl.expires_at, "temporary suspension must include an expiration");
  ok(
    await admin.rpc("admin_manage_account", {
      p_actor_id: staffC.user.id,
      p_subject_id: artistB.user.id,
      p_action: "account_restored",
      p_reason: "Lifecycle account restoration",
      p_details: {},
    }),
    "admin restores the account",
  );
  const restoredControl = ok(
    await admin.from("account_controls").select("status").eq("owner_id", artistB.user.id).single(),
    "restoration is persisted",
  );
  assert.equal(restoredControl.status, "active", "restored account must be active");
  const accountEvents = ok(
    await admin.from("admin_account_events").select("action, reason").eq("subject_id", artistB.user.id),
    "account actions are auditable",
  );
  assert(accountEvents.length >= 3, "premium, suspension, and restoration actions must be recorded");

  const artistBNotifications = ok(
    await artistB.client.from("user_notifications").select("id, type, title, read_at").order("created_at", { ascending: false }),
    "artist B receives private activity notifications",
  );
  assert(
    artistBNotifications.some((item) => item.type === "collaboration_accepted"),
    "artist must be notified when a producer accepts a collaboration",
  );
  assert(
    artistBNotifications.some((item) => item.type === "premium_granted"),
    "artist must be notified when support premium is granted",
  );
  assert(
    artistBNotifications.some((item) => item.type === "account_restored"),
    "artist must be notified when account access is restored",
  );
  const artistANotifications = ok(
    await artistA.client.from("user_notifications").select("id, type"),
    "producer A receives collaboration activity",
  );
  assert(
    artistANotifications.some((item) => item.type === "collaboration_submitted"),
    "producer must be notified about a new collaboration request",
  );
  assert(
    artistANotifications.some((item) => item.type === "collaboration_message"),
    "producer must be notified about a private collaboration message",
  );
  hidden(
    await staffC.client.from("user_notifications").select("id").eq("id", artistBNotifications[0].id),
    "notification rows stay private to their recipient",
  );
  denied(
    await artistB.client.from("user_notifications").update({ title: "Rewritten history" }).eq("id", artistBNotifications[0].id).select("id"),
    "recipients cannot rewrite notification history",
  );
  denied(
    await artistB.client.from("user_notifications").delete().eq("id", artistBNotifications[0].id).select("id"),
    "recipients cannot delete notification history",
  );
  ok(
    await artistB.client.rpc("mark_user_notifications_read", { p_notification_id: artistBNotifications[0].id }),
    "artist marks one notification as read",
  );
  const readNotification = ok(
    await artistB.client.from("user_notifications").select("read_at").eq("id", artistBNotifications[0].id).single(),
    "single notification read state is persisted",
  );
  assert(readNotification.read_at, "single notification must have a read timestamp");
  ok(
    await artistB.client.rpc("mark_user_notifications_read", { p_notification_id: null }),
    "artist marks the remaining inbox as read",
  );
  const unreadNotifications = ok(
    await artistB.client.from("user_notifications").select("id").is("read_at", null),
    "all-read state is persisted",
  );
  assert.equal(unreadNotifications.length, 0, "mark all must clear the unread inbox");

  console.log("Authenticated lifecycle passed:");
  console.log("  - three disposable verified users created and signed in");
  console.log("  - projects, songs, autosave revisions, resume, and conflicts verified");
  console.log("  - project, Locker, session, and producer cross-user access denied");
  console.log("  - producer beat approval blocked until a separate secure Store preview exists");
  console.log("  - collaboration acceptance, messaging, and participant isolation verified");
  console.log("  - premium, moderator, suspension, restoration, and audit operations verified");
  console.log("  - activity delivery, privacy, immutability, and read state verified");
}

try {
  await run();
} finally {
  for (const object of createdStorageObjects.reverse()) {
    const cleanup = await admin.storage.from(object.bucket).remove([object.path]);
    if (cleanup.error) console.error(`Storage cleanup failed for ${object.path}: ${cleanup.error.message}`);
  }
  for (const userId of createdUserIds.reverse()) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error) console.error(`Cleanup failed for ${userId}: ${cleanup.error.message}`);
  }
}
