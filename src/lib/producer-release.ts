type ProducerProfileReadiness = {
  display_name?: string | null;
  handle?: string | null;
  city?: string | null;
  country?: string | null;
  bio?: string | null;
  genres?: string[] | null;
  specialties?: string[] | null;
};

type ProducerBusinessReadiness = {
  onboarding_completed?: boolean | null;
  business_email?: string | null;
};

type ProducerBeatReadiness = {
  title?: string | null;
  bpm?: number | null;
  duration_seconds?: number | null;
  genre?: string | null;
  mood?: string | null;
  region?: string | null;
  tags?: string[] | null;
  license_tiers?: Array<{ license?: string | null; price?: number | null }> | null;
  audio_path?: string | null;
  artwork_path?: string | null;
};

type ProducerUploadDraftReadiness = {
  title?: string | null;
  bpm?: string | number | null;
  genre?: string | null;
  mood?: string | null;
  region?: string | null;
  tags?: string | null;
  lease_price?: string | number | null;
  premium_price?: string | number | null;
  exclusive_price?: string | number | null;
  has_audio?: boolean;
  has_artwork?: boolean;
};

export function getProducerProfileBlockers(
  profile: ProducerProfileReadiness | null | undefined,
  business: ProducerBusinessReadiness | null | undefined,
) {
  if (!profile) return ["Create a producer profile."];
  const blockers: string[] = [];
  if (!hasText(profile.display_name)) blockers.push("Add a producer name.");
  if (!hasText(profile.handle)) blockers.push("Claim a storefront handle.");
  if (!hasText(profile.city) || !hasText(profile.country)) blockers.push("Complete your location.");
  if (!hasText(profile.bio) || profile.bio!.trim().length < 40) blockers.push("Add a producer bio of at least 40 characters.");
  if (!(profile.genres?.length)) blockers.push("Choose at least one genre.");
  if (!(profile.specialties?.length)) blockers.push("Choose at least one specialty.");
  if (!business?.onboarding_completed) blockers.push("Complete producer onboarding.");
  if (!hasText(business?.business_email)) blockers.push("Add a business email.");
  return blockers;
}

export function getProducerBeatBlockers(beat: ProducerBeatReadiness | null | undefined) {
  if (!beat) return ["Upload a beat."];
  const blockers: string[] = [];
  if (!hasText(beat.title)) blockers.push("Add a beat title.");
  if (!beat.bpm || beat.bpm < 40 || beat.bpm > 220) blockers.push("BPM must be between 40 and 220.");
  if (!beat.duration_seconds || beat.duration_seconds < 1) blockers.push("Analyze the audio duration.");
  if (!hasText(beat.genre)) blockers.push("Choose a genre.");
  if (!hasText(beat.mood)) blockers.push("Choose a mood.");
  if (!hasText(beat.region)) blockers.push("Add a region.");
  if (!(beat.tags?.length)) blockers.push("Add at least one discovery tag.");
  if (!hasText(beat.audio_path)) blockers.push("Upload playable audio.");
  if (!hasText(beat.artwork_path)) blockers.push("Upload release artwork.");

  const tiers = beat.license_tiers ?? [];
  const requiredLicenses = ["Lease", "Premium Lease", "Exclusive"];
  for (const license of requiredLicenses) {
    const tier = tiers.find((candidate) => candidate.license === license);
    if (!tier || typeof tier.price !== "number" || !Number.isInteger(tier.price) || tier.price <= 0) {
      blockers.push(`Set a positive ${license} price.`);
    }
  }
  return blockers;
}

export function getProducerUploadDraftBlockers(draft: ProducerUploadDraftReadiness) {
  const blockers: string[] = [];
  const bpm = Number(draft.bpm);
  if (!hasText(draft.title)) blockers.push("Add a beat title.");
  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 220) blockers.push("BPM must be between 40 and 220.");
  if (!hasText(draft.genre)) blockers.push("Add a genre.");
  if (!hasText(draft.mood)) blockers.push("Add a mood.");
  if (!hasText(draft.region)) blockers.push("Add a region.");
  if (!hasText(draft.tags) || !draft.tags!.split(",").some((tag) => tag.trim())) blockers.push("Add at least one discovery tag.");
  if (!draft.has_audio) blockers.push("Choose a beat audio file.");
  if (!draft.has_artwork) blockers.push("Choose release artwork.");

  for (const [label, value] of [
    ["Lease", draft.lease_price],
    ["Premium Lease", draft.premium_price],
    ["Exclusive", draft.exclusive_price],
  ] as const) {
    const price = Number(value);
    if (!Number.isInteger(price) || price <= 0) blockers.push(`Set a positive ${label} price.`);
  }
  return blockers;
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
