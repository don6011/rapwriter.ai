import { z } from "zod";
import { producerActionTypes } from "@/lib/producer-actions";

export const sectionsSchema = z.record(z.string(), z.string()).default({});
export const jsonRecordSchema = z.record(z.string(), z.unknown()).default({});

export const accountRoleSchema = z.object({
  account_type: z.enum(["artist", "producer", "artist_producer"]),
});

export const firstSessionActivationSchema = z.object({
  artist_goal: z.enum(["finish_song", "write_hook", "write_verse", "freestyle"]),
  project_title: z.string().trim().min(1).max(120),
  song_title: z.string().trim().min(1).max(160).default("Untitled Song"),
  beat: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const projectCreateSchema = z.object({
  title: z.string().min(1).max(120),
  project_type: z.string().min(1).max(40).default("Single"),
  status: z.enum(["idea", "draft", "session_ready", "booth_ready", "archived"]).default("draft"),
  artwork: jsonRecordSchema.optional(),
  metadata: jsonRecordSchema.optional(),
});

export const projectPatchSchema = projectCreateSchema.partial();

export const songCreateSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(160),
  track_number: z.number().int().min(1).default(1),
  song_state: z.number().int().min(0).max(3).default(0),
  sections: sectionsSchema.optional(),
  active_section: z.string().default("Hook"),
  beat_id: z.string().nullable().optional(),
  beat_snapshot: jsonRecordSchema.optional(),
});

export const songPatchSchema = songCreateSchema.partial().extend({
  id: z.string().uuid(),
  completion_pct: z.number().int().min(0).max(100).optional(),
  booth_score: z.number().int().min(0).max(100).optional(),
  total_bars: z.number().int().min(0).optional(),
  last_saved_at: z.string().datetime().optional(),
});

export const sessionUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  song_id: z.string().uuid(),
  beat_id: z.string().nullable().optional(),
  beat_snapshot: jsonRecordSchema.optional(),
  mode: z.string().default("midnight"),
  ambiance: z.string().default("vinyl"),
  section_content: sectionsSchema,
  active_section: z.string().default("Hook"),
  song_state: z.number().int().min(0).max(3).default(0),
  completion_pct: z.number().int().min(0).max(100).default(0),
  booth_score: z.number().int().min(0).max(100).default(0),
  total_bars: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  expected_revision: z.number().int().positive().optional(),
  playback_position_seconds: z.number().finite().min(0).max(86400).default(0),
  studio_dna: jsonRecordSchema.optional(),
  client_updated_at: z.string().datetime().optional(),
});

export const sectionVersionRestoreSchema = z.object({
  version_id: z.string().uuid(),
});

export const beatLockerSchema = z.object({
  beat_id: z.string().min(1),
  title: z.string().min(1),
  producer: z.string().optional(),
  bpm: z.number().int().optional(),
  musical_key: z.string().optional(),
  mood: z.string().optional(),
  license: z.string().optional(),
  price: z.number().int().optional(),
  stripe_checkout_session_id: z.string().optional(),
  beat_snapshot: jsonRecordSchema.optional(),
});

export const privateBeatImportSchema = z.object({
  title: z.string().trim().min(1).max(160),
  producer: z.string().trim().max(120).default(""),
  bpm: z.number().int().min(40).max(240).nullable().default(null),
  musical_key: z.string().trim().max(32).nullable().default(null),
  duration_seconds: z.number().int().min(1).max(7200),
  file_name: z.string().trim().min(1).max(255),
  file_size: z.number().int().min(1).max(100 * 1024 * 1024),
  mime_type: z.string().trim().min(1).max(120),
  rights_confirmed: z.literal(true),
});

export const privateBeatImportCompleteSchema = privateBeatImportSchema.extend({
  storage_path: z.string().trim().min(1).max(500),
  content_type: z.string().trim().min(1).max(120),
});

export const songLockerSchema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  song_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  status: z.string().default("draft"),
  booth_ready: z.boolean().default(false),
  snapshot: jsonRecordSchema.optional(),
});

export const hookLockerSchema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  song_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).default("Untitled Hook"),
  content: z.string().min(1),
  source_section: z.string().default("Hook"),
  tags: z.array(z.string()).default([]),
});

export const entitlementCreateSchema = z.object({
  product_id: z.string().min(1),
});

export const marketplaceEventSchema = z.object({
  event_type: z.enum(["beat_play", "beat_favorite", "beat_add"]),
  beat_id: z.string().min(1).max(80),
});

export const roughTakeAnalysisSchema = z.object({
  version: z.literal("booth-ready-v2"),
  durationSeconds: z.number().finite().min(0).max(60 * 60),
  sampleRate: z.number().int().min(8_000).max(384_000),
  peakDb: z.number().finite().min(-120).max(6),
  rmsDb: z.number().finite().min(-120).max(6),
  silencePct: z.number().finite().min(0).max(100),
  clippingPct: z.number().finite().min(0).max(100),
  dynamicRangeDb: z.number().finite().min(0).max(120),
  consistency: z.number().int().min(0).max(100),
  vocalPresence: z.number().int().min(0).max(100),
  deliveryScore: z.number().int().min(0).max(100),
  findings: z.array(z.string().min(1).max(180)).max(3),
});

export const roughTakeUploadSchema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  song_id: z.string().uuid().nullable().optional(),
  session_id: z.string().uuid().nullable().optional(),
  section_name: z.string().trim().min(1).max(60).default("Hook"),
  duration_seconds: z.number().int().min(1).max(3600),
  beat_id: z.string().trim().min(1).max(200).nullable().optional(),
  beat_snapshot: jsonRecordSchema.optional(),
  beat_position_seconds: z.number().finite().min(0).max(86400).default(0),
});

export const producerActionCreateSchema = z.object({
  project_id: z.string().uuid(),
  song_id: z.string().uuid(),
  session_id: z.string().uuid().nullable().optional(),
  action_type: z.enum(producerActionTypes),
  section_name: z.string().min(1).max(60),
  section_content: z.string().min(1).max(20_000),
  attempt: z.number().int().min(0).max(20).default(0),
  beat: z.record(z.string(), z.unknown()).default({}),
  studio_dna: z.object({
    environment: z.string().min(1).max(60),
    goal: z.string().min(1).max(60),
    style: z.string().min(1).max(60),
    mood: z.string().min(1).max(60),
    producer: z.string().min(1).max(60),
  }),
});

export const producerActionDecisionSchema = z.object({
  decision: z.enum(["accept", "reject", "revert"]),
});

export const producerProfileUpsertSchema = z.object({
  display_name: z.string().min(1).max(80),
  handle: z
    .string()
    .max(40)
    .optional()
    .transform((value) => value?.trim().replace(/^@+/, "").toLowerCase() || undefined),
  city: z.string().max(80).optional(),
  studio_name: z.string().max(120).optional(),
  state: z.string().max(80).optional(),
  country: z.string().max(80).default("United States"),
  years_producing: z.number().int().min(0).max(80).nullable().optional(),
  bio: z.string().max(600).optional(),
  genres: z.array(z.string().min(1).max(32)).max(8).default([]),
  specialties: z.array(z.string().min(1).max(32)).max(12).default([]),
  website_url: z.string().max(240).optional(),
  instagram_url: z.string().max(240).optional(),
  youtube_url: z.string().max(240).optional(),
  beatstars_url: z.string().max(240).optional(),
  business_email: z.string().email().max(240).optional().or(z.literal("")),
  contact_preference: z.enum(["platform", "email", "website", "social", "hidden"]).default("platform"),
  license_settings: z
    .object({
      lease: z.number().int().min(0).max(100000).default(49),
      premium: z.number().int().min(0).max(100000).default(149),
      unlimited: z.number().int().min(0).max(100000).default(299),
      exclusive: z.number().int().min(0).max(1000000).default(899),
    })
    .default({ lease: 49, premium: 149, unlimited: 299, exclusive: 899 }),
  default_license_terms: z.string().max(4000).optional(),
  automatic_delivery: z.boolean().default(true),
  onboarding_step: z.number().int().min(1).max(5).default(1),
  submit: z.boolean().default(false),
});

export const producerPlaylistCreateSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  beat_ids: z.array(z.string().uuid()).max(50).default([]),
  publish: z.boolean().default(false),
});

export const producerPlaylistSaveSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).default(""),
  beat_ids: z.array(z.string().uuid()).max(50).default([]),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const producerBeatUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  bpm: z.number().int().min(40).max(220).nullable(),
  duration_seconds: z.number().int().min(0).max(7200),
  musical_key: z.string().trim().max(32).nullable(),
  genre: z.string().trim().max(80).nullable(),
  mood: z.string().trim().max(80).nullable(),
  region: z.string().trim().max(80).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  license_tiers: z.array(z.object({
    license: z.enum(["Lease", "Premium Lease", "Exclusive"]),
    price: z.number().int().min(0).max(1_000_000),
  })).length(3),
  submit: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.submit && value.duration_seconds < 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["duration_seconds"],
      message: "Audio duration is required before submitting a beat.",
    });
  }
});

export const producerFollowSchema = z.object({
  action: z.enum(["follow", "unfollow"]),
});
