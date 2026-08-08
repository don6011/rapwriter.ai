"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductEntitlementRow } from "@/hooks/use-rapwriter-data";
import type { StarterBeat } from "@/lib/starter-beats";
import { productUnlockFromEntitlement } from "@/lib/studio/format";
import type { MarketplaceFeed, ProductUnlock } from "@/lib/studio/types";

export function useMarketplaceFeed(productEntitlements: ProductEntitlementRow[]) {
  const [productUnlocks, setProductUnlocks] = useState<ProductUnlock[]>([]);
  const [marketplaceFeed, setMarketplaceFeed] = useState<MarketplaceFeed>({ beats: [], producers: [] });
  const [marketplaceFeedLoading, setMarketplaceFeedLoading] = useState(true);
  const [marketplaceFeedError, setMarketplaceFeedError] = useState<string | null>(null);
  const [starterBeats, setStarterBeats] = useState<StarterBeat[]>([]);
  const [starterBeatsLoading, setStarterBeatsLoading] = useState(true);
  const [starterBeatsError, setStarterBeatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarketplaceFeedLoading(true);
    setMarketplaceFeedError(null);
    void fetch("/api/marketplace/beats")
      .then(async (res) => {
        if (!res.ok) throw new Error("Producer feed is unavailable.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMarketplaceFeed({
          beats: Array.isArray(data.beats) ? data.beats : [],
          producers: Array.isArray(data.producers) ? data.producers : [],
        });
        setMarketplaceFeedLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMarketplaceFeed({ beats: [], producers: [] });
          setMarketplaceFeedLoading(false);
          // Known bug, tracked separately: an empty feed and a failed fetch are
          // reported with the same message. Preserved verbatim on purpose.
          setMarketplaceFeedError("Producer drops will appear when the live feed reconnects.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStarterBeatsLoading(true);
    setStarterBeatsError(null);
    void fetch("/api/starter-beats")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Starter Beats are unavailable.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setStarterBeats(Array.isArray(data.beats) ? data.beats : []);
        setStarterBeatsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setStarterBeats([]);
        setStarterBeatsLoading(false);
        setStarterBeatsError(error instanceof Error ? error.message : "Starter Beats are unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entitlementUnlocks = useMemo(() => productEntitlements.map(productUnlockFromEntitlement), [productEntitlements]);
  const mergedProductUnlocks = useMemo(() => {
    const seen = new Set<string>();
    return [...entitlementUnlocks, ...productUnlocks].filter((unlock) => {
      if (seen.has(unlock.id)) return false;
      seen.add(unlock.id);
      return true;
    });
  }, [entitlementUnlocks, productUnlocks]);
  const unlockedProductIds = useMemo(() => new Set(mergedProductUnlocks.map((unlock) => unlock.id)), [mergedProductUnlocks]);

  const saveSessionProductUnlock = useCallback((product: Omit<ProductUnlock, "unlockedAt">) => {
    setProductUnlocks((current) => {
      if (current.some((item) => item.id === product.id)) return current;
      return [{ ...product, unlockedAt: new Date().toISOString() }, ...current];
    });
  }, []);

  return {
    marketplaceFeed,
    marketplaceFeedLoading,
    marketplaceFeedError,
    starterBeats,
    starterBeatsLoading,
    starterBeatsError,
    mergedProductUnlocks,
    unlockedProductIds,
    saveSessionProductUnlock,
  };
}
