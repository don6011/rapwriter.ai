import { createFileRoute } from "@tanstack/react-router";
import Marketplace from "@/components/Marketplace";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "RapWriter.ai — Marketplace · The Record Store" },
      { name: "description", content: "A luxury digital record store for creators. Featured producers, trending beats, beat packs, regional & mood collections." },
      { property: "og:title", content: "RapWriter.ai Marketplace" },
      { property: "og:description", content: "Spotify meets BeatStars meets luxury record store. Buy beats, then write to them in Ghost Studio™." },
    ],
  }),
  component: Marketplace,
});
