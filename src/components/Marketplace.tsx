import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  Play, Pause, ShoppingCart, PenLine, BadgeCheck, Sparkles,
  TrendingUp, MapPin, Heart, Headphones, Users, Star, ArrowUpRight,
  Disc3, Music2, ChevronRight, Search, Crown, Filter, Flame, Award,
} from "lucide-react";
import {
  beats, producers, beatPacks, regions, moods,
  type Beat, type Producer, type BeatPack,
  setPendingBeat, addPurchase, getPurchases, purchaseBeat, LICENSE_EVENT,
} from "@/lib/marketplace-data";

// ============================================================
// Waveform — deterministic per id
// ============================================================
function makeBars(seed: string, count = 64) {
  const out: number[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const v = ((h >>> 16) & 0xffff) / 0xffff;
    out.push(0.25 + v * 0.75);
  }
  return out;
}

function Waveform({ id, playing, progress = 0 }: { id: string; playing: boolean; progress?: number }) {
  const bars = useMemo(() => makeBars(id), [id]);
  return (
    <div className="flex items-end gap-[2px] h-10 w-full">
      {bars.map((b, i) => {
        const active = i / bars.length < progress;
        return (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-sm transition-colors",
              active ? "bg-gold" : "bg-gold/25",
              playing && "origin-bottom"
            )}
            style={{
              height: `${b * 100}%`,
              animation: playing ? `vu-pulse ${0.6 + (i % 7) * 0.08}s ease-in-out ${i * 0.012}s infinite` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// Tile art
// ============================================================
function ArtTile({ art, glyph, className, label }: { art: string; glyph: string; className?: string; label?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: art }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.55))]" />
      <div className="absolute inset-0 mix-blend-overlay opacity-30"
           style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 6px)" }} />
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
        <span className="font-display text-xs text-gold/80 tracking-widest">RW</span>
        <span className="text-[9px] tracking-[0.3em] uppercase text-gold/70">Vinyl</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-4xl md:text-5xl text-gold-gradient drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
          {glyph}
        </span>
      </div>
      {label && (
        <div className="absolute bottom-2 left-2 right-2 text-[10px] uppercase tracking-[0.2em] text-foreground/80 truncate">
          {label}
        </div>
      )}
    </div>
  );
}

function VerifiedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      title="Verified Producer™"
      className={cn(
        "inline-flex items-center gap-1 rounded-full gold-seal text-onyx font-semibold",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      )}
    >
      <BadgeCheck className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      Verified
    </span>
  );
}

// ============================================================
// Header
// ============================================================
function MarketHeader({ purchases }: { purchases: number }) {
  return (
    <header className="sticky top-0 z-30 glass-panel">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="gold-seal h-9 w-9 rounded-full flex items-center justify-center">
              <span className="font-display text-onyx text-lg font-bold">R</span>
            </div>
            <div>
              <div className="font-display text-lg leading-none">
                RapWriter<span className="text-gold">.ai</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">
                Marketplace
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold transition-colors"
            >
              Studio
            </Link>
            <span className="px-3 py-1.5 rounded-lg text-xs uppercase tracking-[0.2em] text-gold border border-gold/30 bg-gold/8">
              Marketplace
            </span>
          </nav>
        </div>

        <div className="hidden lg:flex flex-1 max-w-md mx-4">
          <div className="flex items-center gap-2 w-full px-3 py-2 rounded-full border border-border bg-onyx-elev/60">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground/60"
              placeholder="Search beats, producers, packs, regions…"
            />
            <span className="text-[10px] text-muted-foreground/70 hidden xl:inline">⌘K</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-gold hover:border-gold/40">
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>
          <button className="relative flex items-center gap-2 px-3 py-2 rounded-lg gold-seal text-onyx text-xs font-semibold">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">My Licenses</span>
            <span className="bg-onyx text-gold text-[10px] px-1.5 py-0.5 rounded-full tabular-nums">
              {purchases}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// Hero — Featured Producer
// ============================================================
function FeaturedProducerHero({ producer, featuredPack, onBuyPack, onPreview }: {
  producer: Producer; featuredPack: BeatPack; onBuyPack: () => void; onPreview: () => void;
}) {
  return (
    <section className="relative rounded-3xl overflow-hidden border border-gold/20 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
      {/* Banner */}
      <div className="absolute inset-0" style={{ background: producer.banner }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,168,76,0.18),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-onyx via-onyx/70 to-transparent" />
      <div className="absolute inset-0 mix-blend-overlay opacity-20"
           style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px)" }} />

      <div className="relative px-6 md:px-10 pt-8 md:pt-10 pb-6 md:pb-10">
        <div className="flex items-center gap-2 mb-6">
          <Crown className="h-3.5 w-3.5 text-gold" />
          <span className="text-[10px] uppercase tracking-[0.4em] text-gold/90">
            Featured Producer · This Week
          </span>
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-8 items-end">
          {/* Producer block */}
          <div className="flex items-start gap-5">
            <div
              className="h-20 w-20 md:h-24 md:w-24 rounded-2xl border-2 border-gold/40 shrink-0 flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(0,0,0,0.7)]"
              style={{ background: producer.avatar }}
            >
              <span className="font-display text-3xl text-gold-gradient">{producer.glyph}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-display text-3xl md:text-5xl text-gold-gradient leading-none">
                  {producer.name}
                </h1>
                {producer.verified && <VerifiedBadge size="md" />}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{producer.handle}</span>
                <span className="h-1 w-1 rounded-full bg-gold/40" />
                <MapPin className="h-3 w-3" />
                <span>{producer.city}</span>
              </div>
              <p className="text-foreground/85 text-sm md:text-base mt-3 max-w-xl leading-relaxed">
                {producer.bio}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 md:gap-8 mt-5 max-w-md">
                <Stat label="Beats Sold" value={fmt(producer.sales)} />
                <Stat label="Followers" value={fmt(producer.followers)} />
                <Stat label="Rating" value={`${producer.rating} ★`} />
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-2 mt-6">
                <button className="px-4 py-2.5 rounded-xl gold-seal text-onyx text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Follow Producer
                </button>
                <button className="px-4 py-2.5 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 text-sm flex items-center gap-2">
                  Visit Storefront <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Featured pack card */}
          <div className="glass-panel rounded-2xl p-4 w-full md:w-[320px] shrink-0">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">
              Featured Beat Pack
            </div>
            <div className="aspect-square rounded-xl overflow-hidden border border-gold/30 mb-3">
              <ArtTile art={featuredPack.art} glyph={featuredPack.glyph} className="w-full h-full" />
            </div>
            <div className="font-display text-lg leading-tight">{featuredPack.title}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {featuredPack.count} beats · {featuredPack.bpmRange} BPM · {featuredPack.vibe}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <div className="font-display text-2xl text-gold-gradient">${featuredPack.price}</div>
              <div className="flex gap-1.5">
                <button onClick={onPreview} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-gold hover:border-gold/40">
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button onClick={onBuyPack} className="px-3 py-2 rounded-lg gold-seal text-onyx text-xs font-semibold flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" /> Buy Pack
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl md:text-2xl text-gold-gradient leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1.5">{label}</div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

// ============================================================
// Section header
// ============================================================
function SectionHeader({ icon: Icon, eyebrow, title, action }: {
  icon: React.ComponentType<{ className?: string }>; eyebrow: string; title: string; action?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-gold/80 mb-2">
          <Icon className="h-3 w-3" />
          {eyebrow}
        </div>
        <h2 className="font-display text-2xl md:text-3xl">
          <span className="text-gold-gradient">{title}</span>
        </h2>
      </div>
      {action && (
        <button className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold flex items-center gap-1">
          {action} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// Trending Beat Card
// ============================================================
function TrendingBeatCard({
  beat, playing, onPreview, onBuy, onWrite,
}: {
  beat: Beat; playing: boolean;
  onPreview: () => void; onBuy: () => void; onWrite: () => void;
}) {
  const minLicense = beat.prices[0];
  return (
    <article className="group glass-panel rounded-2xl overflow-hidden flex flex-col hover:border-gold/30 transition-colors">
      <div className="relative aspect-square">
        <ArtTile art={beat.art} glyph={beat.glyph} className="absolute inset-0" />
        <button
          onClick={onPreview}
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
          aria-label="Preview"
        >
          <span className={cn(
            "h-14 w-14 rounded-full gold-seal text-onyx flex items-center justify-center shadow-2xl transition-all",
            playing ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
          )}>
            {playing ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6 ml-0.5" fill="currentColor" />}
          </span>
        </button>
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-onyx/80 backdrop-blur text-[10px] text-gold uppercase tracking-widest">
            {beat.region}
          </span>
        </div>
        <button className="absolute top-3 right-3 h-8 w-8 rounded-full bg-onyx/70 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-gold">
          <Heart className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg leading-tight">{beat.title}</h3>
            <span className="text-[10px] text-muted-foreground tabular-nums">{beat.duration}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
            <span className="hover:text-gold cursor-pointer">{beat.producer}</span>
            {beat.verified && <BadgeCheck className="h-3 w-3 text-gold" />}
          </div>
        </div>

        <Waveform id={beat.id} playing={playing} progress={playing ? 0.35 : 0} />

        <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
          <Meta label={`${beat.bpm} BPM`} />
          <Meta label={beat.key} />
          {beat.tags.map(t => <Meta key={t} label={t} accent />)}
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="truncate">{beat.mood}</span>
          <span className="flex items-center gap-1 shrink-0">
            <Headphones className="h-3 w-3" /> {fmt(beat.plays)}
          </span>
        </div>

        <div className="hairline" />

        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">From</div>
            <div className="font-display text-xl text-gold-gradient leading-none">${minLicense.price}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{minLicense.license}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onPreview}
              title="Preview"
              className="h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-gold hover:border-gold/40 flex items-center justify-center"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={onBuy}
              title="Buy License"
              className="h-9 px-3 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 flex items-center gap-1.5 text-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Buy
            </button>
            <button
              onClick={onWrite}
              title="Write To This Beat — opens Ghost Studio™"
              className="h-9 px-3 rounded-lg gold-seal text-onyx flex items-center gap-1.5 text-xs font-semibold"
            >
              <PenLine className="h-3.5 w-3.5" /> Write
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Meta({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider",
      accent
        ? "border-gold/30 text-gold/90 bg-gold/5"
        : "border-border text-muted-foreground"
    )}>
      {label}
    </span>
  );
}

// ============================================================
// Pack card
// ============================================================
function PackCard({ pack, onBuy }: { pack: BeatPack; onBuy: () => void }) {
  return (
    <article className="group glass-panel rounded-2xl p-3 flex flex-col gap-3 hover:border-gold/30">
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
        <ArtTile art={pack.art} glyph={pack.glyph} className="absolute inset-0" />
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-onyx/80 backdrop-blur text-[10px] uppercase tracking-widest text-gold">
          {pack.count} beats
        </div>
      </div>
      <div>
        <div className="font-display text-lg leading-tight">{pack.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Curated by {pack.curator}</div>
        <div className="text-[11px] text-muted-foreground mt-1.5">
          {pack.vibe} · {pack.bpmRange} BPM
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="font-display text-xl text-gold-gradient">${pack.price}</div>
        <button
          onClick={onBuy}
          className="px-3 py-1.5 rounded-lg gold-seal text-onyx text-xs font-semibold flex items-center gap-1.5"
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Buy Pack
        </button>
      </div>
    </article>
  );
}

// ============================================================
// Region / Mood tile
// ============================================================
function CollectionTile({
  art, glyph, name, sub,
}: { art: string; glyph: string; name: string; sub: string }) {
  return (
    <button className="group relative aspect-[4/5] rounded-2xl overflow-hidden border border-border hover:border-gold/40 transition-all">
      <div className="absolute inset-0" style={{ background: art }} />
      <div className="absolute inset-0 bg-gradient-to-t from-onyx via-onyx/40 to-transparent" />
      <div className="absolute inset-0 mix-blend-overlay opacity-25"
           style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px)" }} />
      <div className="absolute inset-0 p-4 flex flex-col justify-between">
        <div className="font-display text-xs text-gold/80 tracking-widest">{glyph}</div>
        <div>
          <div className="font-display text-2xl text-gold-gradient leading-none">{name}</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-foreground/70 mt-2">{sub}</div>
        </div>
      </div>
      <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-onyx/70 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight className="h-3.5 w-3.5 text-gold" />
      </div>
    </button>
  );
}

// ============================================================
// Purchased Toast
// ============================================================
function PurchaseToast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
      <div className="glass-panel rounded-full px-5 py-3 flex items-center gap-3 border border-gold/40 shadow-2xl">
        <Award className="h-4 w-4 text-gold" />
        <span className="text-sm">{msg}</span>
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          → Beat Locker™
        </span>
      </div>
    </div>
  );
}

// ============================================================
// MAIN
// ============================================================
export default function Marketplace() {
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { setPurchases(getPurchases().length); }, []);

  const trending = beats.slice(0, 8);
  const featured = producers[0];
  const featuredPack = beatPacks[1];

  const togglePlay = (id: string) => setPlayingId(prev => (prev === id ? null : id));

  const handleBuyBeat = (b: Beat) => {
    purchaseBeat({ beatId: b.id, license: b.prices[0].license, price: b.prices[0].price, purchasedAt: Date.now() });
    setPurchases(getPurchases().length);
    setToast(`${b.title} — ${b.prices[0].license} license unlocked`);
    setTimeout(() => setToast(null), 2800);
  };

  const handleBuyPack = (p: BeatPack) => {
    purchaseBeat({ beatId: p.id, license: "Premium Lease", price: p.price, purchasedAt: Date.now() });
    setPurchases(getPurchases().length);
    setToast(`${p.title} — pack unlocked`);
    setTimeout(() => setToast(null), 2800);
  };

  const handleWriteToBeat = (b: Beat) => {
    setPendingBeat(b.id);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen w-full text-foreground relative">
      <MarketHeader purchases={purchases} />

      <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 space-y-12 max-w-[1600px] mx-auto">
        {/* HERO */}
        <FeaturedProducerHero
          producer={featured}
          featuredPack={featuredPack}
          onBuyPack={() => handleBuyPack(featuredPack)}
          onPreview={() => togglePlay(trending[0].id)}
        />

        {/* TRENDING */}
        <section>
          <SectionHeader icon={TrendingUp} eyebrow="What's Moving" title="Trending Beats" action="See All" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {trending.map(b => (
              <TrendingBeatCard
                key={b.id}
                beat={b}
                playing={playingId === b.id}
                onPreview={() => togglePlay(b.id)}
                onBuy={() => handleBuyBeat(b)}
                onWrite={() => handleWriteToBeat(b)}
              />
            ))}
          </div>
        </section>

        {/* BEAT PACKS */}
        <section>
          <SectionHeader icon={Disc3} eyebrow="Curated Collections" title="Beat Packs" action="Browse All" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {beatPacks.map(p => <PackCard key={p.id} pack={p} onBuy={() => handleBuyPack(p)} />)}
          </div>
        </section>

        {/* REGIONAL */}
        <section>
          <SectionHeader icon={MapPin} eyebrow="Sounds of the City" title="Regional Collections" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {regions.map(r => (
              <CollectionTile key={r.id} art={r.art} glyph={r.glyph} name={r.name} sub={`${r.count} beats`} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {regions.map(r => (
              <div key={`${r.id}-sig`} className="text-[10px] text-muted-foreground px-1 leading-snug">
                {r.signature}
              </div>
            ))}
          </div>
        </section>

        {/* MOODS */}
        <section>
          <SectionHeader icon={Flame} eyebrow="Write From The Feeling" title="Mood Collections" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {moods.map(m => (
              <CollectionTile key={m.id} art={m.art} glyph={m.glyph} name={m.name} sub={`${m.count} beats`} />
            ))}
          </div>
        </section>

        {/* VERIFIED PRODUCERS */}
        <section>
          <SectionHeader icon={BadgeCheck} eyebrow="The House Roster" title="Verified Producers™" action="View Roster" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {producers.map(p => <ProducerStorefrontCard key={p.id} producer={p} />)}
          </div>
        </section>

        {/* Footer note */}
        <section className="glass-panel rounded-2xl p-5 md:p-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="gold-seal h-10 w-10 rounded-full flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-onyx" />
            </div>
            <div>
              <div className="font-display text-lg">Every license unlocks instantly inside The Locker™</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Beat Locker · Project Selector · Recent Beats · My Licenses — synced the moment you buy.
              </div>
            </div>
          </div>
          <Link
            to="/"
            className="px-4 py-2.5 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 text-sm flex items-center gap-2"
          >
            Open Ghost Studio™ <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      {toast && <PurchaseToast msg={toast} />}
    </div>
  );
}

function ProducerStorefrontCard({ producer }: { producer: Producer }) {
  const producerBeats = beats.filter(b => b.producerId === producer.id);
  return (
    <article className="glass-panel rounded-2xl overflow-hidden group">
      <div className="relative h-24" style={{ background: producer.banner }}>
        <div className="absolute inset-0 bg-gradient-to-t from-onyx-elev to-transparent" />
        <div className="absolute inset-0 mix-blend-overlay opacity-20"
             style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 8px)" }} />
      </div>
      <div className="px-4 pb-4 -mt-10 relative">
        <div
          className="h-16 w-16 rounded-2xl border-2 border-gold/40 flex items-center justify-center shadow-xl"
          style={{ background: producer.avatar }}
        >
          <span className="font-display text-xl text-gold-gradient">{producer.glyph}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="font-display text-lg leading-none">{producer.name}</div>
          {producer.verified && <VerifiedBadge />}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> {producer.city}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="flex items-center gap-1"><Music2 className="h-3 w-3 text-gold" /> {producerBeats.length} beats</span>
          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-gold" /> {producer.rating}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3 text-gold" /> {fmt(producer.followers)}</span>
        </div>
        <button className="mt-4 w-full py-2 rounded-lg border border-gold/30 text-gold text-xs hover:bg-gold/10 flex items-center justify-center gap-1.5">
          Visit Storefront <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
    </article>
  );
}
