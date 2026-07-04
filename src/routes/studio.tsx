import { createFileRoute } from "@tanstack/react-router";
import Studio from "@/components/Studio";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Ghost Studio™ — RapWriter.ai" },
      {
        name: "description",
        content:
          "Ghost Studio™ is the writing room. Pin a beat, write inside it, and hit Booth Ready™.",
      },
      { property: "og:title", content: "Ghost Studio™ — Write until Booth Ready™" },
      {
        property: "og:description",
        content:
          "A luxury songwriting environment. Cadence coaching, Song Mission™, autosave, and Booth Ready™ certification.",
      },
    ],
  }),
  component: Studio,
});
