import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCER_ID = "22222222-2222-4222-8222-222222222222";
const COLLABORATION_ID = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-07-28T04:00:00.000Z";

function envValue(name: string) {
  if (process.env[name]) return process.env[name];
  for (const path of [".env.local", ".env"]) {
    try {
      const line = readFileSync(path, "utf8")
        .split(/\r?\n/)
        .find((entry) => entry.trimStart().startsWith(`${name}=`));
      if (!line) continue;
      return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
    } catch {
      // The next environment source may still contain the public configuration.
    }
  }
  return null;
}

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function browserSession() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const email = "release-producer@rapwriter.test";
  const accessToken = [
    base64Url({ alg: "HS256", typ: "JWT" }),
    base64Url({ aud: "authenticated", sub: USER_ID, email, role: "authenticated", iat: issuedAt, exp: issuedAt + 3600 }),
    "release-test-signature",
  ].join(".");
  return {
    access_token: accessToken,
    refresh_token: "release-test-refresh-token",
    expires_in: 3600,
    expires_at: issuedAt + 3600,
    token_type: "bearer",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { display_name: "Stone Studios" },
      identities: [],
      created_at: NOW,
      updated_at: NOW,
    },
  };
}

async function installAuthenticatedSession(page: Page) {
  const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for authenticated browser tests.");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const session = browserSession();
  await page.context().addCookies([{
    name: storageKey,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
    url: "http://127.0.0.1:3100",
    sameSite: "Lax",
  }]);
  await page.addInitScript(
    ({ key, session, userId }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
      window.localStorage.setItem(`rapwriter:membership-announced:${userId}`, "artist_studio:producer_free");
    },
    { key: storageKey, session, userId: USER_ID },
  );
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, user_id: USER_ID, roles: ["artist", "producer"], email_verified: true }),
    });
  });
  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ notifications: [], unread_count: 0, foundation_ready: true }) });
  });
}

function plan(input: { id: string; audience: "artist" | "producer"; tier: number; name: string; tagline: string }) {
  return {
    ...input,
    monthly_price_cents: input.audience === "artist" ? 2999 : 1999,
    annual_price_cents: input.audience === "artist" ? 29990 : 19990,
    currency: "usd",
    entitlements: input.audience === "artist"
      ? { ghostwriter: true, full_pen_view: true, advanced_booth_ready: true, collaboration_requests: true }
      : { producer_storefront: true, producer_intelligence: true, promotions: true },
    limits: input.audience === "artist" ? { ghostwriter_actions_monthly: 250, projects: -1 } : { active_beats: -1 },
    metadata: {},
  };
}

const artistPro = plan({ id: "artist_studio", audience: "artist", tier: 2, name: "RapWriter Pro", tagline: "Finish the record." });
const producerFree = plan({ id: "producer_free", audience: "producer", tier: 0, name: "Producer HQ Free", tagline: "Sell your sound. Keep 100% of sales." });

const membership = {
  roles: ["artist", "producer"],
  artist: {
    audience: "artist",
    plan: artistPro,
    status: "active",
    source: "subscription",
    provider: "manual",
    renews_at: null,
    cancel_at_period_end: false,
    entitlements: artistPro.entitlements,
    limits: artistPro.limits,
    usage: { ghostwriter_actions: 4 },
  },
  producer: {
    audience: "producer",
    plan: producerFree,
    status: "free",
    source: "free",
    provider: null,
    renews_at: null,
    cancel_at_period_end: false,
    entitlements: producerFree.entitlements,
    limits: producerFree.limits,
    usage: {},
  },
};

function producerPayload() {
  return {
    profile: {
      id: PRODUCER_ID,
      display_name: "Stone Studios",
      handle: "stone-studios",
      city: "Memphis",
      studio_name: "Stone Studios",
      state: "TN",
      country: "United States",
      years_producing: 8,
      bio: "Memphis producer building focused records with soulful samples and hard drums.",
      genres: ["Trap", "Soul"],
      specialties: ["Southern", "Melodic"],
      website_url: null,
      instagram_url: null,
      youtube_url: null,
      beatstars_url: null,
      airbit_url: null,
      traktrain_url: null,
      status: "approved",
      verified: true,
      is_public: true,
    },
    beats: [{
      id: "33333333-3333-4333-8333-333333333333",
      title: "Pulse Code",
      bpm: 84,
      duration_seconds: 192,
      musical_key: "F# Minor",
      genre: "Trap",
      mood: "Late Night",
      region: "Memphis",
      tags: ["Trap", "Late Night"],
      license_tiers: [{ license: "Lease", price: 49 }],
      status: "approved",
      admin_notes: null,
      audio_url: null,
      artwork_url: null,
      created_at: NOW,
      updated_at: NOW,
    }],
    credited_beats: [],
    playlists: [],
    business: {
      business_email: "release-producer@rapwriter.test",
      contact_preference: "platform",
      license_settings: { lease: 49, premium: 149, unlimited: 299, exclusive: 899 },
      default_license_terms: null,
      automatic_delivery: true,
      onboarding_step: 4,
      onboarding_completed: true,
    },
    billing: { plan: "free", stripe_status: "not_connected", payouts_enabled: false, charges_enabled: false, verification: {} },
    membership,
    plans: [producerFree],
    metrics: {
      profile_views: 42,
      beat_plays: 120,
      favorites: 8,
      beat_adds: 4,
      followers: 6,
      sales: 1,
      repeat_customers: 0,
      revenue_cents: 4900,
      revenue_month_cents: 4900,
      revenue_year_cents: 4900,
      average_listen_seconds: 34,
      top_city: "Memphis",
      top_state: "TN",
    },
    reviews: [],
    services: [{
      id: "44444444-4444-4444-8444-444444444444",
      service_type: "custom_beat",
      title: "Custom beat session",
      description: "A focused custom production built around the artist brief.",
      starting_price_cents: 15000,
      turnaround_days: 5,
      is_active: true,
    }],
    collaborations: [],
    sales: [],
    earnings: [],
    release_readiness: { phase: "live", next_action: "Keep the catalog active.", profile_ready: true, profile_blockers: [], beat_blockers: {}, live_beat_count: 1 },
    foundation_ready: true,
  };
}

async function mockProducerApis(page: Page) {
  const payload = producerPayload();
  await page.route("**/api/producer", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.route("**/api/producer/referrals", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: "STONE-LAUNCH", invited: 2, qualified: 1, rewards: { promotion_credits: 1, founding_points: 100, featured_until: null, referral_rewards: 1 } }),
    });
  });
  await page.route("**/api/producer/services", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const submitted = route.request().postDataJSON() as Record<string, unknown>;
    const service = {
      id: "55555555-5555-4555-8555-555555555555",
      service_type: submitted.service_type,
      title: submitted.title,
      description: submitted.description,
      starting_price_cents: submitted.starting_price_cents,
      turnaround_days: submitted.turnaround_days,
      is_active: true,
    };
    payload.services.push(service as (typeof payload.services)[number]);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ service }) });
  });
  return payload;
}

function storefrontPayload() {
  return {
    profile: {
      id: PRODUCER_ID,
      displayName: "Stone Studios",
      handle: "stone-studios",
      city: "Memphis",
      state: "TN",
      country: "United States",
      studioName: "Stone Studios",
      yearsProducing: 8,
      bio: "Memphis producer building focused records with soulful samples and hard drums.",
      genres: ["Trap", "Soul"],
      specialties: ["Southern", "Melodic"],
      verified: true,
      avatarUrl: null,
      bannerUrl: null,
      social: { website: null, instagram: null, youtube: null, beatstars: null, airbit: null, traktrain: null },
    },
    beats: [],
    collections: [],
    services: [{ id: "44444444-4444-4444-8444-444444444444", service_type: "custom_beat", title: "Custom beat session", description: "A focused custom production.", starting_price_cents: 15000, turnaround_days: 5 }],
    metrics: { profile_views: 42, beat_plays: 120, favorites: 8, beat_adds: 4, followers: 6, sales: 1 },
    followerCount: 6,
    following: false,
    signedIn: true,
    ownerPreview: true,
  };
}

function collaborationRequest(status: "submitted" | "accepted" = "submitted") {
  return {
    id: COLLABORATION_ID,
    artist_id: USER_ID,
    producer_id: PRODUCER_ID,
    title: "Build the midnight record",
    brief: "Create a focused late-night record with a strong hook and enough room for the vocal.",
    budget_cents: 17500,
    status,
    handoff_status: "not_started" as const,
    response_note: null,
    counter_price_cents: null,
    requested_deadline: "2026-08-15",
    created_at: NOW,
    updated_at: NOW,
    artist_profile: { display_name: "Nova" },
    producer_profiles: { display_name: "Stone Studios", handle: "stone-studios" },
    producer_services: { title: "Custom beat session", service_type: "custom_beat" },
    producer_beats: null,
    projects: null,
    songs: null,
  };
}

async function mockStudioApis(page: Page) {
  const responses: Record<string, unknown> = {
    "/api/projects": { projects: [] },
    "/api/songs": { songs: [] },
    "/api/sessions": { session: null },
    "/api/locker/beats": { beats: [] },
    "/api/locker/songs": { songs: [] },
    "/api/locker/hooks": { hooks: [] },
    "/api/rough-takes?all=1": { roughTakes: [] },
    "/api/entitlements": { entitlements: [] },
    "/api/orders?scope=purchases": { orders: [] },
    "/api/profile": {
      profile: {
        id: USER_ID,
        email: "release-producer@rapwriter.test",
        display_name: "Nova",
        artist_name: "Nova",
        avatar_url: null,
        plan: "studio",
        account_type: "artist_producer",
        role_onboarding_completed: true,
        onboarding_completed: true,
        first_session_completed: true,
        artist_goal: "finish_song",
        created_at: NOW,
        updated_at: NOW,
      },
    },
    "/api/marketplace/beats": { beats: [], producers: [] },
    "/api/starter-beats": { beats: [] },
  };
  await page.route("**/api/membership", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ membership, plans: [artistPro, producerFree], bundles: [] }) });
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const key = `${url.pathname}${url.search}`;
    if (!(key in responses)) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(responses[key]) });
  });
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test("Producer HQ dock and header back stay inside the workspace", async ({ page }) => {
  await mockProducerApis(page);
  await page.goto("/producer", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Welcome back, Stone Studios." })).toBeVisible();
  const dock = page.getByTestId("producer-hq-dock");
  await expect(dock).toBeVisible();

  await dock.getByRole("button", { name: "Add beat" }).click();
  await expect(page).toHaveURL(/\/producer\?view=upload$/);
  await expect(page.getByRole("heading", { name: "Upload a beat" })).toBeVisible();
  await page.getByRole("button", { name: "Back in Producer HQ" }).click();
  await expect(page).toHaveURL(/\/producer$/);
  await expect(page.getByRole("heading", { name: "Your control room" })).toBeVisible();

  await dock.getByRole("button", { name: "Catalog" }).click();
  await expect(page).toHaveURL(/\/producer\?view=catalog$/);
  await expect(page.getByRole("heading", { name: "Your beats" })).toBeVisible();
  await page.getByRole("button", { name: "Back in Producer HQ" }).click();
  await expect(page).toHaveURL(/\/producer$/);
});

test("Producer collaboration decisions and messages provide immediate feedback", async ({ page }) => {
  let request = collaborationRequest();
  const messages: Array<{ id: string; sender_id: string; body: string; created_at: string }> = [];
  await page.route("**/api/collaborations", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ requests: [request], viewer_id: PRODUCER_ID }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}`, async (route) => {
    request = { ...request, status: "accepted", updated_at: new Date().toISOString() };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ request }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}/messages`, async (route) => {
    if (route.request().method() === "POST") {
      const submitted = route.request().postDataJSON() as { body: string };
      messages.push({ id: "77777777-7777-4777-8777-777777777777", sender_id: PRODUCER_ID, body: submitted.body, created_at: NOW });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: messages[0] }) });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ messages }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}/deliverables`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ deliverables: [] }) });
  });

  await page.goto(`/collaborations?from=producer-hq&request=${COLLABORATION_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Build the midnight record" })).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.locator("[data-sonner-toast]").getByText("Request accepted. The private room is open.", { exact: true })).toBeVisible();
  await expect(page.getByText("Private room", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Message privately").fill("The direction is clear. I will build around the hook first.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("The direction is clear. I will build around the hook first.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-sonner-toast]").getByText("Message sent", { exact: true })).toBeVisible();

  await expect(page.getByText("Session handoff", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose audio or ZIP/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark session complete" })).toHaveCount(0);
});

test("Private collaboration rooms receive new messages without a page refresh", async ({ page }) => {
  const request = { ...collaborationRequest(), status: "accepted" as const };
  let externalMessageAvailable = false;
  await page.route("**/api/collaborations", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ requests: [request], viewer_id: PRODUCER_ID }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}/messages`, async (route) => {
    const messages = externalMessageAvailable
      ? [{ id: "88888888-8888-4888-8888-888888888888", sender_id: request.artist_id, body: "I added a tighter reference for the second verse.", created_at: NOW }]
      : [];
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ messages }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}/deliverables`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ deliverables: [] }) });
  });

  await page.goto(`/collaborations?from=producer-hq&request=${COLLABORATION_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Private room", { exact: true })).toBeVisible();
  externalMessageAvailable = true;

  await expect(page.getByText("I added a tighter reference for the second verse.", { exact: true })).toBeVisible({ timeout: 16_000 });
});

test("Artists approve a delivered version and complete the session", async ({ page }) => {
  let request = { ...collaborationRequest("accepted"), handoff_status: "delivered" as const };
  let deliverable = {
    id: "99999999-9999-4999-8999-999999999999",
    request_id: COLLABORATION_ID,
    sender_id: PRODUCER_ID,
    version_number: 1,
    title: "Final vocal-ready mix",
    note: "Left headroom for the vocal chain.",
    file_name: "midnight-final.wav",
    byte_size: 24000000,
    status: "delivered" as const,
    artist_feedback: null,
    delivered_at: NOW,
    reviewed_at: null,
    download_url: "https://storage.example/signed-final",
  };
  await page.route("**/api/collaborations", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ requests: [request], viewer_id: USER_ID }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}/messages`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}/deliverables`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ deliverables: [deliverable] }) });
  });
  await page.route(`**/api/collaborations/${COLLABORATION_ID}/deliverables/${deliverable.id}`, async (route) => {
    deliverable = { ...deliverable, status: "approved", reviewed_at: NOW };
    request = { ...request, status: "completed", handoff_status: "approved" };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ deliverable }) });
  });

  await page.goto(`/collaborations?request=${COLLABORATION_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Final vocal-ready mix", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation.getByRole("heading", { name: "Approve this delivery?" })).toBeVisible();
  await confirmation.getByRole("button", { name: "Approve delivery" }).click();
  await expect(page.locator("[data-sonner-toast]").getByText("Delivery approved", { exact: true })).toBeVisible();
  await expect(page.getByText("Approved by the artist. Session complete.", { exact: true })).toBeVisible();
});

test("artist and producer access explains both available workspaces", async ({ page }) => {
  await mockStudioApis(page);
  await page.goto("/?view=profile", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Nova", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("RapWriter Pro + Producer HQ Free", { exact: true })).toBeVisible();
  const membershipCard = page.locator("#profile-membership");
  await expect(membershipCard.getByText("RapWriter Pro", { exact: true }).first()).toBeVisible();

  await membershipCard.getByRole("button", { name: "Producer", exact: true }).click();
  await expect(membershipCard.getByText("Producer HQ Free", { exact: true }).first()).toBeVisible();
  await expect(membershipCard.getByRole("link", { name: "Open Producer HQ" })).toHaveAttribute("href", "/producer");

  await membershipCard.getByRole("button", { name: /See everything you unlocked/ }).click();
  const accessGuide = page.getByRole("dialog", { name: "Unlocked membership access" });
  await expect(accessGuide.getByRole("heading", { name: "Everything available now" })).toBeVisible();
  await expect(accessGuide.getByText("Ghostwriter", { exact: true })).toBeVisible();
  await expect(accessGuide.getByText("Advanced Booth Ready", { exact: true })).toBeVisible();

  await accessGuide.getByRole("button", { name: "Producer HQ Free" }).click();
  await expect(accessGuide.getByText("Producer storefront", { exact: true })).toBeVisible();
  await expect(accessGuide.getByText("Producer intelligence", { exact: true })).toBeVisible();
  await expect(accessGuide.getByRole("link", { name: "Open Producer HQ" })).toHaveAttribute("href", "/producer");
  await expect(page.getByTestId("app-dock")).toBeVisible();
});
