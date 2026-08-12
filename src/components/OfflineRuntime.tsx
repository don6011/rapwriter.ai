"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";

const SERVICE_WORKER_PATH = "/rapwriter-offline.js";

export function OfflineRuntime() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    let removeNetworkListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void Network.getStatus().then((status) => setOffline(!status.connected));
      void Network.addListener("networkStatusChange", (status) => setOffline(!status.connected)).then((listener) => {
        removeNetworkListener = () => void listener.remove();
      });
    }

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch(() => {
        // The studio keeps working without the cache layer; local draft writes are independent.
      });
    }

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      removeNetworkListener?.();
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-3 top-[max(env(safe-area-inset-top),0.75rem)] z-[100] mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md border border-gold/30 bg-[#111113]/95 px-3 py-2 text-xs font-medium text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
      Offline. Your draft stays on this device.
    </div>
  );
}
