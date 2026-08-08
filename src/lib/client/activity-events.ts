export const ACTIVITY_REFRESH_EVENT = "rapwriter:activity-refresh";

export function refreshActivityInbox() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACTIVITY_REFRESH_EVENT));
}
