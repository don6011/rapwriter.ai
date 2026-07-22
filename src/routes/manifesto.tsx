import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto · RapWriter.ai" },
      { name: "description", content: "Why RapWriter.ai exists. Not an AI lyric generator — a prep studio that respects the pen." },
      { property: "og:title", content: "The RapWriter Manifesto" },
      { property: "og:description", content: "We built a studio that respects the pen." },
    ],
  }),
  component: Manifesto,
});

function Manifesto() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="pt-32 pb-20 px-5">
        <article className="mx-auto max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">Manifesto</div>
          <h1 className="font-display text-5xl md:text-6xl mt-3 leading-[1.05]">
            Respect the <span className="text-gold-gradient">pen</span>.
          </h1>
          <div className="mt-10 space-y-6 text-lg leading-relaxed text-muted-foreground font-display">
            <p>
              We didn't build another AI that writes for you. The best rappers don't want
              a ghostwriter — they want a room where the beat plays loud, the pen stays
              warm, and every bar has to earn its place.
            </p>
            <p>
              RapWriter.ai is that room. A luxury prep studio. Beats you can actually
              license. A workspace that scores your cadence, your structure, your replay
              value. A finish line called <span className="text-gold">Booth Ready</span>.
            </p>
            <p>
              We built it because writers deserve better than a text box. Because producers
              deserve a storefront that treats their catalog like the art it is. Because
              the culture deserves tools as considered as the songs it makes.
            </p>
            <p className="text-foreground">
              Enter the room. Finish the song. Walk out certified.
            </p>
          </div>
          <div className="mt-14 hairline" />
          <div className="mt-6 text-xs text-muted-foreground uppercase tracking-[0.22em]">
            — The RapWriter team · Atlanta
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
