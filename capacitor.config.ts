import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.rapwriter.app",
  appName: "RapWriter",
  webDir: "native",
  server: {
    // Native release builds load the production app while the local shell remains
    // available as a graceful offline first-launch fallback.
    url: process.env.CAPACITOR_SERVER_URL ?? "https://rapwriter.ai/studio",
    errorPath: "index.html",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "rapwriter.ai",
      "*.rapwriter.ai",
      "*.supabase.co",
      "checkout.stripe.com",
      "*.stripe.com",
    ],
  },
};

export default config;
