"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  FolderPlus,
  Heart,
  Headphones,
  Home,
  Layers3,
  LockKeyhole,
  Mic,
  Palette,
  Pause,
  PenLine,
  Play,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ambientPackProducts,
  bundleProducts,
  producerStyleProducts,
  studioRoomProducts,
  themeProducts,
  vocalChainProducts,
  writingPackProducts,
  type CatalogBundle,
  type CatalogProduct,
} from "@/lib/product-catalog";
import type { Beat, Producer } from "@/lib/marketplace";

type StudioPackId = "midnight" | "trap-house" | "bedroom" | "penthouse" | "cypher";

type StudioPack = {
  id: StudioPackId;
  label: string;
  eyebrow: string;
  line: string;
  image: string;
  position: string;
  overlay: string;
  chip: string;
  bestFor: string[];
  ambience: Array<{ title: string; detail: string }>;
  writingCue: string;
};

type ProductUnlockCategory =
  | "Studio Room"
  | "Producer Style"
  | "Vocal Chain"
  | "Writing Pack"
  | "Ambient Pack"
  | "Theme"
  | "Bundle"
  | "Producer Profile"
  | "Beat License";

type ProductUnlock = {
  id: string;
  title: string;
  category: ProductUnlockCategory;
  detail: string;
  price: string;
  unlockedAt: string;
};

type PadActionStatus = {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
};

type MarketplaceBeat = Beat & {
  previewUrl?: string;
  artworkUrl?: string;
  source?: "producer";
};

type MarketplaceFeed = {
  beats: MarketplaceBeat[];
  producers: Producer[];
};

type SessionContext = {
  title: string;
  mood: string;
  writingStyle: string;
};

type MarketSelection =
  | { kind: "beat"; beat: MarketplaceBeat }
  | { kind: "room"; pack: StudioPack; product: CatalogProduct | null; owned: boolean }
  | { kind: "product"; product: CatalogProduct; owned: boolean }
  | { kind: "bundle"; bundle: CatalogBundle; owned: boolean }
  | { kind: "producer"; producer: Producer; beats: MarketplaceBeat[]; saved: boolean };

type MarketCategory = "beats" | "rooms" | "pens" | "vocal" | "tools" | "themes" | "bundles";
type MarketToolCategory = "pens" | "vocal" | "tools" | "themes";

type PremiumMarketplaceProps = {
  signedIn: boolean;
  onAuthRequired: () => void;
  onFavoriteBeat: (beat: Beat) => void;
  onAddBeatToProject: (beat: Beat) => void;
  onLicenseBeat: (beat: Beat) => void;
  onPreviewBeat: (beat: Beat) => void;
  playingBeatId: string | null;
  status: PadActionStatus;
  marketplaceFeed: MarketplaceFeed;
  marketplaceFeedLoading: boolean;
  marketplaceFeedError: string | null;
  activeStudioPack: StudioPack;
  studioPacks: StudioPack[];
  onStudioPack: (id: StudioPackId) => void;
  productUnlocks: ProductUnlock[];
  onUnlockProduct: (product: Omit<ProductUnlock, "unlockedAt">) => void;
  sessionContext: SessionContext;
};

const sessionToolProducts = [...writingPackProducts, ...ambientPackProducts];
const marketCategories: Array<{ id: MarketCategory; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "beats", label: "Beats", icon: Play },
  { id: "rooms", label: "Rooms", icon: Home },
  { id: "pens", label: "AI Pens", icon: PenLine },
  { id: "vocal", label: "Vocal", icon: Mic },
  { id: "tools", label: "Tools", icon: WandSparkles },
  { id: "themes", label: "Themes", icon: Palette },
  { id: "bundles", label: "Bundles", icon: Layers3 },
];

function isMarketToolCategory(category: MarketCategory): category is MarketToolCategory {
  return category === "pens" || category === "vocal" || category === "tools" || category === "themes";
}

export function PremiumMarketplace({
  signedIn,
  onAuthRequired,
  onFavoriteBeat,
  onAddBeatToProject,
  onLicenseBeat,
  onPreviewBeat,
  playingBeatId,
  status,
  marketplaceFeed,
  marketplaceFeedLoading,
  marketplaceFeedError,
  activeStudioPack,
  studioPacks,
  onStudioPack,
  productUnlocks,
  onUnlockProduct,
  sessionContext,
}: PremiumMarketplaceProps) {
  const [category, setCategory] = useState<MarketCategory>("beats");
  const [toolCategory, setToolCategory] = useState<MarketToolCategory>("pens");
  const [selection, setSelection] = useState<MarketSelection | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [pulseIndex, setPulseIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [beatCatalogOpen, setBeatCatalogOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRail = useHorizontalRail<HTMLElement>(marketCategories.length);

  const approvedProducerBeats = marketplaceFeed.beats;
  const allMarketplaceBeats = useMemo<MarketplaceBeat[]>(() => approvedProducerBeats, [approvedProducerBeats]);
  const featuredBeats = allMarketplaceBeats.slice(0, 7);
  const unlockedIds = useMemo(() => new Set(productUnlocks.map((item) => item.id)), [productUnlocks]);
  const featuredProducers = useMemo(() => {
    return Array.from(new Map(marketplaceFeed.producers.map((producer) => [producer.id, producer])).values());
  }, [marketplaceFeed.producers]);
  const spotlightProducer = featuredProducers[0];
  const spotlightBeats = spotlightProducer
    ? allMarketplaceBeats.filter((beat) => beat.producerId === spotlightProducer.id)
    : [];
  const penthousePack = studioPacks.find((pack) => pack.id === "penthouse") ?? studioPacks[0];
  const bedroomPack = studioPacks.find((pack) => pack.id === "bedroom") ?? studioPacks[0];
  const featuredBundle = bundleProducts[0];
  const recommendedBeat =
    featuredBeats.find((beat) => beat.emotionalTags.some((tag) => tag.toLowerCase().includes(sessionContext.mood.toLowerCase()))) ??
    featuredBeats[0];
  const recommendedPen =
    producerStyleProducts.find((product) => sessionContext.mood.toLowerCase().includes("pain") && product.title === "Pain Architect") ??
    producerStyleProducts[0];
  const recommendedRoom = sessionContext.mood.toLowerCase().includes("pain") ? bedroomPack : penthousePack;

  const livePulse = [
    `${allMarketplaceBeats.length} approved beat${allMarketplaceBeats.length === 1 ? "" : "s"} ready to write to`,
    `${featuredProducers.length} producer storefront${featuredProducers.length === 1 ? "" : "s"} live`,
    `${activeStudioPack.label} is your active studio room`,
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setPulseIndex((current) => (current + 1) % livePulse.length), 3600);
    return () => window.clearInterval(timer);
  }, [livePulse.length]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const storedCategory = window.sessionStorage.getItem("rapwriter:market:category") as MarketCategory | null;
    const storedQuery = window.sessionStorage.getItem("rapwriter:market:query") ?? "";
    const storedScroll = Number(window.sessionStorage.getItem("rapwriter:market:scroll") ?? 0);
    if (storedCategory && marketCategories.some((item) => item.id === storedCategory)) {
      setCategory(storedCategory);
      if (isMarketToolCategory(storedCategory)) setToolCategory(storedCategory);
    }
    if (storedQuery) {
      setQuery(storedQuery);
      setSearchOpen(true);
    }
    window.requestAnimationFrame(() => {
      if (scrollContainer && Number.isFinite(storedScroll)) scrollContainer.scrollTop = storedScroll;
    });
    return () => {
      if (scrollContainer) window.sessionStorage.setItem("rapwriter:market:scroll", String(scrollContainer.scrollTop));
    };
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem("rapwriter:market:category", category);
    window.sessionStorage.setItem("rapwriter:market:query", query);
  }, [category, query]);

  useEffect(() => {
    if (!selection && !beatCatalogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelection(null);
        setBeatCatalogOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beatCatalogOpen, selection]);

  const jumpToShelf = (nextCategory: MarketCategory) => {
    setCategory(nextCategory);
    if (isMarketToolCategory(nextCategory)) setToolCategory(nextCategory);
    window.requestAnimationFrame(() => {
      const shelfId = isMarketToolCategory(nextCategory) ? "market-tools" : `market-${nextCategory}`;
      document.getElementById(shelfId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const selectRoom = (pack: StudioPack) => {
    const product = studioRoomProducts.find((item) => item.id === `studio-room-${pack.id}`) ?? null;
    const owned = pack.id === "midnight" || (product ? unlockedIds.has(product.id) : false);
    setSelection({ kind: "room", pack, product, owned });
  };

  const selectProduct = (product: CatalogProduct) => {
    setSelection({ kind: "product", product, owned: unlockedIds.has(product.id) });
  };

  const selectBundle = (bundle: CatalogBundle) => {
    setSelection({ kind: "bundle", bundle, owned: unlockedIds.has(bundle.id) });
  };

  const selectProducer = (producer: Producer) => {
    setSelection({
      kind: "producer",
      producer,
      beats: allMarketplaceBeats.filter((beat) => beat.producerId === producer.id),
      saved: unlockedIds.has(`producer-${producer.id}`),
    });
  };

  const favoriteBeat = (beat: MarketplaceBeat) => {
    setFavoriteIds((current) => new Set([...current, beat.id]));
    onFavoriteBeat(beat);
  };

  const searchableItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const results: Array<{ id: string; title: string; meta: string; selection: MarketSelection }> = [];
    for (const beat of allMarketplaceBeats) {
      const haystack = [beat.title, beat.producer, beat.region, beat.mood, ...beat.tags].join(" ").toLowerCase();
      if (haystack.includes(normalized)) results.push({ id: `beat-${beat.id}`, title: beat.title, meta: `${beat.producer} / Beat`, selection: { kind: "beat", beat } });
    }
    for (const pack of studioPacks) {
      const product = studioRoomProducts.find((item) => item.id === `studio-room-${pack.id}`) ?? null;
      if ([pack.label, ...pack.bestFor].join(" ").toLowerCase().includes(normalized)) {
        results.push({
          id: `room-${pack.id}`,
          title: pack.label,
          meta: "Studio environment",
          selection: { kind: "room", pack, product, owned: pack.id === "midnight" || Boolean(product && unlockedIds.has(product.id)) },
        });
      }
    }
    for (const product of [...producerStyleProducts, ...vocalChainProducts, ...sessionToolProducts, ...themeProducts]) {
      if ([product.title, product.detail, ...product.tags].join(" ").toLowerCase().includes(normalized)) {
        results.push({ id: `product-${product.id}`, title: product.title, meta: productTypeLabel(product), selection: { kind: "product", product, owned: unlockedIds.has(product.id) } });
      }
    }
    return results.slice(0, 8);
  }, [allMarketplaceBeats, query, studioPacks, unlockedIds]);

  return (
    <div ref={scrollContainerRef} className="flex-1 scroll-smooth overflow-y-auto px-5 pb-32 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label-hw text-gold/85">Marketplace</div>
          <h1 className="mt-2 text-2xl font-semibold">Build your perfect studio.</h1>
          <p className="mt-2 max-w-[310px] text-sm leading-relaxed text-muted-foreground">
            Discover the sound, room, and creative tools that fit tonight&apos;s record.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((current) => !current)}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors",
            searchOpen ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-white/[0.03] text-white/72",
          )}
          aria-label="Search Marketplace"
          aria-expanded={searchOpen}
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {searchOpen && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#111113] p-3">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search beats, rooms, AI Pens..."
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </label>
          {query.trim() && (
            <div className="mt-2 space-y-1">
              {searchableItems.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    setSelection(result.selection);
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-white/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{result.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{result.meta}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gold/65" />
                </button>
              ))}
              {searchableItems.length === 0 && <div className="px-3 py-4 text-sm text-muted-foreground">No studio pieces match that search.</div>}
            </div>
          )}
        </div>
      )}

      <section className="relative mt-5 min-h-[360px] overflow-hidden rounded-[22px] border border-gold/25 bg-[#111113]">
        <img
          src={featuredBundle.image}
          alt="Penthouse Sessions studio"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "67% center" }}
          draggable={false}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(5,5,6,0.32)_30%,rgba(5,5,6,0.96)_78%,#050506)]" />
        <div className="relative flex min-h-[360px] flex-col justify-end p-5">
          <div className="mb-auto inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-black/52 px-3 py-1.5 backdrop-blur-md">
            <Crown className="h-3.5 w-3.5 text-gold" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Featured Drop</span>
          </div>
          <div className="max-w-[330px]">
            <h2 className="text-[28px] font-semibold leading-[1.05]">{featuredBundle.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/68">The complete commercial room for hook-first records.</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/78">
              {featuredBundle.includes.slice(0, 3).map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-gold" />{item}</span>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectRoom(penthousePack)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/18 bg-black/45 px-3 text-xs font-semibold text-white backdrop-blur-md"
              >
                <Eye className="h-4 w-4" /> Preview Studio
              </button>
              <button
                type="button"
                onClick={() => selectBundle(featuredBundle)}
                className="gold-seal flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-black"
              >
                View Drop <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-3 flex min-h-11 items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-3">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-55" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <Activity className="h-3.5 w-3.5 shrink-0 text-gold/75" />
        <div key={pulseIndex} className="min-w-0 flex-1 truncate text-[11px] text-white/65">
          <span className="font-semibold text-white/88">Catalog</span> / {livePulse[pulseIndex]}
        </div>
      </div>

      {!signedIn && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-gold/20 bg-gold/8 p-3">
          <div className="text-xs leading-relaxed text-gold/90">Sign in to save favorites and sync your studio.</div>
          <button onClick={onAuthRequired} className="shrink-0 rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold">Sign in</button>
        </div>
      )}

      {status.message && (
        <div className={cn("mt-4 rounded-xl px-3 py-2 text-center text-[11px]", status.state === "error" ? "border border-rec/25 bg-rec/10 text-rec" : "border border-gold/20 bg-gold/8 text-gold")}>{status.message}</div>
      )}

      {marketplaceFeedLoading && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
          <span className="text-[11px] text-white/58">Checking for fresh producer drops...</span>
        </div>
      )}
      {!marketplaceFeedLoading && marketplaceFeedError && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-[11px] text-white/50">{marketplaceFeedError}</div>
      )}

      <div className="sticky top-0 z-20 -mx-5 mt-5 flex items-center gap-1.5 border-y border-white/8 bg-[#090909]/95 px-2 py-2.5 backdrop-blur-xl">
        <RailControl direction="previous" label="categories" disabled={!categoryRail.canScrollPrevious} onClick={() => categoryRail.scroll("previous")} />
        <nav
          ref={categoryRail.ref}
          className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto px-1 py-0.5 scroll-smooth [overscroll-behavior-x:contain] [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden"
          aria-label="Marketplace shelves"
        >
          {marketCategories.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpToShelf(item.id)}
                className={cn("flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors", category === item.id ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-white/[0.03] text-muted-foreground")}
              >
                <Icon className="h-3.5 w-3.5" />{item.label}
              </button>
            );
          })}
        </nav>
        <RailControl direction="next" label="categories" disabled={!categoryRail.canScrollNext} onClick={() => categoryRail.scroll("next")} />
      </div>

      <section className="pt-7">
        <ShelfHeading eyebrow="Built for tonight" title={`Match ${sessionContext.title}`} detail={`${sessionContext.mood} mood / ${sessionContext.writingStyle} writing`} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {recommendedBeat && (
            <RecommendationCard label="Beat" title={recommendedBeat.title} icon={Play} onClick={() => setSelection({ kind: "beat", beat: recommendedBeat })} />
          )}
          <RecommendationCard label="Room" title={recommendedRoom.label} icon={Home} onClick={() => selectRoom(recommendedRoom)} />
          <RecommendationCard label="AI Pen" title={recommendedPen.title} icon={PenLine} onClick={() => selectProduct(recommendedPen)} />
        </div>
      </section>

      <section id="market-beats" className="scroll-mt-20 pt-9">
        <MarketplaceShelf
          eyebrow={featuredBeats.length ? "Approved producer drops" : "Producer catalog"}
          title={featuredBeats.length ? "Find your next record" : "The first drops are being prepared"}
          detail={featuredBeats.length ? "Listen first. Write when the pocket feels right." : "Approved producer beats will appear here. Nothing is padded with demo inventory."}
          label="beats"
          itemCount={featuredBeats.length}
          onSeeAll={() => setBeatCatalogOpen(true)}
        >
          {featuredBeats.map((beat) => (
            <BeatShelfCard
              key={beat.id}
              beat={beat}
              playing={playingBeatId === beat.id}
              favorite={favoriteIds.has(beat.id)}
              onPreview={() => onPreviewBeat(beat)}
              onFavorite={() => favoriteBeat(beat)}
              onOpen={() => setSelection({ kind: "beat", beat })}
            />
          ))}
          {!featuredBeats.length && <MarketplaceInventoryEmpty />}
        </MarketplaceShelf>
      </section>

      {spotlightProducer && (
        <section className="pt-9">
          <ProducerSpotlight
            producer={spotlightProducer}
            beats={spotlightBeats}
            saved={unlockedIds.has(`producer-${spotlightProducer.id}`)}
            onOpen={() => selectProducer(spotlightProducer)}
            onSave={() => onUnlockProduct({ id: `producer-${spotlightProducer.id}`, title: spotlightProducer.name, category: "Producer Profile", detail: spotlightProducer.bio, price: "$0" })}
          />
        </section>
      )}

      <section id="market-rooms" className="scroll-mt-20 pt-9">
        <MarketplaceShelf eyebrow="Studio environments" title="Choose the room" detail="The atmosphere changes. Your writing flow stays familiar." label="rooms" itemCount={studioPacks.length}>
          {studioPacks.map((pack) => {
            const product = studioRoomProducts.find((item) => item.id === `studio-room-${pack.id}`);
            const owned = pack.id === "midnight" || Boolean(product && unlockedIds.has(product.id));
            return <RoomShelfCard key={pack.id} pack={pack} owned={owned} active={activeStudioPack.id === pack.id} onOpen={() => selectRoom(pack)} />;
          })}
        </MarketplaceShelf>
      </section>

      <section id="market-tools" className="scroll-mt-20 pt-9">
        <MarketplaceShelf
          eyebrow={toolCategory === "pens" ? "Writing personalities" : toolCategory === "vocal" ? "Booth tools" : toolCategory === "tools" ? "Session tools" : "Visual identity"}
          title={toolCategory === "pens" ? "Choose your AI Pen" : toolCategory === "vocal" ? "Vocal chains" : toolCategory === "tools" ? "Keep the room moving" : "Change the light"}
          detail={toolCategory === "pens" ? "Different pressure, vocabulary, cadence, and point of view." : toolCategory === "vocal" ? "Pick the finish that matches the record." : toolCategory === "tools" ? "Structure and atmosphere without cluttering the pad." : "Change the room's visual energy."}
          label={toolCategory === "pens" ? "AI Pens" : toolCategory === "vocal" ? "vocal chains" : toolCategory === "tools" ? "session tools" : "themes"}
          itemCount={toolCategory === "pens" ? producerStyleProducts.length : toolCategory === "vocal" ? vocalChainProducts.length : toolCategory === "tools" ? sessionToolProducts.length : themeProducts.length}
          beforeRail={(
            <div className="mt-4 grid grid-cols-4 gap-1.5" role="tablist" aria-label="Studio tools">
              {marketCategories.filter((item) => isMarketToolCategory(item.id)).map((item) => {
                const Icon = item.icon;
                const toolId = item.id as MarketToolCategory;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={toolCategory === toolId}
                    onClick={() => {
                      setToolCategory(toolId);
                      setCategory(toolId);
                    }}
                    className={cn("flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[10px] font-semibold", toolCategory === toolId ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-white/[0.03] text-muted-foreground")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        >
          {toolCategory === "pens" && producerStyleProducts.map((product, index) => (
            <ProductShelfCard key={product.id} product={product} index={index} owned={unlockedIds.has(product.id)} onOpen={() => selectProduct(product)} />
          ))}
          {toolCategory === "vocal" && vocalChainProducts.map((product, index) => (
            <ProductShelfCard key={product.id} product={product} index={index + 2} owned={unlockedIds.has(product.id)} onOpen={() => selectProduct(product)} />
          ))}
          {toolCategory === "tools" && sessionToolProducts.map((product, index) => (
            <ProductShelfCard key={product.id} product={product} index={index + 4} owned={unlockedIds.has(product.id)} onOpen={() => selectProduct(product)} />
          ))}
          {toolCategory === "themes" && themeProducts.map((product, index) => (
            <ThemeShelfCard key={product.id} product={product} index={index} owned={unlockedIds.has(product.id)} onOpen={() => selectProduct(product)} />
          ))}
        </MarketplaceShelf>
      </section>

      <section id="market-bundles" className="scroll-mt-20 pt-9">
        <MarketplaceShelf eyebrow="Complete studios" title="Build it in one move" detail="Curated rooms, writing personalities, and booth tools that already fit together." label="bundles" itemCount={bundleProducts.length}>
          {bundleProducts.map((bundle) => (
            <BundleShelfCard key={bundle.id} bundle={bundle} owned={unlockedIds.has(bundle.id)} onOpen={() => selectBundle(bundle)} />
          ))}
        </MarketplaceShelf>
      </section>

      <BeatCatalogSheet
        open={beatCatalogOpen}
        beats={allMarketplaceBeats}
        playingBeatId={playingBeatId}
        favoriteIds={favoriteIds}
        onClose={() => setBeatCatalogOpen(false)}
        onPreview={onPreviewBeat}
        onFavorite={favoriteBeat}
        onOpenBeat={(beat) => {
          setBeatCatalogOpen(false);
          setSelection({ kind: "beat", beat });
        }}
      />

      <MarketDetailSheet
        selection={selection}
        playingBeatId={playingBeatId}
        status={status}
        onClose={() => setSelection(null)}
        onPreviewBeat={onPreviewBeat}
        onFavoriteBeat={(beat) => favoriteBeat(beat)}
        onWriteBeat={(beat) => {
          onAddBeatToProject(beat);
          setSelection(null);
        }}
        onLicenseBeat={onLicenseBeat}
        onUseRoom={(pack) => {
          onStudioPack(pack.id);
          setSelection(null);
        }}
        onUnlockProduct={onUnlockProduct}
      />
    </div>
  );
}

type RailDirection = "previous" | "next";

function useHorizontalRail<T extends HTMLElement>(itemCount: number) {
  const ref = useRef<T | null>(null);
  const [position, setPosition] = useState({ canScrollPrevious: false, canScrollNext: false });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      const next = {
        canScrollPrevious: element.scrollLeft > 8,
        canScrollNext: element.scrollLeft < maxScroll - 8,
      };
      setPosition((current) =>
        current.canScrollPrevious === next.canScrollPrevious && current.canScrollNext === next.canScrollNext
          ? current
          : next,
      );
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);

    return () => {
      element.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [itemCount]);

  const scroll = (direction: RailDirection) => {
    const element = ref.current;
    if (!element) return;
    const distance = Math.max(240, element.clientWidth * 0.82);
    element.scrollBy({ left: direction === "next" ? distance : -distance, behavior: "smooth" });
  };

  return { ref, scroll, ...position };
}

function MarketplaceShelf({ eyebrow, title, detail, label, itemCount, onSeeAll, beforeRail, children }: {
  eyebrow: string;
  title: string;
  detail: string;
  label: string;
  itemCount: number;
  onSeeAll?: () => void;
  beforeRail?: ReactNode;
  children: ReactNode;
}) {
  const rail = useHorizontalRail<HTMLDivElement>(itemCount);

  return (
    <>
      <ShelfHeading
        eyebrow={eyebrow}
        title={title}
        detail={detail}
        controls={(
          <div className="flex shrink-0 items-center gap-1.5">
            {onSeeAll && itemCount > 0 && (
              <button type="button" onClick={onSeeAll} className="min-h-9 px-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold transition-colors hover:text-gold/80">
                See all
              </button>
            )}
            <RailControl direction="previous" label={label} disabled={!rail.canScrollPrevious} onClick={() => rail.scroll("previous")} />
            <RailControl direction="next" label={label} disabled={!rail.canScrollNext} onClick={() => rail.scroll("next")} />
          </div>
        )}
      />
      {beforeRail}
      <div
        ref={rail.ref}
        className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 scroll-smooth [overscroll-behavior-x:contain] [scrollbar-width:none] [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
        aria-label={`${label} carousel`}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}

function MarketplaceInventoryEmpty() {
  return (
    <div className="w-[calc(100vw-40px)] max-w-[390px] shrink-0 rounded-2xl border border-dashed border-gold/25 bg-[#111113] p-5">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold">
        <Headphones className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Real beats only.</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The catalog opens as producers complete onboarding and RapWriter approves their releases.
      </p>
      <Link href="/producer" className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-gold">
        Open Producer Portal <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function RailControl({ direction, label, disabled, onClick }: {
  direction: RailDirection;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  const action = direction === "previous" ? "Previous" : "Next";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${action} ${label}`}
      title={`${action} ${label}`}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/78 transition-colors enabled:hover:border-gold/35 enabled:hover:text-gold disabled:cursor-default disabled:opacity-25"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ShelfHeading({ eyebrow, title, detail, controls }: { eyebrow: string; title: string; detail: string; controls?: ReactNode }) {
  return (
    <div>
      <div className="label-hw text-gold/80">{eyebrow}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-xl font-semibold">{title}</h2>
        {controls}
      </div>
      <p className="mt-1 max-w-[350px] text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function RecommendationCard({ label, title, icon: Icon, onClick }: { label: string; title: string; icon: ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-xl border border-white/10 bg-[#111113] p-3 text-left transition-transform active:scale-[0.98]">
      <Icon className="h-4 w-4 text-gold" />
      <span className="mt-3 block text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="mt-1 block min-h-8 text-xs font-semibold leading-4">{title}</span>
    </button>
  );
}

function BeatShelfCard({ beat, playing, favorite, onPreview, onFavorite, onOpen }: { beat: MarketplaceBeat; playing: boolean; favorite: boolean; onPreview: () => void; onFavorite: () => void; onOpen: () => void }) {
  const bars = useMemo(() => makeMarketBars(beat.id, 32), [beat.id]);
  return (
    <article className="w-[78vw] max-w-[292px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#111113]">
      <div className="relative h-40" style={{ background: beat.art }}>
        {beat.artworkUrl && <img src={beat.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.72))]" />
        <button type="button" onClick={onPreview} className="absolute left-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-gold text-black shadow-[0_8px_28px_rgba(0,0,0,0.35)]" aria-label={`${playing ? "Pause" : "Preview"} ${beat.title}`}>
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <button type="button" onClick={onFavorite} className={cn("absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border backdrop-blur-md", favorite ? "border-gold/45 bg-gold/18 text-gold" : "border-white/15 bg-black/40 text-white/74")} aria-label={`Favorite ${beat.title}`}>
          <Heart className={cn("h-4 w-4", favorite && "fill-current")} />
        </button>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/58">{beat.region} / {beat.bpm} BPM</div>
            <div className="mt-1 text-xl font-semibold leading-none">{beat.title}</div>
          </div>
          <div className="rounded-full border border-emerald-300/25 bg-black/45 px-2 py-1 text-[9px] font-semibold text-emerald-300">{beat.writingNow > 0 ? `${beat.writingNow} writing` : "New drop"}</div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/25 bg-gold/8 text-[9px] font-semibold text-gold">{producerInitials(beat.producer)}</div>
            <span className="truncate text-xs text-muted-foreground">{beat.producer}</span>
            {beat.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
          </div>
          <span className="text-[10px] font-semibold text-gold">{beat.boothReadyScore > 0 ? `${beat.boothReadyScore}% Booth fit` : "Awaiting session data"}</span>
        </div>
        <div className="mt-3 flex h-7 items-center gap-[2px]" aria-hidden="true">
          {bars.map((bar, index) => <span key={index} className={cn("flex-1 rounded-full", playing ? "bg-gold" : "bg-gold/28")} style={{ height: `${bar}%`, animation: playing ? `vu-pulse ${0.7 + (index % 5) * 0.09}s ease-in-out infinite` : undefined }} />)}
        </div>
        <button type="button" onClick={onOpen} className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold">
          Explore this beat <ChevronRight className="h-4 w-4 text-gold" />
        </button>
      </div>
    </article>
  );
}

function RoomShelfCard({ pack, owned, active, onOpen }: { pack: StudioPack; owned: boolean; active: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={cn("w-[80vw] max-w-[302px] shrink-0 snap-start overflow-hidden rounded-2xl border bg-[#111113] text-left", active ? "border-gold/45" : "border-white/10")}>
      <div className="relative h-44">
        <img src={pack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: pack.position }} loading="lazy" decoding="async" draggable={false} />
        <div className="absolute inset-0" style={{ background: pack.overlay }} />
        <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/48 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/78 backdrop-blur-md">{active ? "Active" : owned ? "Owned" : "Preview"}</div>
        {!owned && <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/48 text-white/76 backdrop-blur-md"><LockKeyhole className="h-4 w-4" /></span>}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-xl font-semibold">{pack.label}</div>
          <div className="mt-1 text-[11px] text-white/62">{pack.line}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[0.16em] text-gold/78">Best for</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{pack.bestFor.join(" / ")}</div>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/25 text-gold"><Eye className="h-4 w-4" /></span>
      </div>
    </button>
  );
}

function ProductShelfCard({ product, index, owned, onOpen }: { product: CatalogProduct; index: number; owned: boolean; onOpen: () => void }) {
  const Icon = productIcon(product);
  return (
    <button type="button" onClick={onOpen} className="w-[67vw] max-w-[252px] shrink-0 snap-start rounded-2xl border border-white/10 bg-[#111113] p-4 text-left transition-transform active:scale-[0.99]">
      <div className="relative h-28 overflow-hidden rounded-xl border border-white/8" style={{ background: productArtwork(product, index) }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_38%)]" />
        <div className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-xl border border-gold/25 bg-black/28 text-gold backdrop-blur-md"><Icon className="h-4 w-4" /></div>
        {owned && <span className="absolute right-3 top-3 rounded-full border border-gold/30 bg-black/45 px-2 py-1 text-[9px] font-semibold text-gold">Owned</span>}
        <div className="absolute bottom-3 left-3 right-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">{productTypeLabel(product)}</div>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{product.title}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{product.detail}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="truncate text-[10px] text-gold/82">{product.tags.slice(0, 2).join(" / ")}</span>
        <span className="shrink-0 text-xs font-semibold text-gold">{owned ? "Open" : product.price}</span>
      </div>
    </button>
  );
}

function ThemeShelfCard({ product, index, owned, onOpen }: { product: CatalogProduct; index: number; owned: boolean; onOpen: () => void }) {
  const swatches = themeSwatches(index);
  return (
    <button type="button" onClick={onOpen} className="w-[70vw] max-w-[266px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#111113] text-left">
      <div className="relative h-36" style={{ background: swatches.background }}>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.7))]" />
        <div className="absolute bottom-3 left-3 flex gap-2">
          {swatches.colors.map((color) => <span key={color} className="h-5 w-5 rounded-full border border-white/20" style={{ background: color }} />)}
        </div>
        {owned && <span className="absolute right-3 top-3 rounded-full border border-gold/30 bg-black/45 px-2 py-1 text-[9px] font-semibold text-gold">Owned</span>}
      </div>
      <div className="p-4">
        <div className="text-lg font-semibold">{product.title}</div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{product.tags.join(" / ")}</span><span className="shrink-0 text-gold">{owned ? "Open" : product.price}</span></div>
      </div>
    </button>
  );
}

function BundleShelfCard({ bundle, owned, onOpen }: { bundle: CatalogBundle; owned: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-[84vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gold/20 bg-[#111113] text-left">
      <div className="relative h-40">
        <img src={bundle.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "65% center" }} loading="lazy" decoding="async" draggable={false} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.82))]" />
        <span className="absolute left-3 top-3 rounded-full border border-gold/30 bg-black/48 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-gold backdrop-blur-md">{bundle.savings}</span>
        {owned && <span className="absolute right-3 top-3 rounded-full border border-gold/30 bg-black/48 px-2.5 py-1 text-[9px] font-semibold text-gold">Owned</span>}
        <div className="absolute bottom-3 left-3 right-3"><div className="text-xl font-semibold">{bundle.title}</div><div className="mt-1 text-[11px] text-white/62">{bundle.includes.length} studio pieces / {bundle.price}</div></div>
      </div>
      <div className="flex items-center justify-between gap-3 p-4"><span className="text-xs text-muted-foreground">A complete creative setup</span><ArrowRight className="h-4 w-4 text-gold" /></div>
    </button>
  );
}

function ProducerSpotlight({ producer, beats, saved, onOpen, onSave }: { producer: Producer; beats: MarketplaceBeat[]; saved: boolean; onOpen: () => void; onSave: () => void }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#111113]">
      <div className="relative min-h-52 p-5" style={{ background: producer.banner }}>
        <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(0,0,0,0.16),rgba(0,0,0,0.82))]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold"><Award className="h-4 w-4" />Producer Spotlight</div>
          <div className="mt-8 flex items-end gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-gold/35 bg-black/25 text-base font-semibold text-gold">{producer.glyph}</div>
            <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-2xl font-semibold">{producer.name}</h3>{producer.verified && <ShieldCheck className="h-5 w-5 shrink-0 text-gold" />}</div><div className="mt-1 text-xs text-white/60">{producer.city} / {producer.handle}</div></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <SpotlightStat value={formatCompactNumber(producer.sales)} label="Licenses" />
            <SpotlightStat value={producer.rating > 0 ? `${producer.rating}` : "New"} label="Rating" />
            <SpotlightStat value={`${beats.length}`} label="Drops" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <button type="button" onClick={onOpen} className="min-h-11 rounded-xl border border-gold/30 bg-gold/10 px-3 text-sm font-semibold text-gold">View collection</button>
        <button type="button" onClick={onSave} disabled={saved} className={cn("min-h-11 rounded-xl px-3 text-sm font-semibold", saved ? "border border-gold/25 bg-gold/8 text-gold" : "border border-white/10 bg-white/[0.03] text-white/75")}>{saved ? "Following" : "Follow"}</button>
      </div>
    </div>
  );
}

function SpotlightStat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/24 px-2 py-2 text-center"><div className="text-sm font-semibold text-gold">{value}</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/48">{label}</div></div>;
}

function BeatCatalogSheet({ open, beats, playingBeatId, favoriteIds, onClose, onPreview, onFavorite, onOpenBeat }: {
  open: boolean;
  beats: MarketplaceBeat[];
  playingBeatId: string | null;
  favoriteIds: Set<string>;
  onClose: () => void;
  onPreview: (beat: MarketplaceBeat) => void;
  onFavorite: (beat: MarketplaceBeat) => void;
  onOpenBeat: (beat: MarketplaceBeat) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleBeats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return beats;
    return beats.filter((beat) =>
      [beat.title, beat.producer, beat.region, beat.mood, ...beat.tags, ...beat.emotionalTags]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [beats, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/76 px-3 pb-3 backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="All producer beats" className="flex max-h-[92svh] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#101012] shadow-[0_-24px_90px_rgba(0,0,0,0.7)]">
        <div className="border-b border-white/8 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label-hw text-gold/80">Producer catalog</div>
              <h2 className="mt-1 text-xl font-semibold">All beats</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{beats.length} drops ready to preview</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/72" aria-label="Close all beats">
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/28 px-3 focus-within:border-gold/35">
            <Search className="h-4 w-4 shrink-0 text-gold/72" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search beats or producers" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/32" />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-8">
          <div className="space-y-2">
            {visibleBeats.map((beat) => {
              const playing = playingBeatId === beat.id;
              const favorite = favoriteIds.has(beat.id);
              return (
                <article key={beat.id} className="flex min-h-[92px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-2.5">
                  <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10" style={{ background: beat.art }}>
                    {beat.artworkUrl && <img src={beat.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} />}
                    <button type="button" onClick={() => onPreview(beat)} className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-gold text-black shadow-lg" aria-label={`${playing ? "Pause" : "Preview"} ${beat.title}`}>
                      {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                    </button>
                  </div>
                  <button type="button" onClick={() => onOpenBeat(beat)} className="min-w-0 flex-1 py-1 text-left" aria-label={`View ${beat.title}`}>
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold">{beat.title}</h3>
                      {beat.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-white/52">{beat.producer} / {beat.region}</div>
                    <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-gold/82">
                      <span>{beat.bpm} BPM</span>
                      <span>{beat.key}</span>
                      <span>{beat.writingNow > 0 ? `${beat.writingNow} writing` : "New drop"}</span>
                    </div>
                  </button>
                  <button type="button" onClick={() => onFavorite(beat)} disabled={favorite} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", favorite ? "border-gold/35 bg-gold/12 text-gold" : "border-white/10 bg-white/[0.03] text-white/58")} aria-label={favorite ? `Saved ${beat.title}` : `Favorite ${beat.title}`}>
                    <Heart className={cn("h-4 w-4", favorite && "fill-current")} />
                  </button>
                </article>
              );
            })}
          </div>
          {visibleBeats.length === 0 && (
            <div className="grid min-h-44 place-items-center text-center">
              <div><Search className="mx-auto h-5 w-5 text-gold/60" /><p className="mt-3 text-sm font-semibold">No beats found</p><p className="mt-1 text-xs text-muted-foreground">Try a producer, mood, region, or title.</p></div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MarketDetailSheet({ selection, playingBeatId, status, onClose, onPreviewBeat, onFavoriteBeat, onWriteBeat, onLicenseBeat, onUseRoom, onUnlockProduct }: {
  selection: MarketSelection | null;
  playingBeatId: string | null;
  status: PadActionStatus;
  onClose: () => void;
  onPreviewBeat: (beat: Beat) => void;
  onFavoriteBeat: (beat: MarketplaceBeat) => void;
  onWriteBeat: (beat: MarketplaceBeat) => void;
  onLicenseBeat: (beat: MarketplaceBeat) => void;
  onUseRoom: (pack: StudioPack) => void;
  onUnlockProduct: (product: Omit<ProductUnlock, "unlockedAt">) => void;
}) {
  if (!selection) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/72 px-3 pb-3 backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Marketplace preview" className="max-h-[90svh] w-full max-w-[430px] overflow-hidden rounded-[24px] border border-white/10 bg-[#101012] shadow-[0_-24px_90px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div className="label-hw text-gold/80">Studio Preview</div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/72" aria-label="Close Marketplace preview"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[calc(90svh-65px)] overflow-y-auto">
          {selection.kind === "beat" && <BeatDetail beat={selection.beat} playing={playingBeatId === selection.beat.id} busy={status.state === "saving"} onPreview={() => onPreviewBeat(selection.beat)} onFavorite={() => onFavoriteBeat(selection.beat)} onWrite={() => onWriteBeat(selection.beat)} onLicense={() => onLicenseBeat(selection.beat)} />}
          {selection.kind === "room" && <RoomDetail selection={selection} onUse={() => onUseRoom(selection.pack)} onUnlock={() => selection.product && onUnlockProduct(toUnlock(selection.product, "Studio Room"))} />}
          {selection.kind === "product" && <ProductDetail selection={selection} onUnlock={() => onUnlockProduct(toUnlock(selection.product, productUnlockCategory(selection.product)))} />}
          {selection.kind === "bundle" && <BundleDetail selection={selection} onUnlock={() => onUnlockProduct(toUnlock(selection.bundle, "Bundle"))} />}
          {selection.kind === "producer" && <ProducerDetail selection={selection} onUseBeat={(beat) => onWriteBeat(beat)} onSave={() => onUnlockProduct({ id: `producer-${selection.producer.id}`, title: selection.producer.name, category: "Producer Profile", detail: selection.producer.bio, price: "$0" })} />}
        </div>
      </section>
    </div>
  );
}

function BeatDetail({ beat, playing, busy, onPreview, onFavorite, onWrite, onLicense }: { beat: MarketplaceBeat; playing: boolean; busy: boolean; onPreview: () => void; onFavorite: () => void; onWrite: () => void; onLicense: () => void }) {
  const bars = useMemo(() => makeMarketBars(beat.id, 48), [beat.id]);
  return <div>
    <div className="relative h-56" style={{ background: beat.art }}>{beat.artworkUrl && <img src={beat.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />}<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(16,16,18,0.96))]" /><button type="button" onClick={onPreview} className="absolute left-5 top-5 grid h-12 w-12 place-items-center rounded-full bg-gold text-black" aria-label={`${playing ? "Pause" : "Preview"} ${beat.title}`}>{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}</button><div className="absolute bottom-5 left-5 right-5"><div className="label-hw text-gold/85">{beat.region} / {beat.bpm} BPM / {beat.key}</div><h2 className="mt-2 text-3xl font-semibold">{beat.title}</h2><div className="mt-1 flex items-center gap-2 text-sm text-white/62">{beat.producer}{beat.verified && <ShieldCheck className="h-4 w-4 text-gold" />}</div></div></div>
    <div className="p-5">
      <div className="flex h-10 items-center gap-[2px]">{bars.map((bar, index) => <span key={index} className={cn("flex-1 rounded-full", playing ? "bg-gold" : "bg-gold/25")} style={{ height: `${bar}%`, animation: playing ? `vu-pulse ${0.7 + (index % 5) * 0.09}s ease-in-out infinite` : undefined }} />)}</div>
      <div className="mt-5 grid grid-cols-3 gap-2"><DetailStat icon={Users} value={beat.writingNow > 0 ? `${beat.writingNow}` : "New"} label="Writing now" /><DetailStat icon={TrendingUp} value={beat.completionRate > 0 ? `${beat.completionRate}%` : "New"} label="Finish rate" /><DetailStat icon={Award} value={beat.boothReadyScore > 0 ? `${beat.boothReadyScore}%` : "New"} label="Booth fit" /></div>
      <div className="mt-5"><div className="label-hw text-gold/80">Why it fits</div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beat.mood}. Strong for {beat.emotionalTags.slice(0, 3).join(", ").toLowerCase()} records with enough space to shape a complete song.</p></div>
      <div className="mt-5 grid grid-cols-[48px_1fr] gap-2"><button type="button" onClick={onFavorite} className="grid min-h-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70" aria-label={`Favorite ${beat.title}`}><Heart className="h-4 w-4" /></button><button type="button" onClick={onWrite} disabled={busy} className="gold-seal flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-black disabled:opacity-55"><FolderPlus className="h-4 w-4" />Write to this beat</button></div>
      <button type="button" onClick={onLicense} disabled={busy} className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl border border-gold/25 bg-gold/8 px-4 text-xs font-semibold text-gold disabled:opacity-55"><span>Licensing options</span><span>From ${beat.prices[0]?.price ?? 0} <ChevronRight className="ml-1 inline h-3.5 w-3.5" /></span></button>
    </div>
  </div>;
}

function RoomDetail({ selection, onUse, onUnlock }: { selection: Extract<MarketSelection, { kind: "room" }>; onUse: () => void; onUnlock: () => void }) {
  const { pack, product, owned } = selection;
  return <div><div className="relative h-60"><img src={pack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: pack.position }} decoding="async" /><div className="absolute inset-0" style={{ background: pack.overlay }} /><div className="absolute bottom-5 left-5 right-5"><div className="label-hw text-gold/85">{owned ? "Available" : "Locked Preview"}</div><h2 className="mt-2 text-3xl font-semibold">{pack.label}</h2><p className="mt-2 text-sm text-white/62">{pack.line}</p></div></div><div className="p-5"><div className="label-hw text-gold/80">Room intelligence</div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pack.writingCue}</p><div className="mt-4 flex flex-wrap gap-2">{pack.bestFor.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/62">{tag}</span>)}</div><div className="mt-5 space-y-2">{pack.ambience.slice(0, 3).map((item) => <div key={item.title} className="flex gap-3 border-t border-white/8 pt-3"><Headphones className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><div><div className="text-sm font-semibold">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{item.detail}</div></div></div>)}</div><button type="button" onClick={owned ? onUse : onUnlock} className={cn("mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold", owned ? "gold-seal text-black" : "border border-gold/30 bg-gold/10 text-gold")}>{owned ? <><Home className="h-4 w-4" />Use this studio</> : <><ShoppingBag className="h-4 w-4" />Unlock {product?.price ?? "Room"}</>}</button>{!owned && <p className="mt-2 text-center text-[11px] text-muted-foreground">Preview freely. Unlocking activates the room in Studio.</p>}</div></div>;
}

function ProductDetail({ selection, onUnlock }: { selection: Extract<MarketSelection, { kind: "product" }>; onUnlock: () => void }) {
  const { product, owned } = selection;
  const Icon = productIcon(product);
  const features = productFeatures(product);
  return <div><div className="relative h-48" style={{ background: productArtwork(product, 2) }}><div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.13),transparent_38%),linear-gradient(180deg,transparent,rgba(16,16,18,0.92))]" /><div className="absolute left-5 top-5 grid h-12 w-12 place-items-center rounded-2xl border border-gold/30 bg-black/25 text-gold"><Icon className="h-5 w-5" /></div><div className="absolute bottom-5 left-5 right-5"><div className="label-hw text-gold/85">{productTypeLabel(product)}</div><h2 className="mt-2 text-3xl font-semibold">{product.title}</h2></div></div><div className="p-5"><p className="text-sm leading-relaxed text-muted-foreground">{product.detail}</p><div className="mt-5 space-y-0">{features.map((feature) => <div key={feature.label} className="flex items-start justify-between gap-4 border-t border-white/8 py-3"><span className="text-xs text-muted-foreground">{feature.label}</span><span className="max-w-[220px] text-right text-xs font-semibold text-white/82">{feature.value}</span></div>)}</div><button type="button" onClick={onUnlock} disabled={owned} className={cn("mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold", owned ? "border border-gold/25 bg-gold/8 text-gold" : "gold-seal text-black")}>{owned ? <><Check className="h-4 w-4" />Owned</> : <><ShoppingCart className="h-4 w-4" />Unlock {product.price}</>}</button></div></div>;
}

function BundleDetail({ selection, onUnlock }: { selection: Extract<MarketSelection, { kind: "bundle" }>; onUnlock: () => void }) {
  const { bundle, owned } = selection;
  return <div><div className="relative h-60"><img src={bundle.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "65% center" }} decoding="async" /><div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(16,16,18,0.96))]" /><div className="absolute bottom-5 left-5 right-5"><div className="inline-flex rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-gold">{bundle.savings}</div><h2 className="mt-3 text-3xl font-semibold">{bundle.title}</h2></div></div><div className="p-5"><p className="text-sm leading-relaxed text-muted-foreground">{bundle.detail}</p><div className="mt-5 label-hw text-gold/80">Inside the studio</div><div className="mt-2 divide-y divide-white/8">{bundle.includes.map((item) => <div key={item} className="flex items-center gap-3 py-3 text-sm"><span className="grid h-7 w-7 place-items-center rounded-full border border-gold/25 bg-gold/8 text-gold"><Check className="h-3.5 w-3.5" /></span>{item}</div>)}</div><button type="button" onClick={onUnlock} disabled={owned} className={cn("mt-5 flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-sm font-semibold", owned ? "border border-gold/25 bg-gold/8 text-gold" : "gold-seal text-black")}><span>{owned ? "Studio owned" : "Own entire studio"}</span><span>{owned ? <Check className="h-4 w-4" /> : bundle.price}</span></button></div></div>;
}

function ProducerDetail({ selection, onUseBeat, onSave }: { selection: Extract<MarketSelection, { kind: "producer" }>; onUseBeat: (beat: MarketplaceBeat) => void; onSave: () => void }) {
  const { producer, beats, saved } = selection;
  return <div><div className="relative h-52" style={{ background: producer.banner }}><div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(16,16,18,0.95))]" /><div className="absolute bottom-5 left-5 right-5"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-gold/35 bg-black/25 text-base font-semibold text-gold">{producer.glyph}</div><div className="mt-3 flex items-center gap-2"><h2 className="text-3xl font-semibold">{producer.name}</h2>{producer.verified && <ShieldCheck className="h-5 w-5 text-gold" />}</div><div className="mt-1 text-xs text-white/60">{producer.city} / {producer.handle}</div></div></div><div className="p-5"><p className="text-sm leading-relaxed text-muted-foreground">{producer.bio}</p><div className="mt-5 grid grid-cols-3 gap-2"><SpotlightStat value={formatCompactNumber(producer.sales)} label="Licenses" /><SpotlightStat value={formatCompactNumber(producer.followers)} label="Followers" /><SpotlightStat value={producer.rating > 0 ? `${producer.rating}` : "New"} label="Rating" /></div><div className="mt-5 label-hw text-gold/80">Featured beats</div><div className="mt-2 space-y-2">{beats.slice(0, 3).map((beat) => <button key={beat.id} type="button" onClick={() => onUseBeat(beat)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/24 p-2.5 text-left"><span className="grid h-10 w-10 place-items-center rounded-lg border border-gold/20 text-[10px] font-semibold text-gold" style={{ background: beat.art }}>{beat.glyph}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{beat.title}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{beat.bpm} BPM / {beat.key}</span></span><ArrowRight className="h-4 w-4 text-gold" /></button>)}</div><button type="button" onClick={onSave} disabled={saved} className={cn("mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold", saved ? "border border-gold/25 bg-gold/8 text-gold" : "gold-seal text-black")}>{saved ? "Following" : "Follow producer"}</button></div></div>;
}

function DetailStat({ icon: Icon, value, label }: { icon: ComponentType<{ className?: string }>; value: string; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/24 p-2 text-center"><Icon className="mx-auto h-3.5 w-3.5 text-gold" /><div className="mt-2 text-sm font-semibold">{value}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{label}</div></div>;
}

function productTypeLabel(product: CatalogProduct) {
  if (product.type === "ai_style") return "AI Pen";
  if (product.type === "vocal_chain") return "Vocal Chain";
  if (product.type === "writing_pack") return "Writing Pack";
  if (product.type === "ambient_pack") return "Studio Air";
  if (product.type === "theme") return "Theme";
  if (product.type === "bundle") return "Studio Bundle";
  return "Studio Piece";
}

function productUnlockCategory(product: CatalogProduct): ProductUnlockCategory {
  if (product.type === "ai_style") return "Producer Style";
  if (product.type === "vocal_chain") return "Vocal Chain";
  if (product.type === "writing_pack") return "Writing Pack";
  if (product.type === "ambient_pack") return "Ambient Pack";
  if (product.type === "theme") return "Theme";
  if (product.type === "bundle") return "Bundle";
  return "Studio Room";
}

function toUnlock(product: CatalogProduct, category: ProductUnlockCategory): Omit<ProductUnlock, "unlockedAt"> {
  return { id: product.id, title: product.title, category, detail: product.detail, price: product.price };
}

function productIcon(product: CatalogProduct) {
  if (product.type === "ai_style") return PenLine;
  if (product.type === "vocal_chain") return Mic;
  if (product.type === "writing_pack") return WandSparkles;
  if (product.type === "ambient_pack") return Headphones;
  if (product.type === "theme") return Palette;
  return Sparkles;
}

function productFeatures(product: CatalogProduct) {
  if (product.type === "ai_style") return [{ label: "Writing behavior", value: product.tags[0] ?? "Focused" }, { label: "Cadence preference", value: product.tags[1] ?? "Adaptive" }, { label: "Artist compatibility", value: product.tags[2] ?? "Versatile" }, { label: "Difficulty", value: product.title === "Trap Scientist" ? "Advanced" : "Intuitive" }];
  if (product.type === "vocal_chain") return [{ label: "Purpose", value: product.detail }, { label: "Perfect for", value: product.tags.join(", ") }, { label: "Signal path", value: product.title === "Raw Cypher" ? "Presence / control / output" : "Tone / compression / space / output" }];
  if (product.type === "theme") return [{ label: "Changes", value: "Controls, waveform, backgrounds, visualizer" }, { label: "Visual character", value: product.tags.join(", ") }, { label: "Writing tools", value: "Unchanged" }];
  return [{ label: "Creative purpose", value: product.detail }, { label: "Best for", value: product.tags.join(", ") }, { label: "Works inside", value: "Studio and Writer Flow" }];
}

function productArtwork(product: CatalogProduct, index: number) {
  const palettes = [
    "linear-gradient(145deg,#0b0b0d 0%,#4d3510 58%,#d5aa43 140%)",
    "linear-gradient(145deg,#07070a 0%,#27172d 58%,#8e4c9e 135%)",
    "linear-gradient(145deg,#07090a 0%,#102d2d 58%,#4aa7a0 135%)",
    "linear-gradient(145deg,#0b0808 0%,#3d1616 58%,#bd4646 140%)",
    "linear-gradient(145deg,#070708 0%,#202126 58%,#8e929c 140%)",
  ];
  return palettes[Math.abs(index + product.id.length) % palettes.length];
}

function themeSwatches(index: number) {
  const themes = [
    { background: "linear-gradient(140deg,#05050b,#13294a 52%,#9f2cff)", colors: ["#111827", "#2563eb", "#a855f7"] },
    { background: "linear-gradient(140deg,#080604,#5c3517 52%,#d3a43f)", colors: ["#111111", "#8a5a24", "#d6b65f"] },
    { background: "linear-gradient(140deg,#070707,#3d2a0c 52%,#f2c14e)", colors: ["#080808", "#c79a32", "#f1d47a"] },
    { background: "linear-gradient(140deg,#08060c,#321448 52%,#a94fd3)", colors: ["#0d0812", "#6b2d84", "#c17ad7"] },
    { background: "linear-gradient(140deg,#030303,#202020 58%,#777)", colors: ["#050505", "#2f2f2f", "#b0b0b0"] },
  ];
  return themes[index % themes.length];
}

function makeMarketBars(seed: string, count: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return Array.from({ length: count }, (_, index) => {
    hash = (hash * 1103515245 + 12345 + index) >>> 0;
    return 24 + (((hash >>> 16) & 0xffff) / 0xffff) * 76;
  });
}

function producerInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}
