import { useEffect, useState, useCallback } from "react";
import {
  getPurchases, getBeatLicense, isBeatLicensed, purchaseBeat,
  LICENSE_EVENT, type PurchasedBeat, type License,
} from "@/lib/marketplace-data";

/**
 * Reactive licensing hook — subscribes to license-change events so that
 * HeroBeatPlayer, the Locker counts, and any other consumer auto-update the
 * instant a beat is licensed.
 */
export function useLicensing(beatId?: string) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick(t => t + 1);
    window.addEventListener(LICENSE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LICENSE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const purchases: PurchasedBeat[] = getPurchases();
  const license = beatId ? getBeatLicense(beatId) : null;
  const licensed = beatId ? isBeatLicensed(beatId) : false;

  const purchase = useCallback(
    (id: string, license: License, price: number) => {
      purchaseBeat({ beatId: id, license, price, purchasedAt: Date.now() });
    },
    [tick],
  );

  return { purchases, license, licensed, purchase };
}
