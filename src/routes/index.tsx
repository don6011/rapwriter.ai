import { createFileRoute } from "@tanstack/react-router";
import Studio from "@/components/Studio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RapWriter.ai — Sharpen Your Pen" },
      { name: "description", content: "The Prep Studio™. A premium digital environment where artists go from idea to Booth Ready™." },
      { property: "og:title", content: "RapWriter.ai — The Prep Studio™" },
      { property: "og:description", content: "Go from idea to Booth Ready™. Not an AI lyric generator — a luxury prep studio for artists." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" },
    ],
  }),
  component: Studio,
});
