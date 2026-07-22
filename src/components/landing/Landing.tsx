import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, PlayCircle, ShieldCheck, Award, Sparkles, Mic, Music2,
  Waves, CheckCircle2, Star, ChevronDown, Headphones,
} from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useScrollReveal, useCountUp } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";
import { producers } from "@/lib/marketplace-data";
import studioHero from "@/assets/studio-hero.jpg";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <SiteNav transparent />
      <Hero />
      <LogoStrip />
      <ProductTour />
      <MetricsBand />
      <ProducersRail />
      <Testimonials />
      <PricingTease />
      <FAQ />
      <CTA />
      <SiteFooter />
    </div>
  );
}

/* ---------- HERO ---------- */
function Hero() {
  const [live, setLive] = useState(295);
  useEffect(() => {
    const t = setInterval(() => setLive((n) => n + (Math.random() > 0.5 ? 1 : -1)), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative pt-40 pb-28 px-5 overflow-hidden">
      {/* Cinematic studio photograph */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={studioHero}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0b]/70 via-[#0a0a0b]/85 to-[#0a0a0b]" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 12% 10%, rgba(255,176,32,0.18), transparent 55%)" }} />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-onyx-elev/60 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
          The Prep Studio · v1.5
        </div>

        <h1 className="font-display mt-6 text-5xl sm:text-6xl md:text-7xl leading-[1.02] tracking-tight">
          Go from idea to <span className="text-gold-gradient">Booth Ready</span>.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          A luxury digital environment for rap artists. License the beat, write to it,
          hit the score, walk into the booth certified.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/studio"
            className="group inline-flex items-center gap-2 rounded-md gold-seal px-6 py-3 text-sm font-semibold text-onyx hover:scale-[1.02] transition-transform"
          >
            Enter the Studio
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 rounded-md border border-border/70 px-6 py-3 text-sm font-semibold text-foreground hover:bg-onyx-elev transition-colors"
          >
            <PlayCircle className="h-4 w-4" /> Browse Beats
          </Link>
        </div>

        <div className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="tabular-nums">{live.toLocaleString()}</span> rappers writing right now
        </div>

        {/* waveform */}
        <div className="mt-14 mx-auto max-w-3xl">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <span className="inline-flex items-center gap-2"><Headphones className="h-3.5 w-3.5 text-gold" /> Now playing · Midnight in Atlanta</span>
              <span>140 BPM · F# minor</span>
            </div>
            <Waveform />
          </div>
        </div>
      </div>
    </section>
  );
}

function Waveform() {
  const bars = useMemo(
    () => Array.from({ length: 96 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.42)) * 0.75),
    [],
  );
  return (
    <div className="h-20 flex items-end gap-[3px]">
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-gradient-to-t from-gold-deep/40 to-gold"
          style={{
            height: `${v * 100}%`,
            animation: `vu-pulse ${1.2 + (i % 5) * 0.15}s ease-in-out ${i * 0.015}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- LOGO STRIP ---------- */
function LogoStrip() {
  const marks = ["300 · Ent", "Quality Control", "Top Dawg", "Def Jam", "Motown", "Atlantic"];
  return (
    <section className="border-y border-border/40 bg-onyx-elev/30">
      <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col md:flex-row items-center gap-6">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Writers signed to
        </span>
        <div className="flex-1 grid grid-cols-3 md:grid-cols-6 gap-6 items-center opacity-60">
          {marks.map((m) => (
            <div
              key={m}
              className="text-center font-display text-sm tracking-widest text-muted-foreground"
            >
              {m}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- PRODUCT TOUR ---------- */
function ProductTour() {
  const steps = [
    {
      icon: Music2,
      title: "License the beat",
      body: "A curated record store. Booth Ready Beats, mood collections, producer storefronts. Buy or preview.",
      accent: "Marketplace",
    },
    {
      icon: Mic,
      title: "Write inside the room",
      body: "Ghost Studio pins the beat, autosaves your drafts, and coaches your cadence in real time.",
      accent: "Ghost Studio",
    },
    {
      icon: Award,
      title: "Certify Booth Ready",
      body: "Score of 90+ on Structure, Cadence, Completion, Originality & Replay unlocks the gold seal.",
      accent: "Booth Ready",
    },
  ];
  return (
    <Section eyebrow="How it works" title="One environment. Three moves.">
      <div className="grid md:grid-cols-3 gap-5">
        {steps.map((s, i) => (
          <RevealCard key={s.title} delay={i * 90}>
            <div className="glass-panel rounded-2xl p-6 h-full flex flex-col">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gold/80">
                {s.accent}
              </div>
              <s.icon className="mt-4 h-8 w-8 text-gold" />
              <div className="mt-4 font-display text-2xl">{s.title}</div>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                {s.body}
              </div>
              <div className="hairline mt-5" />
            </div>
          </RevealCard>
        ))}
      </div>
    </Section>
  );
}

/* ---------- METRICS BAND ---------- */
function MetricsBand() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  const stats = [
    { label: "Songs Certified", value: 12480, suffix: "+" },
    { label: "Beats Licensed", value: 38200, suffix: "+" },
    { label: "Hours Written", value: 91300, suffix: "" },
    { label: "Producers Onboarded", value: 460, suffix: "" },
  ];
  return (
    <section className="py-24 px-5" ref={ref}>
      <div className="mx-auto max-w-6xl glass-panel rounded-3xl p-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} suffix={s.suffix} label={s.label} active={visible} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({
  value, suffix, label, active,
}: { value: number; suffix: string; label: string; active: boolean }) {
  const n = useCountUp(value, active);
  return (
    <div>
      <div className="font-display text-4xl md:text-5xl text-gold-gradient tabular-nums">
        {n.toLocaleString()}{suffix}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/* ---------- PRODUCERS RAIL ---------- */
function ProducersRail() {
  const featured = producers.slice(0, 6);
  return (
    <Section eyebrow="Producer Network" title="Beats from the people shaping the sound.">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {featured.map((p, i) => (
          <RevealCard key={p.id} delay={i * 40}>
            <Link
              to="/marketplace"
              className="block glass-panel rounded-xl p-4 hover:border-gold/40 transition-colors"
            >
              <div className="h-16 w-16 rounded-full gold-seal grid place-items-center font-display text-onyx text-xl">
                {p.name.charAt(0)}
              </div>
              <div className="mt-3 font-semibold text-sm truncate">{p.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{p.city ?? "—"}</div>
              <div className="mt-2 text-[11px] text-gold/80">Visit Storefront →</div>
            </Link>
          </RevealCard>
        ))}
      </div>
    </Section>
  );
}

/* ---------- TESTIMONIALS ---------- */
function Testimonials() {
  const quotes = [
    {
      q: "It's the first time a tool actually respects how I write. The beat is right there, the score keeps me honest, and I finish songs.",
      a: "Kayo · Atlanta",
    },
    {
      q: "Marketplace + Ghost Studio in one place is the move. I license, I write, I ship — no more copy-pasting between apps.",
      a: "Lex Duro · Houston",
    },
    {
      q: "Booth Ready is the accountability I didn't know I needed. Gold seal or you rewrite. Simple.",
      a: "Ma$e Lucid · Brooklyn",
    },
  ];
  return (
    <Section eyebrow="Written by the room" title="From the artists inside.">
      <div className="grid md:grid-cols-3 gap-5">
        {quotes.map((t, i) => (
          <RevealCard key={i} delay={i * 90}>
            <div className="glass-panel rounded-2xl p-6 h-full flex flex-col">
              <div className="flex gap-0.5 text-gold">
                {[0,1,2,3,4].map((s) => <Star key={s} className="h-3.5 w-3.5 fill-gold" />)}
              </div>
              <p className="mt-4 font-display text-lg leading-snug flex-1">"{t.q}"</p>
              <div className="mt-4 text-xs text-muted-foreground">{t.a}</div>
            </div>
          </RevealCard>
        ))}
      </div>
    </Section>
  );
}

/* ---------- PRICING TEASE ---------- */
function PricingTease() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      note: "Preview the room",
      features: ["Ghost Studio access", "Preview beats", "3 saved drafts"],
      cta: "Start free",
      to: "/auth",
      highlight: false,
    },
    {
      name: "Writer",
      price: "$14",
      note: "Per month",
      features: ["Unlimited drafts", "Full autosave", "Booth Ready score", "5 licensed beats"],
      cta: "Enter Studio",
      to: "/studio",
      highlight: true,
    },
    {
      name: "Studio",
      price: "$39",
      note: "For pros",
      features: ["Everything in Writer", "Unlimited licenses", "Priority producer access", "Certificate exports"],
      cta: "Talk to us",
      to: "/auth",
      highlight: false,
    },
  ];
  return (
    <Section eyebrow="Pricing" title="Fair to the writer. Fair to the producer.">
      <div className="grid md:grid-cols-3 gap-5">
        {tiers.map((t, i) => (
          <RevealCard key={t.name} delay={i * 80}>
            <div
              className={cn(
                "rounded-2xl p-6 h-full flex flex-col border transition-all",
                t.highlight
                  ? "border-gold/60 bg-gradient-to-b from-gold/[0.08] to-transparent shadow-[0_20px_60px_-30px_theme(colors.yellow.500/40%)]"
                  : "glass-panel border-border/50",
              )}
            >
              {t.highlight && (
                <div className="self-start text-[10px] uppercase tracking-[0.22em] text-gold mb-2">
                  Most popular
                </div>
              )}
              <div className="font-display text-2xl">{t.name}</div>
              <div className="mt-2 flex items-end gap-1">
                <span className="font-display text-4xl text-gold-gradient">{t.price}</span>
                <span className="text-xs text-muted-foreground mb-1">/ {t.note}</span>
              </div>
              <ul className="mt-5 space-y-2 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-gold" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={t.to}
                className={cn(
                  "mt-6 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-all",
                  t.highlight
                    ? "gold-seal text-onyx hover:scale-[1.02]"
                    : "border border-border/70 hover:bg-onyx-elev",
                )}
              >
                {t.cta}
              </Link>
            </div>
          </RevealCard>
        ))}
      </div>
    </Section>
  );
}

/* ---------- FAQ ---------- */
function FAQ() {
  const items = [
    {
      q: "Is this an AI lyric generator?",
      a: "No. RapWriter.ai is a prep studio. It coaches your pen with cadence & completion metrics, but every bar is yours.",
    },
    {
      q: "Do I actually own the licenses I buy?",
      a: "Yes. Every beat license from the Marketplace is yours. Terms are attached to each beat and stored in your Locker.",
    },
    {
      q: "What is Booth Ready?",
      a: "A 5-axis quality score across Structure, Cadence, Completion, Originality and Replay Value. 90+ certifies the song.",
    },
    {
      q: "Does my work stay private?",
      a: "Yes. Drafts autosave locally and — when you sign in — into your private vault. Only you see them.",
    },
    {
      q: "Can producers upload beats?",
      a: "Producer Storefronts are open. Talk to us if you want early access.",
    },
    {
      q: "Do you have a mobile app?",
      a: "The web app works on mobile today. Native apps are on the roadmap — see /changelog.",
    },
  ];
  return (
    <Section eyebrow="FAQ" title="What people ask before they enter.">
      <div className="max-w-3xl mx-auto divide-y divide-border/50 glass-panel rounded-2xl">
        {items.map((it) => (
          <FAQRow key={it.q} q={it.q} a={it.a} />
        ))}
      </div>
    </Section>
  );
}

function FAQRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-onyx-elev/40 transition-colors"
    >
      <div className="flex-1">
        <div className="font-medium">{q}</div>
        {open && <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{a}</div>}
      </div>
      <ChevronDown className={cn("h-4 w-4 mt-1 text-muted-foreground transition-transform", open && "rotate-180")} />
    </button>
  );
}

/* ---------- CTA ---------- */
function CTA() {
  return (
    <section className="py-28 px-5">
      <div className="mx-auto max-w-4xl text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-gold" />
        <h2 className="font-display text-4xl md:text-5xl mt-4">
          Your next song is <span className="text-gold-gradient">one session</span> away.
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Enter the Prep Studio. Pick a beat. Finish the song. Walk out Booth Ready.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-md gold-seal px-6 py-3 text-sm font-semibold text-onyx hover:scale-[1.02] transition-transform"
          >
            Enter the Studio <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md border border-border/70 px-6 py-3 text-sm font-semibold hover:bg-onyx-elev transition-colors"
          >
            Create your account
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */
function Section({
  eyebrow, title, children,
}: { eyebrow: string; title: string; children: React.ReactNode }) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <section className="py-24 px-5">
      <div ref={ref} className={cn("mx-auto max-w-6xl", visible ? "reveal-in" : "reveal")}>
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">{eyebrow}</div>
          <h2 className="font-display text-3xl md:text-5xl mt-3">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function RevealCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(visible ? "reveal-in" : "reveal")}
    >
      {children}
    </div>
  );
}
