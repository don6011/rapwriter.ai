import type { ProductEntitlementRow, ProfileRow, SongRow } from "@/hooks/use-rapwriter-data";
import type { MembershipSnapshot } from "@/lib/membership";
import type { ProductUnlock, SectionVersion } from "@/lib/studio/types";

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export function formatVersionTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function versionSourceLabel(source: SectionVersion["source"]) {
  const labels: Record<SectionVersion["source"], string> = {
    autosave: "Autosave",
    manual: "Manual save",
    recovery: "Restored draft",
    import: "Imported",
    producer_action: "Producer pass",
  };
  return labels[source];
}

export function getProgressPct(currentTime: number, duration: number) {
  if (!duration || duration <= 0) return 0;
  return Math.max(0, Math.min(100, (currentTime / duration) * 100));
}

export function artistDisplayName(profile: ProfileRow | null, email?: string | null) {
  return profile?.artist_name?.trim() || profile?.display_name?.trim() || email?.split("@")[0] || "Artist";
}

export function getProjectTitle(song: SongRow | null) {
  const project = song?.projects;
  if (!project || typeof project !== "object") return null;
  const title = "title" in project ? project.title : null;
  const type = "project_type" in project ? project.project_type : null;
  if (typeof title !== "string") return null;
  return typeof type === "string" && type ? `${title} - ${type}` : title;
}

export function productCategoryLabel(type: ProductEntitlementRow["product_type"]): ProductUnlock["category"] {
  if (type === "ai_style") return "Producer Style";
  if (type === "vocal_chain") return "Vocal Chain";
  if (type === "writing_pack") return "Writing Pack";
  if (type === "ambient_pack") return "Ambient Pack";
  if (type === "theme") return "Theme";
  if (type === "bundle") return "Bundle";
  if (type === "producer_profile") return "Producer Profile";
  if (type === "studio_room") return "Studio Room";
  return "Beat License";
}

export function productUnlockFromEntitlement(entitlement: ProductEntitlementRow): ProductUnlock {
  const detail = typeof entitlement.metadata.detail === "string" ? entitlement.metadata.detail : "Studio Store product unlocked.";
  const price = typeof entitlement.metadata.price === "string" ? entitlement.metadata.price : `$${Math.round(entitlement.price_cents / 100)}`;
  return {
    id: entitlement.product_id,
    title: entitlement.title,
    category: productCategoryLabel(entitlement.product_type),
    detail,
    price,
    unlockedAt: entitlement.created_at,
  };
}

export function membershipAccessLabel(membership: MembershipSnapshot | null) {
  const artistPlan = `${membership?.artist?.plan.id ?? ""} ${membership?.artist?.plan.name ?? ""}`.toLowerCase();
  const producerPlan = `${membership?.producer?.plan.id ?? ""} ${membership?.producer?.plan.name ?? ""}`.toLowerCase();
  const hasArtistElite = /\belite\b/.test(artistPlan);
  const hasArtistPro = /\bpro\b/.test(artistPlan);
  const hasProducerPro = /\bpro\b/.test(producerPlan);
  if (hasArtistElite && hasProducerPro) return "All Access";
  if (hasArtistElite) return "Elite";
  if (hasArtistPro) return "Pro";
  if (hasProducerPro) return "Producer Pro";
  return null;
}

export function hasAllAccessMembership(membership: MembershipSnapshot | null) {
  return membership?.artist?.plan.id === "artist_studio"
    && membership?.producer?.plan.id === "producer_pro";
}
