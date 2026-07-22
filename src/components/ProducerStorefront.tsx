"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AudioWaveform,
  BadgeCheck,
  Briefcase,
  ChevronRight,
  ExternalLink,
  Globe2,
  Heart,
  Home,
  Instagram,
  Music2,
  Pause,
  Play,
  Share2,
  ShoppingCart,
  UserCircle,
  Users,
  Youtube,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { setPendingBeat, type Beat, type EmotionalTag, type License } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type StorefrontBeat = {
  id: string;
  marketplaceId: string;
  title: string;
  producer: string;
  producerId: string;
  bpm: number;
  key: string;
  genre: string;
  mood: string;
  region: string;
  tags: string[];
  duration: string;
  durationSeconds: number;
  audioUrl: string | null;
  artworkUrl: string | null;
  licenseTiers: Array<{ license: string; price: number }>;
  featured: boolean;
};

type StorefrontPayload = {
  profile: {
    id: string;
    displayName: string;
    handle: string;
    city: string | null;
    state: string | null;
    country: string | null;
    studioName: string | null;
    yearsProducing: number | null;
    bio: string | null;
    genres: string[];
    specialties: string[];
    verified: boolean;
    avatarUrl: string | null;
    bannerUrl: string | null;
    social: Record<"website" | "instagram" | "youtube" | "beatstars", string | null>;
  };
  beats: StorefrontBeat[];
  collections: Array<{ id: string; title: string; description: string | null; beatIds: string[] }>;
  metrics: { profile_views: number; beat_plays: number; favorites: number; beat_adds: number; followers: number; sales: number };
  followerCount: number;
  following: boolean;
  signedIn: boolean;
  ownerPreview: boolean;
};

export function ProducerStorefront({ handle }: { handle: string }) {
  const [store, setStore] = useState<StorefrontPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [checkoutBeatId, setCheckoutBeatId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/marketplace/producers/${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not open this storefront.");
        return data as StorefrontPayload;
      })
      .then((data) => {
        if (!active) return;
        setStore(data);
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not open this storefront.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [handle]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const featuredBeat = useMemo(() => store?.beats.find((beat) => beat.featured) ?? store?.beats[0] ?? null, [store]);
  const location = store ? [store.profile.city, store.profile.state, store.profile.country].filter(Boolean).join(", ") : "";

  const togglePreview = (beat: StorefrontBeat) => {
    if (!beat.audioUrl) {
      setNotice("Preview audio is still being prepared.");
      return;
    }
    if (playingId === beat.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(beat.audioUrl);
    audioRef.current = audio;
    setPlayingId(beat.id);
    setProgress(0);
    audio.addEventListener("timeupdate", () => {
      const duration = audio.duration || beat.durationSeconds;
      setProgress(duration ? Math.min(100, (audio.currentTime / duration) * 100) : 0);
    });
    audio.addEventListener("ended", () => {
      setPlayingId(null);
      setProgress(0);
    });
    void audio.play()
      .then(() => trackStorefrontBeatPlay(beat.marketplaceId))
      .catch(() => {
        setPlayingId(null);
        setNotice("Tap play again to start the preview.");
      });
  };

  const followProducer = async () => {
    if (!store || followBusy) return;
    setFollowBusy(true);
    setNotice(null);
    try {
      const action = store.following ? "unfollow" : "follow";
      const response = await fetch(`/api/marketplace/producers/${encodeURIComponent(handle)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (response.status === 401) {
        setNotice("Sign in from Studio to follow producers.");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Could not update this producer.");
      setStore((current) => current ? { ...current, following: data.following, followerCount: data.followerCount } : current);
      setNotice(data.following ? `${store.profile.displayName} added to your circle.` : "Producer removed from your circle.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update this producer.");
    } finally {
      setFollowBusy(false);
    }
  };

  const shareStorefront = async () => {
    if (!store) return;
    const shareData = { title: `${store.profile.displayName} on RapWriter`, text: `Hear ${store.profile.displayName}'s producer catalog on RapWriter.`, url: window.location.href };
    const usedNativeShare = typeof navigator.share === "function";
    try {
      if (usedNativeShare) await navigator.share(shareData);
      else await navigator.clipboard.writeText(window.location.href);
      setNotice(usedNativeShare ? "Storefront shared." : "Storefront link copied.");
    } catch {
      // Closing the native share sheet should leave the page unchanged.
    }
  };

  const writeToBeat = (beat: StorefrontBeat) => {
    setPendingBeat(toMarketplaceBeat(beat, Boolean(store?.profile.verified)));
    window.location.assign("/?view=studio&from=producer-storefront");
  };

  const licenseBeat = async (beat: StorefrontBeat) => {
    const tier = beat.licenseTiers[0];
    if (!tier || checkoutBeatId) return;
    setCheckoutBeatId(beat.id);
    setNotice(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beat_id: beat.marketplaceId, license: tier.license }),
      });
      const data = await response.json();
      if (response.status === 401) {
        setNotice("Sign in from Studio before licensing a beat.");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Checkout could not be started.");
      if (!data.checkout_url) throw new Error("Stripe did not return a checkout link.");
      window.location.assign(data.checkout_url);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Checkout could not be started.");
    } finally {
      setCheckoutBeatId(null);
    }
  };

  if (loading) return <StorefrontState title="Opening storefront" body="Loading the producer catalog..." />;
  if (error || !store) return <StorefrontState title="Storefront unavailable" body={error ?? "This producer is not public yet."} />;

  return (
    <main className="min-h-svh bg-[#060607] text-white">
      <div className="mx-auto min-h-svh w-full max-w-[430px] overflow-hidden border-x border-white/8 bg-[#09090a] shadow-[0_0_80px_rgba(0,0,0,0.75)]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-black/88 px-4 backdrop-blur-xl">
          <Link href="/?view=market" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/75" aria-label="Back to Studio Store">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandLogo className="scale-90" />
          <button type="button" onClick={shareStorefront} className="grid h-10 w-10 place-items-center rounded-full border border-gold/25 bg-gold/8 text-gold" aria-label="Share storefront">
            <Share2 className="h-4 w-4" />
          </button>
        </header>

        {store.ownerPreview && (
          <div className="border-b border-gold/20 bg-gold/10 px-5 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
            Private preview - approval is required before this page is public
          </div>
        )}

        <section className="relative min-h-[330px] overflow-hidden">
          {store.profile.bannerUrl ? (
            <img src={store.profile.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#050506_0%,#17130d_48%,#3a2a0e_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(9,9,10,0.35)_42%,#09090a_100%)]" />
          <div className="relative flex min-h-[330px] flex-col justify-end px-5 pb-6 pt-20">
            <div className="flex items-end gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-gold/35 bg-black/65 text-xl font-semibold text-gold shadow-[0_16px_45px_rgba(0,0,0,0.55)]">
                {store.profile.avatarUrl ? <img src={store.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(store.profile.displayName)}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold">{store.profile.displayName}</h1>
                  {store.profile.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-gold" aria-label="Verified producer" />}
                </div>
                <div className="mt-1 text-sm text-white/60">@{store.profile.handle}</div>
                {location && <div className="mt-1 truncate text-xs text-white/45">{location}</div>}
              </div>
            </div>
            <p className="mt-5 max-w-[36ch] text-sm leading-relaxed text-white/72">
              {store.profile.bio || "Independent production built for focused writing sessions."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...store.profile.specialties, ...store.profile.genres].slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/68">{tag}</span>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={followProducer} disabled={followBusy} className={cn("min-h-12 rounded-xl px-4 text-sm font-semibold", store.following ? "border border-gold/30 bg-gold/10 text-gold" : "gold-seal text-black", followBusy && "opacity-60")}>
                {followBusy ? "Updating..." : store.following ? "Following" : "Follow Producer"}
              </button>
              <button type="button" onClick={shareStorefront} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-black/30 px-4 text-sm font-semibold text-white/75">
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
          </div>
        </section>

        {notice && <div className="mx-5 mb-5 rounded-xl border border-gold/20 bg-gold/8 px-3 py-2 text-center text-xs text-gold">{notice}</div>}

        <section className="grid grid-cols-3 border-y border-white/8 px-5 py-5 text-center">
          <StoreStat value={formatCompact(store.followerCount)} label="Followers" />
          <StoreStat value={formatCompact(store.metrics.beat_plays)} label="Beat plays" />
          <StoreStat value={formatCompact(store.metrics.sales)} label="Sales" />
        </section>

        {featuredBeat && (
          <section className="px-5 py-7">
            <SectionHeading eyebrow="Producer's pick" title="Start with this one" />
            <div className="mt-4 overflow-hidden rounded-2xl border border-gold/22 bg-[#111113]">
              <BeatArtwork beat={featuredBeat} large />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold">{featuredBeat.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{featuredBeat.bpm} BPM - {featuredBeat.key} - {featuredBeat.mood}</p>
                  </div>
                  <button type="button" onClick={() => togglePreview(featuredBeat)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-black" aria-label={`Preview ${featuredBeat.title}`}>
                    {playingId === featuredBeat.id ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                  </button>
                </div>
                <ProgressBar active={playingId === featuredBeat.id} progress={progress} />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => writeToBeat(featuredBeat)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 text-sm font-semibold text-gold">
                    <Music2 className="h-4 w-4" /> Write
                  </button>
                  <button type="button" onClick={() => licenseBeat(featuredBeat)} disabled={Boolean(checkoutBeatId)} className="gold-seal flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-black disabled:opacity-60">
                    <ShoppingCart className="h-4 w-4" /> {checkoutBeatId === featuredBeat.id ? "Opening..." : `License $${featuredBeat.licenseTiers[0]?.price ?? 0}`}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-white/8 px-5 py-7">
          <SectionHeading eyebrow="Approved catalog" title="Beats built for the pen" detail={`${store.beats.length} records ready for writing sessions`} />
          <div className="mt-4 space-y-3">
            {store.beats.map((beat) => (
              <div key={beat.id} className="rounded-2xl border border-white/10 bg-[#111113] p-3">
                <div className="flex items-center gap-3">
                  <BeatArtwork beat={beat} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{beat.title}</div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">{beat.bpm} BPM - {beat.key} - {beat.genre}</div>
                    <ProgressBar active={playingId === beat.id} progress={progress} compact />
                  </div>
                  <button type="button" onClick={() => togglePreview(beat)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/35 bg-gold/10 text-gold" aria-label={`Preview ${beat.title}`}>
                    {playingId === beat.id ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <button type="button" onClick={() => writeToBeat(beat)} className="flex min-h-10 items-center justify-between rounded-xl border border-white/10 bg-black/22 px-3 text-xs font-semibold text-white/72">
                    Write to this beat <ChevronRight className="h-4 w-4 text-gold" />
                  </button>
                  <button type="button" onClick={() => licenseBeat(beat)} disabled={Boolean(checkoutBeatId)} className="grid min-h-10 min-w-11 place-items-center rounded-xl border border-gold/35 bg-gold/10 text-gold disabled:opacity-60" aria-label={`License ${beat.title}`} title={`License from $${beat.licenseTiers[0]?.price ?? 0}`}>
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {!store.beats.length && <p className="py-7 text-center text-sm text-muted-foreground">Approved beats will appear here after review.</p>}
          </div>
        </section>

        {store.collections.length > 0 && (
          <section className="border-t border-white/8 px-5 py-7">
            <SectionHeading eyebrow="Collections" title="Curated by the producer" />
            <div className="mt-4 space-y-3">
              {store.collections.map((collection) => (
                <div key={collection.id} className="rounded-2xl border border-white/10 bg-[#111113] p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold"><AudioWaveform className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{collection.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{collection.beatIds.length} beats</div>
                    </div>
                  </div>
                  {collection.description && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{collection.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <SocialLinks social={store.profile.social} />

        <nav className="sticky bottom-0 z-40 grid h-20 grid-cols-4 border-t border-white/8 bg-black/94 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
          <DockLink href="/" label="Studio" icon={Home} />
          <DockLink href="/?view=locker" label="Locker" icon={Briefcase} />
          <DockLink href="/?view=market" label="Market" icon={ShoppingCart} active />
          <DockLink href="/?view=profile" label="Profile" icon={UserCircle} />
        </nav>
      </div>
    </main>
  );
}

function StorefrontState({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-svh place-items-center bg-[#060607] px-6 text-white">
      <div className="w-full max-w-[390px] text-center">
        <BrandLogo className="justify-center" />
        <h1 className="mt-8 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <Link href="/?view=market" className="gold-seal mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-black"><ArrowLeft className="h-4 w-4" /> Studio Store</Link>
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <div><div className="label-hw text-gold/80">{eyebrow}</div><h2 className="mt-1 text-xl font-semibold">{title}</h2>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}

function BeatArtwork({ beat, large = false }: { beat: StorefrontBeat; large?: boolean }) {
  const className = large ? "relative h-44 w-full" : "grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/20 bg-[linear-gradient(145deg,#16120b,#3b2a0d)] text-xs font-semibold text-gold";
  if (large) return <div className={className}>{beat.artworkUrl ? <img src={beat.artworkUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center bg-[linear-gradient(145deg,#09090a,#3b2a0d)] text-3xl font-semibold text-gold">{initials(beat.title)}</div>}<div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,0.66))]" /></div>;
  return <div className={className}>{beat.artworkUrl ? <img src={beat.artworkUrl} alt="" className="h-full w-full object-cover" /> : initials(beat.title)}</div>;
}

function ProgressBar({ active, progress, compact = false }: { active: boolean; progress: number; compact?: boolean }) {
  return <div className={cn("overflow-hidden rounded-full bg-white/10", compact ? "mt-2 h-0.5" : "mt-4 h-1")}><div className="h-full bg-gold transition-[width] duration-200" style={{ width: `${active ? progress : 0}%` }} /></div>;
}

function StoreStat({ value, label }: { value: string; label: string }) {
  return <div><div className="text-lg font-semibold text-gold">{value}</div><div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/42">{label}</div></div>;
}

function SocialLinks({ social }: { social: StorefrontPayload["profile"]["social"] }) {
  const links = [
    { key: "website", label: "Website", icon: Globe2, href: social.website },
    { key: "instagram", label: "Instagram", icon: Instagram, href: social.instagram },
    { key: "youtube", label: "YouTube", icon: Youtube, href: social.youtube },
    { key: "beatstars", label: "BeatStars", icon: ExternalLink, href: social.beatstars },
  ].filter((item) => item.href);
  if (!links.length) return null;
  return <section className="border-t border-white/8 px-5 py-7"><SectionHeading eyebrow="Connect" title="Follow the sound" /><div className="mt-4 grid grid-cols-2 gap-2">{links.map(({ key, label, icon: Icon, href }) => <a key={key} href={href ?? undefined} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white/70"><Icon className="h-4 w-4 text-gold" />{label}</a>)}</div></section>;
}

function DockLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: typeof Home; active?: boolean }) {
  return <a href={href} className={cn("flex flex-col items-center justify-center gap-1 text-[10px]", active ? "text-gold" : "text-white/45")}><Icon className="h-5 w-5" />{label}</a>;
}

function toMarketplaceBeat(beat: StorefrontBeat, verified: boolean): Beat & { previewUrl?: string } {
  const licenses = new Set<License>(["Lease", "Premium Lease", "Exclusive", "Stems + Exclusive"]);
  const prices = beat.licenseTiers
    .filter((tier): tier is { license: License; price: number } => licenses.has(tier.license as License) && Number.isFinite(tier.price))
    .map((tier) => ({ license: tier.license, price: tier.price }));
  const emotionalTags = beat.tags.filter((tag): tag is EmotionalTag => ["Pain", "Victory", "Motivation", "Heartbreak", "Late Night Drive", "Strip Club", "Storytelling", "Hustle", "Love", "Soul", "Street", "Club"].includes(tag));
  return {
    id: beat.marketplaceId,
    title: beat.title,
    producer: beat.producer,
    producerId: beat.producerId,
    verified,
    bpm: beat.bpm,
    key: beat.key,
    mood: beat.mood,
    region: beat.region,
    tags: beat.tags,
    duration: beat.duration,
    art: `url('${marketplaceBeatMediaUrl(beat.id, "artwork")}') center/cover`,
    glyph: initials(beat.title),
    prices,
    plays: 0,
    tag: "PRODUCER",
    boothReadyScore: 0,
    completionRate: 0,
    tracksFinished: 0,
    writingNow: 0,
    emotionalTags,
    previewUrl: marketplaceBeatMediaUrl(beat.id, "audio"),
  };
}

function marketplaceBeatMediaUrl(beatId: string, kind: "audio" | "artwork") {
  return `/api/marketplace/beats/${beatId}/media?kind=${kind}`;
}

function trackStorefrontBeatPlay(beatId: string) {
  void fetch("/api/marketplace/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "beat_play", beat_id: beatId }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "RW";
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}
