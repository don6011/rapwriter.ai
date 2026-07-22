import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/40 bg-onyx/60">
      <div className="mx-auto max-w-6xl px-5 py-14 grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
        <div className="col-span-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md gold-seal grid place-items-center">
              <Sparkles className="h-4 w-4 text-onyx" />
            </div>
            <span className="font-display text-lg">
              RapWriter<span className="text-gold-gradient">.ai</span>
            </span>
          </Link>
          <p className="mt-3 text-muted-foreground max-w-sm leading-relaxed">
            The luxury prep studio for rap artists. Go from idea to Booth Ready —
            without leaving one environment.
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            All systems normal · v1.5
          </div>
        </div>

        <FooterCol
          title="Product"
          items={[
            { label: "Studio", to: "/studio" },
            { label: "Marketplace", to: "/marketplace" },
            { label: "Changelog", to: "/changelog" },
          ]}
        />
        <FooterCol
          title="Company"
          items={[
            { label: "Manifesto", to: "/manifesto" },
            { label: "Sign in", to: "/auth" },
          ]}
        />
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Legal</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>Terms</li>
            <li>Privacy</li>
            <li>© {new Date().getFullYear()} RapWriter.ai</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/30">
        <div className="mx-auto max-w-6xl px-5 py-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center justify-between">
          <span>Made in Atlanta · Written everywhere</span>
          <span>Booth Ready · Ghost Studio · Prep Studio</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; to: string }[];
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="text-muted-foreground hover:text-foreground transition-colors">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
