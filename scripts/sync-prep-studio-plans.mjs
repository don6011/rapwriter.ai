import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase server credentials are missing.");

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const commonEntitlements = {
  writing_pad: true,
  writer_flow: true,
  basic_studio: true,
  marketplace_browse: true,
  marketplace_purchase: true,
  beat_previews: true,
  basic_booth_ready: true,
  booth_ready_lite: true,
  basic_ghostwriter: true,
  cloud_sync: true,
};

const plans = [
  {
    id: "artist_free",
    name: "Prep Studio Free",
    tagline: "Start the record.",
    monthly_price_cents: 0,
    annual_price_cents: 0,
    entitlements: {
      ...commonEntitlements,
      ghostwriter: true,
      full_pen_view: false,
      producer_pass: false,
      commercial_pass: false,
      hook_doctor: false,
      rewrite: false,
      advanced_booth_ready: false,
      producer_notes: false,
      studio_dna_full: false,
      ai_session_memory: false,
      advanced_lyric_intelligence: false,
      commercial_intelligence: false,
      performance_intelligence: false,
      performance_coach: false,
      premium_exports: false,
      multi_device_cloud_sync: false,
      version_history: false,
      producer_connections: false,
      producer_messaging: false,
      priority_ai: false,
      unlimited_priority_ai: false,
      elite_rooms: false,
      exclusive_releases: false,
      elite_badge: false,
      early_features: false,
    },
    limits: {
      active_projects: 3,
      song_storage: 12,
      ghostwriter_actions_monthly: 3,
      studio_rooms: 1,
      ai_pens: 1,
      storage_mb: 250,
      priority_ai_actions_monthly: 0,
      private_beat_imports: 1,
    },
    metadata: {
      brand: "Prep Studio",
      outcome: "Experience RapWriter",
      positioning: "Prove the value of a better writing room",
    },
  },
  {
    id: "artist_pro",
    name: "Prep Studio Pro",
    tagline: "Finish better records.",
    monthly_price_cents: 1499,
    annual_price_cents: 14990,
    entitlements: {
      ...commonEntitlements,
      ghostwriter: true,
      full_pen_view: true,
      producer_pass: true,
      commercial_pass: true,
      hook_doctor: true,
      rewrite: true,
      advanced_booth_ready: true,
      producer_notes: true,
      studio_dna_full: true,
      ai_session_memory: true,
      advanced_lyric_intelligence: true,
      commercial_intelligence: false,
      performance_intelligence: false,
      performance_coach: false,
      premium_exports: true,
      multi_device_cloud_sync: true,
      version_history: true,
      producer_connections: true,
      producer_messaging: false,
      priority_ai: true,
      unlimited_priority_ai: false,
      elite_rooms: false,
      exclusive_releases: false,
      elite_badge: false,
      early_features: false,
    },
    limits: {
      active_projects: -1,
      song_storage: -1,
      ghostwriter_actions_monthly: 80,
      studio_rooms: 8,
      ai_pens: 6,
      storage_mb: 5000,
      priority_ai_actions_monthly: 100,
      private_beat_imports: 25,
    },
    metadata: {
      brand: "Prep Studio",
      outcome: "Finish better records",
      positioning: "Everything that improves the writing process",
    },
  },
  {
    id: "artist_studio",
    name: "Prep Studio Elite",
    tagline: "Turn serious records into a career.",
    monthly_price_cents: 2999,
    annual_price_cents: 29990,
    entitlements: {
      ...commonEntitlements,
      ghostwriter: true,
      full_pen_view: true,
      producer_pass: true,
      commercial_pass: true,
      hook_doctor: true,
      rewrite: true,
      advanced_booth_ready: true,
      producer_notes: true,
      studio_dna_full: true,
      ai_session_memory: true,
      advanced_lyric_intelligence: true,
      commercial_intelligence: true,
      performance_intelligence: true,
      performance_coach: true,
      premium_exports: true,
      multi_device_cloud_sync: true,
      version_history: true,
      producer_connections: true,
      producer_messaging: true,
      priority_ai: true,
      unlimited_priority_ai: true,
      elite_rooms: true,
      exclusive_releases: true,
      elite_badge: true,
      early_features: true,
    },
    limits: {
      active_projects: -1,
      song_storage: -1,
      ghostwriter_actions_monthly: 250,
      studio_rooms: 12,
      ai_pens: -1,
      storage_mb: 20000,
      priority_ai_actions_monthly: -1,
      private_beat_imports: 100,
    },
    metadata: {
      brand: "Prep Studio",
      outcome: "Build a professional creative practice",
      positioning: "Career-focused intelligence for serious creators",
    },
  },
];

const { data: existing, error: readError } = await supabase
  .from("subscription_plans")
  .select("id")
  .in("id", plans.map((plan) => plan.id));
if (readError) throw readError;

const existingIds = new Set((existing ?? []).map((plan) => plan.id));
for (const plan of plans) {
  if (!existingIds.has(plan.id)) throw new Error(`Missing plan ${plan.id}`);
  const { error } = await supabase.from("subscription_plans").update(plan).eq("id", plan.id);
  if (error) throw error;
}

const { data: producerPlans, error: producerReadError } = await supabase
  .from("subscription_plans")
  .select("id,metadata")
  .eq("audience", "producer");
if (producerReadError) throw producerReadError;
for (const plan of producerPlans ?? []) {
  const { error } = await supabase
    .from("subscription_plans")
    .update({
      metadata: {
        ...(plan.metadata ?? {}),
        brand: "Producer HQ",
        separate_from_artist_membership: true,
        supports_future_all_access: true,
      },
    })
    .eq("id", plan.id);
  if (error) throw error;
}

const { data: verified, error: verifyError } = await supabase
  .from("subscription_plans")
  .select("id,name,monthly_price_cents,entitlements,limits")
  .in("id", plans.map((plan) => plan.id))
  .order("tier");
if (verifyError) throw verifyError;

console.log(JSON.stringify((verified ?? []).map((plan) => ({
  id: plan.id,
  name: plan.name,
  price: plan.monthly_price_cents,
  ghostwriter: plan.entitlements?.ghostwriter,
  advanced_booth_ready: plan.entitlements?.advanced_booth_ready,
  performance_coach: plan.entitlements?.performance_coach,
  studio_rooms: plan.limits?.studio_rooms,
})), null, 2));
