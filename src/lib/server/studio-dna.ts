import { mergeStudioDnaTraits, type StudioDnaTraits } from "@/lib/studio-dna-profile";
import { requireMembershipEntitlement } from "@/lib/server/membership-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function updateStudioDnaFromCompletedSession(input: {
  supabase: ServerSupabaseClient;
  ownerId: string;
  sessionId: string;
  sections: Record<string, string>;
  studioDna: Record<string, unknown>;
  beat: Record<string, unknown>;
}) {
  await requireMembershipEntitlement(input.supabase, input.ownerId, "artist", "studio_dna_full");
  const admin = createAdminClient();
  const { data: existing, error } = await admin.from("ai_studio_dna_profiles").select("traits,source_session_count").eq("owner_id", input.ownerId).maybeSingle();
  if (error) throw error;
  const current = (existing?.traits ?? {}) as StudioDnaTraits;
  if (current.recent_session_ids?.includes(input.sessionId)) return current;
  const traits = mergeStudioDnaTraits(current, input);
  const { error: upsertError } = await admin.from("ai_studio_dna_profiles").upsert({
    owner_id: input.ownerId,
    traits,
    source_session_count: Number(existing?.source_session_count ?? 0) + 1,
    model: "deterministic-v1",
  }, { onConflict: "owner_id" });
  if (upsertError) throw upsertError;
  await admin.from("growth_events").insert({ owner_id: input.ownerId, event_name: "studio_dna_updated", metadata: { source: "completed_session", trait_version: 1 } });
  return traits;
}
