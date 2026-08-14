"use client";

import { useEffect } from "react";
import type { useRapWriterData } from "@/hooks/use-rapwriter-data";
import type { Beat } from "@/lib/marketplace";
import type { PadActionStatus, ProductUnlock } from "@/lib/studio/types";

type Workspace = ReturnType<typeof useRapWriterData>;

export type StudioCommerceOptions = {
  user: Workspace["user"];
  unlockProductEntitlement: Workspace["unlockProductEntitlement"];
  /** Records a purchase in the session so the Locker shows it before entitlements refresh. */
  saveSessionProductUnlock: (product: Omit<ProductUnlock, "unlockedAt">) => void;
  requestAuth: (message?: string) => void;
  setPadActionStatus: (status: PadActionStatus) => void;
};

/**
 * Studio Store purchases: free unlocks, Stripe checkout hand-offs, and the checkout
 * return banner. Every outcome is reported through the pad status line.
 */
export function useStudioCommerce({
  user,
  unlockProductEntitlement,
  saveSessionProductUnlock,
  requestAuth,
  setPadActionStatus,
}: StudioCommerceOptions) {
  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (!checkout) return;
    setPadActionStatus({
      state: checkout === "success" ? "saved" : "error",
      message: checkout === "success" ? "Purchase complete. Your studio access is syncing." : "Checkout cancelled. Nothing was charged.",
    });
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [setPadActionStatus]);

  function unlockProduct(product: Omit<ProductUnlock, "unlockedAt">) {
    if (!user) {
      requestAuth("Sign in to sync this purchase across devices.");
      setPadActionStatus({ state: "error", message: `${product.title} needs checkout before it unlocks.` });
      return;
    }

    if (product.price === "$0") {
      setPadActionStatus({ state: "saving", message: `Saving ${product.title}...` });
      void unlockProductEntitlement(product.id)
        .then(() => {
          saveSessionProductUnlock(product);
          setPadActionStatus({ state: "saved", message: `${product.title} saved.` });
        })
        .catch((err) => {
          setPadActionStatus({ state: "error", message: err instanceof Error ? err.message : "Could not save this producer." });
        });
      return;
    }

    setPadActionStatus({ state: "saving", message: `Opening secure checkout for ${product.title}...` });
    void fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Checkout could not be started.");
        if (!data.checkout_url) throw new Error("Stripe did not return a checkout link.");
        window.location.assign(data.checkout_url);
      })
      .catch((err) => {
        setPadActionStatus({ state: "error", message: err instanceof Error ? err.message : "Checkout could not be started." });
      });
  }

  function licenseBeat(beat: Beat) {
    if (!user) {
      requestAuth("Sign in to license this beat and keep it in your Locker.");
      return;
    }

    const tier = beat.prices[0];
    if (!tier) {
      setPadActionStatus({ state: "error", message: "No license is available for this beat." });
      return;
    }

    setPadActionStatus({ state: "saving", message: `Opening secure checkout for ${beat.title}...` });
    void fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beat_id: beat.id, license: tier.license }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Checkout could not be started.");
        if (!data.checkout_url) throw new Error("Stripe did not return a checkout link.");
        window.location.assign(data.checkout_url);
      })
      .catch((err) => {
        setPadActionStatus({ state: "error", message: err instanceof Error ? err.message : "Checkout could not be started." });
      });
  }

  return { unlockProduct, licenseBeat };
}
