import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/components/landing/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RapWriter.ai — Go from idea to Booth Ready™" },
      {
        name: "description",
        content:
          "The luxury prep studio for rap artists. License beats, write to them, and certify your songs Booth Ready™ — all in one environment.",
      },
      { property: "og:title", content: "RapWriter.ai — The Prep Studio™" },
      {
        property: "og:description",
        content:
          "Beats, writing, cadence coaching, and Booth Ready™ certification. One environment.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  component: Landing,
});
