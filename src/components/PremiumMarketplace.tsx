"use client";

import Link from "next/link";
import { ArrowRight, Check, Crown, Heart, LoaderCircle, Pause, Play, Search, ShieldCheck, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Beat } from "@/lib/marketplace";
import { prepStudioTiers } from "@/lib/prep-studio-plans";
import type { StarterBeat } from "@/lib/starter-beats";
import type { MarketplaceFeed, PadActionStatus, ProductUnlock, StudioPack, StudioPackId } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export type MarketCategory = "beats" | "producer";

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
  starterBeats: StarterBeat[];
  onUseStarterBeat: (beat: StarterBeat) => void;
  activeStudioPack: StudioPack;
  studioPacks: StudioPack[];
  onStudioPack: (id: StudioPackId) => void;
  artistPlanId?: string | null;
  allAccess?: boolean;
  productUnlocks: ProductUnlock[];
  onUnlockProduct: (product: Omit<ProductUnlock, "unlockedAt">) => void;
  sessionContext: { title: string; mood: string; writingStyle: string };
  onOpenMembership: () => void;
  onContinueWriting: () => void;
  focusCategory?: MarketCategory | null;
};

type ProducerBeat = MarketplaceFeed["beats"][number];

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
  starterBeats,
  onUseStarterBeat,
  artistPlanId,
  onOpenMembership,
  onContinueWriting,
  focusCategory,
}: PremiumMarketplaceProps) {
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedBeat, setSelectedBeat] = useState<ProducerBeat | null>(null);
  const isPaid = Boolean(artistPlanId && artistPlanId !== "artist_free");
  const normalizedQuery = query.trim().toLowerCase();

  const producerBeats = useMemo(() => marketplaceFeed.beats.filter((beat) => beatMatches(beat, normalizedQuery)), [marketplaceFeed.beats, normalizedQuery]);
  const availableStarterBeats = useMemo(() => {
    if (isPaid) return starterBeats;
    const featured = starterBeats.filter((beat) => beat.featured);
    return (featured.length > 0 ? featured : starterBeats).slice(0, 3);
  }, [isPaid, starterBeats]);
  const visibleStarterBeats = useMemo(
    () => availableStarterBeats.filter((beat) => starterBeatMatches(beat, normalizedQuery)),
    [availableStarterBeats, normalizedQuery],
  );
  const hiddenStarterCount = Math.max(0, starterBeats.length - availableStarterBeats.length);

  useEffect(() => {
    if (!focusCategory) return;
    const target = focusCategory === "producer" ? "producer-beats" : "market-beats";
    window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focusCategory]);

  const favoriteBeat = (beat: ProducerBeat) => {
    setFavoriteIds((current) => new Set(current).add(beat.id));
    onFavoriteBeat(beat);
  };

  return (
    <div className="min-h-full bg-[#080809] pb-28 text-white">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#080809]/92 px-5 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label-hw text-gold/82">Market</div>
            <h1 className="mt-1 text-2xl font-semibold">Membership & beats</h1>
          </div>
          <button type="button" onClick={onContinueWriting} className="min-h-10 rounded-full border border-gold/25 bg-gold/8 px-4 text-xs font-semibold text-gold">
            Keep writing
          </button>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 focus-within:border-gold/35">
          <Search className="h-4 w-4 shrink-0 text-gold/72" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search beats or producers" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/32" />
        </label>
      </header>

      <main className="px-4">
        <MembershipDecision activePlanId={artistPlanId} signedIn={signedIn} onOpen={onOpenMembership} />

        <section id="market-beats" className="scroll-mt-28 pt-9">
          <SectionHeading eyebrow="RapWriter Beats" title="Start with a pocket" detail={isPaid ? "Your complete starter library is ready." : "Three starter beats are included. Upgrade for the full library."} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {visibleStarterBeats.map((beat) => <StarterBeatCard key={beat.id} beat={beat} onUse={() => onUseStarterBeat(beat)} />)}
          </div>
          {visibleStarterBeats.length === 0 && <EmptyState title="No starter beats match" detail="Try a title, mood, genre, or collection." />}
          {!isPaid && hiddenStarterCount > 0 && (
            <button type="button" onClick={onOpenMembership} className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-gold/25 bg-gold/8 px-4 text-left text-xs font-semibold text-gold">
              <span>Unlock {hiddenStarterCount} more starter beats</span><ArrowRight className="h-4 w-4" />
            </button>
          )}
        </section>

        <section id="producer-beats" className="scroll-mt-28 pt-10">
          <SectionHeading eyebrow="Producer Beats" title="Find the record" detail="Preview, write, or license directly. Buying beats is open to every RapWriter account." />
          {marketplaceFeedLoading ? (
            <div className="mt-4 grid min-h-40 place-items-center rounded-2xl border border-white/10 bg-white/[0.025]"><LoaderCircle className="h-5 w-5 animate-spin text-gold" /></div>
          ) : marketplaceFeedError ? (
            <FeedError message={marketplaceFeedError} />
          ) : producerBeats.length === 0 ? (
            <EmptyState title={normalizedQuery ? "No producer beats match" : "No producer drops yet"} detail={normalizedQuery ? "Try a producer, region, mood, or beat title." : "Approved producer releases will appear here as they go live."} />
          ) : (
            <div className="mt-4 space-y-3">
              {producerBeats.map((beat) => (
                <ProducerBeatCard
                  key={beat.id}
                  beat={beat}
                  playing={playingBeatId === beat.id}
                  favorite={favoriteIds.has(beat.id)}
                  onPreview={() => onPreviewBeat(beat)}
                  onFavorite={() => favoriteBeat(beat)}
                  onOpen={() => setSelectedBeat(beat)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <BeatSheet
        beat={selectedBeat}
        playing={selectedBeat ? playingBeatId === selectedBeat.id : false}
        busy={status.state === "saving"}
        onClose={() => setSelectedBeat(null)}
        onPreview={() => selectedBeat && onPreviewBeat(selectedBeat)}
        onFavorite={() => selectedBeat && favoriteBeat(selectedBeat)}
        onWrite={() => {
          if (!selectedBeat) return;
          onAddBeatToProject(selectedBeat);
          setSelectedBeat(null);
        }}
        onLicense={() => selectedBeat && onLicenseBeat(selectedBeat)}
      />
    </div>
  );
}

function MembershipDecision({ activePlanId, signedIn, onOpen }: { activePlanId?: string | null; signedIn: boolean; onOpen: () => void }) {
  const paid = Boolean(activePlanId && activePlanId !== "artist_free");
  const currentTierId = paid ? "artist_pro" : "artist_free";
  return (
    <section className="pt-5">
      <div className="overflow-hidden rounded-2xl border border-gold/25 bg-[linear-gradient(145deg,rgba(246,199,72,0.1),rgba(17,17,19,0.98)_58%)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-black/28 text-gold"><Crown className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="label-hw text-gold/82">RapWriter Membership</div>
            <h2 className="mt-1 text-xl font-semibold">{paid ? "RapWriter Pro is active." : "Free writes. Pro finishes."}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Write complete songs free. RapWriter Pro adds the AI family, booth tools, history, and every room.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {prepStudioTiers.map((plan) => (
            <div key={plan.id} className={cn("rounded-xl border p-3", plan.id === "artist_pro" ? "border-gold/30 bg-gold/[0.08]" : "border-white/10 bg-black/24")}>
              <div className="flex min-h-5 items-start justify-between gap-1.5">
                <div className="text-xs font-semibold">{plan.name}</div>
                {plan.id === currentTierId && <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.08em] text-emerald-300">Current</span>}
              </div>
              <div className="mt-1 text-lg font-semibold text-gold">{plan.monthlyPriceCents === 0 ? "$0" : `$${(plan.monthlyPriceCents / 100).toFixed(2)}`}<span className="text-[9px] text-white/42">{plan.monthlyPriceCents === 0 ? "" : "/mo"}</span></div>
              <div className="mt-2 text-[10px] leading-4 text-white/52">{plan.outcome}</div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onOpen} className={cn("mt-3 min-h-12 w-full rounded-xl px-4 text-sm font-semibold", paid ? "border border-gold/25 bg-gold/8 text-gold" : "gold-seal text-black")}>
          {paid ? "Manage RapWriter Pro" : signedIn ? "Upgrade to Pro - $7.99/mo" : "Explore Pro - $7.99/mo"}
        </button>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div><div className="label-hw text-gold/78">{eyebrow}</div><h2 className="mt-1 text-xl font-semibold">{title}</h2><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p></div>;
}

function StarterBeatCard({ beat, onUse }: { beat: StarterBeat; onUse: () => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#111113]">
      <div className="relative aspect-square bg-[linear-gradient(145deg,#2d2311,#09090a)]">
        {beat.artworkUrl && <img src={beat.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />}
        <span className="absolute left-2 top-2 rounded-full border border-gold/25 bg-black/65 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-gold">Included</span>
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold">{beat.title}</h3>
        <p className="mt-1 truncate text-[10px] text-white/48">{[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null].filter(Boolean).join(" / ")}</p>
        <button type="button" onClick={onUse} className="mt-3 min-h-10 w-full rounded-xl bg-gold px-3 text-xs font-semibold text-black">Write to beat</button>
      </div>
    </article>
  );
}

function ProducerBeatCard({ beat, playing, favorite, onPreview, onFavorite, onOpen }: { beat: ProducerBeat; playing: boolean; favorite: boolean; onPreview: () => void; onFavorite: () => void; onOpen: () => void }) {
  const storefront = producerStorefrontHref(beat.producer, beat.producerId);
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#111113]">
      <div className="flex gap-3 p-3">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10" style={{ background: beat.art }}>
          {beat.artworkUrl && <img src={beat.artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />}
          <button type="button" onClick={onPreview} className="relative z-10 grid h-11 w-11 place-items-center rounded-full bg-gold text-black" aria-label={`${playing ? "Pause" : "Preview"} ${beat.title}`}>
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
          </button>
        </div>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5"><h3 className="truncate text-base font-semibold">{beat.title}</h3>{beat.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}</div>
          <div className="mt-1 truncate text-xs text-white/52">{beat.producer} / {beat.region}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-gold/78"><span>{beat.bpm} BPM</span><span>{beat.key}</span><span>From ${beat.prices[0]?.price ?? 0}</span></div>
        </button>
        <button type="button" onClick={onFavorite} disabled={favorite} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", favorite ? "border-gold/35 bg-gold/12 text-gold" : "border-white/10 text-white/55")} aria-label={favorite ? `Saved ${beat.title}` : `Favorite ${beat.title}`}><Heart className={cn("h-4 w-4", favorite && "fill-current")} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-white/8 p-3">
        {storefront ? <Link href={storefront} className="flex min-h-10 items-center justify-center rounded-xl border border-white/10 text-xs font-semibold text-white/72">Producer</Link> : <span />}
        <button type="button" onClick={onOpen} className="min-h-10 rounded-xl border border-gold/25 bg-gold/8 text-xs font-semibold text-gold">Beat options</button>
      </div>
    </article>
  );
}

function BeatSheet({ beat, playing, busy, onClose, onPreview, onFavorite, onWrite, onLicense }: { beat: ProducerBeat | null; playing: boolean; busy: boolean; onClose: () => void; onPreview: () => void; onFavorite: () => void; onWrite: () => void; onLicense: () => void }) {
  if (!beat) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/76 px-3 pb-3 backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={`${beat.title} options`} className="w-full max-w-[430px] overflow-hidden rounded-[24px] border border-white/10 bg-[#101012]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div className="label-hw text-gold/80">Producer Beat</div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10" aria-label="Close beat options"><X className="h-4 w-4" /></button></div>
        <div className="p-4">
          <div className="flex items-center gap-3"><button type="button" onClick={onPreview} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-black">{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}</button><div className="min-w-0"><h2 className="truncate text-xl font-semibold">{beat.title}</h2><p className="mt-1 truncate text-xs text-muted-foreground">{beat.producer} / {beat.bpm} BPM / {beat.key}</p></div></div>
          <p className="mt-4 text-xs leading-5 text-white/55">Preview the beat, start writing immediately, or choose a producer license. Membership is never required to buy music.</p>
          <div className="mt-4 grid grid-cols-[48px_1fr] gap-2"><button type="button" onClick={onFavorite} className="grid min-h-12 place-items-center rounded-xl border border-white/10" aria-label={`Favorite ${beat.title}`}><Heart className="h-4 w-4" /></button><button type="button" onClick={onWrite} disabled={busy} className="gold-seal min-h-12 rounded-xl px-4 text-sm font-semibold text-black disabled:opacity-55">Write to this beat</button></div>
          <button type="button" onClick={onLicense} disabled={busy} className="mt-2 flex min-h-12 w-full items-center justify-between rounded-xl border border-gold/25 bg-gold/8 px-4 text-sm font-semibold text-gold disabled:opacity-55"><span className="inline-flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Licensing options</span><span>From ${beat.prices[0]?.price ?? 0}</span></button>
        </div>
      </section>
    </div>
  );
}

function FeedError({ message }: { message: string }) {
  return <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4"><div className="text-sm font-semibold">Producer beats could not load</div><p className="mt-1 text-xs leading-5 text-white/52">{message}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-10 rounded-xl border border-white/10 px-4 text-xs font-semibold">Try again</button></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="mt-4 grid min-h-36 place-items-center rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center"><div><div className="text-sm font-semibold">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div>;
}

function beatMatches(beat: ProducerBeat, query: string) {
  if (!query) return true;
  return [beat.title, beat.producer, beat.region, beat.mood, beat.key, beat.bpm, ...beat.tags, ...beat.emotionalTags].join(" ").toLowerCase().includes(query);
}

function starterBeatMatches(beat: StarterBeat, query: string) {
  if (!query) return true;
  return [beat.title, beat.producer, beat.genre, beat.mood, beat.collection, beat.bpm, ...beat.tags, ...beat.writingFit].filter(Boolean).join(" ").toLowerCase().includes(query);
}

function producerStorefrontHref(name: string, producerId: string) {
  const handle = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return handle ? `/producer/${encodeURIComponent(handle)}?id=${encodeURIComponent(producerId)}` : null;
}
