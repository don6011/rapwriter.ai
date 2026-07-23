export const MEMBERSHIP_ACCESS_EVENT = "rapwriter:membership-access";

export type MembershipAccessNotice = {
  code: "upgrade_required" | "usage_limit_reached";
  message: string;
  audience: "artist" | "producer" | null;
  feature: string | null;
  currentPlan: string | null;
  recommendedPlan: string | null;
  usage: number | null;
  limit: number | null;
};

export function membershipAccessNotice(payload: unknown, status?: number): MembershipAccessNotice | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  const code = value.code;
  if (code !== "upgrade_required" && code !== "usage_limit_reached") return null;
  if (status !== undefined && status !== 402 && status !== 429) return null;

  return {
    code,
    message: typeof value.error === "string" ? value.error : code === "upgrade_required"
      ? "Upgrade your membership to use this feature."
      : "You have reached this plan's limit.",
    audience: value.audience === "artist" || value.audience === "producer" ? value.audience : null,
    feature: stringValue(value.feature),
    currentPlan: stringValue(value.current_plan),
    recommendedPlan: stringValue(value.recommended_plan),
    usage: numberValue(value.usage),
    limit: numberValue(value.limit),
  };
}

export function notifyMembershipAccess(payload: unknown, status?: number) {
  const notice = membershipAccessNotice(payload, status);
  if (!notice || typeof window === "undefined") return notice;
  window.dispatchEvent(new CustomEvent<MembershipAccessNotice>(MEMBERSHIP_ACCESS_EVENT, { detail: notice }));
  return notice;
}

export function membershipAccessCopy(notice: MembershipAccessNotice) {
  const feature = featureLabel(notice.feature);
  if (notice.code === "usage_limit_reached") {
    const quantity = notice.usage !== null && notice.limit !== null ? ` (${notice.usage}/${notice.limit})` : "";
    return `${feature} limit reached${quantity}. Your work is safe.`;
  }
  return `${feature} is included with ${planLabel(notice.recommendedPlan)}.`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function featureLabel(feature: string | null) {
  const labels: Record<string, string> = {
    active_projects: "Active projects",
    song_storage: "Song storage",
    ghostwriter: "Ghostwriter",
    hook_doctor: "Hook Doctor",
    rewrite: "Producer Rewrite",
    commercial_pass: "Commercial Pass",
    version_history: "Revision history",
    premium_exports: "Premium exports",
    private_beat_imports: "Private beat imports",
    beat_uploads: "Beat uploads",
    collections: "Producer collections",
  };
  if (!feature) return "This feature";
  return labels[feature] ?? feature.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function planLabel(plan: string | null) {
  if (plan === "artist_pro") return "Prep Studio Pro";
  if (plan === "artist_studio") return "Prep Studio Elite";
  if (plan === "producer_pro") return "Producer Pro";
  return "a higher membership";
}
