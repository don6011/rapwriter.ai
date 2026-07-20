import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RapWriter.ai - The Prep Studio",
    short_name: "RapWriter",
    description: "Write, rehearse, and prepare every record for the booth.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070708",
    theme_color: "#070708",
    icons: [
      {
        src: "/brand/rapwriter-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/rapwriter-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
