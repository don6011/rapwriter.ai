"use client";

import { LockerBeatCard } from "@/components/studio/locker/cards/LockerBeatCard";
import { LockerDnaMetric } from "@/components/studio/locker/cards/LockerDnaMetric";
import { LockerEmpty } from "@/components/studio/locker/cards/LockerEmpty";
import { LockerFilterRow } from "@/components/studio/locker/cards/LockerFilterRow";
import { LockerHookCard } from "@/components/studio/locker/cards/LockerHookCard";
import { LockerLoading } from "@/components/studio/locker/cards/LockerLoading";
import { LockerOwnedCard } from "@/components/studio/locker/cards/LockerOwnedCard";
import { LockerReceiptRow } from "@/components/studio/locker/cards/LockerReceiptRow";
import { LockerSongCard } from "@/components/studio/locker/cards/LockerSongCard";
import { LockerSummaryMetric } from "@/components/studio/locker/cards/LockerSummaryMetric";
import { LockerVocalCard } from "@/components/studio/locker/cards/LockerVocalCard";
import { StarterBeatCard } from "@/components/studio/locker/cards/StarterBeatCard";
import { PrivateBeatImportSheet } from "@/components/studio/sheets/PrivateBeatImportSheet";
import type { BeatLockerRow, CommerceOrderRow, HookLockerRow, PrivateBeatImportInput, RoughTakeRow, SongLockerRow } from "@/hooks/use-rapwriter-data";
import type { StarterBeat } from "@/lib/starter-beats";
import { resolveBeatPreviewUrl } from "@/lib/beat-playback";
import { beatSnapshotFromLockerBeat, beatSnapshotFromStarterBeat, getBeatDurationSeconds } from "@/lib/studio/beat-snapshot";
import { formatShortDate } from "@/lib/studio/format";
import { countTotalBars } from "@/lib/studio/bars";
import { lockerSongBarCount, mostFrequent } from "@/lib/studio/locker-snapshot";
import type { ProductUnlock, StudioPack } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Headphones, Mic2, Pencil, Save, Search, ShoppingCart, Sparkles, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function LockerScreen({
  beats,
  starterBeats,
  songs,
  hooks,
  roughTakes,
  activeSongId,
  activeSectionContent,
  activeCompletionPct,
  activeStudioPack,
  productUnlocks,
  orders,
  loading,
  signedIn,
  error,
  onAuthRequired,
  onResumeSong,
  onPrepareSong,
  onUseHook,
  onUseBeat,
  onUseStarterBeat,
  onImportBeat,
  onRemove,
  onGoToStudio,
  onGoToMarket,
}: {
  beats: BeatLockerRow[];
  starterBeats: StarterBeat[];
  songs: SongLockerRow[];
  hooks: HookLockerRow[];
  roughTakes: RoughTakeRow[];
  activeSongId: string | null;
  activeSectionContent: Record<string, string>;
  activeCompletionPct: number;
  activeStudioPack: StudioPack;
  productUnlocks: ProductUnlock[];
  orders: CommerceOrderRow[];
  loading: boolean;
  signedIn: boolean;
  error: string | null;
  onAuthRequired: () => void;
  onResumeSong: (song: SongLockerRow) => void;
  onPrepareSong: (song: SongLockerRow) => void;
  onUseHook: (hook: HookLockerRow) => void;
  onUseBeat: (beat: BeatLockerRow) => void;
  onUseStarterBeat: (beat: StarterBeat) => void;
  onImportBeat: (input: PrivateBeatImportInput) => Promise<BeatLockerRow | null>;
  onRemove: (kind: "beats" | "songs" | "hooks", id: string) => void;
  onGoToStudio: () => void;
  onGoToMarket: () => void;
}) {
  type LockerTab = "songs" | "hooks" | "beats" | "vocals" | "purchases";
  const [tab, setTab] = useState<LockerTab>("songs");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [songFilter, setSongFilter] = useState<"all" | "draft" | "ready">("all");
  const [beatFilter, setBeatFilter] = useState<"all" | "included" | "private" | "favorite" | "licensed">("all");
  const [starterCollection, setStarterCollection] = useState("all");
  const [creativeDnaOpen, setCreativeDnaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const visibleProductUnlocks = productUnlocks.filter((unlock) => unlock.category !== "Producer Style");
  const purchaseCount = visibleProductUnlocks.length;
  const savedCount = songs.length + hooks.length + beats.length + roughTakes.length;
  const collectionCount = savedCount + starterBeats.length + purchaseCount;
  const boothReadyCount = songs.filter((song) => song.booth_ready).length;
  const totalBarsWritten = songs.reduce((total, song) => total + lockerSongBarCount(song), 0);
  const favoriteProducer = mostFrequent(beats.map((beat) => beat.producer).filter((value): value is string => Boolean(value))) ?? "Not enough saves yet";
  const favoriteMood = mostFrequent(beats.map((beat) => beat.mood).filter((value): value is string => Boolean(value))) ?? "Still taking shape";
  const liveSongState = (song: SongLockerRow) => {
    const live = Boolean(activeSongId && song.song_id === activeSongId);
    return {
      live,
      liveProgress: live ? activeCompletionPct : undefined,
      liveBars: live ? countTotalBars(activeSectionContent) : undefined,
    };
  };
  const takesForSong = (song: SongLockerRow) => song.song_id
    ? roughTakes.filter((take) => take.song_id === song.song_id)
    : [];
  const tabs: Array<{ id: LockerTab; label: string; count: number; icon: typeof Save }> = [
    { id: "songs", label: "Songs", count: songs.length, icon: Save },
    { id: "hooks", label: "Hooks", count: hooks.length, icon: Pencil },
    { id: "beats", label: "Beats", count: beats.length + starterBeats.length, icon: Headphones },
    { id: "vocals", label: "Vocals", count: roughTakes.length, icon: Mic2 },
    { id: "purchases", label: "Owned", count: purchaseCount, icon: ShoppingCart },
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSongs = songs.filter((song) => {
    const matchesQuery = !normalizedQuery || [song.title, song.status, song.created_at, formatShortDate(song.created_at)].join(" ").toLowerCase().includes(normalizedQuery);
    const matchesFilter = Boolean(normalizedQuery) || songFilter === "all" || (songFilter === "ready" ? song.booth_ready : !song.booth_ready);
    return matchesQuery && matchesFilter;
  });
  const visibleHooks = hooks.filter((hook) =>
    !normalizedQuery || [hook.title, hook.content, hook.source_section, hook.created_at, formatShortDate(hook.created_at), ...hook.tags].join(" ").toLowerCase().includes(normalizedQuery),
  );
  const visibleBeats = beats.filter((beat) => {
    const matchesQuery = !normalizedQuery || [beat.title, beat.producer, beat.mood, beat.musical_key, beat.license, beat.created_at, formatShortDate(beat.created_at)].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
    const normalizedLicense = beat.license?.toLowerCase() ?? "";
    const matchesFilter = Boolean(normalizedQuery) || beatFilter === "all"
      || (beatFilter === "favorite" && normalizedLicense === "favorite")
      || (beatFilter === "private" && normalizedLicense === "private import")
      || (beatFilter === "licensed" && normalizedLicense !== "favorite" && normalizedLicense !== "private import");
    return matchesQuery && matchesFilter;
  });
  const visibleStarterBeats = starterBeats.filter((beat) => {
    const matchesQuery = !normalizedQuery || [beat.title, beat.producer, beat.genre, beat.mood, beat.key, beat.collection, ...beat.tags, ...beat.writingFit].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
    const matchesFilter = Boolean(normalizedQuery) || beatFilter === "all" || beatFilter === "included";
    const matchesCollection = Boolean(normalizedQuery) || starterCollection === "all" || beat.collectionSlug === starterCollection;
    return matchesQuery && matchesFilter && matchesCollection;
  });
  const starterCollections = Array.from(new Map(starterBeats.filter((beat) => beat.collectionSlug && beat.collection).map((beat) => [beat.collectionSlug!, beat.collection!])).entries());
  const displayedStarterBeats = !normalizedQuery && beatFilter === "all" ? visibleStarterBeats.slice(0, 4) : visibleStarterBeats;
  const visibleUnlocks = visibleProductUnlocks.filter((unlock) =>
    !normalizedQuery || [unlock.title, unlock.category, unlock.detail].join(" ").toLowerCase().includes(normalizedQuery),
  );
  const songTitleForTake = (take: RoughTakeRow) => songs.find((song) => song.song_id === take.song_id)?.title ?? "Saved session";
  const visibleVocals = roughTakes.filter((take) =>
    !normalizedQuery || [take.section_name, songTitleForTake(take), take.created_at, formatShortDate(take.created_at)].join(" ").toLowerCase().includes(normalizedQuery),
  );
  const globalSearchCount = visibleSongs.length + visibleHooks.length + visibleBeats.length + visibleStarterBeats.length + visibleVocals.length + visibleUnlocks.length;

  const stopPreview = useCallback(() => {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      previewAudioRef.current = null;
    }
    setPreviewingId(null);
    setPreviewProgress(0);
  }, []);

  const togglePreview = useCallback(async (id: string, url: string | null, fallbackDuration: number) => {
    if (previewingId === id) {
      stopPreview();
      return;
    }
    stopPreview();
    setPreviewError(null);
    if (!url) {
      setPreviewError("This audio file is not available yet.");
      return;
    }
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setPreviewingId(id);
    audio.ontimeupdate = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Math.max(1, fallbackDuration);
      setPreviewProgress(Math.min(100, (audio.currentTime / duration) * 100));
    };
    audio.onended = stopPreview;
    audio.onerror = () => {
      stopPreview();
      setPreviewError("This audio could not be played.");
    };
    try {
      await audio.play();
    } catch {
      stopPreview();
      setPreviewError("Tap the preview again to start playback.");
    }
  }, [previewingId, stopPreview]);

  const starterPreviewProps = (beat: StarterBeat) => {
    const id = `starter:${beat.id}`;
    const snapshot = beatSnapshotFromStarterBeat(beat);
    return {
      previewing: previewingId === id,
      previewProgress: previewingId === id ? previewProgress : 0,
      onPreview: () => void togglePreview(id, resolveBeatPreviewUrl(snapshot), getBeatDurationSeconds(snapshot)),
    };
  };

  const beatPreviewProps = (beat: BeatLockerRow) => {
    const id = `beat:${beat.id}`;
    const snapshot = beatSnapshotFromLockerBeat(beat);
    return {
      previewing: previewingId === id,
      previewProgress: previewingId === id ? previewProgress : 0,
      onPreview: () => void togglePreview(id, resolveBeatPreviewUrl(snapshot), getBeatDurationSeconds(snapshot)),
    };
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const storedTab = window.sessionStorage.getItem("rapwriter:locker:tab") as LockerTab | null;
    const storedScroll = Number(window.sessionStorage.getItem("rapwriter:locker:scroll") ?? 0);
    if (storedTab && ["songs", "hooks", "beats", "vocals", "purchases"].includes(storedTab)) setTab(storedTab);
    window.requestAnimationFrame(() => {
      if (scrollContainer && Number.isFinite(storedScroll)) scrollContainer.scrollTop = storedScroll;
    });
    return () => {
      if (scrollContainer) window.sessionStorage.setItem("rapwriter:locker:scroll", String(scrollContainer.scrollTop));
    };
  }, []);

  useEffect(() => {
    stopPreview();
    window.sessionStorage.setItem("rapwriter:locker:tab", tab);
    setQuery("");
    setSearchOpen(false);
  }, [stopPreview, tab]);

  useEffect(() => stopPreview, [stopPreview]);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 pb-32 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label-hw text-gold/85">Locker</div>
          <h1 className="mt-2 text-2xl font-semibold">{signedIn ? "Everything worth keeping." : "Your work belongs here."}</h1>
          <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
            {signedIn ? "Everything you create, collect, and unlock lives here, ready for the next session." : "Sign in to protect every draft, beat, and studio piece across devices."}
          </p>
        </div>
        {signedIn && (
          <button
            type="button"
            onClick={() => setSearchOpen((current) => !current)}
            className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors", searchOpen ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-white/[0.03] text-white/72")}
            aria-label="Search Locker"
            aria-expanded={searchOpen}
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>
      {!signedIn && !loading ? (
        <LockerEmpty title="Studio sync is off." body="Sign in once and your drafts, saved hooks, favorite beats, and owned studio pieces travel with you." actionLabel="Sign in" onAction={onAuthRequired} />
      ) : (
        <>
          <section className="mt-5 border-y border-white/10 py-3" aria-label="Locker snapshot">
            <div className="flex items-center justify-between gap-3">
              <div className="label-hw text-white/48">Locker snapshot</div>
              {error ? (
                <button type="button" onClick={onAuthRequired} className="flex items-center gap-1 text-[11px] font-semibold text-gold">Reconnect Vault <ChevronRight className="h-3.5 w-3.5" /></button>
              ) : (
                <div className="flex items-center gap-2 text-[11px] font-semibold text-white/68"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Protected</div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-white/10">
              <LockerSummaryMetric value={collectionCount} label="Saved items" />
              <LockerSummaryMetric value={boothReadyCount} label="Booth Ready" />
              <LockerSummaryMetric value={beats.length + starterBeats.length} label="Beats" />
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#111113]">
            <button type="button" onClick={() => setCreativeDnaOpen((current) => !current)} className="flex min-h-16 w-full items-center justify-between gap-4 px-4 text-left" aria-expanded={creativeDnaOpen}>
              <span className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8"><Sparkles className="h-4 w-4 text-gold" /></span><span className="min-w-0"><span className="label-hw text-gold/80">Creative DNA</span><span className="mt-1 block truncate text-xs text-muted-foreground">The patterns behind your writing.</span></span></span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", creativeDnaOpen && "rotate-180")} />
            </button>
            {creativeDnaOpen && (
              <div className="grid grid-cols-2 border-t border-white/8">
                <LockerDnaMetric label="Favorite Room" value={activeStudioPack.label} />
                <LockerDnaMetric label="Favorite Producer" value={favoriteProducer} />
                <LockerDnaMetric label="Writing Mood" value={favoriteMood} />
                <LockerDnaMetric label="Bars Written" value={String(totalBarsWritten)} />
              </div>
            )}
          </section>

          <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Locker collections">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={cn("flex min-h-[58px] min-w-[76px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-1 transition-colors", tab === item.id ? "border-gold/40 bg-gold/10 text-gold" : "border-white/8 bg-white/[0.025] text-muted-foreground")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="max-w-full truncate text-[10px] font-semibold">{item.label} <span className="opacity-65">{item.count}</span></span>
                </button>
              );
            })}
          </div>

          {searchOpen && (
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#111113] px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your Creative Vault..."
                className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X className="h-4 w-4 text-muted-foreground" /></button>}
            </label>
          )}

          {!normalizedQuery && tab === "songs" && (
            <LockerFilterRow
              items={[{ id: "all", label: "All" }, { id: "draft", label: "Drafts" }, { id: "ready", label: "Booth Ready" }]}
              active={songFilter}
              onChange={(value) => setSongFilter(value as typeof songFilter)}
            />
          )}
          {!normalizedQuery && tab === "beats" && (
            <LockerFilterRow
              items={[{ id: "all", label: "All" }, { id: "included", label: "Included" }, { id: "private", label: "Yours" }, { id: "favorite", label: "Favorites" }, { id: "licensed", label: "Licensed" }]}
              active={beatFilter}
              onChange={(value) => setBeatFilter(value as typeof beatFilter)}
            />
          )}
          {!normalizedQuery && tab === "beats" && beatFilter === "included" && starterCollections.length > 1 && (
            <LockerFilterRow
              items={[{ id: "all", label: "All collections" }, ...starterCollections.map(([id, label]) => ({ id, label }))]}
              active={starterCollection}
              onChange={setStarterCollection}
            />
          )}

          {loading ? (
            <LockerLoading />
          ) : normalizedQuery ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3"><div className="label-hw text-white/52">Vault Results</div><div className="text-[11px] tabular-nums text-gold">{globalSearchCount}</div></div>
              {visibleSongs.map((song) => <LockerSongCard key={`search-${song.id}`} song={song} takes={takesForSong(song)} {...liveSongState(song)} onResume={() => onResumeSong(song)} onPrepare={() => onPrepareSong(song)} onRemove={() => onRemove("songs", song.id)} />)}
              {visibleHooks.map((hook) => <LockerHookCard key={`search-${hook.id}`} hook={hook} onUse={() => onUseHook(hook)} onRemove={() => onRemove("hooks", hook.id)} />)}
              {visibleStarterBeats.map((beat) => <StarterBeatCard key={`search-starter-${beat.id}`} beat={beat} {...starterPreviewProps(beat)} onUse={() => { stopPreview(); onUseStarterBeat(beat); }} />)}
              {visibleBeats.map((beat) => <LockerBeatCard key={`search-${beat.id}`} beat={beat} {...beatPreviewProps(beat)} onUse={() => { stopPreview(); onUseBeat(beat); }} onRemove={() => onRemove("beats", beat.id)} />)}
              {visibleVocals.map((take) => {
                const previewId = `vocal:${take.id}`;
                return <LockerVocalCard key={`search-vocal-${take.id}`} take={take} songTitle={songTitleForTake(take)} previewing={previewingId === previewId} previewProgress={previewingId === previewId ? previewProgress : 0} onPreview={() => void togglePreview(previewId, take.signed_url, take.duration_seconds)} />;
              })}
              {visibleUnlocks.map((unlock) => <LockerOwnedCard key={`search-${unlock.id}`} unlock={unlock} />)}
              {globalSearchCount === 0 && <LockerEmpty title="Nothing in your Vault matches." body="Try a title, producer, mood, room, license, or saved date." />}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {tab === "beats" && (
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <div><div className="label-hw text-white/48">Beat Locker</div><div className="mt-1 text-[10px] text-muted-foreground">Private files stay yours.</div></div>
                  <button type="button" onClick={() => setImportOpen(true)} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-gold/30 bg-gold/8 px-3 text-xs font-semibold text-gold">
                    <Upload className="h-3.5 w-3.5" />Import beat
                  </button>
                </div>
              )}
              {tab === "songs" && visibleSongs.map((song) => <LockerSongCard key={song.id} song={song} takes={takesForSong(song)} {...liveSongState(song)} onResume={() => onResumeSong(song)} onPrepare={() => onPrepareSong(song)} onRemove={() => onRemove("songs", song.id)} />)}
              {tab === "songs" && visibleSongs.length === 0 && <LockerEmpty title={normalizedQuery ? "No songs match." : "No saved songs yet."} body="Save a song from the writing pad and it will be ready to resume here." actionLabel="Open Studio" onAction={onGoToStudio} />}

              {tab === "hooks" && visibleHooks.map((hook) => <LockerHookCard key={hook.id} hook={hook} onUse={() => onUseHook(hook)} onRemove={() => onRemove("hooks", hook.id)} />)}
              {tab === "hooks" && visibleHooks.length === 0 && <LockerEmpty title={normalizedQuery ? "No hooks match." : "No hooks saved yet."} body="Capture the lines worth returning to, then reuse them in any session." actionLabel="Write a Hook" onAction={onGoToStudio} />}

              {tab === "beats" && visibleStarterBeats.length > 0 && <div className="flex items-center justify-between gap-3 px-1"><div className="label-hw text-gold/75">Included with RapWriter</div><div className="text-[10px] text-muted-foreground">Full session use</div></div>}
              {tab === "beats" && displayedStarterBeats.map((beat) => <StarterBeatCard key={beat.id} beat={beat} {...starterPreviewProps(beat)} onUse={() => { stopPreview(); onUseStarterBeat(beat); }} />)}
              {tab === "beats" && beatFilter === "all" && visibleStarterBeats.length > displayedStarterBeats.length && (
                <button type="button" onClick={() => setBeatFilter("included")} className="min-h-11 w-full rounded-xl border border-gold/25 bg-gold/8 text-xs font-semibold text-gold">
                  See all {visibleStarterBeats.length} included beats
                </button>
              )}
              {tab === "beats" && visibleBeats.length > 0 && visibleStarterBeats.length > 0 && <div className="px-1 pt-2 label-hw text-white/45">Saved and licensed</div>}
              {tab === "beats" && visibleBeats.map((beat) => <LockerBeatCard key={beat.id} beat={beat} {...beatPreviewProps(beat)} onUse={() => { stopPreview(); onUseBeat(beat); }} onRemove={() => onRemove("beats", beat.id)} />)}
              {tab === "beats" && visibleBeats.length === 0 && visibleStarterBeats.length === 0 && <LockerEmpty title={normalizedQuery ? "No beats match." : "No beats saved yet."} body="Favorite a beat in Studio Store and keep the pocket close." actionLabel="Browse Beats" onAction={onGoToMarket} />}

              {tab === "vocals" && visibleVocals.map((take) => {
                const previewId = `vocal:${take.id}`;
                return <LockerVocalCard key={take.id} take={take} songTitle={songTitleForTake(take)} previewing={previewingId === previewId} previewProgress={previewingId === previewId ? previewProgress : 0} onPreview={() => void togglePreview(previewId, take.signed_url, take.duration_seconds)} />;
              })}
              {tab === "vocals" && visibleVocals.length === 0 && <LockerEmpty title="No saved vocals yet." body="Choose Vocals only on the writing pad, record a take, and keep it here for playback." actionLabel="Open Studio" onAction={onGoToStudio} />}

              {tab === "purchases" && (
                  <>
                    {visibleUnlocks.map((unlock) => <LockerOwnedCard key={unlock.id} unlock={unlock} />)}
                  {visibleUnlocks.length === 0 && normalizedQuery && <LockerEmpty title="No owned items match." body="Try another search or browse the full studio collection." actionLabel="Explore Market" onAction={onGoToMarket} />}
                    {visibleProductUnlocks.length === 0 && !normalizedQuery && <LockerEmpty title="No owned studio assets yet." body="Rooms and creative assets you purchase from Studio Store will live here permanently." actionLabel="Explore Market" onAction={onGoToMarket} />}
                    {orders.length > 0 && (
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <div className="label-hw mb-2 text-gold/80">Receipts</div>
                        <div className="space-y-2">
                          {orders.slice(0, 8).map((order) => <LockerReceiptRow key={order.id} order={order} />)}
                        </div>
                      </div>
                    )}
                  </>
                )}
            </div>
          )}
          {previewError && <div className="mt-3 rounded-xl border border-rec/25 bg-rec/10 p-3 text-xs text-rec">{previewError}</div>}
          <PrivateBeatImportSheet open={importOpen} onClose={() => setImportOpen(false)} onImport={onImportBeat} />
        </>
      )}
    </div>
  );
}
