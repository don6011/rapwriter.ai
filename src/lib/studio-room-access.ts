export const studioRoomIds = [
  "midnight",
  "trap-house",
  "bedroom",
  "penthouse",
  "cypher",
  "afterglow",
  "bedroom-diaries",
  "red-light",
  "main-room",
  "skyline-loft",
  "soft-life",
  "desert-sessions",
  "rooftop-sessions",
  "radio-room",
  "bando-sessions",
] as const;

export type StudioRoomId = (typeof studioRoomIds)[number];
export type StudioRoomRequiredPlan = "pro" | null;

export type StudioRoomAccess = {
  available: boolean;
  source: "included" | "membership" | "owned" | "locked";
  badge: string;
  requiredPlan: StudioRoomRequiredPlan;
};

export const defaultStudioRoomId: StudioRoomId = "skyline-loft";

const includedRooms = new Set<StudioRoomId>([defaultStudioRoomId, "midnight"]);
export function studioRoomRequiredPlan(roomId: StudioRoomId): StudioRoomRequiredPlan {
  return includedRooms.has(roomId) ? null : "pro";
}

export function membershipIncludesStudioRoom(planId: string | null | undefined, roomId: StudioRoomId) {
  if (includedRooms.has(roomId)) return true;
  if (planId === "artist_studio" || planId === "artist_pro") return true;
  return false;
}

export function resolveStudioRoomAccess(
  roomId: StudioRoomId,
  planId: string | null | undefined,
  owned: boolean,
): StudioRoomAccess {
  if (owned) return { available: true, source: "owned", badge: "Owned", requiredPlan: studioRoomRequiredPlan(roomId) };
  if (includedRooms.has(roomId)) return { available: true, source: "included", badge: roomId === defaultStudioRoomId ? "Default" : "Included", requiredPlan: null };

  const requiredPlan = studioRoomRequiredPlan(roomId);
  if (membershipIncludesStudioRoom(planId, roomId)) {
    return {
      available: true,
      source: "membership",
      badge: "Available",
      requiredPlan,
    };
  }

  return {
    available: false,
    source: "locked",
    badge: requiredPlan === "pro" ? "Pro" : "Store",
    requiredPlan,
  };
}
