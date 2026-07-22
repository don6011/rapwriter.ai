import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;

  const [
    profile,
    artistProfile,
    roles,
    subscriptions,
    entitlementGrants,
    usageCounters,
    projects,
    songs,
    sessions,
    beats,
    savedSongs,
    hooks,
    roughTakes,
    sections,
    sectionVersions,
    entitlements,
    producerProfile,
    producerBeats,
    producerPlaylists,
    producerBusiness,
    producerBilling,
    producerMetrics,
    producerFollows,
    producerActions,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("artist_profiles").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, created_at").eq("user_id", user.id),
    supabase.from("user_subscriptions").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("entitlement_grants").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("usage_counters").select("*").eq("owner_id", user.id).order("period_start"),
    supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("songs").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("ghost_studio_sessions").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("beat_locker").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("song_locker").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("hook_locker").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("rough_takes").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("song_sections").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("song_section_versions").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("product_entitlements").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("producer_profiles").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_beats").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("producer_playlists").select("*, producer_playlist_items(*)").eq("owner_id", user.id).order("created_at"),
    supabase.from("producer_business_settings").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_billing_accounts").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_metrics").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("producer_follows").select("*").eq("follower_id", user.id).order("created_at"),
    supabase.from("producer_actions").select("*").eq("owner_id", user.id).order("created_at"),
  ]);

  const results = {
    profile,
    artist_profile: artistProfile,
    roles,
    subscriptions,
    entitlement_grants: entitlementGrants,
    usage_counters: usageCounters,
    projects,
    songs,
    sessions,
    beat_locker: beats,
    song_locker: savedSongs,
    hook_locker: hooks,
    rough_takes: roughTakes,
    song_sections: sections,
    song_section_versions: sectionVersions,
    product_entitlements: entitlements,
    producer_profile: producerProfile,
    producer_beats: producerBeats,
    producer_playlists: producerPlaylists,
    producer_business: producerBusiness,
    producer_billing: producerBilling,
    producer_metrics: producerMetrics,
    producer_follows: producerFollows,
    producer_actions: producerActions,
  };

  const failed = Object.entries(results).find(([, result]) => result.error);
  if (failed) {
    return NextResponse.json({ error: `Could not export ${failed[0]}.` }, { status: 500 });
  }

  const payload = {
    format: "rapwriter-account-export",
    version: 1,
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    data: Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.data])),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="rapwriter-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
