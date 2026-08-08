"use client";

import { PRODUCER_BEAT_ID, RAW_BEAT_UUID } from "@/lib/studio/beat-snapshot";

export function trackMarketplaceEvent(eventType: "beat_play" | "beat_favorite" | "beat_add", beatId: string) {
  if (!PRODUCER_BEAT_ID.test(beatId) && !RAW_BEAT_UUID.test(beatId)) return;
  void fetch("/api/marketplace/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType, beat_id: beatId }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
