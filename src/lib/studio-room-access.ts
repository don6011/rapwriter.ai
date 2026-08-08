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
export type StudioRoomRequiredPlan = "pro" | "elite" | null;

export type StudioRoomAccess = {
  available: boolean;
  source: "included" | "membership" | "owned" | "locked";
  badge: string;
  requiredPlan: StudioRoomRequiredPlan;
};

export const defaultStudioRoomId: StudioRoomId = "skyline-loft";

const includedRooms = new Set<StudioRoomId>([defaultStudioRoomId, "midnight"]);
const proRooms = new Set<StudioRoomId>(["trap-house", "bedroom", "cypher"]);
const eliteRooms = new Set<StudioRoomId>(["penthouse", "red-light", "main-room", "radio-room"]);

export function studioRoomRequiredPlan(roomId: StudioRoomId): StudioRoomRequiredPlan {
  if (proRooms.has(roomId)) return "pro";
  if (eliteRooms.has(roomId)) return "elite";
  return null;
}

export function membershipIncludesStudioRoom(planId: string | null | undefined, roomId: StudioRoomId) {
  if (includedRooms.has(roomId)) return true;
  if (planId === "creator_all_access") return true;
  if (planId === "artist_studio") return proRooms.has(roomId) || eliteRooms.has(roomId);
  if (planId === "artist_pro") return proRooms.has(roomId);
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
      badge: planId === "creator_all_access" ? "All Access" : "Available",
      requiredPlan,
    };
  }

  return {
    available: false,
    source: "locked",
    badge: requiredPlan === "elite" ? "Elite" : requiredPlan === "pro" ? "Pro" : "Store",
    requiredPlan,
  };
}
