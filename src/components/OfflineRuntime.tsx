"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";

const SERVICE_WORKER_PATH = "/rapwriter-offline.js";
const NATIVE_NETWORK_POLL_MS = 1_500;

export function OfflineRuntime() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let disposed = false;
    const nativePlatform = Capacitor.getPlatform() !== "web";

    const updateConnection = (connected: boolean) => {
      if (!disposed) setOffline(!connected);
    };

    const refreshConnection = async () => {
      if (nativePlatform) {
        try {
          const status = await Network.getStatus();
          updateConnection(status.connected);
          return;
        } catch {
          // Fall through to the browser signal if the native bridge is unavailable.
        }
      }

      updateConnection(navigator.onLine);
    };

    const handleConnectionEvent = () => void refreshConnection();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshConnection();
    };

    void refreshConnection();
    window.addEventListener("online", handleConnectionEvent);
    window.addEventListener("offline", handleConnectionEvent);
    window.addEventListener("focus", handleConnectionEvent);
    window.addEventListener("pageshow", handleConnectionEvent);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let removeNetworkListener: (() => void) | undefined;
    if (nativePlatform) {
      void Network.addListener("networkStatusChange", (status) => updateConnection(status.connected))
        .then((listener) => {
          if (disposed) {
            void listener.remove();
          } else {
            removeNetworkListener = () => void listener.remove();
          }
        })
        .catch(() => {
          // Browser online/offline events remain active if the native bridge is unavailable.
        });
    }

    const networkPoll = window.setInterval(() => void refreshConnection(), NATIVE_NETWORK_POLL_MS);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch(() => {
        // The studio keeps working without the cache layer; local draft writes are independent.
      });
    }

    return () => {
      disposed = true;
      window.clearInterval(networkPoll);
      window.removeEventListener("online", handleConnectionEvent);
      window.removeEventListener("offline", handleConnectionEvent);
      window.removeEventListener("focus", handleConnectionEvent);
      window.removeEventListener("pageshow", handleConnectionEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      removeNetworkListener?.();
    };
  }, []);

  if (!offline) return null;

  return (
    <main
      aria-labelledby="offline-title"
      aria-live="assertive"
      className="fixed inset-0 z-[1000] flex min-h-dvh items-center justify-center bg-[#070708] px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)] text-white"
      role="alert"
    >
      <section className="w-full max-w-sm rounded-lg border border-gold/25 bg-[#111113] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div
          aria-hidden="true"
          className="mx-auto mb-5 grid h-13 w-13 place-items-center rounded-full border border-gold/40 text-xl font-semibold text-gold"
        >
          R
        </div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">RapWriter</p>
        <h1 id="offline-title" className="text-2xl font-semibold">
          Your studio is offline.
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          Reconnect to continue your session. Work already saved on this device remains protected.
        </p>
        <p className="mt-5 text-xs font-medium text-white/45">Waiting for a connection…</p>
      </section>
    </main>
  );
}
