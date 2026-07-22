import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog · RapWriter.ai" },
      { name: "description", content: "What we shipped. The Prep Studio is under active development — this is where you can see it." },
      { property: "og:title", content: "RapWriter.ai — Changelog" },
      { property: "og:description", content: "Shipped updates from the RapWriter.ai team." },
    ],
  }),
  component: Changelog,
});

const entries = [
  {
    date: "Jul 04, 2026",
    tag: "Ghost Studio",
    title: "Booth Ready Achievement System",
    body: "Automatic cinematic celebration when a project's quality score crosses 90. Gold badge stamp, staged certificate reveal, and a shareable certification number.",
  },
  {
    date: "Jun 22, 2026",
    tag: "Ghost Studio",
    title: "Ghost Studio V1.5 — Director's Cut",
    body: "Producer Notes, Song Mission checklist, Writing Session Timeline, and a redesigned Now Playing surface. The studio finally feels like a studio.",
  },
  {
    date: "Jun 08, 2026",
    tag: "Marketplace",
    title: "Homepage restructure — Start With A Beat",
    body: "Marketplace hero now leads with mood chips, a live 'writing now' counter, and a clear Start Writing CTA. Endless scrolling is out.",
  },
  {
    date: "May 27, 2026",
    tag: "Marketplace",
    title: "Producer Storefronts",
    body: "Every producer now has a full storefront: hero banner, collections, best sellers, social proof, and a producer story.",
  },
  {
    date: "May 14, 2026",
    tag: "Platform",
    title: "Licensing state machine",
    body: "The Hero Beat Player and Lockers now update automatically after purchase. Buying and writing are one continuous flow.",
  },
];

function Changelog() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="pt-32 pb-20 px-5">
        <div className="mx-auto max-w-3xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">Changelog</div>
          <h1 className="font-display text-5xl md:text-6xl mt-3">Shipped.</h1>
          <p className="mt-3 text-muted-foreground">Everything we've released. Public log, kept honest.</p>

          <ol className="mt-14 relative border-l border-border/60 pl-8 space-y-12">
            {entries.map((e) => (
              <li key={e.date} className="relative">
                <span className="absolute -left-[41px] top-1 h-6 w-6 rounded-full gold-seal grid place-items-center">
                  <Sparkles className="h-3 w-3 text-onyx" />
                </span>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {e.date} · <span className="text-gold">{e.tag}</span>
                </div>
                <h3 className="mt-2 font-display text-2xl">{e.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{e.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
