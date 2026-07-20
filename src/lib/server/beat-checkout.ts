import type { License } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";

type ProducerTier = { license?: unknown; price?: unknown };

export type ResolvedBeatCheckout = {
  beatId: string;
  title: string;
  producer: string;
  license: string;
  priceCents: number;
  snapshot: Record<string, unknown>;
};

export async function resolveBeatCheckout(beatId: string, requestedLicense: string): Promise<ResolvedBeatCheckout | null> {
  const producerBeatId = beatId.startsWith("producer-beat-") ? beatId.slice("producer-beat-".length) : beatId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(producerBeatId)) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("producer_beats")
    .select("id, title, bpm, musical_key, genre, mood, region, tags, duration_seconds, license_tiers, producer_profiles(display_name, status, is_public)")
    .eq("id", producerBeatId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const profileValue = data.producer_profiles as unknown;
  const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;
  const producerProfile = profile as { display_name?: string; status?: string; is_public?: boolean } | null;
  if (!producerProfile || producerProfile.status !== "approved" || !producerProfile.is_public) return null;

  const tier = findTier((data.license_tiers ?? []) as ProducerTier[], requestedLicense);
  if (!tier) return null;

  return {
    beatId: `producer-beat-${data.id}`,
    title: data.title,
    producer: producerProfile.display_name ?? "RapWriter Producer",
    license: tier.license,
    priceCents: tier.price * 100,
    snapshot: {
      id: `producer-beat-${data.id}`,
      producerBeatId: data.id,
      title: data.title,
      producer: producerProfile.display_name ?? "RapWriter Producer",
      bpm: data.bpm,
      key: data.musical_key,
      genre: data.genre,
      mood: data.mood,
      region: data.region,
      durationSeconds: data.duration_seconds,
      source: "approved_producer",
    },
  };
}

function findTier(tiers: ProducerTier[] | Array<{ license: License; price: number }>, requestedLicense: string) {
  const normalizedRequest = normalizeLicense(requestedLicense);
  const match = tiers.find((tier) => typeof tier.license === "string" && normalizeLicense(tier.license) === normalizedRequest);
  if (!match || typeof match.license !== "string" || typeof match.price !== "number" || !Number.isInteger(match.price) || match.price <= 0) return null;
  return { license: match.license, price: match.price };
}

function normalizeLicense(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}
