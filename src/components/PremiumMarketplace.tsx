"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
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
  studioRoomProducts,
  themeProducts,
  writingPackProducts,
  type CatalogBundle,
  type CatalogProduct,
} from "@/lib/product-catalog";
import type { Beat, Producer } from "@/lib/marketplace";
import { prepStudioTiers } from "@/lib/prep-studio-plans";

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

type MarketCategory = "beats" | "producer" | "studio-upgrades" | "creator-assets";
type StudioUpgradeCategory = "rooms" | "themes" | "atmosphere";

type PremiumMarketplaceProps = {
  signedIn: boolean;
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
  onOpenMembership: () => void;
  onContinueWriting: () => void;
};

const creatorAssetProducts = writingPackProducts;
const marketCategories: Array<{ id: MarketCategory; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "beats", label: "Beats", icon: Play },
  { id: "producer", label: "Producer", icon: Users },
  { id: "studio-upgrades", label: "Studio Upgrades", icon: Home },
  { id: "creator-assets", label: "Creator Assets", icon: WandSparkles },
];

export function PremiumMarketplace({
  signedIn,
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
  onOpenMembership,
  onContinueWriting,
}: PremiumMarketplaceProps) {
  const [category, setCategory] = useState<MarketCategory>("beats");
  const [studioUpgradeCategory, setStudioUpgradeCategory] = useState<StudioUpgradeCategory>("rooms");
  const [selection, setSelection] = useState<MarketSelection | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
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
  const featuredBundle = bundleProducts[0];
  const featuredBundleOwned = unlockedIds.has(featuredBundle.id);
  const featuredProductTitles = useMemo(
    () => new Set(featuredBundle.includes.map((item) => item.toLowerCase())),
    [featuredBundle.includes],
  );
  const recommendedBeat =
    featuredBeats.find((beat) => beat.emotionalTags.some((tag) => tag.toLowerCase().includes(sessionContext.mood.toLowerCase()))) ??
    featuredBeats[0];
  const discoveryBeats = recommendedBeat
    ? [recommendedBeat, ...allMarketplaceBeats.filter((beat) => beat.id !== recommendedBeat.id)]
    : allMarketplaceBeats;
  const studioUpgradeRooms = studioPacks.filter((pack) => !featuredProductTitles.has(pack.label.toLowerCase()));
  const studioUpgradeThemes = themeProducts.filter((product) => !featuredProductTitles.has(product.title.toLowerCase()));
  const studioUpgradeAtmospheres = ambientPackProducts.filter((product) => !featuredProductTitles.has(product.title.toLowerCase()));
  const visibleCreatorAssets = creatorAssetProducts.filter((product) => !featuredProductTitles.has(product.title.toLowerCase()));

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const storedCategory = window.sessionStorage.getItem("rapwriter:market:category") as MarketCategory | null;
    const storedQuery = window.sessionStorage.getItem("rapwriter:market:query") ?? "";
    const storedScroll = Number(window.sessionStorage.getItem("rapwriter:market:scroll") ?? 0);
    if (storedCategory && marketCategories.some((item) => item.id === storedCategory)) {
      setCategory(storedCategory);
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
    window.requestAnimationFrame(() => {
      document.getElementById(`market-${nextCategory}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const haystack = [beat.title, beat.producer, beat.region, beat.mood, beat.bpm, beat.key, ...beat.tags].join(" ").toLowerCase();
      if (haystack.includes(normalized)) results.push({ id: `beat-${beat.id}`, title: beat.title, meta: `${beat.producer} / Beat`, selection: { kind: "beat", beat } });
    }
    for (const producer of featuredProducers) {
      const haystack = [producer.name, producer.handle, producer.city, producer.bio].join(" ").toLowerCase();
      if (haystack.includes(normalized)) {
        results.push({
          id: `producer-${producer.id}`,
          title: producer.name,
          meta: `${producer.city} / Producer`,
          selection: {
            kind: "producer",
            producer,
            beats: allMarketplaceBeats.filter((beat) => beat.producerId === producer.id),
            saved: unlockedIds.has(`producer-${producer.id}`),
          },
        });
      }
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
    for (const product of [...creatorAssetProducts, ...ambientPackProducts, ...themeProducts, ...bundleProducts]) {
      if ([product.title, product.detail, ...product.tags].join(" ").toLowerCase().includes(normalized)) {
        results.push({
          id: `product-${product.id}`,
          title: product.title,
          meta: productTypeLabel(product),
          selection: product.type === "bundle"
            ? { kind: "bundle", bundle: product as CatalogBundle, owned: unlockedIds.has(product.id) }
            : { kind: "product", product, owned: unlockedIds.has(product.id) },
        });
      }
    }
    return results.slice(0, 8);
  }, [allMarketplaceBeats, featuredProducers, query, studioPacks, unlockedIds]);

  return (
    <div ref={scrollContainerRef} className="flex-1 scroll-smooth overflow-y-auto px-5 pb-32 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label-hw text-gold/85">Studio Store&trade;</div>
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
          aria-label="Search Studio Store"
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
              placeholder="Search beats, producers, rooms, assets..."
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
              {featuredBundle.includes.filter((item) => !featuredBundle.title.includes(item)).slice(0, 3).map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-gold" />{item}</span>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectBundle(featuredBundle)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/18 bg-black/45 px-3 text-xs font-semibold text-white backdrop-blur-md"
              >
                <Eye className="h-4 w-4" /> Preview Drop
              </button>
              <button
                type="button"
                onClick={() => onUnlockProduct(toUnlock(featuredBundle, "Bundle"))}
                disabled={featuredBundleOwned}
                className="gold-seal flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-black"
              >
                {featuredBundleOwned ? "Owned" : `Unlock ${featuredBundle.price}`} {featuredBundleOwned ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <PrepStudioMembership signedIn={signedIn} onUpgrade={onOpenMembership} />

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
          aria-label="Studio Store sections"
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
        <ShelfHeading eyebrow="Built for tonight" title="We matched this to your writing." detail={`${sessionContext.mood} mood / ${sessionContext.writingStyle} delivery / ${sessionContext.title}`} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <RecommendationCard
            label="Beat direction"
            title={recommendedBeat ? `${discoveryBeats.length} approved match${discoveryBeats.length === 1 ? "" : "es"}` : "Matching starts with the first drop"}
            detail={recommendedBeat ? `${sessionContext.mood} pocket / ${recommendedBeat.bpm} BPM` : "No demo inventory added"}
            icon={Play}
            onClick={() => jumpToShelf("beats")}
          />
          <RecommendationCard
            label="Studio DNA"
            title={`${sessionContext.writingStyle} pressure`}
            detail={`Built around ${sessionContext.mood.toLowerCase()} records`}
            icon={Sparkles}
            onClick={onContinueWriting}
          />
        </div>
      </section>

      {discoveryBeats.length > 0 && <section id="market-beats" className="scroll-mt-20 pt-10">
        <ShelfHeading
          eyebrow="Trending Beats"
          title="Find the right pocket"
          detail="Approved producer releases, with your strongest session match first."
          controls={discoveryBeats.length > 0 ? (
            <button type="button" onClick={() => setBeatCatalogOpen(true)} className="min-h-9 shrink-0 px-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">See all</button>
          ) : undefined}
        />
        <div className="mt-4 space-y-3">
          {discoveryBeats.slice(0, 5).map((beat) => (
            <TrendingBeatCard
              key={beat.id}
              beat={beat}
              studioMatch={beat.id === recommendedBeat?.id}
              playing={playingBeatId === beat.id}
              favorite={favoriteIds.has(beat.id)}
              onPreview={() => onPreviewBeat(beat)}
              onFavorite={() => favoriteBeat(beat)}
              onOpen={() => setSelection({ kind: "beat", beat })}
            />
          ))}
        </div>
      </section>}

      {spotlightProducer && (
        <section id="market-producer" className="scroll-mt-20 pt-10">
          <ProducerSpotlight
            producer={spotlightProducer}
            beats={spotlightBeats}
            saved={unlockedIds.has(`producer-${spotlightProducer.id}`)}
            onOpen={() => selectProducer(spotlightProducer)}
            onSave={() => onUnlockProduct({ id: `producer-${spotlightProducer.id}`, title: spotlightProducer.name, category: "Producer Profile", detail: spotlightProducer.bio, price: "$0" })}
          />
        </section>
      )}

      <section id="market-studio-upgrades" className="scroll-mt-20 pt-10">
        <MarketplaceShelf
          eyebrow="Studio Upgrades"
          title="Shape the room"
          detail="Change the environment, visual treatment, or atmosphere without changing how you write."
          label={studioUpgradeCategory === "rooms" ? "studio rooms" : studioUpgradeCategory === "themes" ? "studio themes" : "studio atmosphere"}
          itemCount={studioUpgradeCategory === "rooms" ? studioUpgradeRooms.length : studioUpgradeCategory === "themes" ? studioUpgradeThemes.length : studioUpgradeAtmospheres.length}
          beforeRail={(
            <div className="mt-4 grid grid-cols-3 gap-1.5" role="tablist" aria-label="Studio Upgrade categories">
              {([
                { id: "rooms" as const, label: "Rooms", icon: Home },
                { id: "themes" as const, label: "Themes", icon: Palette },
                { id: "atmosphere" as const, label: "Atmosphere", icon: Headphones },
              ]).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={studioUpgradeCategory === item.id}
                    onClick={() => setStudioUpgradeCategory(item.id)}
                    className={cn("flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[10px] font-semibold", studioUpgradeCategory === item.id ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-white/[0.03] text-muted-foreground")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        >
          {studioUpgradeCategory === "rooms" && studioUpgradeRooms.map((pack) => {
            const product = studioRoomProducts.find((item) => item.id === `studio-room-${pack.id}`);
            const owned = pack.id === "midnight" || Boolean(product && unlockedIds.has(product.id));
            return <RoomShelfCard key={pack.id} pack={pack} owned={owned} active={activeStudioPack.id === pack.id} onOpen={() => selectRoom(pack)} />;
          })}
          {studioUpgradeCategory === "themes" && studioUpgradeThemes.map((product, index) => (
            <ThemeShelfCard key={product.id} product={product} index={index} owned={unlockedIds.has(product.id)} onOpen={() => selectProduct(product)} />
          ))}
          {studioUpgradeCategory === "atmosphere" && studioUpgradeAtmospheres.map((product, index) => (
            <UpgradeProductCard key={product.id} product={product} index={index} owned={unlockedIds.has(product.id)} onOpen={() => selectProduct(product)} />
          ))}
        </MarketplaceShelf>
      </section>

      <section id="market-creator-assets" className="scroll-mt-20 pt-9">
        <ShelfHeading eyebrow="Creator Assets" title="Own the building blocks" detail="Reusable writing packs you keep in your Locker and bring into any session." />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {visibleCreatorAssets.map((product, index) => (
            <CreatorToolCard key={product.id} product={product} index={index} owned={unlockedIds.has(product.id)} onOpen={() => selectProduct(product)} />
          ))}
        </div>
      </section>

      <BeatCatalogSheet
        open={beatCatalogOpen}
        beats={discoveryBeats}
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

function PrepStudioMembership({ signedIn, onUpgrade }: { signedIn: boolean; onUpgrade: () => void }) {
  return (
    <section className="mt-4 overflow-hidden rounded-[22px] border border-gold/25 bg-[linear-gradient(145deg,rgba(255,176,32,0.1),rgba(17,17,19,0.98)_54%)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-black/28 text-gold"><Mic className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="label-hw text-gold/85">Prep Studio&trade; Membership</div>
          <h2 className="mt-1 text-xl font-semibold">Build better records.</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choose how far you want to take tonight&apos;s session.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {prepStudioTiers.map((plan) => (
          <div key={plan.id} className={cn("rounded-xl border px-3 py-3", plan.featured ? "border-gold/45 bg-gold/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" : "border-white/10 bg-black/20")}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{plan.shortName}</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold", plan.featured ? "border-gold/35 bg-gold/10 text-gold" : "border-white/10 text-white/48")}>{plan.decisionLabel}</span>
                </div>
                <div className="mt-1 text-[11px] leading-4 text-white/62">{plan.outcome}</div>
              </div>
              <span className={cn("shrink-0 text-xs font-semibold", plan.featured ? "text-gold" : "text-white/76")}>{plan.monthlyPriceCents === 0 ? "$0" : `$${(plan.monthlyPriceCents / 100).toFixed(2)}/mo`}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {plan.previewBenefits.map((benefit) => (
                <span key={benefit} className="inline-flex items-center gap-1 text-[10px] text-white/58"><Check className="h-3 w-3 text-gold" />{benefit}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onUpgrade} className="gold-seal mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-black">
        {signedIn ? "Explore membership" : "Start with Free"} <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-2 text-center text-[10px] text-white/46">Your projects stay yours. Change plans anytime.</p>
    </section>
  );
}

function RecommendationCard({ label, title, detail, icon: Icon, onClick }: { label: string; title: string; detail: string; icon: ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-xl border border-white/10 bg-[#111113] p-3 text-left transition-transform active:scale-[0.98]">
      <Icon className="h-4 w-4 text-gold" />
      <span className="mt-3 block text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="mt-1 block text-sm font-semibold leading-5">{title}</span>
      <span className="mt-1 block truncate text-[10px] text-white/48">{detail}</span>
    </button>
  );
}

function TrendingBeatCard({ beat, studioMatch, playing, favorite, onPreview, onFavorite, onOpen }: { beat: MarketplaceBeat; studioMatch: boolean; playing: boolean; favorite: boolean; onPreview: () => void; onFavorite: () => void; onOpen: () => void }) {
  const bars = useMemo(() => makeMarketBars(beat.id, 24), [beat.id]);
  const startingPrice = beat.prices.length ? Math.min(...beat.prices.map((price) => price.price)) : null;
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#111113] p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10" style={{ background: beat.art }}>
          {beat.artworkUrl && <img src={beat.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} />}
          <div className="absolute inset-0 bg-black/18" />
          <button type="button" onClick={onPreview} className="absolute inset-0 m-auto grid h-10 w-10 place-items-center rounded-full bg-gold text-black" aria-label={`${playing ? "Pause" : "Preview"} ${beat.title}`}>
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
          </button>
        </div>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="text-[9px] uppercase tracking-[0.14em] text-gold/78">{beat.tags[0] ?? beat.mood} / {beat.bpm} BPM / {beat.key}</div>
          <h3 className="mt-1 truncate text-base font-semibold">{beat.title}</h3>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">{beat.producer}</span>{beat.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[9px] font-semibold">
            {studioMatch && <span className="text-emerald-300">Studio Match&trade;</span>}
            <span className="text-gold">Booth Match&trade; {beat.boothReadyScore > 0 ? `${beat.boothReadyScore}%` : "New"}</span>
          </div>
        </button>
        <button type="button" onClick={onFavorite} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", favorite ? "border-gold/45 bg-gold/14 text-gold" : "border-white/10 bg-white/[0.03] text-white/58")} aria-label={`Favorite ${beat.title}`}>
          <Heart className={cn("h-4 w-4", favorite && "fill-current")} />
        </button>
      </div>
      <div className="mt-3 flex h-5 items-center gap-[2px]" aria-hidden="true">
        {bars.map((bar, index) => <span key={index} className={cn("flex-1 rounded-full", playing ? "bg-gold" : "bg-gold/24")} style={{ height: `${bar}%`, animation: playing ? `vu-pulse ${0.7 + (index % 5) * 0.09}s ease-in-out infinite` : undefined }} />)}
      </div>
      <button type="button" onClick={onOpen} className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold">
        <span>{startingPrice == null ? "Explore licensing" : `License from $${startingPrice}`}</span><ChevronRight className="h-4 w-4 text-gold" />
      </button>
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

function CreatorToolCard({ product, index, owned, onOpen }: { product: CatalogProduct; index: number; owned: boolean; onOpen: () => void }) {
  const Icon = productIcon(product);
  return (
    <button type="button" onClick={onOpen} className="min-w-0 rounded-2xl border border-white/10 bg-[#111113] p-3 text-left transition-transform active:scale-[0.99]">
      <div className="relative h-20 overflow-hidden rounded-xl border border-white/8" style={{ background: productArtwork(product, index) }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_38%)]" />
        <div className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-lg border border-gold/25 bg-black/28 text-gold backdrop-blur-md"><Icon className="h-4 w-4" /></div>
        {owned && <span className="absolute right-2 top-2 rounded-full border border-gold/30 bg-black/45 px-2 py-1 text-[8px] font-semibold text-gold">Owned</span>}
      </div>
      <div className="mt-3 text-[8px] font-semibold uppercase tracking-[0.14em] text-gold/72">{creatorOutcomeLabel(product)}</div>
      <h3 className="mt-1 text-sm font-semibold leading-5">{product.title}</h3>
      <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-muted-foreground">{product.detail}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="truncate text-[9px] text-white/48">{product.tags.slice(0, 2).join(" / ")}</span>
        <span className="shrink-0 text-[10px] font-semibold text-gold">{owned ? "Open" : product.price}</span>
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

function UpgradeProductCard({ product, index, owned, onOpen }: { product: CatalogProduct; index: number; owned: boolean; onOpen: () => void }) {
  const Icon = productIcon(product);
  return (
    <button type="button" onClick={onOpen} className="w-[70vw] max-w-[266px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#111113] text-left">
      <div className="relative h-32" style={{ background: productArtwork(product, index + 3) }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_38%),linear-gradient(180deg,transparent,rgba(0,0,0,0.72))]" />
        <span className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-xl border border-gold/25 bg-black/35 text-gold backdrop-blur-md"><Icon className="h-4 w-4" /></span>
        {owned && <span className="absolute right-3 top-3 rounded-full border border-gold/30 bg-black/45 px-2 py-1 text-[9px] font-semibold text-gold">Owned</span>}
        <div className="absolute bottom-3 left-3 right-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/62">Atmosphere Pack</div>
      </div>
      <div className="p-4">
        <div className="text-lg font-semibold">{product.title}</div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.detail}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="truncate text-white/48">{product.tags.slice(0, 2).join(" / ")}</span><span className="shrink-0 font-semibold text-gold">{owned ? "Open" : product.price}</span></div>
      </div>
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
  const [sort, setSort] = useState<"match" | "booth" | "popular" | "price">("match");
  const [genre, setGenre] = useState("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const genres = useMemo(() => Array.from(new Set(beats.map((beat) => beat.tags[0]).filter(Boolean))).sort(), [beats]);
  const filteredBeats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = beats.filter((beat) => {
      const matchesGenre = genre === "all" || beat.tags[0] === genre;
      const matchesQuery = !normalized || [beat.title, beat.producer, beat.region, beat.mood, beat.bpm, beat.key, ...beat.tags, ...beat.emotionalTags]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
      return matchesGenre && matchesQuery;
    });
    if (sort === "booth") return [...filtered].sort((a, b) => b.boothReadyScore - a.boothReadyScore);
    if (sort === "popular") return [...filtered].sort((a, b) => b.plays - a.plays);
    if (sort === "price") return [...filtered].sort((a, b) => lowestBeatPrice(a) - lowestBeatPrice(b));
    return filtered;
  }, [beats, genre, query, sort]);
  const visibleBeats = filteredBeats.slice(0, visibleCount);

  useEffect(() => setVisibleCount(12), [genre, open, query, sort]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/76 px-3 pb-3 backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="All producer beats" className="flex max-h-[92svh] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#101012] shadow-[0_-24px_90px_rgba(0,0,0,0.7)]">
        <div className="border-b border-white/8 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label-hw text-gold/80">Beat Discovery</div>
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="rounded-xl border border-white/10 bg-black/28 px-3 py-2">
              <span className="block text-[8px] uppercase tracking-[0.14em] text-white/42">Genre</span>
              <select value={genre} onChange={(event) => setGenre(event.target.value)} className="mt-1 w-full bg-transparent text-xs font-semibold text-white outline-none">
                <option value="all">All sounds</option>
                {genres.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="rounded-xl border border-white/10 bg-black/28 px-3 py-2">
              <span className="block text-[8px] uppercase tracking-[0.14em] text-white/42">Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="mt-1 w-full bg-transparent text-xs font-semibold text-white outline-none">
                <option value="match">Best match</option>
                <option value="booth">Booth Match</option>
                <option value="popular">Most played</option>
                <option value="price">Lowest price</option>
              </select>
            </label>
          </div>
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
          {visibleBeats.length < filteredBeats.length && (
            <button type="button" onClick={() => setVisibleCount((count) => count + 12)} className="mt-3 min-h-11 w-full rounded-xl border border-gold/25 bg-gold/8 text-xs font-semibold text-gold">Load more beats</button>
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
      <section role="dialog" aria-modal="true" aria-label="Studio Store preview" className="max-h-[90svh] w-full max-w-[430px] overflow-hidden rounded-[24px] border border-white/10 bg-[#101012] shadow-[0_-24px_90px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div className="label-hw text-gold/80">Studio Preview</div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/72" aria-label="Close Studio Store preview"><X className="h-4 w-4" /></button></div>
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

function creatorOutcomeLabel(product: CatalogProduct) {
  if (product.type === "vocal_chain") return "Cleaner demos";
  if (product.id === "writing-hook-builder") return "Built for replay";
  if (product.id === "writing-16-bar-pressure") return "Stronger verses";
  if (product.id === "writing-story-mode") return "Built for storytelling";
  return "Creator Asset";
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
  if (product.type === "vocal_chain") return [{ label: "Purpose", value: product.detail }, { label: "Perfect for", value: product.tags.join(", ") }, { label: "Signal path", value: "Tone / compression / space / output" }];
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

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

function lowestBeatPrice(beat: MarketplaceBeat) {
  return beat.prices.length ? Math.min(...beat.prices.map((price) => price.price)) : Number.MAX_SAFE_INTEGER;
}
