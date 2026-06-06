import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  Play, Pause, ShoppingCart, PenLine, BadgeCheck, Sparkles,
  TrendingUp, MapPin, Heart, Headphones, Users, Star, ArrowUpRight,
  Disc3, Music2, ChevronRight, Search, Crown, Filter, Flame, Award,
  Mic2, CheckCircle2, Activity, Quote, Youtube, Instagram, Compass, Trophy,
} from "lucide-react";
import {
  beats, producers, beatPacks, regions, moods, producerExtras,
  recentlyWrittenTo, emotionalTagList,
  type Beat, type Producer, type BeatPack,
  setPendingBeat, getPurchases, purchaseBeat,
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
  beat, playing, onPreview, onBuy, onWrite, variant = "default",
}: {
  beat: Beat; playing: boolean;
  onPreview: () => void; onBuy: () => void; onWrite: () => void;
  variant?: "default" | "booth";
}) {
  const minLicense = beat.prices[0];
  const isBooth = variant === "booth";
  return (
    <article className={cn(
      "group glass-panel rounded-2xl overflow-hidden flex flex-col transition-all",
      isBooth
        ? "border-gold/40 shadow-[0_20px_60px_-30px_rgba(201,168,76,0.5)] hover:border-gold/60"
        : "hover:border-gold/30"
    )}>
      <div className="relative aspect-square">
        <ArtTile art={beat.art} glyph={beat.glyph} className="absolute inset-0" />
        {isBooth && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full gold-seal text-onyx px-2 py-1 text-[10px] font-semibold shadow-lg">
            <Trophy className="h-3 w-3" /> Booth Ready™
          </div>
        )}
        {!isBooth && (
          <button className="absolute top-3 right-3 h-8 w-8 rounded-full bg-onyx/70 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-gold">
            <Heart className="h-3.5 w-3.5" />
          </button>
        )}
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
        {beat.writingNow > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-onyx/85 backdrop-blur border border-gold/20 px-2 py-1 text-[10px] text-foreground/90">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
            </span>
            <span className="tabular-nums font-medium">{beat.writingNow}</span>
            <span className="text-muted-foreground">writing now</span>
          </div>
        )}
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

        {/* Booth Ready metrics row */}
        <div className="grid grid-cols-3 gap-2">
          <BoothMetric label="Booth Ready" value={`${beat.boothReadyScore}`} suffix="/100" highlight />
          <BoothMetric label="Completion" value={`${beat.completionRate}%`} />
          <BoothMetric label="Finished" value={fmt(beat.tracksFinished)} />
        </div>

        <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
          <Meta label={`${beat.bpm} BPM`} />
          <Meta label={beat.key} />
        </div>

        {/* Emotional tags */}
        <div className="flex items-center flex-wrap gap-1.5">
          {beat.emotionalTags.slice(0, 4).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full border border-gold/25 bg-gold/5 text-[10px] text-gold/90 tracking-wide">
              {t}
            </span>
          ))}
        </div>

        <div className="hairline" />

        {/* PRIMARY CTA: Write To This Beat */}
        <button
          onClick={onWrite}
          className="w-full h-11 rounded-xl gold-seal text-onyx flex items-center justify-center gap-2 text-sm font-semibold shadow-[0_10px_30px_-12px_rgba(201,168,76,0.7)] hover:scale-[1.01] transition-transform"
        >
          <PenLine className="h-4 w-4" /> Write To This Beat™
        </button>

        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">License from</div>
            <div className="flex items-baseline gap-1.5">
              <div className="font-display text-lg text-gold-gradient leading-none">${minLicense.price}</div>
              <div className="text-[10px] text-muted-foreground">{minLicense.license}</div>
            </div>
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
              title="Buy License Now"
              className="h-9 px-3 rounded-lg border border-gold/30 text-gold/90 hover:bg-gold/10 flex items-center gap-1.5 text-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Buy
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function BoothMetric({ label, value, suffix, highlight }: { label: string; value: string; suffix?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg px-2 py-1.5 border text-center",
      highlight ? "border-gold/30 bg-gold/5" : "border-border bg-onyx-elev/40"
    )}>
      <div className="flex items-baseline justify-center gap-0.5">
        <span className={cn("font-display text-base leading-none", highlight ? "text-gold-gradient" : "text-foreground")}>{value}</span>
        {suffix && <span className="text-[9px] text-muted-foreground">{suffix}</span>}
      </div>
      <div className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground mt-1">{label}</div>
    </div>
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

  const totalWritingNow = beats.reduce((s, b) => s + b.writingNow, 0);
  const beatById = (id: string) => beats.find(b => b.id === id);

  return (
    <div className="min-h-screen w-full text-foreground relative">
      <MarketHeader purchases={purchases} />

      <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 space-y-14 max-w-[1600px] mx-auto">
        {/* SECTION 1 — START WITH A BEAT™ (Mood Hero) */}
        <StartWithABeatHero
          allBeats={beats}
          totalWritingNow={totalWritingNow}
          onStartWriting={(b) => handleWriteToBeat(b)}
          onPreview={(id) => togglePlay(id)}
          playingId={playingId}
        />

        {/* SECTION 2 — TRENDING IN THE STUDIO™ (merged) */}
        <TrendingInTheStudio
          beatById={beatById}
          playingId={playingId}
          onPreview={togglePlay}
          onBuy={handleBuyBeat}
          onWrite={handleWriteToBeat}
        />

        {/* SECTION 3 — MARKETPLACE (tabbed) */}
        <MarketplaceTabs
          playingId={playingId}
          onPreview={togglePlay}
          onBuy={handleBuyBeat}
          onBuyPack={handleBuyPack}
          onWrite={handleWriteToBeat}
        />

        {/* SECTION 4 — PRODUCER NETWORK™ (horizontal carousel) */}
        <ProducerNetwork />

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

// ============================================================
// SECTION 1 — Start With A Beat™ (mood-driven hero)
// ============================================================
const MOOD_CHIPS: { label: string; tag: string }[] = [
  { label: "Pain", tag: "Pain" },
  { label: "Victory", tag: "Victory" },
  { label: "Street", tag: "Street" },
  { label: "Love", tag: "Love" },
  { label: "Club", tag: "Club" },
  { label: "Hustle", tag: "Hustle" },
  { label: "Storytelling", tag: "Storytelling" },
];

function StartWithABeatHero({
  allBeats, totalWritingNow, onStartWriting, onPreview, playingId,
}: {
  allBeats: Beat[];
  totalWritingNow: number;
  onStartWriting: (b: Beat) => void;
  onPreview: (id: string) => void;
  playingId: string | null;
}) {
  const [mood, setMood] = useState<string>("Pain");

  const recommended = useMemo(() => {
    const filtered = allBeats.filter(b =>
      b.emotionalTags.some(t => t === mood) || b.tags.includes(mood)
    );
    const pool = filtered.length ? filtered : allBeats;
    return [...pool].sort((a, b) => b.boothReadyScore - a.boothReadyScore).slice(0, 3);
  }, [mood, allBeats]);

  const hero = recommended[0];

  return (
    <section className="relative rounded-3xl overflow-hidden border border-gold/30 shadow-[0_30px_80px_-40px_rgba(201,168,76,0.5)]">
      <div className="absolute inset-0 transition-all duration-700" style={{ background: hero.art }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(201,168,76,0.28),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-onyx via-onyx/85 to-onyx/30" />
      <div className="absolute inset-0 mix-blend-overlay opacity-20"
           style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 8px)" }} />

      <div className="relative px-6 md:px-10 py-10 md:py-14 grid lg:grid-cols-[1fr_auto] gap-10 items-center">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-5">
            <Compass className="h-3.5 w-3.5 text-gold" />
            <span className="text-[10px] uppercase tracking-[0.4em] text-gold/90">Start With A Beat™</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl leading-[0.95] text-gold-gradient">
            What are you writing tonight?
          </h1>
          <p className="text-foreground/85 text-sm md:text-base mt-4 leading-relaxed max-w-xl">
            Pick a feeling. We'll cue the right beat and open a fresh session in Ghost Studio™. No purchase needed to write — license when you take it to the booth.
          </p>

          {/* Mood chips */}
          <div className="flex flex-wrap gap-2 mt-6">
            {MOOD_CHIPS.map(c => {
              const active = mood === c.tag;
              return (
                <button
                  key={c.tag}
                  onClick={() => setMood(c.tag)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm border transition-all",
                    active
                      ? "gold-seal text-onyx border-transparent font-semibold shadow-[0_8px_24px_-10px_rgba(201,168,76,0.7)]"
                      : "border-gold/25 bg-gold/5 hover:bg-gold/15 hover:border-gold/50 text-gold/90"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 mt-7">
            <button
              onClick={() => onStartWriting(hero)}
              className="px-6 py-3.5 rounded-xl gold-seal text-onyx font-semibold flex items-center gap-2 shadow-[0_15px_40px_-12px_rgba(201,168,76,0.8)] hover:scale-[1.02] transition-transform"
            >
              <PenLine className="h-4 w-4" /> Start Writing™
            </button>
            <button
              onClick={() => onPreview(hero.id)}
              className="px-4 py-3 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 text-sm flex items-center gap-2"
            >
              {playingId === hero.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Preview Beat
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <span className="tabular-nums text-foreground/90 font-medium">{totalWritingNow}</span>
              rappers writing right now
            </div>
          </div>
        </div>

        {/* Recommendation rail */}
        <div className="glass-panel rounded-2xl p-4 w-full lg:w-[340px] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Recommended for <span className="text-gold">{mood}</span>
            </div>
          </div>
          <div className="space-y-2">
            {recommended.map((b, i) => (
              <button
                key={b.id}
                onClick={() => onStartWriting(b)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-xl border text-left transition-all",
                  i === 0
                    ? "border-gold/40 bg-gold/5 hover:bg-gold/10"
                    : "border-border hover:border-gold/30 hover:bg-onyx-elev/40"
                )}
              >
                <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0">
                  <ArtTile art={b.art} glyph={b.glyph} className="w-full h-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm leading-tight truncate">{b.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {b.producer} · {b.bpm} BPM · {b.key}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-sm text-gold-gradient leading-none">{b.boothReadyScore}</div>
                  <div className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Booth</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SECTION 2 — Trending In The Studio™ (merged shelf)
// ============================================================
function TrendingInTheStudio({
  beatById, playingId, onPreview, onBuy, onWrite,
}: {
  beatById: (id: string) => Beat | undefined;
  playingId: string | null;
  onPreview: (id: string) => void;
  onBuy: (b: Beat) => void;
  onWrite: (b: Beat) => void;
}) {
  // Rank: blend Booth Ready Score + active writers (recently written to)
  const ranked = useMemo(() => {
    return [...beats]
      .map(b => ({ b, score: b.boothReadyScore * 0.6 + b.writingNow * 0.8 + b.completionRate * 0.2 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(x => x.b);
  }, []);

  // Live ticker headline from most recent activity
  const tickerBeat = beatById(recentlyWrittenTo[0].beatId);

  return (
    <section>
      <SectionHeader
        icon={Flame}
        eyebrow="Booth Ready · Recently Written To · Live"
        title="Trending In The Studio™"
        action="See All"
      />
      {tickerBeat && (
        <div className="glass-panel rounded-xl px-4 py-2.5 mb-5 flex items-center gap-3 text-xs">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="text-muted-foreground truncate">
            <span className="text-foreground/90 font-medium">{recentlyWrittenTo[0].artistHandle}</span>
            <span> just </span>
            <span className="text-gold">{recentlyWrittenTo[0].action}</span>
            <span> on </span>
            <span className="text-gold">{tickerBeat.title}</span>
            <span className="text-muted-foreground/70"> · {recentlyWrittenTo[0].minutesAgo}m ago</span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ranked.map((b, i) => (
          <TrendingBeatCard
            key={b.id}
            beat={b}
            playing={playingId === b.id}
            onPreview={() => onPreview(b.id)}
            onBuy={() => onBuy(b)}
            onWrite={() => onWrite(b)}
            variant={i < 2 ? "booth" : "default"}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// SECTION 3 — Marketplace tabs
// ============================================================
type MarketTab = "beats" | "packs" | "producers" | "regions" | "moods";

function MarketplaceTabs({
  playingId, onPreview, onBuy, onBuyPack, onWrite,
}: {
  playingId: string | null;
  onPreview: (id: string) => void;
  onBuy: (b: Beat) => void;
  onBuyPack: (p: BeatPack) => void;
  onWrite: (b: Beat) => void;
}) {
  const [tab, setTab] = useState<MarketTab>("beats");

  const tabs: { id: MarketTab; label: string; count: number }[] = [
    { id: "beats",     label: "Beats",      count: beats.length },
    { id: "packs",     label: "Beat Packs", count: beatPacks.length },
    { id: "producers", label: "Producers",  count: producers.length },
    { id: "regions",   label: "Regions",    count: regions.length },
    { id: "moods",     label: "Moods",      count: moods.length },
  ];

  return (
    <section>
      <SectionHeader icon={Disc3} eyebrow="The Catalog" title="Marketplace" />

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 rounded-full text-xs uppercase tracking-[0.18em] whitespace-nowrap transition-all flex items-center gap-2",
                active
                  ? "gold-seal text-onyx font-semibold shadow-[0_8px_24px_-12px_rgba(201,168,76,0.7)]"
                  : "border border-border text-muted-foreground hover:text-gold hover:border-gold/40"
              )}
            >
              {t.label}
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
                active ? "bg-onyx/30 text-onyx" : "bg-onyx-elev/60 text-muted-foreground"
              )}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === "beats" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {beats.map(b => (
            <TrendingBeatCard
              key={b.id}
              beat={b}
              playing={playingId === b.id}
              onPreview={() => onPreview(b.id)}
              onBuy={() => onBuy(b)}
              onWrite={() => onWrite(b)}
            />
          ))}
        </div>
      )}

      {tab === "packs" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {beatPacks.map(p => <PackCard key={p.id} pack={p} onBuy={() => onBuyPack(p)} />)}
        </div>
      )}

      {tab === "producers" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {producers.map(p => <ProducerTeaseCard key={p.id} producer={p} />)}
        </div>
      )}

      {tab === "regions" && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
          {regions.map(r => (
            <CollectionTile key={r.id} art={r.art} glyph={r.glyph} name={r.name} sub={`${r.count} beats`} />
          ))}
        </div>
      )}

      {tab === "moods" && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
          {moods.map(m => (
            <CollectionTile key={m.id} art={m.art} glyph={m.glyph} name={m.name} sub={`${m.count} beats`} />
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// SECTION 4 — Producer Network™ (horizontal carousel of teases)
// ============================================================
function ProducerNetwork() {
  return (
    <section>
      <SectionHeader
        icon={BadgeCheck}
        eyebrow="The House Roster"
        title="Producer Network™"
        action="View Roster"
      />
      <div className="-mx-4 md:-mx-6 lg:-mx-10 px-4 md:px-6 lg:px-10 overflow-x-auto scroll-smooth snap-x snap-mandatory">
        <div className="flex gap-4 pb-3 min-w-min">
          {producers.map(p => (
            <div key={p.id} className="snap-start shrink-0 w-[280px] md:w-[320px]">
              <ProducerTeaseCard producer={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProducerTeaseCard({ producer }: { producer: Producer }) {
  const extras = producerExtras[producer.id];
  const signature = extras?.tagline ?? producer.bio;
  const producerBeats = beats.filter(b => b.producerId === producer.id);
  const finishedTotal = producerBeats.reduce((s, b) => s + b.tracksFinished, 0);
  return (
    <article className="glass-panel rounded-2xl overflow-hidden border border-border hover:border-gold/30 transition-all h-full flex flex-col">
      <div className="relative h-24" style={{ background: producer.banner }}>
        <div className="absolute inset-0 bg-gradient-to-t from-onyx/80 to-transparent" />
        <div className="absolute inset-0 mix-blend-overlay opacity-25"
             style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px)" }} />
      </div>
      <div className="px-4 pb-4 -mt-8 flex flex-col flex-1 gap-3">
        <div className="flex items-end gap-3">
          <div
            className="h-14 w-14 rounded-xl border-2 border-gold/40 shrink-0 flex items-center justify-center shadow-lg"
            style={{ background: producer.avatar }}
          >
            <span className="font-display text-xl text-gold-gradient">{producer.glyph}</span>
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-1.5">
              <div className="font-display text-base leading-none truncate">{producer.name}</div>
              {producer.verified && <BadgeCheck className="h-3.5 w-3.5 text-gold shrink-0" />}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 truncate">{producer.handle} · {producer.city}</div>
          </div>
        </div>
        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{signature}</p>
        <div className="grid grid-cols-3 gap-1.5">
          <BoothMetric label="Followers" value={fmt(producer.followers)} />
          <BoothMetric label="Beats Sold" value={fmt(producer.sales)} />
          <BoothMetric label="Finished" value={fmt(finishedTotal)} highlight />
        </div>
        <button className="mt-auto w-full h-9 rounded-lg gold-seal text-onyx text-xs font-semibold flex items-center justify-center gap-1.5">
          Visit Storefront™ <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

// ============================================================
// Start With A Beat™ — primary discovery CTA
// ============================================================
function StartWithABeatCTA({
  beat, totalWritingNow, onStart, onPreview,
}: { beat: Beat; totalWritingNow: number; onStart: () => void; onPreview: () => void }) {
  return (
    <section className="relative rounded-3xl overflow-hidden border border-gold/30 shadow-[0_30px_80px_-40px_rgba(201,168,76,0.5)]">
      <div className="absolute inset-0" style={{ background: beat.art }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,rgba(201,168,76,0.25),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-onyx via-onyx/85 to-onyx/40" />
      <div className="absolute inset-0 mix-blend-overlay opacity-20"
           style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 8px)" }} />

      <div className="relative px-6 md:px-10 py-8 md:py-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="h-3.5 w-3.5 text-gold" />
            <span className="text-[10px] uppercase tracking-[0.4em] text-gold/90">Discovery Mode</span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl leading-[0.95] text-gold-gradient">
            Start With A Beat™
          </h2>
          <p className="text-foreground/85 text-sm md:text-base mt-4 leading-relaxed max-w-xl">
            Don't pick a license. Pick a feeling. RapWriter loads a beat into Ghost Studio™ and starts a fresh writing session — no purchase needed to write. License when you're ready to take it to the booth.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={onStart}
              className="px-6 py-3.5 rounded-xl gold-seal text-onyx font-semibold flex items-center gap-2 shadow-[0_15px_40px_-12px_rgba(201,168,76,0.8)] hover:scale-[1.02] transition-transform"
            >
              <PenLine className="h-4 w-4" /> Start With A Beat™
            </button>
            <button
              onClick={onPreview}
              className="px-4 py-3 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 text-sm flex items-center gap-2"
            >
              <Play className="h-3.5 w-3.5" /> Preview "{beat.title}"
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <span className="tabular-nums text-foreground/90 font-medium">{totalWritingNow}</span>
              rappers writing right now
            </div>
          </div>
        </div>

        {/* Starter beat preview */}
        <div className="glass-panel rounded-2xl p-4 w-full md:w-[300px] shrink-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">
            Recommended Start
          </div>
          <div className="aspect-square rounded-xl overflow-hidden border border-gold/30 mb-3">
            <ArtTile art={beat.art} glyph={beat.glyph} className="w-full h-full" />
          </div>
          <div className="font-display text-lg leading-tight">{beat.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{beat.producer} · {beat.bpm} BPM · {beat.key}</div>
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <BoothMetric label="Booth Ready" value={`${beat.boothReadyScore}`} suffix="/100" highlight />
            <BoothMetric label="Complete" value={`${beat.completionRate}%`} />
            <BoothMetric label="Finished" value={fmt(beat.tracksFinished)} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Recently Written To — live activity ticker
// ============================================================
function RecentlyWrittenTo({
  beatById, onWrite,
}: { beatById: (id: string) => Beat | undefined; onWrite: (id: string) => void }) {
  return (
    <section>
      <SectionHeader
        icon={Activity}
        eyebrow="Live · Across The Studio"
        title="Recently Written To"
        action="See All Activity"
      />
      <div className="glass-panel rounded-2xl divide-y divide-border/60 overflow-hidden">
        {recentlyWrittenTo.map(act => {
          const beat = beatById(act.beatId);
          if (!beat) return null;
          const isBooth = act.action === "hit Booth Ready™";
          return (
            <div key={act.id} className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 hover:bg-onyx-elev/40 transition-colors">
              {/* Artist */}
              <div
                className="h-10 w-10 rounded-full border border-gold/30 shrink-0 flex items-center justify-center"
                style={{ background: act.artistColor }}
              >
                <span className="font-display text-sm text-gold-gradient">{act.artistGlyph}</span>
              </div>

              {/* Action */}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">
                  <span className="text-foreground/90 font-medium">{act.artistHandle}</span>
                  <span className="text-muted-foreground"> {isBooth ? "" : "just "}</span>
                  {isBooth ? (
                    <span className="inline-flex items-center gap-1 text-gold font-semibold">
                      <Trophy className="h-3 w-3" /> hit Booth Ready™
                    </span>
                  ) : (
                    <span className="text-foreground/80">{act.action}</span>
                  )}
                  <span className="text-muted-foreground"> on </span>
                  <span className="text-gold">{beat.title}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                  {act.minutesAgo}m ago · {beat.producer} · {beat.bpm} BPM · {beat.key}
                </div>
              </div>

              {/* Mini art */}
              <div className="h-10 w-10 rounded-md overflow-hidden hidden sm:block shrink-0">
                <ArtTile art={beat.art} glyph={beat.glyph} className="w-full h-full" />
              </div>

              {/* Write CTA */}
              <button
                onClick={() => onWrite(act.beatId)}
                className="h-9 px-3 rounded-lg gold-seal text-onyx text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <PenLine className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Write To This Beat™</span>
                <span className="sm:hidden">Write</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// Producer Storefront™ — full panel
// ============================================================
function ProducerStorefront({
  producer, onPreview, onWrite, playingId,
}: {
  producer: Producer;
  onPreview: (id: string) => void;
  onWrite: (b: Beat) => void;
  playingId: string | null;
}) {
  const extras = producerExtras[producer.id];
  const producerBeats = beats.filter(b => b.producerId === producer.id);
  const bestSellers = extras
    ? extras.bestSellerIds.map(id => beats.find(b => b.id === id)).filter((b): b is Beat => !!b)
    : producerBeats.slice(0, 3);
  const finishedTotal = producerBeats.reduce((s, b) => s + b.tracksFinished, 0);

  return (
    <article className="glass-panel rounded-3xl overflow-hidden border border-border">
      {/* Hero banner */}
      <div className="relative h-40 md:h-48" style={{ background: producer.banner }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,168,76,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-onyx-elev via-onyx-elev/60 to-transparent" />
        <div className="absolute inset-0 mix-blend-overlay opacity-20"
             style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px)" }} />
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-gold/90 flex items-center gap-1">
            <Mic2 className="h-3 w-3" /> Producer Storefront™
          </span>
        </div>
      </div>

      <div className="px-5 md:px-7 pb-6 -mt-14 relative grid lg:grid-cols-[300px_1fr] gap-6">
        {/* LEFT — Identity & social proof */}
        <div>
          <div
            className="h-24 w-24 rounded-2xl border-2 border-gold/40 flex items-center justify-center shadow-xl"
            style={{ background: producer.avatar }}
          >
            <span className="font-display text-3xl text-gold-gradient">{producer.glyph}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <div className="font-display text-2xl leading-none">{producer.name}</div>
            {producer.verified && <VerifiedBadge />}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {producer.city} · {producer.handle}
          </div>

          {extras && (
            <div className="text-sm text-foreground/80 italic mt-3 leading-snug">
              "{extras.tagline}"
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Stat label="Beats Sold" value={fmt(producer.sales)} />
            <Stat label="Tracks Finished" value={fmt(finishedTotal)} />
            <Stat label="Rating" value={`${producer.rating}★`} />
          </div>

          {/* Social proof */}
          {extras && (
            <div className="mt-5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Instagram className="h-3.5 w-3.5 text-gold" />
                <span>{extras.social.instagram}</span>
                <span className="h-1 w-1 rounded-full bg-gold/40" />
                <Youtube className="h-3.5 w-3.5 text-gold" />
                <span>{fmt(extras.social.youtubeSubs)} subs</span>
              </div>
              <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
                <Quote className="h-3.5 w-3.5 text-gold mb-1.5" />
                <div className="text-sm text-foreground/85 italic leading-snug">
                  "{extras.social.pressQuote}"
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-2">
                  — {extras.social.pressSource}
                </div>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <button className="px-4 py-2 rounded-lg gold-seal text-onyx text-xs font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Follow
            </button>
            <button className="px-4 py-2 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 text-xs flex items-center gap-1.5">
              Visit Storefront <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* RIGHT — Story, collections, best sellers */}
        <div className="space-y-5 lg:pt-14">
          {extras && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 mb-2">Producer Story</div>
              <p className="text-sm md:text-[15px] text-foreground/85 leading-relaxed">
                {extras.story}
              </p>
            </div>
          )}

          {extras && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 mb-2">Collections</div>
              <div className="flex flex-wrap gap-2">
                {extras.collections.map(c => (
                  <button
                    key={c.id}
                    className="text-left rounded-xl border border-border bg-onyx-elev/40 hover:border-gold/40 px-3 py-2 transition-colors"
                  >
                    <div className="font-display text-sm leading-none">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{c.vibe} · {c.count} beats</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Best Sellers
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {bestSellers.map(b => (
                <div key={b.id} className="rounded-xl border border-border bg-onyx-elev/40 p-3 flex flex-col gap-2 hover:border-gold/30 transition-colors">
                  <div className="aspect-square rounded-lg overflow-hidden relative">
                    <ArtTile art={b.art} glyph={b.glyph} className="absolute inset-0" />
                    <button
                      onClick={() => onPreview(b.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <span className="h-10 w-10 rounded-full gold-seal text-onyx flex items-center justify-center">
                        {playingId === b.id ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 ml-0.5" fill="currentColor" />}
                      </span>
                    </button>
                  </div>
                  <div className="font-display text-sm leading-tight truncate">{b.title}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Trophy className="h-3 w-3 text-gold" />
                    <span className="text-gold/90 font-medium">{b.boothReadyScore}/100</span>
                    <span>·</span>
                    <span>{fmt(b.tracksFinished)} finished</span>
                  </div>
                  <button
                    onClick={() => onWrite(b)}
                    className="mt-1 w-full py-2 rounded-lg gold-seal text-onyx text-[11px] font-semibold flex items-center justify-center gap-1.5"
                  >
                    <PenLine className="h-3 w-3" /> Write To This Beat™
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

