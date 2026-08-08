"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Award,
  Briefcase,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CloudOff,
  Crown,
  Download,
  FolderPlus,
  Heart,
  Headphones,
  History,
  LifeBuoy,
  LockKeyhole,
  Mic,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { MembershipCard } from "@/components/MembershipCard";
import { PremiumMarketplace, type MarketCategory } from "@/components/PremiumMarketplace";
import {
  analyzeLyrics,
  analyzeRoughTakeAudio,
  type RoughTakeAnalysis,
} from "@/lib/booth-ready-v2";
import {
  type ProducerActionProposal,
  type ProducerActionType,
} from "@/lib/producer-actions";
import {
  accountTypeLabel,
  hasArtistWorkspace,
  hasProducerWorkspace,
  type OnboardingAccountType,
} from "@/lib/account-role";
import {
  useRapWriterData,
  isSessionConflictError,
  type BeatLockerRow,
  type BoothExportCreateInput,
  type CommerceOrderRow,
  type HookLockerRow,
  type ProfileRow,
  type PrivateBeatImportInput,
  type ProjectRow,
  type RoughTakeRow,
  type SongRow,
  type SongLockerRow,
  type SessionRow,
} from "@/hooks/use-rapwriter-data";
import type { BoothExportRecord } from "@/lib/booth-export";
import {
  MEMBERSHIP_ACCESS_EVENT,
  membershipAccessCopy,
  notifyMembershipAccess,
  type MembershipAccessNotice,
} from "@/lib/client/membership-access";
import { consumePendingBeat, type Beat } from "@/lib/marketplace";
import { clampBeatSeekTime, resolveBeatPreviewUrl } from "@/lib/beat-playback";
import { studioRoomProducts } from "@/lib/product-catalog";
import type { StarterBeat } from "@/lib/starter-beats";
import type { MembershipSnapshot, WorkspaceMembership } from "@/lib/membership";
import {
  defaultStudioRoomId,
  resolveStudioRoomAccess,
  type StudioRoomAccess,
} from "@/lib/studio-room-access";
import { cn } from "@/lib/utils";
import { createAmbientBuffer } from "@/lib/studio/ambient-audio";
import { blankSections, countBars, countTotalBars, sectionKeyFromTitle } from "@/lib/studio/bars";
import {
  beatSnapshotFromLockerBeat,
  beatSnapshotFromRecord,
  beatSnapshotFromSong,
  beatSnapshotFromStarterBeat,
  EMPTY_BEAT,
  getBeatDurationSeconds,
  getStudioRoomProductId,
  lockerSnapshotBeat,
  toBeatSnapshot,
} from "@/lib/studio/beat-snapshot";
import {
  boothReadyFromLockerSnapshot,
  getSongState,
  isRoughTakeAnalysis,
  scoreBoothReady,
} from "@/lib/studio/booth-ready";
import {
  MOBILE_STUDIO_DNA_KEY,
  MOBILE_STUDIO_PACK_KEY,
  normalizeStudioDna,
  readMobileDraftRecord,
  writeMobileDraftRecord,
} from "@/lib/studio/draft-storage";
import { buildBoothExportSnapshot } from "@/lib/studio/export-snapshot";
import {
  artistDisplayName,
  formatDuration,
  formatShortDate,
  getProjectTitle,
  hasAllAccessMembership,
  productUnlockFromEntitlement,
} from "@/lib/studio/format";
import {
  buildBeatIntelligence,
  buildEnvironmentIntelligence,
  getWritingMomentum,
  studioDnaCue,
} from "@/lib/studio/intelligence";
import {
  lockerSnapshotNumber,
  lockerSongBarCount,
  lockerSongProgress,
  mostFrequent,
  sectionsFromLockerSnapshot,
} from "@/lib/studio/locker-snapshot";
import { trackMarketplaceEvent } from "@/lib/studio/telemetry";
import { getStudioPack, studioPacks } from "@/lib/studio/packs";
import { blankStarterLyrics, mobileSections } from "@/lib/studio/sections";
import { defaultStudioDna } from "@/lib/studio/dna";
import type {
  ArtistGoal,
  BeatIntelligence,
  BoothReadyResult,
  EnvironmentIntelligence,
  MarketplaceFeed,
  MobileDraftRecord,
  MobileNavView,
  PadActionStatus,
  PadActions,
  ProducerActionControls,
  ProducerActionStatus,
  ProductUnlock,
  SectionVersion,
  SelectedBeat,
  StudioDna,
  StudioPack,
  StudioPackId,
  VersionHistoryStatus,
} from "@/lib/studio/types";
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
import { StarterBeatCard } from "@/components/studio/locker/cards/StarterBeatCard";
import { BoothReadyPanel } from "@/components/studio/panels/BoothReadyPanel";
import { ImmersiveEnvironmentEffects } from "@/components/studio/panels/ImmersiveEnvironmentEffects";
import { MobileProjectRail } from "@/components/studio/panels/MobileProjectRail";
import { MobileSectionTabs } from "@/components/studio/panels/MobileSectionTabs";
import { PadTransport } from "@/components/studio/panels/PadTransport";
import { PenView } from "@/components/studio/panels/PenView";
import { ProducerPassPanel } from "@/components/studio/panels/ProducerPassPanel";
import { StudioAccessHub } from "@/components/studio/panels/StudioAccessHub";
import { MobileBottomNav } from "@/components/studio/primitives/MobileBottomNav";
import { MobileDrawer } from "@/components/studio/primitives/MobileDrawer";
import { MobileHeader } from "@/components/studio/primitives/MobileHeader";
import { MobileProfileRow } from "@/components/studio/primitives/MobileProfileRow";
import { ProfileSignal } from "@/components/studio/primitives/ProfileSignal";
import { TakeWaveform } from "@/components/studio/waveform/TakeWaveform";
import { BeatSwitcherSheet } from "@/components/studio/sheets/BeatSwitcherSheet";
import { BoothExportSheet } from "@/components/studio/sheets/BoothExportSheet";
import { GhostwriterSheet } from "@/components/studio/sheets/GhostwriterSheet";
import { MobileAuthDrawer } from "@/components/studio/sheets/MobileAuthDrawer";
import { useAuthDrawer } from "@/components/studio/state/use-auth-drawer";
import { NewSongSheet } from "@/components/studio/sheets/NewSongSheet";
import { PrivateBeatImportSheet } from "@/components/studio/sheets/PrivateBeatImportSheet";
import { StudioAirSheet } from "@/components/studio/sheets/StudioAirSheet";
import { StudioDnaSheet } from "@/components/studio/sheets/StudioDnaSheet";
import { StudioPackSheet } from "@/components/studio/sheets/StudioPackSheet";
import { VersionHistorySheet } from "@/components/studio/sheets/VersionHistorySheet";

export function MobileStudioShell() {
  const workspace = useRapWriterData();
  const {
    activeSong,
    activateFirstSession,
    addBeatLicense,
    beatLocker,
    createSong,
    createBoothExport,
    ensureWorkspace,
    error: workspaceError,
    hookLocker,
    importPrivateBeat,
    loadLatestRoughTake,
    loading,
    loadingData,
    lockerCounts,
    membership,
    profile,
    productEntitlements,
    commerceOrders,
    projects,
    roughTake,
    roughTakes,
    removeLockerItem,
    saveHook,
    saveNow,
    saveSongToLocker,
    session,
    signOut,
    roles,
    emailVerified,
    songs,
    songLocker,
    updateSong,
    updateAccountRole,
    updateProfileAvatar,
    updateProfileIdentity,
    unlockProductEntitlement,
    uploadRoughTake,
    user,
  } = workspace;
  const { requestAuth, drawerProps: authDrawerProps } = useAuthDrawer(workspace);
  const [screen, setScreen] = useState<"home" | "writer">("home");
  const [activeNav, setActiveNav] = useState<MobileNavView>("studio");
  const [studioAccessOpen, setStudioAccessOpen] = useState(false);
  const [readinessLaunchToken, setReadinessLaunchToken] = useState(0);
  const [marketFocusCategory, setMarketFocusCategory] = useState<MarketCategory | null>(null);
  const [activeStudioPackId, setActiveStudioPackId] = useState<StudioPackId>(defaultStudioRoomId);
  const [playing, setPlaying] = useState(false);
  const [beatCurrentTime, setBeatCurrentTime] = useState(0);
  const [beatDuration, setBeatDuration] = useState(getBeatDurationSeconds(EMPTY_BEAT));
  const [beatError, setBeatError] = useState<string | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<SelectedBeat>(EMPTY_BEAT);
  const [recording, setRecording] = useState(false);
  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [roughTakeUrl, setRoughTakeUrl] = useState<string | null>(null);
  const [roughTakeBlob, setRoughTakeBlob] = useState<Blob | null>(null);
  const [roughTakeDuration, setRoughTakeDuration] = useState(0);
  const [roughTakeBeat, setRoughTakeBeat] = useState<SelectedBeat | null>(null);
  const [roughTakeBeatPosition, setRoughTakeBeatPosition] = useState(0);
  const [roughTakeSaved, setRoughTakeSaved] = useState(false);
  const [roughTakeSaving, setRoughTakeSaving] = useState(false);
  const [roughTakeAnalyzing, setRoughTakeAnalyzing] = useState(false);
  const [roughTakeAnalysis, setRoughTakeAnalysis] = useState<RoughTakeAnalysis | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [sectionContent, setSectionContent] = useState<Record<string, string>>(blankStarterLyrics);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [padActionStatus, setPadActionStatus] = useState<PadActionStatus>({ state: "idle", message: "" });
  const [songSwitchStatus, setSongSwitchStatus] = useState<PadActionStatus>({ state: "idle", message: "" });
  const [titleDraft, setTitleDraft] = useState("Untitled Song");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleStatus, setTitleStatus] = useState<PadActionStatus>({ state: "idle", message: "" });
  const [newSongOpen, setNewSongOpen] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongStartSection, setNewSongStartSection] = useState("Hook");
  const [newSongUseBeat, setNewSongUseBeat] = useState(true);
  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [syncRetryNonce, setSyncRetryNonce] = useState(0);
  const [syncMessage, setSyncMessage] = useState("Saved on device");
  const [productUnlocks, setProductUnlocks] = useState<ProductUnlock[]>([]);
  const [marketplaceFeed, setMarketplaceFeed] = useState<MarketplaceFeed>({ beats: [], producers: [] });
  const [marketplaceFeedLoading, setMarketplaceFeedLoading] = useState(true);
  const [marketplaceFeedError, setMarketplaceFeedError] = useState<string | null>(null);
  const [starterBeats, setStarterBeats] = useState<StarterBeat[]>([]);
  const [starterBeatsLoading, setStarterBeatsLoading] = useState(true);
  const [starterBeatsError, setStarterBeatsError] = useState<string | null>(null);
  const [beatSwitcherOpen, setBeatSwitcherOpen] = useState(false);
  const [boothExportOpen, setBoothExportOpen] = useState(false);
  const [boothExportDraft, setBoothExportDraft] = useState<BoothExportCreateInput | null>(null);
  const [boothExportRecord, setBoothExportRecord] = useState<BoothExportRecord | null>(null);
  const [boothExportStatus, setBoothExportStatus] = useState<"idle" | "saving" | "error">("idle");
  const [boothExportError, setBoothExportError] = useState<string | null>(null);
  const [studioDna, setStudioDna] = useState<StudioDna>(defaultStudioDna);
  const [studioAirPlaying, setStudioAirPlaying] = useState(false);
  const [studioDnaOpen, setStudioDnaOpen] = useState(false);
  const [producerActionProposal, setProducerActionProposal] = useState<ProducerActionProposal | null>(null);
  const [producerActionStatus, setProducerActionStatus] = useState<ProducerActionStatus>("idle");
  const [producerActionError, setProducerActionError] = useState<string | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [sectionVersions, setSectionVersions] = useState<SectionVersion[]>([]);
  const [versionHistoryStatus, setVersionHistoryStatus] = useState<VersionHistoryStatus>("idle");
  const [versionHistoryError, setVersionHistoryError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<BlobPart[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const roughTakeAnalysisRunRef = useRef(0);
  const roughTakeUrlRef = useRef<string | null>(null);
  const recordBeatRef = useRef<SelectedBeat | null>(null);
  const recordBeatPositionRef = useRef(0);
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const beatStartedAtRef = useRef<number | null>(null);
  const beatOffsetRef = useRef(0);
  const beatTimerRef = useRef<number | null>(null);
  const beatCurrentTimeRef = useRef(0);
  const beatDurationRef = useRef(getBeatDurationSeconds(EMPTY_BEAT));
  const studioAirEngineRef = useRef<{ context: AudioContext; source: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const pendingBeatHandledRef = useRef(false);
  const activePreviewBeatIdRef = useRef<string | null>(null);
  const skipNextBeatResetRef = useRef(false);
  const localDraftRef = useRef<MobileDraftRecord | null>(null);
  const skipNextDraftWriteRef = useRef(false);
  const retryUrgentRef = useRef(false);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const conflictBlockedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const activeSongIdRef = useRef<string | null>(null);
  const section = mobileSections[activeSection];
  const activeStudioPack = getStudioPack(activeStudioPackId);
  const activeProjectId = session?.project_id ?? activeSong?.project_id ?? projects[0]?.id;
  const activeSongId = session?.song_id ?? activeSong?.id;
  activeProjectIdRef.current = activeProjectId ?? null;
  activeSongIdRef.current = activeSongId ?? null;
  const entitlementUnlocks = useMemo(() => productEntitlements.map(productUnlockFromEntitlement), [productEntitlements]);
  const mergedProductUnlocks = useMemo(() => {
    const seen = new Set<string>();
    return [...entitlementUnlocks, ...productUnlocks].filter((unlock) => {
      if (seen.has(unlock.id)) return false;
      seen.add(unlock.id);
      return true;
    });
  }, [entitlementUnlocks, productUnlocks]);
  const unlockedProductIds = useMemo(() => new Set(mergedProductUnlocks.map((unlock) => unlock.id)), [mergedProductUnlocks]);

  useEffect(() => {
    const handleMembershipAccess = (event: Event) => {
      const notice = (event as CustomEvent<MembershipAccessNotice>).detail;
      if (!notice) return;
      setBeatSwitcherOpen(false);
      setSyncMessage(membershipAccessCopy(notice));
      setStudioAccessOpen(true);
    };
    window.addEventListener(MEMBERSHIP_ACCESS_EVENT, handleMembershipAccess);
    return () => window.removeEventListener(MEMBERSHIP_ACCESS_EVENT, handleMembershipAccess);
  }, []);

  useEffect(() => {
    const artist = membership?.artist;
    const producer = membership?.producer;
    if (!user || !artist || artist.plan.tier <= 0) return;
    const accessIdentity = `${artist.plan.id}:${producer?.plan.id ?? "none"}`;
    const storageKey = `rapwriter:membership-announced:${user.id}`;
    if (window.localStorage.getItem(storageKey) === accessIdentity) return;
    window.localStorage.setItem(storageKey, accessIdentity);
    setStudioAccessOpen(true);
  }, [membership?.artist, membership?.producer, user]);

  const getStudioPackAccess = useCallback((id: StudioPackId) => {
    const accessPlanId = hasAllAccessMembership(membership)
      ? "creator_all_access"
      : membership?.artist?.plan.id;
    return resolveStudioRoomAccess(
      id,
      accessPlanId,
      unlockedProductIds.has(getStudioRoomProductId(id)),
    );
  }, [membership, unlockedProductIds]);

  const canUseStudioPack = useCallback((id: StudioPackId) => {
    return getStudioPackAccess(id).available;
  }, [getStudioPackAccess]);

  const buildDraftRecord = useCallback((unsynced: boolean, savedSession?: SessionRow | null): MobileDraftRecord => {
    const previous = localDraftRef.current;
    const now = new Date().toISOString();
    return {
      version: 3,
      ownerId: userIdRef.current ?? previous?.ownerId ?? null,
      updatedAt: unsynced ? now : previous?.updatedAt ?? now,
      syncedAt: unsynced ? previous?.syncedAt ?? null : now,
      unsynced,
      projectId: savedSession?.project_id ?? activeProjectIdRef.current ?? previous?.projectId ?? null,
      songId: savedSession?.song_id ?? activeSongIdRef.current ?? previous?.songId ?? null,
      sessionId: savedSession?.id ?? previous?.sessionId ?? null,
      baseRevision: savedSession?.revision ?? previous?.baseRevision ?? null,
      sections: { ...blankSections(), ...sectionContent },
      activeSection: section.name,
      beat: { ...selectedBeat },
      studioPackId: activeStudioPack.id,
      studioDna: { ...studioDna, environment: activeStudioPack.id },
      playbackPositionSeconds: Math.max(0, beatCurrentTimeRef.current),
    };
  }, [activeStudioPack.id, section.name, sectionContent, selectedBeat, studioDna]);

  const queueUrgentSessionSync = useCallback(() => {
    if (!draftLoaded || conflictBlockedRef.current) return;
    const draft = buildDraftRecord(true);
    localDraftRef.current = draft;
    writeMobileDraftRecord(draft);
    if (!user) {
      setSaveStatus("saved");
      setSyncMessage("Saved on device");
      return;
    }
    retryUrgentRef.current = true;
    setSyncRetryNonce((value) => value + 1);
  }, [buildDraftRecord, draftLoaded, user]);

  const stopStudioAir = useCallback(() => {
    const engine = studioAirEngineRef.current;
    studioAirEngineRef.current = null;
    if (engine) {
      try {
        engine.source.stop();
      } catch {
        // The ambient loop may already be stopped during navigation or a room change.
      }
      void engine.context.close();
    }
    setStudioAirPlaying(false);
  }, []);

  const toggleStudioAir = useCallback((index: number) => {
    const safeIndex = Math.max(0, Math.min(activeStudioPack.ambience.length - 1, index));
    if (studioAirPlaying && studioDna.studioAir.activeIndex === safeIndex) {
      stopStudioAir();
      return;
    }

    stopStudioAir();
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setSyncMessage("Studio Air is unavailable in this browser");
      return;
    }

    const context = new AudioContextClass();
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const ambience = activeStudioPack.ambience[safeIndex] ?? activeStudioPack.ambience[0];
    source.buffer = createAmbientBuffer(context, `${activeStudioPack.id}-${ambience.title}`);
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = ambience.title.toLowerCase().includes("rain") ? 5200 : 2400;
    gain.gain.value = studioDna.studioAir.volume / 100;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    studioAirEngineRef.current = { context, source, gain };
    setStudioDna((current) => ({
      ...current,
      studioAir: { ...current.studioAir, activeIndex: safeIndex },
    }));
    setStudioAirPlaying(true);
    setSyncMessage(`${ambience.title} playing`);
  }, [activeStudioPack, stopStudioAir, studioAirPlaying, studioDna.studioAir.activeIndex, studioDna.studioAir.volume]);

  const changeStudioAirVolume = useCallback((volume: number) => {
    const safeVolume = Math.max(4, Math.min(32, volume));
    setStudioDna((current) => ({
      ...current,
      studioAir: { ...current.studioAir, volume: safeVolume },
    }));
    const engine = studioAirEngineRef.current;
    if (engine) engine.gain.gain.setTargetAtTime(safeVolume / 100, engine.context.currentTime, 0.08);
  }, []);

  const selectBeatForSession = useCallback((beat: SelectedBeat) => {
    const draft = {
      ...buildDraftRecord(true),
      beat: { ...beat },
      playbackPositionSeconds: 0,
    };

    localDraftRef.current = draft;
    writeMobileDraftRecord(draft);
    setSelectedBeat(beat);
    setSaveStatus(user ? "saving" : "saved");

    if (!user) return;
    retryUrgentRef.current = true;
    setSyncRetryNonce((value) => value + 1);
  }, [buildDraftRecord, user]);

  useEffect(() => {
    beatCurrentTimeRef.current = beatCurrentTime;
  }, [beatCurrentTime]);

  useEffect(() => {
    beatDurationRef.current = beatDuration;
  }, [beatDuration]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeNav, screen]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(MOBILE_STUDIO_PACK_KEY);
    if (stored) setActiveStudioPackId(getStudioPack(stored).id);
  }, []);

  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (!checkout) return;
    setPadActionStatus({
      state: checkout === "success" ? "saved" : "error",
      message: checkout === "success" ? "Purchase complete. Your studio access is syncing." : "Checkout cancelled. Nothing was charged.",
    });
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMarketplaceFeedLoading(true);
    setMarketplaceFeedError(null);
    void fetch("/api/marketplace/beats")
      .then(async (res) => {
        if (!res.ok) throw new Error("Producer feed is unavailable.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMarketplaceFeed({
          beats: Array.isArray(data.beats) ? data.beats : [],
          producers: Array.isArray(data.producers) ? data.producers : [],
        });
        setMarketplaceFeedLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMarketplaceFeed({ beats: [], producers: [] });
          setMarketplaceFeedLoading(false);
          setMarketplaceFeedError("Producer drops will appear when the live feed reconnects.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStarterBeatsLoading(true);
    setStarterBeatsError(null);
    void fetch("/api/starter-beats")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Starter Beats are unavailable.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setStarterBeats(Array.isArray(data.beats) ? data.beats : []);
        setStarterBeatsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setStarterBeats([]);
        setStarterBeatsLoading(false);
        setStarterBeatsError(error instanceof Error ? error.message : "Starter Beats are unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MOBILE_STUDIO_DNA_KEY);
      if (raw) {
        const next = normalizeStudioDna(JSON.parse(raw), defaultStudioRoomId);
        setStudioDna(next);
        setActiveStudioPackId(next.environment);
      }
    } catch {
      // Studio DNA can always be rebuilt from the default session.
    }
  }, []);

  function changeStudioPack(id: StudioPackId) {
    if (!canUseStudioPack(id)) {
      setSyncMessage(`${getStudioPack(id).label} is locked. Preview it in Studio Store first.`);
      setActiveNav("market");
      return;
    }
    stopStudioAir();
    setActiveStudioPackId(id);
    setStudioDna((current) => ({ ...current, environment: id }));
    window.localStorage.setItem(MOBILE_STUDIO_PACK_KEY, id);
    setSyncMessage("Room changed");
  }

  function previewStudioPack(id: StudioPackId) {
    if (process.env.NODE_ENV === "production") return;
    stopStudioAir();
    setActiveStudioPackId(id);
    setStudioDna((current) => ({ ...current, environment: id }));
    setSyncMessage(`${getStudioPack(id).label} preview active - access remains locked`);
  }

  function updateStudioDna(patch: Partial<StudioDna>) {
    setStudioDna((current) => {
      const next = { ...current, ...patch };
      if (patch.environment) {
        if (!canUseStudioPack(patch.environment)) {
          setSyncMessage(`${getStudioPack(patch.environment).label} is locked. Preview it in Studio Store first.`);
          setActiveNav("market");
          return current;
        }
        setActiveStudioPackId(patch.environment);
        window.localStorage.setItem(MOBILE_STUDIO_PACK_KEY, patch.environment);
      }
      return next;
    });
  }

  function startStudioDnaSession() {
    const normalized = { ...studioDna, environment: getStudioPack(studioDna.environment).id };
    if (!canUseStudioPack(normalized.environment)) {
      setSyncMessage(`${getStudioPack(normalized.environment).label} is locked. Preview it in Studio Store first.`);
      setActiveNav("market");
      setStudioDnaOpen(false);
      return;
    }
    setStudioDna(normalized);
    setActiveStudioPackId(normalized.environment);
    window.localStorage.setItem(MOBILE_STUDIO_PACK_KEY, normalized.environment);
    window.localStorage.setItem(MOBILE_STUDIO_DNA_KEY, JSON.stringify(normalized));
    setStudioDnaOpen(false);
    setScreen("writer");
    setSyncMessage("Studio DNA loaded");
  }

  function continueWriterFlow(playBeat = false) {
    const hasSavedStudioDna = Boolean(window.localStorage.getItem(MOBILE_STUDIO_DNA_KEY));
    if (!hasSavedStudioDna) {
      setStudioDnaOpen(true);
      return;
    }
    setScreen("writer");
    if (playBeat && !playing && selectedBeat.id !== EMPTY_BEAT.id && resolveBeatPreviewUrl(selectedBeat)) {
      toggleBeatPlayback();
    }
  }

  function saveSessionProductUnlock(product: Omit<ProductUnlock, "unlockedAt">) {
    setProductUnlocks((current) => {
      if (current.some((item) => item.id === product.id)) return current;
      return [{ ...product, unlockedAt: new Date().toISOString() }, ...current];
    });
  }

  function unlockProduct(product: Omit<ProductUnlock, "unlockedAt">) {
    if (!user) {
      requestAuth("Sign in to sync this purchase across devices.");
      setPadActionStatus({ state: "error", message: `${product.title} needs checkout before it unlocks.` });
      return;
    }

    if (product.price === "$0") {
      setPadActionStatus({ state: "saving", message: `Saving ${product.title}...` });
      void unlockProductEntitlement(product.id)
        .then(() => {
          saveSessionProductUnlock(product);
          setPadActionStatus({ state: "saved", message: `${product.title} saved.` });
        })
        .catch((err) => {
          setPadActionStatus({ state: "error", message: err instanceof Error ? err.message : "Could not save this producer." });
        });
      return;
    }

    setPadActionStatus({ state: "saving", message: `Opening secure checkout for ${product.title}...` });
    void fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Checkout could not be started.");
        if (!data.checkout_url) throw new Error("Stripe did not return a checkout link.");
        window.location.assign(data.checkout_url);
      })
      .catch((err) => {
        setPadActionStatus({ state: "error", message: err instanceof Error ? err.message : "Checkout could not be started." });
      });
  }

  function unlockStudioPack(id: StudioPackId) {
    const product = studioRoomProducts.find((item) => item.id === getStudioRoomProductId(id));
    if (!product) {
      setPadActionStatus({ state: "error", message: "This room is not available for purchase yet." });
      return;
    }
    unlockProduct({
      id: product.id,
      title: product.title,
      category: "Studio Room",
      detail: product.detail,
      price: product.price,
    });
  }

  function licenseBeat(beat: Beat) {
    if (!user) {
      requestAuth("Sign in to license this beat and keep it in your Locker.");
      return;
    }

    const tier = beat.prices[0];
    if (!tier) {
      setPadActionStatus({ state: "error", message: "No license is available for this beat." });
      return;
    }

    setPadActionStatus({ state: "saving", message: `Opening secure checkout for ${beat.title}...` });
    void fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beat_id: beat.id, license: tier.license }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Checkout could not be started.");
        if (!data.checkout_url) throw new Error("Stripe did not return a checkout link.");
        window.location.assign(data.checkout_url);
      })
      .catch((err) => {
        setPadActionStatus({ state: "error", message: err instanceof Error ? err.message : "Checkout could not be started." });
      });
  }

  const stopBeatPreview = useCallback(({ reset = false }: { reset?: boolean } = {}) => {
    if (beatTimerRef.current) window.clearInterval(beatTimerRef.current);
    beatTimerRef.current = null;
    activePreviewBeatIdRef.current = null;
    const elapsed = beatStartedAtRef.current ? (performance.now() - beatStartedAtRef.current) / 1000 : 0;
    const audioTime = beatAudioRef.current?.currentTime;
    const duration = beatDurationRef.current;
    beatOffsetRef.current = reset
      ? 0
      : typeof audioTime === "number" && Number.isFinite(audioTime)
        ? Math.min(duration, audioTime)
        : Math.min(duration, beatOffsetRef.current + elapsed);
    beatStartedAtRef.current = null;

    if (beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current = null;
    }
    setPlaying(false);
    if (reset) setBeatCurrentTime(0);
  }, []);

  async function startBeatPreview(beat: SelectedBeat = selectedBeat) {
    activePreviewBeatIdRef.current = beat.id;
    const duration = getBeatDurationSeconds(beat);
    setBeatDuration(duration);
    setBeatError(null);

    const previewUrl = resolveBeatPreviewUrl(beat);
    if (previewUrl) {
      const audio = new Audio(previewUrl);
      audio.preload = "metadata";
      beatAudioRef.current = audio;
      audio.ontimeupdate = () => setBeatCurrentTime(audio.currentTime);
      audio.onended = () => stopBeatPreview({ reset: true });

      await new Promise<void>((resolve, reject) => {
        const handleLoadedMetadata = () => resolve();
        const handleError = () => reject(new Error("Beat preview could not load."));

        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
          return;
        }

        audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
        audio.addEventListener("error", handleError, { once: true });
        audio.load();
      });

      if (beatAudioRef.current !== audio) return;

      const mediaDuration = Number.isFinite(audio.duration) ? audio.duration : duration;
      const resumeAt = clampBeatSeekTime(beatOffsetRef.current, mediaDuration);
      setBeatDuration(mediaDuration);
      audio.currentTime = resumeAt;
      setBeatCurrentTime(resumeAt);
      await audio.play();
      trackMarketplaceEvent("beat_play", beat.id);
      setPlaying(true);
      return;
    }

    activePreviewBeatIdRef.current = null;
    setBeatError(beat.id === EMPTY_BEAT.id ? "Choose an approved beat from Studio Store." : "This beat has no playable preview.");
  }

  const toggleBeatPlayback = () => {
    if (playing) {
      stopBeatPreview();
      queueUrgentSessionSync();
      return;
    }
    void startBeatPreview().catch(() => {
      setBeatError("Could not start beat preview.");
      stopBeatPreview();
    });
  };

  const seekBeatPlayback = useCallback((requestedTime: number) => {
    const audio = beatAudioRef.current;
    const audioDuration = audio && Number.isFinite(audio.duration) ? audio.duration : 0;
    const duration = Math.max(audioDuration, beatDurationRef.current, 0);
    const nextTime = clampBeatSeekTime(requestedTime, duration);

    beatOffsetRef.current = nextTime;
    beatCurrentTimeRef.current = nextTime;
    if (audio) audio.currentTime = nextTime;
    setBeatCurrentTime(nextTime);
    setBeatError(null);
  }, []);

  const previewMarketplaceBeat = (beat: Beat) => {
    const snapshot = toBeatSnapshot(beat);
    if (selectedBeat.id === snapshot.id) {
      toggleBeatPlayback();
      return;
    }

    stopBeatPreview({ reset: true });
    beatOffsetRef.current = 0;
    setSelectedBeat(snapshot);
    void startBeatPreview(snapshot).catch(() => {
      setBeatError("Could not start beat preview.");
      stopBeatPreview({ reset: true });
    });
  };

  useEffect(() => {
    if (!titleEditing) setTitleDraft(activeSong?.title ?? "Untitled Song");
  }, [activeSong?.title, titleEditing]);

  useEffect(() => {
    // `params` is read once, before either branch calls replaceState, so both
    // branches still see the original query string.
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "market" || view === "locker" || view === "profile" || view === "studio") {
      setActiveNav(view);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const authError = params.get("auth_error");
    if (authError) {
      requestAuth(authError);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [requestAuth]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (roughTakeUrlRef.current) URL.revokeObjectURL(roughTakeUrlRef.current);
      stopBeatPreview({ reset: false });
      stopStudioAir();
    };
  }, [stopBeatPreview, stopStudioAir]);

  useEffect(() => {
    if (activeNav === "studio") return;
    stopStudioAir();
  }, [activeNav, stopStudioAir]);

  useEffect(() => {
    if (skipNextBeatResetRef.current) {
      skipNextBeatResetRef.current = false;
      setBeatDuration(getBeatDurationSeconds(selectedBeat));
      setBeatError(null);
      return;
    }
    if (activePreviewBeatIdRef.current === selectedBeat.id) return;
    stopBeatPreview({ reset: true });
    setBeatDuration(getBeatDurationSeconds(selectedBeat));
    setBeatError(null);
  }, [selectedBeat, stopBeatPreview]);

  useEffect(() => {
    if (!recording || !recordStartedAt) return;
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recordStartedAt) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [recordStartedAt, recording]);

  useEffect(() => {
    if (roughTakeBlob) return;
    if (!roughTake) {
      setRoughTakeAnalysis(null);
      setRoughTakeBeat(null);
      setRoughTakeBeatPosition(0);
      return;
    }
    if (roughTakeUrlRef.current) {
      URL.revokeObjectURL(roughTakeUrlRef.current);
      roughTakeUrlRef.current = null;
    }
    setRoughTakeUrl(roughTake.signed_url);
    setRoughTakeDuration(roughTake.duration_seconds);
    setRoughTakeBeat(beatSnapshotFromRecord(roughTake.beat_snapshot) ?? null);
    setRoughTakeBeatPosition(Math.max(0, Number(roughTake.beat_position_seconds) || 0));
    setRoughTakeSaved(true);
    setRoughTakeAnalysis(isRoughTakeAnalysis(roughTake.analysis) ? roughTake.analysis : null);
  }, [roughTake, roughTakeBlob]);

  useEffect(() => {
    if (loading) return;
    const draft = readMobileDraftRecord(user?.id ?? null);
    localDraftRef.current = draft;
    skipNextDraftWriteRef.current = true;

    if (draft) {
      setSectionContent({ ...blankSections(), ...draft.sections });
      const sectionIndex = mobileSections.findIndex((item) => item.name === draft.activeSection);
      if (sectionIndex >= 0) setActiveSection(sectionIndex);
      skipNextBeatResetRef.current = true;
      setSelectedBeat(draft.beat);
      const pack = getStudioPack(draft.studioPackId).id;
      setActiveStudioPackId(pack);
      setStudioDna({ ...draft.studioDna, environment: pack });
      setBeatCurrentTime(draft.playbackPositionSeconds);
      beatCurrentTimeRef.current = draft.playbackPositionSeconds;
      beatOffsetRef.current = draft.playbackPositionSeconds;
      setSaveStatus(draft.unsynced ? "error" : "saved");
      setSyncMessage(draft.unsynced ? "Recovered on device. Sync pending" : "Saved on device");
    }

    setDraftLoaded(true);
  }, [loading, user?.id]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (skipNextDraftWriteRef.current) {
      skipNextDraftWriteRef.current = false;
      return;
    }

    setSaveStatus("saving");
    const draft = buildDraftRecord(true);
    localDraftRef.current = draft;
    writeMobileDraftRecord(draft);
    if (!userIdRef.current) {
      setSaveStatus("saved");
      setSyncMessage("Saved on device");
    }
  }, [buildDraftRecord, draftLoaded]);

  useEffect(() => {
    const handleOffline = () => {
      setSaveStatus("error");
      setSyncMessage("Saved on device. Offline");
    };
    const handleOnline = () => {
      if (!localDraftRef.current?.unsynced || conflictBlockedRef.current) return;
      retryUrgentRef.current = true;
      setSyncRetryNonce((value) => value + 1);
    };
    const persistBeforeExit = () => {
      const previous = localDraftRef.current;
      if (!previous) return;
      const playbackDirty = Math.abs(previous.playbackPositionSeconds - beatCurrentTimeRef.current) >= 1;
      if (!previous.unsynced && !playbackDirty) return;
      const draft = buildDraftRecord(true);
      localDraftRef.current = draft;
      writeMobileDraftRecord(draft);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") persistBeforeExit();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", persistBeforeExit);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", persistBeforeExit);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [buildDraftRecord]);

  const completionPct = useMemo(() => {
    const written = mobileSections.reduce((sum, item) => {
      const bars = countBars(sectionContent[item.name]);
      return sum + Math.min(bars, item.target);
    }, 0);
    const total = mobileSections.reduce((sum, item) => sum + item.target, 0);
    return Math.round((written / total) * 100);
  }, [sectionContent]);

  const totalBars = useMemo(
    () => mobileSections.reduce((sum, item) => sum + countBars(sectionContent[item.name]), 0),
    [sectionContent],
  );
  const lyricAnalysis = useMemo(() => analyzeLyrics(sectionContent), [sectionContent]);
  const boothReady = useMemo(
    () =>
      scoreBoothReady(sectionContent, completionPct, lyricAnalysis, {
        activeSection: section.name,
        roughTakeDuration,
        roughTakeSaved,
        roughTakeSection: roughTake?.section_name ?? null,
        roughTakeExists: Boolean(roughTakeUrl),
        roughTakeAnalyzing,
        roughTakeAnalysis,
      }),
    [completionPct, lyricAnalysis, roughTake?.section_name, roughTakeAnalysis, roughTakeAnalyzing, roughTakeDuration, roughTakeSaved, roughTakeUrl, section.name, sectionContent],
  );
  const beatIntel = useMemo(
    () =>
      buildBeatIntelligence({
        beat: selectedBeat,
        sectionName: section.name,
        sectionText: sectionContent[section.name] ?? "",
        sections: sectionContent,
        completionPct,
        boothReady,
        roughTakeSaved,
      }),
    [boothReady, completionPct, roughTakeSaved, section.name, sectionContent, selectedBeat],
  );
  const environmentIntel = useMemo(
    () => buildEnvironmentIntelligence(activeStudioPack, studioDna, section.name),
    [activeStudioPack, section.name, studioDna],
  );

  useEffect(() => {
    if (!newSongOpen) return;
    setNewSongTitle(`${beatIntel.titleSeed} ${songs.length + 1}`);
    setNewSongStartSection("Hook");
    setNewSongUseBeat(true);
  }, [beatIntel.titleSeed, newSongOpen, songs.length]);

  useEffect(() => {
    if (!draftLoaded || !session || session.id === hydratedSessionId) return;

    const localDraft = localDraftRef.current;
    const remoteUpdatedAt = Date.parse(session.client_updated_at ?? session.last_active_at);
    const localUpdatedAt = localDraft ? Date.parse(localDraft.updatedAt) : 0;
    const localMatchesOwner = !localDraft?.ownerId || localDraft.ownerId === user?.id;
    const localMatchesSong = !localDraft?.songId || localDraft.songId === session.song_id;
    const recoverLocal = Boolean(
      localDraft?.unsynced &&
      localMatchesOwner &&
      localMatchesSong &&
      Number.isFinite(localUpdatedAt) &&
      localUpdatedAt > remoteUpdatedAt,
    );

    if (recoverLocal && localDraft) {
      setSectionContent({ ...blankSections(), ...localDraft.sections });
      const sectionIndex = mobileSections.findIndex((item) => item.name === localDraft.activeSection);
      if (sectionIndex >= 0) setActiveSection(sectionIndex);
      skipNextBeatResetRef.current = true;
      setSelectedBeat(localDraft.beat);
      const localPack = canUseStudioPack(localDraft.studioPackId) ? localDraft.studioPackId : defaultStudioRoomId;
      const localDna = normalizeStudioDna(localDraft.studioDna, localPack);
      setActiveStudioPackId(localPack);
      setStudioDna({ ...localDna, environment: localPack });
      setBeatCurrentTime(localDraft.playbackPositionSeconds);
      beatCurrentTimeRef.current = localDraft.playbackPositionSeconds;
      beatOffsetRef.current = localDraft.playbackPositionSeconds;
      conflictBlockedRef.current = false;
      retryUrgentRef.current = true;
      setSyncRetryNonce((value) => value + 1);
      setSaveStatus("error");
      setSyncMessage("Recovered on device. Sync pending");
    } else {
      const nextSections = { ...blankSections(), ...session.section_content };
      const nextSectionIndex = mobileSections.findIndex((item) => item.name === session.active_section);
      const nextBeat = beatSnapshotFromRecord(session.beat_snapshot) ?? beatSnapshotFromSong(activeSong) ?? EMPTY_BEAT;
      const remoteDna = normalizeStudioDna(session.studio_dna, getStudioPack(session.ambiance || session.mode).id);
      const remotePack = canUseStudioPack(remoteDna.environment) ? remoteDna.environment : defaultStudioRoomId;
      const playbackPosition = Math.max(0, Number(session.playback_position_seconds) || 0);

      skipNextDraftWriteRef.current = true;
      setSectionContent(nextSections);
      if (nextSectionIndex >= 0) setActiveSection(nextSectionIndex);
      skipNextBeatResetRef.current = true;
      setSelectedBeat(nextBeat);
      setActiveStudioPackId(remotePack);
      setStudioDna({ ...remoteDna, environment: remotePack });
      setBeatCurrentTime(playbackPosition);
      beatCurrentTimeRef.current = playbackPosition;
      beatOffsetRef.current = playbackPosition;
      window.localStorage.setItem(MOBILE_STUDIO_PACK_KEY, remotePack);
      window.localStorage.setItem(MOBILE_STUDIO_DNA_KEY, JSON.stringify({ ...remoteDna, environment: remotePack }));

      const remoteDraft: MobileDraftRecord = {
        version: 3,
        ownerId: user?.id ?? null,
        updatedAt: session.client_updated_at ?? session.last_active_at,
        syncedAt: session.last_active_at,
        unsynced: false,
        projectId: session.project_id,
        songId: session.song_id,
        sessionId: session.id,
        baseRevision: session.revision,
        sections: nextSections,
        activeSection: session.active_section,
        beat: nextBeat,
        studioPackId: remotePack,
        studioDna: { ...remoteDna, environment: remotePack },
        playbackPositionSeconds: playbackPosition,
      };
      localDraftRef.current = remoteDraft;
      writeMobileDraftRecord(remoteDraft);
      conflictBlockedRef.current = false;
      setSaveStatus("saved");
      setSyncMessage("Resume loaded");
    }

    setHydratedSessionId(session.id);
  }, [activeSong, canUseStudioPack, draftLoaded, hydratedSessionId, session, user?.id]);

  useEffect(() => {
    if (loadingData || pendingBeatHandledRef.current) return;
    pendingBeatHandledRef.current = true;
    const pendingBeat = consumePendingBeat();
    if (!pendingBeat) return;

    setSelectedBeat(toBeatSnapshot(pendingBeat));
    setActiveNav("studio");
    setScreen("writer");
    setPlaying(false);
    setBeatCurrentTime(0);
    setSyncMessage(`${pendingBeat.title} loaded from Studio Store`);
  }, [loadingData]);

  useEffect(() => {
    if (!user || loading || loadingData || !draftLoaded) return;
    if (!localDraftRef.current?.unsynced || conflictBlockedRef.current) return;

    const timer = window.setTimeout(async () => {
      retryUrgentRef.current = false;
      setSaveStatus("saving");
      try {
        let projectId: string | undefined = activeProjectId;
        let songId: string | undefined = activeSongId;

        if (!projectId || !songId) {
          const created = await ensureWorkspace({
            title: "Untitled Project",
            project_type: "EP",
            sections: sectionContent,
            beat: selectedBeat,
          });
          projectId = created?.project.id;
          songId = created?.song.id;
        }

        if (!projectId || !songId) throw new Error("Could not prepare your session.");

        const savedSession = await saveNow({
          projectId,
          songId,
          sessionId: session?.id,
          beat: selectedBeat,
          mode: activeStudioPack.id,
          ambiance: activeStudioPack.id,
          sectionContent,
          activeSection: section.name,
          songState: completionPct >= 67 ? 2 : 1,
          completionPct,
          boothScore: boothReady.score,
          totalBars,
          playbackPositionSeconds: beatCurrentTimeRef.current,
          studioDna: { ...studioDna, environment: activeStudioPack.id },
          clientUpdatedAt: localDraftRef.current?.updatedAt,
        });
        retryAttemptRef.current = 0;
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
        skipNextDraftWriteRef.current = true;
        const syncedDraft = buildDraftRecord(false, savedSession);
        localDraftRef.current = syncedDraft;
        writeMobileDraftRecord(syncedDraft);
        setSaveStatus("saved");
        setSyncMessage("Synced just now");
      } catch (error) {
        setSaveStatus("error");
        if (isSessionConflictError(error)) {
          conflictBlockedRef.current = true;
          setSyncMessage("Newer session found. Local draft preserved.");
          return;
        }

        setSyncMessage(navigator.onLine ? "Saved on device. Sync pending" : "Saved on device. Offline");
        if (!navigator.onLine) return;
        const retryDelay = Math.min(30000, 5000 * 2 ** retryAttemptRef.current);
        retryAttemptRef.current += 1;
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = window.setTimeout(() => {
          retryUrgentRef.current = true;
          setSyncRetryNonce((value) => value + 1);
        }, retryDelay);
      }
    }, retryUrgentRef.current ? 250 : 5000);

    return () => window.clearTimeout(timer);
  }, [
    activeProjectId,
    activeSongId,
    activeStudioPack.id,
    boothReady.score,
    buildDraftRecord,
    completionPct,
    draftLoaded,
    section.name,
    sectionContent,
    totalBars,
    ensureWorkspace,
    loading,
    loadingData,
    saveNow,
    selectedBeat,
    session?.id,
    studioDna,
    syncRetryNonce,
    user,
  ]);

  useEffect(() => {
    if (!playing || conflictBlockedRef.current) return;
    queueUrgentSessionSync();
    const timer = window.setInterval(() => {
      const currentDraft = localDraftRef.current;
      if (currentDraft && Math.abs(currentDraft.playbackPositionSeconds - beatCurrentTimeRef.current) < 5) return;
      queueUrgentSessionSync();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [playing, queueUrgentSessionSync]);

  const generateProducerRevision = async (actionType: ProducerActionType, attempt = 0) => {
    if (!user) {
      requestAuth("Sign in to run a Producer Pass and save its history.");
      return;
    }

    const currentContent = sectionContent[section.name]?.trim() ?? "";
    if (countBars(currentContent) < 2) {
      setProducerActionError(`Write at least two lines in ${section.name} before running this pass.`);
      setProducerActionStatus("error");
      return;
    }

    setProducerActionStatus("generating");
    setProducerActionError(null);
    try {
      let projectId: string | undefined = activeProjectId;
      let songId: string | undefined = activeSongId;
      let sessionId = session?.id;

      if (!projectId || !songId) {
        const created = await ensureWorkspace({
          title: "Untitled Project",
          project_type: "EP",
          sections: sectionContent,
          beat: selectedBeat,
        });
        projectId = created?.project.id;
        songId = created?.song.id;
      }

      if (!projectId || !songId) throw new Error("Could not prepare this writing session.");

      const syncedSession = await saveNow({
        projectId,
        songId,
        sessionId,
        beat: selectedBeat,
        mode: activeStudioPack.id,
        ambiance: activeStudioPack.id,
        sectionContent,
        activeSection: section.name,
        songState: completionPct >= 67 ? 2 : 1,
        completionPct,
        boothScore: boothReady.score,
        totalBars,
      });
      sessionId = syncedSession?.id ?? sessionId;

      const response = await fetch("/api/producer-actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          project_id: projectId,
          song_id: songId,
          session_id: sessionId ?? null,
          action_type: actionType,
          section_name: section.name,
          section_content: currentContent,
          attempt,
          beat: selectedBeat,
          studio_dna: studioDna,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notifyMembershipAccess(data, response.status);
        throw new Error(data.error ?? "Producer Pass could not create a revision.");
      }

      setProducerActionProposal(data.proposal as ProducerActionProposal);
      setProducerActionStatus("preview");
      setSyncMessage("Revision ready to preview");
    } catch (error) {
      setProducerActionError(error instanceof Error ? error.message : "Producer Pass could not create a revision.");
      setProducerActionStatus("error");
    }
  };

  const resolveProducerRevision = async (decision: "accept" | "reject" | "revert") => {
    if (!producerActionProposal) return;
    setProducerActionStatus("applying");
    setProducerActionError(null);
    try {
      const response = await fetch(`/api/producer-actions/${producerActionProposal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Producer revision could not be updated.");

      if (decision === "reject") {
        setProducerActionProposal(null);
        setProducerActionStatus("idle");
        setSyncMessage("Revision rejected");
        return;
      }

      const nextSections = data.section_content as Record<string, string> | undefined;
      if (nextSections) setSectionContent({ ...blankSections(), ...nextSections });
      setSaveStatus("saved");
      setProducerActionProposal((current) => current ? { ...current, status: decision === "accept" ? "accepted" : "reverted" } : current);
      setProducerActionStatus(decision === "accept" ? "accepted" : "reverted");
      setSyncMessage(decision === "accept" ? "Producer revision saved" : "Original lyrics restored");
    } catch (error) {
      setProducerActionError(error instanceof Error ? error.message : "Producer revision could not be updated.");
      setProducerActionStatus("error");
    }
  };

  const tryAnotherProducerRevision = async () => {
    const current = producerActionProposal;
    if (!current) return;
    try {
      await fetch(`/api/producer-actions/${current.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "reject" }),
      });
    } catch {
      // A fresh preview can still be generated if retiring the old preview fails.
    }
    setProducerActionProposal(null);
    void generateProducerRevision(current.actionType, current.attempt + 1);
  };

  const changeActiveSectionContent = (value: string) => {
    if (producerActionProposal) {
      setProducerActionProposal(null);
      setProducerActionStatus("idle");
      setProducerActionError(null);
    }
    conflictBlockedRef.current = false;
    setSectionContent((previous) => ({ ...previous, [section.name]: value }));
  };

  const openVersionHistory = async () => {
    if (!user) {
      requestAuth("Sign in to view and restore writing history.");
      return;
    }
    if (membership?.artist?.entitlements.version_history !== true) {
      setScreen("home");
      setActiveNav("profile");
      setSyncMessage("Prep Studio Pro unlocks revision history");
      return;
    }

    setVersionHistoryOpen(true);
    setVersionHistoryStatus("loading");
    setVersionHistoryError(null);
    setSectionVersions([]);

    if (!activeSongId) {
      setVersionHistoryStatus("ready");
      setVersionHistoryError("History begins after this song completes its first sync.");
      return;
    }

    try {
      const params = new URLSearchParams({
        song_id: activeSongId,
        section_key: sectionKeyFromTitle(section.name),
      });
      const response = await fetch(`/api/song-sections/versions?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Revision history could not be loaded.");
      setSectionVersions(Array.isArray(data.versions) ? data.versions : []);
      setVersionHistoryStatus("ready");
    } catch (error) {
      setVersionHistoryError(error instanceof Error ? error.message : "Revision history could not be loaded.");
      setVersionHistoryStatus("error");
    }
  };

  const restoreSectionVersion = async (versionId: string) => {
    setVersionHistoryStatus("restoring");
    setVersionHistoryError(null);
    try {
      const response = await fetch("/api/song-sections/versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "This version could not be restored.");

      const nextSections = data.section_content as Record<string, string> | undefined;
      if (nextSections) setSectionContent({ ...blankSections(), ...nextSections });
      setProducerActionProposal(null);
      setProducerActionStatus("idle");
      setSaveStatus("saved");
      setSyncMessage(`${section.name} restored from history`);
      setVersionHistoryStatus("ready");
      setVersionHistoryOpen(false);
    } catch (error) {
      setVersionHistoryError(error instanceof Error ? error.message : "This version could not be restored.");
      setVersionHistoryStatus("error");
    }
  };

  const loadMobileSong = async (song: SongRow) => {
    if (roughTakeBlob && !roughTakeSaved) {
      setSongSwitchStatus({ state: "error", message: "Keep or delete the current rough take before switching songs." });
      return;
    }
    setSongSwitchStatus({ state: "saving", message: "Loading session..." });
    const nextSections = { ...blankSections(), ...song.sections };
    const nextSectionName = song.active_section || "Hook";
    const nextSectionIndex = mobileSections.findIndex((item) => item.name === nextSectionName);
    const nextBeat = beatSnapshotFromSong(song) ?? EMPTY_BEAT;
    const nextDna = normalizeStudioDna(song.studio_dna, getStudioPack(song.session_ambiance || song.session_mode).id);
    const nextPack = canUseStudioPack(nextDna.environment) ? nextDna.environment : defaultStudioRoomId;
    const nextPlaybackPosition = Math.max(0, Number(song.playback_position_seconds) || 0);
    const nextBoothScore = song.booth_score ?? scoreBoothReady(nextSections, song.completion_pct ?? 0, analyzeLyrics(nextSections), {
      activeSection: nextSectionName,
      roughTakeDuration: 0,
      roughTakeSaved: false,
      roughTakeSection: null,
      roughTakeExists: false,
      roughTakeAnalyzing: false,
      roughTakeAnalysis: null,
    }).score;

    try {
      if (activeProjectId && activeSongId && activeSongId !== song.id) {
        await saveNow({
          projectId: activeProjectId,
          songId: activeSongId,
          sessionId: session?.id,
          beat: selectedBeat,
          mode: activeStudioPack.id,
          ambiance: activeStudioPack.id,
          sectionContent,
          activeSection: section.name,
          songState: completionPct >= 67 ? 2 : 1,
          completionPct,
          boothScore: boothReady.score,
          totalBars,
          playbackPositionSeconds: beatCurrentTimeRef.current,
          studioDna: { ...studioDna, environment: activeStudioPack.id },
        });
      }

      stopBeatPreview({ reset: true });
      stopStudioAir();
      setSectionContent(nextSections);
      setActiveSection(nextSectionIndex >= 0 ? nextSectionIndex : 0);
      setRoughTakeBlob(null);
      setRoughTakeUrl(null);
      setRoughTakeDuration(0);
      setRoughTakeSaved(false);
      setRoughTakeAnalysis(null);
      setRoughTakeAnalyzing(false);
      skipNextBeatResetRef.current = true;
      setSelectedBeat(nextBeat);
      setActiveStudioPackId(nextPack);
      setStudioDna({ ...nextDna, environment: nextPack });
      setBeatCurrentTime(nextPlaybackPosition);
      beatCurrentTimeRef.current = nextPlaybackPosition;
      beatOffsetRef.current = nextPlaybackPosition;

      await saveNow({
        projectId: song.project_id,
        songId: song.id,
        sessionId: session?.id,
        beat: nextBeat,
        mode: nextPack,
        ambiance: nextPack,
        sectionContent: nextSections,
        activeSection: nextSectionName,
        songState: song.song_state ?? 1,
        completionPct: song.completion_pct ?? completionPct,
        boothScore: nextBoothScore,
        totalBars: song.total_bars ?? countTotalBars(nextSections),
        playbackPositionSeconds: nextPlaybackPosition,
        studioDna: { ...nextDna, environment: nextPack },
      });
      await loadLatestRoughTake({ songId: song.id });
      setHydratedSessionId(null);
      setSaveStatus("saved");
      setSyncMessage("Session loaded");
      setSongSwitchStatus({ state: "saved", message: `${song.title} loaded.` });
    } catch (err) {
      setSongSwitchStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Could not load song.",
      });
    }
  };

  const createMobileSong = async ({
    title,
    startSection,
    useCurrentBeat,
  }: {
    title: string;
    startSection: string;
    useCurrentBeat: boolean;
  }) => {
    if (!user) {
      requestAuth("Sign in to create and switch between songs.");
      return;
    }

    setSongSwitchStatus({ state: "saving", message: "Creating song..." });
    const nextSections = blankSections();
    const nextSectionIndex = Math.max(0, mobileSections.findIndex((item) => item.name === startSection));
    const songBeat = useCurrentBeat ? selectedBeat : null;
    const cleanTitle = title.trim() || `${beatIntel.titleSeed} ${songs.length + 1}`;

    try {
      if (roughTakeBlob && !roughTakeSaved) {
        throw new Error("Keep or delete the current rough take before creating another song.");
      }
      if (activeProjectId && activeSongId) {
        await saveNow({
          projectId: activeProjectId,
          songId: activeSongId,
          sessionId: session?.id,
          beat: selectedBeat,
          mode: activeStudioPack.id,
          ambiance: activeStudioPack.id,
          sectionContent,
          activeSection: section.name,
          songState: completionPct >= 67 ? 2 : 1,
          completionPct,
          boothScore: boothReady.score,
          totalBars,
          playbackPositionSeconds: beatCurrentTimeRef.current,
          studioDna: { ...studioDna, environment: activeStudioPack.id },
        });
      }
      let project: ProjectRow | undefined = projects[0];
      if (!project) {
        const created = await ensureWorkspace({
          title: "Untitled Project",
          project_type: "EP",
          sections: nextSections,
          beat: songBeat,
        });
        project = created?.project;
      }

      if (!project) throw new Error("Could not prepare a project.");

      const createdSong = await createSong({
        projectId: project.id,
        title: cleanTitle,
        sections: nextSections,
        activeSection: startSection,
        beat: songBeat,
      });

      if (!createdSong) throw new Error("Could not create song.");

      setSectionContent(nextSections);
      setActiveSection(nextSectionIndex);
      setRoughTakeBlob(null);
      setRoughTakeUrl(null);
      setRoughTakeDuration(0);
      setRoughTakeSaved(false);
      stopBeatPreview({ reset: true });
      stopStudioAir();
      skipNextBeatResetRef.current = true;
      setSelectedBeat(songBeat ?? EMPTY_BEAT);
      setBeatCurrentTime(0);
      beatCurrentTimeRef.current = 0;
      beatOffsetRef.current = 0;
      await saveNow({
        projectId: project.id,
        songId: createdSong.id,
        sessionId: session?.id,
        beat: songBeat,
        mode: activeStudioPack.id,
        ambiance: activeStudioPack.id,
        sectionContent: nextSections,
        activeSection: startSection,
        songState: 0,
        completionPct: 0,
        boothScore: 0,
        totalBars: 0,
        playbackPositionSeconds: 0,
        studioDna: { ...studioDna, environment: activeStudioPack.id },
      });
      setHydratedSessionId(null);
      setSaveStatus("saved");
      setSyncMessage("New song ready");
      setTitleDraft(cleanTitle);
      setNewSongOpen(false);
      setScreen("writer");
      setSongSwitchStatus({ state: "saved", message: "New song created." });
    } catch (err) {
      setSongSwitchStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Could not create song.",
      });
    }
  };

  const saveSongTitle = async () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleStatus({ state: "error", message: "Song title cannot be empty." });
      return;
    }
    if (!user) {
      requestAuth("Sign in to rename synced songs.");
      return;
    }
    if (!activeSongId) {
      setTitleStatus({ state: "error", message: "Create a song before renaming it." });
      return;
    }

    setTitleStatus({ state: "saving", message: "Saving title..." });
    try {
      await updateSong({ id: activeSongId, title: nextTitle });
      setTitleEditing(false);
      setTitleStatus({ state: "saved", message: "Title updated." });
      setSyncMessage("Title saved");
    } catch (err) {
      setTitleStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Could not update title.",
      });
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const startRecording = async () => {
    setRecordError(null);
    stopStudioAir();
    roughTakeAnalysisRunRef.current += 1;
    setRoughTakeAnalysis(null);
    setRoughTakeAnalyzing(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordError("Recording is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      recorderChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      const startedAt = Date.now();
      const beatAtStart = { ...selectedBeat };
      const beatPositionAtStart = Math.max(0, beatCurrentTimeRef.current);
      recorderRef.current = recorder;
      recordBeatRef.current = beatAtStart;
      recordBeatPositionRef.current = beatPositionAtStart;
      setRoughTakeBeat(beatAtStart);
      setRoughTakeBeatPosition(beatPositionAtStart);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const analysisRunId = roughTakeAnalysisRunRef.current;
        const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        if (roughTakeUrlRef.current) URL.revokeObjectURL(roughTakeUrlRef.current);
        roughTakeUrlRef.current = url;
        setRoughTakeBlob(blob);
        setRoughTakeUrl(url);
        setRoughTakeDuration(duration);
        setRoughTakeSaved(false);
        setRoughTakeAnalyzing(true);
        setRecording(false);
        setRecordStartedAt(null);
        setRecordingSeconds(0);
        recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        try {
          const analysis = await analyzeRoughTakeAudio(blob);
          if (roughTakeAnalysisRunRef.current === analysisRunId) setRoughTakeAnalysis(analysis);
        } catch {
          if (roughTakeAnalysisRunRef.current === analysisRunId) {
            setRoughTakeAnalysis(null);
            setRecordError("Take recorded. Performance analysis was unavailable in this browser.");
          }
        } finally {
          if (roughTakeAnalysisRunRef.current === analysisRunId) setRoughTakeAnalyzing(false);
        }
      };

      if (!playing) {
        try {
          await startBeatPreview(beatAtStart);
        } catch {
          setBeatError("The beat could not start, but recording is still available.");
        }
      }
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      setRecordStartedAt(startedAt);
    } catch {
      setRecordError("Microphone permission was blocked.");
      setRecording(false);
      setRecordStartedAt(null);
    }
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
      return;
    }
    void startRecording();
  };

  const deleteRoughTake = () => {
    roughTakeAnalysisRunRef.current += 1;
    if (roughTakeUrlRef.current) URL.revokeObjectURL(roughTakeUrlRef.current);
    roughTakeUrlRef.current = null;
    setRoughTakeBlob(null);
    setRoughTakeUrl(null);
    setRoughTakeDuration(0);
    setRoughTakeBeat(null);
    setRoughTakeBeatPosition(0);
    recordBeatRef.current = null;
    recordBeatPositionRef.current = 0;
    setRoughTakeSaved(false);
    setRoughTakeAnalysis(null);
    setRoughTakeAnalyzing(false);
    setRecordError(null);
  };

  const saveRoughTake = async () => {
    if (!user) {
      requestAuth("Sign in to save rough takes.");
      return;
    }
    if (!roughTakeBlob) {
      setRecordError(roughTakeSaved ? "This take is already saved." : "Record a take before saving.");
      return;
    }
    if (roughTakeAnalyzing) {
      setRecordError("Let the delivery read finish before keeping this take.");
      return;
    }

    setRoughTakeSaving(true);
    setRecordError(null);
    try {
      let projectId: string | undefined = activeProjectId;
      let songId: string | undefined = activeSongId;
      let sessionId = session?.id;

      if (!projectId || !songId) {
        const created = await ensureWorkspace({
          title: "Untitled Project",
          project_type: "EP",
          sections: sectionContent,
          beat: selectedBeat,
        });
        projectId = created?.project.id;
        songId = created?.song.id;
      }

      if (projectId && songId && !sessionId) {
        const savedSession = await saveNow({
          projectId,
          songId,
          beat: selectedBeat,
          mode: activeStudioPack.id,
          ambiance: activeStudioPack.id,
          sectionContent,
          activeSection: section.name,
          songState: completionPct >= 67 ? 2 : 1,
          completionPct,
          boothScore: boothReady.score,
          totalBars,
        });
        sessionId = savedSession?.id;
      }

      await uploadRoughTake({
        file: roughTakeBlob,
        projectId,
        songId,
        sessionId,
        sectionName: section.name,
        durationSeconds: roughTakeDuration,
        analysis: roughTakeAnalysis,
        beat: roughTakeBeat ?? recordBeatRef.current ?? selectedBeat,
        beatPositionSeconds: roughTakeBeatPosition || recordBeatPositionRef.current,
      });
      setRoughTakeSaved(true);
      setRoughTakeBlob(null);
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : "Could not save rough take.");
    } finally {
      setRoughTakeSaving(false);
    }
  };

  const runPadAction = async (successMessage: string, action: () => Promise<void>) => {
    if (!user) {
      setPadActionStatus({ state: "error", message: "Sign in to sync this to your Locker." });
      requestAuth("Sign in to save this to your Locker.");
      return;
    }

    setPadActionStatus({ state: "saving", message: "Saving..." });
    try {
      await action();
      setPadActionStatus({ state: "saved", message: successMessage });
    } catch (err) {
      setPadActionStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Could not save. Try again.",
      });
    }
  };

  const padActions: PadActions = {
    status: padActionStatus,
    onSaveHook: () => {
      void runPadAction("Hook saved to Locker.", async () => {
        await saveHook({
          projectId: activeProjectId,
          songId: activeSongId,
          title: "Midnight Hook",
          content: sectionContent.Hook,
        });
      });
    },
    onSaveSong: () => {
      void runPadAction("Song saved to Locker.", async () => {
        await saveSongToLocker({
          projectId: activeProjectId,
          songId: activeSongId,
          title: activeSong?.title ?? "Untitled Song",
          status: completionPct >= 67 ? "session_ready" : "draft",
          boothReady: completionPct >= 75,
          snapshot: {
            sections: sectionContent,
            boothReady,
            completionPct,
            totalBars,
            beat: selectedBeat,
          },
        });
      });
    },
    onFavoriteBeat: () => {
      void runPadAction("Beat saved to Locker.", async () => {
        await addBeatLicense(selectedBeat, "Favorite", 0);
      });
    },
    onAddBeatToProject: () => {
      void runPadAction("Beat attached to project.", async () => {
        if (activeProjectId && activeSongId) {
          await saveNow({
            projectId: activeProjectId,
            songId: activeSongId,
            sessionId: session?.id,
            beat: selectedBeat,
            mode: activeStudioPack.id,
            ambiance: activeStudioPack.id,
            sectionContent,
            activeSection: section.name,
            songState: completionPct >= 67 ? 2 : 1,
            completionPct,
            boothScore: boothReady.score,
            totalBars,
          });
          return;
        }

        await ensureWorkspace({
          title: "Untitled Project",
          project_type: "EP",
          sections: sectionContent,
          beat: selectedBeat,
        });
      });
    },
  };

  const openCurrentBoothExport = async () => {
    if (!user) {
      requestAuth("Sign in to freeze a Booth Ready version and download studio files.");
      return;
    }

    setBoothExportStatus("idle");
    setBoothExportError(null);
    setBoothExportRecord(null);
    try {
      let projectId = activeProjectId ?? null;
      let songId = activeSongId ?? null;
      let songTitle = titleDraft.trim() || activeSong?.title || "Untitled Song";
      let projectTitle = projects.find((project) => project.id === projectId)?.title || "Untitled Project";

      if (!projectId || !songId) {
        const workspaceResult = await ensureWorkspace({
          title: projectTitle,
          songTitle,
          project_type: "Single",
          sections: sectionContent,
          beat: selectedBeat,
        });
        if (!workspaceResult) throw new Error("Could not prepare this song for export.");
        projectId = workspaceResult.project.id;
        songId = workspaceResult.song.id;
        songTitle = workspaceResult.song.title;
        projectTitle = workspaceResult.project.title;
      } else {
        await saveNow({
          projectId,
          songId,
          sessionId: session?.id,
          beat: selectedBeat,
          mode: activeStudioPack.id,
          ambiance: activeStudioPack.id,
          sectionContent,
          activeSection: section.name,
          songState: completionPct >= 67 ? 2 : 1,
          completionPct,
          boothScore: boothReady.score,
          totalBars,
        });
      }

      setBoothExportDraft({
        projectId,
        songId,
        sessionId: session?.song_id === songId ? session.id : null,
        roughTakeId: roughTake?.song_id === songId ? roughTake.id : null,
        title: songTitle,
        snapshot: buildBoothExportSnapshot({
          projectTitle,
          artistName: artistDisplayName(profile, user.email),
          activeSection: section.name,
          sections: sectionContent,
          beat: selectedBeat,
          boothReady,
          completionPct,
          totalBars,
          roughTake: roughTake?.song_id === songId ? roughTake : null,
        }),
      });
      setBoothExportOpen(true);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Could not prepare Booth Ready export");
    }
  };

  const openLockerBoothExport = (lockerSong: SongLockerRow) => {
    if (!user) {
      requestAuth("Sign in to export songs from your Locker.");
      return;
    }
    if (!lockerSong.project_id || !lockerSong.song_id) {
      setSyncMessage("Resume this song once before preparing its Booth package");
      return;
    }
    const sections = sectionsFromLockerSnapshot(lockerSong.snapshot);
    if (!sections) {
      setSyncMessage("This Locker copy does not contain exportable lyrics");
      return;
    }
    const completion = lockerSongProgress(lockerSong);
    const bars = lockerSnapshotNumber(lockerSong.snapshot, "totalBars", "total_bars") ?? lockerSongBarCount(lockerSong);
    const fullSong = songs.find((song) => song.id === lockerSong.song_id);
    const beat = lockerSnapshotBeat(lockerSong.snapshot) ?? beatSnapshotFromSong(fullSong ?? null) ?? EMPTY_BEAT;
    const lockerBoothReady = boothReadyFromLockerSnapshot(lockerSong.snapshot, sections, completion);
    const linkedRoughTake = roughTake?.song_id === lockerSong.song_id ? roughTake : null;

    setBoothExportStatus("idle");
    setBoothExportError(null);
    setBoothExportRecord(null);
    setBoothExportDraft({
      projectId: lockerSong.project_id,
      songId: lockerSong.song_id,
      sessionId: session?.song_id === lockerSong.song_id ? session.id : null,
      roughTakeId: linkedRoughTake?.id ?? null,
      title: lockerSong.title,
      snapshot: buildBoothExportSnapshot({
        projectTitle: projects.find((project) => project.id === lockerSong.project_id)?.title || "Untitled Project",
        artistName: artistDisplayName(profile, user.email),
        activeSection: fullSong?.active_section || "Hook",
        sections,
        beat,
        boothReady: lockerBoothReady,
        completionPct: completion,
        totalBars: bars,
        roughTake: linkedRoughTake,
      }),
    });
    setBoothExportOpen(true);
  };

  const freezeBoothExport = async () => {
    if (!boothExportDraft) return;
    setBoothExportStatus("saving");
    setBoothExportError(null);
    try {
      const created = await createBoothExport(boothExportDraft);
      if (!created) throw new Error("Sign in to create a Booth Ready export.");
      setBoothExportRecord(created);
      setBoothExportStatus("idle");
    } catch (error) {
      setBoothExportStatus("error");
      setBoothExportError(error instanceof Error ? error.message : "Could not freeze this Booth Ready version.");
    }
  };

  if (!draftLoaded) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-[#070708] px-6 text-foreground" role="status" aria-label="Restoring Studio session">
        <div className="text-center">
          <BrandLogo className="justify-center" />
          <div className="mx-auto mt-5 h-1 w-24 overflow-hidden rounded-full bg-white/8">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gold" />
          </div>
          <div className="label-hw mt-4 text-white/42">Restoring Studio</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100svh] bg-[#070708] text-foreground">
      <div
        className="pointer-events-none fixed inset-0 bg-cover opacity-[0.18] blur-[2px] saturate-[0.82] transition-[background-image,background-position] duration-700"
        style={{ backgroundImage: `url('${activeStudioPack.image}')`, backgroundPosition: activeStudioPack.position }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.38),rgba(7,7,8,0.92)_46%,#070708)]" />
      <ImmersiveEnvironmentEffects studioPack={activeStudioPack} />

      <div className={cn(
        "relative z-10 mx-auto flex w-full max-w-[430px] flex-col overflow-hidden bg-[#070708]/96",
        screen === "writer" ? "h-[100svh]" : "min-h-[100svh]",
      )}>
        <MobileHeader
          signedIn={Boolean(user)}
          membership={membership}
          onOpenAccess={() => setStudioAccessOpen(true)}
          onAuthRequired={() => requestAuth("Sign in to open your studio activity.")}
        />
        <StudioAccessHub
          open={studioAccessOpen}
          membership={membership}
          onClose={() => setStudioAccessOpen(false)}
          onStartWriting={() => {
            setStudioAccessOpen(false);
            setActiveNav("studio");
            setScreen("writer");
          }}
          onOpenReadiness={() => {
            setStudioAccessOpen(false);
            setActiveNav("studio");
            setScreen("writer");
            setReadinessLaunchToken((current) => current + 1);
          }}
          onChooseRoom={() => {
            setStudioAccessOpen(false);
            setActiveNav("studio");
            setScreen("home");
            setStudioDnaOpen(true);
          }}
          onBrowseProducers={() => {
            setStudioAccessOpen(false);
            setMarketFocusCategory("producer");
            setActiveNav("market");
            setScreen("home");
          }}
          onManage={() => {
            setStudioAccessOpen(false);
            setActiveNav("profile");
            setScreen("home");
            window.requestAnimationFrame(() => document.getElementById("profile-membership")?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
        />
        {screen === "home" ? (
          <>
            {activeNav === "studio" && (
              <MobileHome
                completionPct={completionPct}
                syncMessage={syncMessage}
                saveStatus={saveStatus}
                boothReady={boothReady}
                sectionContent={sectionContent}
                activeSection={activeSection}
                roughTakeUrl={roughTakeUrl}
                roughTakeDuration={roughTakeDuration}
                roughTakeBeat={roughTakeBeat}
                roughTakeBeatPosition={roughTakeBeatPosition}
                recording={recording}
                recordingSeconds={recordingSeconds}
                recordError={recordError}
                onDeleteRoughTake={deleteRoughTake}
                roughTakeSaved={roughTakeSaved}
                roughTakeSaving={roughTakeSaving}
                onSaveRoughTake={saveRoughTake}
                activeSong={activeSong}
                songTitleDraft={titleDraft}
                titleEditing={titleEditing}
                titleStatus={titleStatus}
                songState={getSongState(completionPct, boothReady.score)}
                selectedBeat={selectedBeat}
                beatIntel={beatIntel}
                environmentIntel={environmentIntel}
                playing={playing}
                beatCurrentTime={beatCurrentTime}
                beatDuration={beatDuration}
                beatError={beatError}
                onTitleDraft={setTitleDraft}
                onStartTitleEdit={() => setTitleEditing(true)}
                onCancelTitleEdit={() => {
                  setTitleDraft(activeSong?.title ?? "Untitled Song");
                  setTitleEditing(false);
                  setTitleStatus({ state: "idle", message: "" });
                }}
                onSaveTitle={() => void saveSongTitle()}
                onToggleRecording={toggleRecording}
                onSetActiveSection={setActiveSection}
                onToggleBeat={toggleBeatPlayback}
                onSeekBeat={seekBeatPlayback}
                onCommitBeatSeek={queueUrgentSessionSync}
                onChangeBeat={() => setBeatSwitcherOpen(true)}
                onContinue={() => continueWriterFlow(true)}
                songs={songs}
                projects={projects}
                signedIn={Boolean(user)}
                onSyncRequest={() => requestAuth("Sign in to protect this draft across devices.")}
                onLoadSong={(song) => void loadMobileSong(song)}
                onNewSong={() => {
                  if (!user) {
                    requestAuth("Sign in to create and switch between songs.");
                    return;
                  }
                  setNewSongOpen(true);
                }}
                studioPack={activeStudioPack}
                studioPacks={studioPacks}
                studioDna={studioDna}
                studioAirPlaying={studioAirPlaying}
                getStudioPackAccess={getStudioPackAccess}
                onUnlockStudioPack={unlockStudioPack}
                onOpenMembership={() => {
                  setActiveNav("profile");
                  window.requestAnimationFrame(() => document.getElementById("profile-membership")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                onStudioPack={changeStudioPack}
                onPreviewStudioPack={previewStudioPack}
                onStudioDna={() => setStudioDnaOpen(true)}
                onToggleStudioAir={toggleStudioAir}
                onStudioAirVolume={changeStudioAirVolume}
              />
            )}
            {activeNav === "locker" && (
              <MobileLocker
                beats={beatLocker}
                starterBeats={starterBeats}
                songs={songLocker}
                hooks={hookLocker}
                roughTakes={roughTakes}
                sessionSongs={songs}
                activeStudioPack={activeStudioPack}
                productUnlocks={mergedProductUnlocks}
                orders={commerceOrders}
                loading={loading || loadingData || starterBeatsLoading}
                signedIn={Boolean(user)}
                error={workspaceError ?? starterBeatsError}
                onAuthRequired={() => requestAuth("Sign in to open your synced Locker.")}
                onResumeSong={(lockerSong) => {
                  const fullSong = songs.find((song) => song.id === lockerSong.song_id);
                  if (fullSong) {
                    void loadMobileSong(fullSong);
                    setActiveNav("studio");
                    return;
                  }
                  const sections = sectionsFromLockerSnapshot(lockerSong.snapshot);
                  if (!sections) return;
                  setSectionContent({ ...blankSections(), ...sections });
                  setActiveSection(0);
                  setActiveNav("studio");
                  setScreen("writer");
                  setSyncMessage(`${lockerSong.title} restored`);
                }}
                onPrepareSong={openLockerBoothExport}
                onUseHook={(hook) => {
                  const cleanHook = hook.content.trim();
                  if (!cleanHook) return;
                  setSectionContent((current) => ({
                    ...current,
                    [section.name]: [current[section.name]?.trim(), cleanHook].filter(Boolean).join("\n"),
                  }));
                  setActiveNav("studio");
                  setScreen("writer");
                  setSyncMessage(`${hook.title} inserted`);
                }}
                onUseBeat={(beat) => {
                  const snapshot = beatSnapshotFromLockerBeat(beat);
                  setSelectedBeat(snapshot);
                  setActiveNav("studio");
                  void runPadAction(`${beat.title} loaded into session.`, async () => {
                    if (!activeProjectId || !activeSongId) return;
                    await saveNow({
                      projectId: activeProjectId,
                      songId: activeSongId,
                      sessionId: session?.id,
                      beat: snapshot,
                      mode: activeStudioPack.id,
                      ambiance: activeStudioPack.id,
                      sectionContent,
                      activeSection: section.name,
                      songState: completionPct >= 67 ? 2 : 1,
                      completionPct,
                      boothScore: boothReady.score,
                      totalBars,
                    });
                  });
                }}
                onUseStarterBeat={(beat) => {
                  const snapshot = beatSnapshotFromStarterBeat(beat);
                  stopBeatPreview({ reset: true });
                  beatOffsetRef.current = 0;
                  beatCurrentTimeRef.current = 0;
                  setBeatCurrentTime(0);
                  selectBeatForSession(snapshot);
                  setActiveNav("studio");
                  setScreen("writer");
                  setSyncMessage(`${beat.title} loaded from Starter Beats`);
                }}
                onImportBeat={importPrivateBeat}
                onRemove={(kind, id) => void removeLockerItem(kind, id)}
                onGoToStudio={() => setActiveNav("studio")}
                onGoToMarket={() => setActiveNav("market")}
              />
            )}
            {activeNav === "market" && (
              <PremiumMarketplace
                focusCategory={marketFocusCategory}
                signedIn={Boolean(user)}
                onFavoriteBeat={(beat) => {
                  const snapshot = toBeatSnapshot(beat);
                  void runPadAction(`${beat.title} saved to Beat Locker.`, async () => {
                    await addBeatLicense(snapshot, "Favorite", 0);
                    trackMarketplaceEvent("beat_favorite", beat.id);
                  });
                }}
                onAddBeatToProject={(beat) => {
                  void runPadAction(`${beat.title} added to project.`, async () => {
                    const snapshot = toBeatSnapshot(beat);
                    setSelectedBeat(snapshot);
                    if (activeProjectId && activeSongId) {
                      await saveNow({
                        projectId: activeProjectId,
                        songId: activeSongId,
                        sessionId: session?.id,
                        beat: snapshot,
                        mode: activeStudioPack.id,
                        ambiance: activeStudioPack.id,
                        sectionContent,
                        activeSection: section.name,
                        songState: completionPct >= 67 ? 2 : 1,
                        completionPct,
                        boothScore: Math.max(boothReady.score, beat.boothReadyScore),
                        totalBars,
                      });
                    } else {
                      await ensureWorkspace({
                        title: "Untitled Project",
                        project_type: "EP",
                        sections: sectionContent,
                        beat: snapshot,
                      });
                    }
                    trackMarketplaceEvent("beat_add", beat.id);
                  });
                }}
                onLicenseBeat={licenseBeat}
                onPreviewBeat={previewMarketplaceBeat}
                playingBeatId={playing ? selectedBeat.id : null}
                status={padActionStatus}
                marketplaceFeed={marketplaceFeed}
                marketplaceFeedLoading={marketplaceFeedLoading}
                marketplaceFeedError={marketplaceFeedError}
                starterBeats={starterBeats}
                onUseStarterBeat={(beat) => {
                  const snapshot = beatSnapshotFromStarterBeat(beat);
                  stopBeatPreview({ reset: true });
                  beatOffsetRef.current = 0;
                  beatCurrentTimeRef.current = 0;
                  setBeatCurrentTime(0);
                  selectBeatForSession(snapshot);
                  setActiveNav("studio");
                  setScreen("writer");
                  setSyncMessage(`${beat.title} loaded from RapWriter Beats`);
                }}
                activeStudioPack={activeStudioPack}
                studioPacks={studioPacks}
                onStudioPack={changeStudioPack}
                artistPlanId={membership?.artist?.plan.id}
                allAccess={hasAllAccessMembership(membership)}
                productUnlocks={mergedProductUnlocks}
                onUnlockProduct={unlockProduct}
                onOpenMembership={() => {
                  setActiveNav("profile");
                  window.requestAnimationFrame(() => document.getElementById("profile-membership")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                onContinueWriting={() => {
                  setActiveNav("studio");
                  setScreen("writer");
                }}
                sessionContext={{
                  title: activeSong?.title ?? titleDraft,
                  mood: studioDna.mood,
                  writingStyle: studioDna.style,
                }}
              />
            )}
            {activeNav === "profile" && (
              <MobileProfile
                completionPct={completionPct}
                boothReady={boothReady}
                activeStudioPack={activeStudioPack}
                membership={membership}
                profile={profile}
                lockerCounts={lockerCounts}
                loading={loading || loadingData}
                signedIn={Boolean(user)}
                emailVerified={emailVerified}
                isAdmin={roles.includes("admin") || roles.includes("moderator")}
                error={workspaceError}
                onAuthRequired={() => requestAuth("Sign in to sync your artist profile.")}
                onExpandWorkspace={async () => {
                  await updateAccountRole("artist_producer");
                  setSyncMessage("Artist + Producer workspace ready");
                }}
                onProfileAvatar={updateProfileAvatar}
                onProfileIdentity={async (artistName) => updateProfileIdentity({ artistName })}
                onSignOut={signOut}
                onOpenStudio={() => {
                  setActiveNav("studio");
                  setScreen("writer");
                }}
                onOpenMarket={() => {
                  setMarketFocusCategory("producer");
                  setActiveNav("market");
                  setScreen("home");
                }}
              />
            )}
          </>
        ) : (
          <MobileWriter
            readinessLaunchToken={readinessLaunchToken}
            activeSection={activeSection}
            sectionContent={sectionContent}
            saveStatus={saveStatus}
            signedIn={Boolean(user)}
            boothReady={boothReady}
            padActions={padActions}
            playing={playing}
            recording={recording}
            recordingSeconds={recordingSeconds}
            roughTakeUrl={roughTakeUrl}
            roughTakeDuration={roughTakeDuration}
            roughTakeBeat={roughTakeBeat}
            roughTakeBeatPosition={roughTakeBeatPosition}
            recordError={recordError}
            roughTakeSaved={roughTakeSaved}
            roughTakeSaving={roughTakeSaving}
            selectedBeat={selectedBeat}
            environmentIntel={environmentIntel}
            beatCurrentTime={beatCurrentTime}
            beatDuration={beatDuration}
            beatError={beatError}
            onBack={() => setScreen("home")}
            onOpenHistory={() => void openVersionHistory()}
            onSyncRequest={() => requestAuth("Sign in to protect this draft and sync it across devices.")}
            onSetActiveSection={setActiveSection}
            onChange={changeActiveSectionContent}
            onToggleBeat={toggleBeatPlayback}
            onSeekBeat={seekBeatPlayback}
            onCommitBeatSeek={queueUrgentSessionSync}
            onChangeBeat={() => setBeatSwitcherOpen(true)}
            onToggleRecording={toggleRecording}
            onDeleteRoughTake={deleteRoughTake}
            onSaveRoughTake={saveRoughTake}
            onPrepareForBooth={() => void openCurrentBoothExport()}
            studioPack={activeStudioPack}
            studioDna={studioDna}
            studioAirPlaying={studioAirPlaying}
            artistMembership={membership?.artist ?? null}
            onToggleStudioAir={toggleStudioAir}
            onStudioAirVolume={changeStudioAirVolume}
            onUpgrade={() => {
              setScreen("home");
              setActiveNav("profile");
              setSyncMessage("Choose the membership that fits your studio");
            }}
            producerActions={{
              proposal: producerActionProposal,
              status: producerActionStatus,
              error: producerActionError,
              onGenerate: (actionType, attempt) => void generateProducerRevision(actionType, attempt),
              onAccept: () => void resolveProducerRevision("accept"),
              onReject: () => void resolveProducerRevision("reject"),
              onRetry: () => void tryAnotherProducerRevision(),
              onUndo: () => void resolveProducerRevision("revert"),
            }}
          />
        )}
        <BeatSwitcherSheet
          open={beatSwitcherOpen}
          signedIn={Boolean(user)}
          currentBeat={selectedBeat}
          starterBeats={starterBeats}
          lockerBeats={beatLocker}
          marketplaceBeats={marketplaceFeed.beats}
          marketplaceLoading={marketplaceFeedLoading}
          marketplaceError={marketplaceFeedError}
          onClose={() => setBeatSwitcherOpen(false)}
          onPreviewStart={() => stopBeatPreview()}
          onImportBeat={importPrivateBeat}
          onAuthRequired={() => {
            setBeatSwitcherOpen(false);
            requestAuth("Sign in to import a private beat into your Locker.");
          }}
          onUseBeat={(beat) => {
            const snapshot = beatSnapshotFromLockerBeat(beat);
            stopBeatPreview({ reset: true });
            beatOffsetRef.current = 0;
            beatCurrentTimeRef.current = 0;
            setBeatCurrentTime(0);
            selectBeatForSession(snapshot);
            setBeatSwitcherOpen(false);
            setSyncMessage(`${beat.title} loaded. Saving session...`);
          }}
          onUseStarterBeat={(beat) => {
            const snapshot = beatSnapshotFromStarterBeat(beat);
            stopBeatPreview({ reset: true });
            beatOffsetRef.current = 0;
            beatCurrentTimeRef.current = 0;
            setBeatCurrentTime(0);
            selectBeatForSession(snapshot);
            setBeatSwitcherOpen(false);
            setSyncMessage(`${beat.title} loaded. Saving session...`);
          }}
        />
        {screen === "home" && (
          <MobileBottomNav
            activeNav={activeNav}
            onChange={(view) => {
              if (view === "market") setMarketFocusCategory(null);
              setActiveNav(view);
              setScreen("home");
            }}
          />
        )}
        <MobileAuthDrawer {...authDrawerProps} />
        <StudioDnaSheet
          open={studioDnaOpen}
          dna={studioDna}
          studioPacks={studioPacks}
          canUseStudioPack={canUseStudioPack}
          onChange={updateStudioDna}
          onClose={() => setStudioDnaOpen(false)}
          onStart={startStudioDnaSession}
        />
        <NewSongSheet
          open={newSongOpen}
          title={newSongTitle}
          startSection={newSongStartSection}
          useCurrentBeat={newSongUseBeat}
          beat={selectedBeat}
          status={songSwitchStatus}
          onTitle={setNewSongTitle}
          onStartSection={setNewSongStartSection}
          onUseCurrentBeat={setNewSongUseBeat}
          onClose={() => setNewSongOpen(false)}
          onCreate={() =>
            void createMobileSong({
              title: newSongTitle,
              startSection: newSongStartSection,
              useCurrentBeat: newSongUseBeat,
            })
          }
        />
        <VersionHistorySheet
          open={versionHistoryOpen}
          sectionName={section.name}
          currentContent={sectionContent[section.name] ?? ""}
          versions={sectionVersions}
          status={versionHistoryStatus}
          error={versionHistoryError}
          onClose={() => setVersionHistoryOpen(false)}
          onRestore={(versionId) => void restoreSectionVersion(versionId)}
        />
        <BoothExportSheet
          open={boothExportOpen}
          draft={boothExportDraft}
          exportRecord={boothExportRecord}
          status={boothExportStatus}
          error={boothExportError}
          premiumExports={membership?.artist?.entitlements.premium_exports === true}
          onClose={() => setBoothExportOpen(false)}
          onFreeze={() => void freezeBoothExport()}
          onUpgrade={() => {
            setBoothExportOpen(false);
            setScreen("home");
            setActiveNav("profile");
            setSyncMessage("Prep Studio Pro unlocks the full Booth package");
          }}
        />
        {user && profile && !profile.role_onboarding_completed && (
          <MobileRoleOnboarding
            artistName={profile.artist_name || profile.display_name || profile.email?.split("@")[0] || "Artist"}
            onComplete={async (accountType) => {
              await updateAccountRole(accountType);
              if (accountType === "producer") window.location.assign("/producer");
            }}
          />
        )}
        {user && profile && profile.role_onboarding_completed && !profile.first_session_completed && hasArtistWorkspace(profile.account_type) && (
          <MobileFirstSessionActivation
            artistName={profile.artist_name || profile.display_name || profile.email?.split("@")[0] || "Artist"}
            beat={selectedBeat}
            onComplete={async ({ artistGoal, projectTitle, songTitle, useBeat }) => {
              const activation = await activateFirstSession({
                artistGoal,
                projectTitle,
                songTitle,
                beat: useBeat ? selectedBeat : null,
              });
              if (!activation) throw new Error("Could not start your first session.");
              const nextBeat = useBeat ? selectedBeat : EMPTY_BEAT;
              setSectionContent(blankSections());
              setActiveSection(0);
              setSelectedBeat(nextBeat);
              setTitleDraft(activation.song.title);
              setSyncMessage("First session ready");
              setActiveNav("studio");
              setScreen("writer");
            }}
          />
        )}
      </div>
    </main>
  );
}

function MobileHome({
  completionPct,
  boothReady,
  syncMessage,
  saveStatus,
  sectionContent,
  activeSection,
  roughTakeUrl,
  roughTakeDuration,
  roughTakeBeat,
  roughTakeBeatPosition,
  recording,
  recordingSeconds,
  recordError,
  onDeleteRoughTake,
  roughTakeSaved,
  roughTakeSaving,
  onSaveRoughTake,
  activeSong,
  songTitleDraft,
  titleEditing,
  titleStatus,
  songState,
  selectedBeat,
  beatIntel,
  environmentIntel,
  playing,
  beatCurrentTime,
  beatDuration,
  beatError,
  onTitleDraft,
  onStartTitleEdit,
  onCancelTitleEdit,
  onSaveTitle,
  onToggleRecording,
  onSetActiveSection,
  onToggleBeat,
  onSeekBeat,
  onCommitBeatSeek,
  onChangeBeat,
  onContinue,
  songs,
  projects,
  signedIn,
  onSyncRequest,
  onLoadSong,
  onNewSong,
  studioPack,
  studioPacks,
  studioDna,
  studioAirPlaying,
  getStudioPackAccess,
  onUnlockStudioPack,
  onOpenMembership,
  onStudioPack,
  onPreviewStudioPack,
  onStudioDna,
  onToggleStudioAir,
  onStudioAirVolume,
}: {
  completionPct: number;
  boothReady: BoothReadyResult;
  syncMessage: string;
  saveStatus: "saved" | "saving" | "error";
  sectionContent: Record<string, string>;
  activeSection: number;
  roughTakeUrl: string | null;
  roughTakeDuration: number;
  roughTakeBeat: SelectedBeat | null;
  roughTakeBeatPosition: number;
  recording: boolean;
  recordingSeconds: number;
  recordError: string | null;
  onDeleteRoughTake: () => void;
  roughTakeSaved: boolean;
  roughTakeSaving: boolean;
  onSaveRoughTake: () => void;
  activeSong: SongRow | null;
  songTitleDraft: string;
  titleEditing: boolean;
  titleStatus: PadActionStatus;
  songState: { label: string; tone: "muted" | "gold" | "green" };
  selectedBeat: SelectedBeat;
  beatIntel: BeatIntelligence;
  environmentIntel: EnvironmentIntelligence;
  playing: boolean;
  beatCurrentTime: number;
  beatDuration: number;
  beatError: string | null;
  onTitleDraft: (value: string) => void;
  onStartTitleEdit: () => void;
  onCancelTitleEdit: () => void;
  onSaveTitle: () => void;
  onToggleRecording: () => void;
  onSetActiveSection: (index: number) => void;
  onToggleBeat: () => void;
  onSeekBeat: (seconds: number) => void;
  onCommitBeatSeek: () => void;
  onChangeBeat: () => void;
  onContinue: () => void;
  songs: SongRow[];
  projects: ProjectRow[];
  signedIn: boolean;
  onSyncRequest: () => void;
  onLoadSong: (song: SongRow) => void;
  onNewSong: () => void;
  studioPack: StudioPack;
  studioPacks: StudioPack[];
  studioDna: StudioDna;
  studioAirPlaying: boolean;
  getStudioPackAccess: (id: StudioPackId) => StudioRoomAccess;
  onUnlockStudioPack: (id: StudioPackId) => void;
  onOpenMembership: () => void;
  onStudioPack: (id: StudioPackId) => void;
  onPreviewStudioPack: (id: StudioPackId) => void;
  onStudioDna: () => void;
  onToggleStudioAir: (index: number) => void;
  onStudioAirVolume: (volume: number) => void;
}) {
  const section = mobileSections[activeSection];
  const [studioPackSheetOpen, setStudioPackSheetOpen] = useState(false);
  const [studioAirOpen, setStudioAirOpen] = useState(false);
  const previewLines = (sectionContent[section.name] || "").split("\n").filter((line) => line.trim());
  const songTitle = activeSong?.title ?? "Untitled Song";
  const projectTitle = getProjectTitle(activeSong) ?? "No project selected";
  const sessionStatus = signedIn
    ? saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "error"
        ? "Saved on device. Sync pending"
        : syncMessage
    : "Saved on device";
  const padStatus = saveStatus === "saving" ? "Saving" : saveStatus === "error" ? "On device" : "Saved";

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <section className="relative h-[288px] overflow-hidden">
        <img
          src={studioPack.image}
          alt={studioPack.label}
          className="studio-depth-shift absolute inset-0 h-full w-full object-cover transition-[object-position,filter] duration-700"
          style={{ objectPosition: studioPack.position }}
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        <div className="absolute inset-0 transition-colors duration-700" style={{ background: studioPack.overlay }} />
        <div className="absolute bottom-8 left-5 right-5">
          <h1 className="max-w-[22rem] text-[30px] font-semibold leading-[1.05]">{studioPack.headline}</h1>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStudioPackSheetOpen(true)}
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-gold/25 bg-black/38 px-3 py-1.5 text-left text-sm font-medium text-gold backdrop-blur-md"
              aria-label="Open studio packs"
            >
              <span className="truncate">{studioPack.label}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setStudioAirOpen(true)}
              className={cn(
                "relative grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-black/38 backdrop-blur-md",
                studioAirPlaying ? "border-gold/45 text-gold" : "border-gold/25 text-gold/75",
              )}
              aria-label="Open room ambience"
              title="Room ambience"
            >
              <Headphones className="h-3.5 w-3.5" />
              {studioAirPlaying && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />}
            </button>
          </div>
        </div>
      </section>

      <section className="px-5">
        <div className="-mt-1 label-hw mb-2">Last project</div>
        <div className="rounded-2xl border border-white/10 bg-[#151516]/92 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.34)]">
          <div className="flex items-center gap-3">
            <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-gold/20 bg-black">
              <img src="/brand/rapwriter-main-logo.webp" alt="Project artwork" className="h-full w-full object-cover" draggable={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {titleEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={songTitleDraft}
                        onChange={(event) => onTitleDraft(event.target.value)}
                        className="min-h-10 min-w-0 flex-1 rounded-xl border border-gold/30 bg-black/42 px-3 text-base font-semibold outline-none"
                        maxLength={160}
                        autoFocus
                      />
                      <button onClick={onSaveTitle} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-black" aria-label="Save song title">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={onCancelTitleEdit} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Cancel title edit">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-lg font-semibold leading-tight">{songTitle}</div>
                      <button onClick={onStartTitleEdit} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Rename song">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{projectTitle}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        songState.tone === "green"
                          ? "bg-emerald-500/14 text-emerald-300"
                          : songState.tone === "gold"
                            ? "bg-gold/12 text-gold"
                            : "bg-white/8 text-muted-foreground",
                      )}
                    >
                      {songState.label}
                    </span>
                  </div>
                  {titleStatus.message && (
                    <div className={cn("mt-2 text-[11px]", titleStatus.state === "error" ? "text-rec" : "text-gold")}>{titleStatus.message}</div>
                  )}
                </div>
                <div className="pt-8 text-xs tabular-nums text-white/85">{completionPct}%</div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
                <div className="h-full rounded-full bg-[var(--amber)] shadow-[0_0_14px_rgba(246,199,72,0.55)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-3 flex min-h-9 items-center justify-between border-t border-white/10 pt-3 text-xs">
            <span className="text-muted-foreground">Session status</span>
            {signedIn ? (
              <span className="text-right text-gold">{sessionStatus}</span>
            ) : (
              <button type="button" onClick={onSyncRequest} className="inline-flex items-center gap-1.5 text-right font-semibold text-gold" aria-label="Protect device-only draft">
                <CloudOff className="h-3.5 w-3.5" />
                On this device
              </button>
            )}
          </div>
        </div>

        {projects.length <= 1 && (
          <button type="button" onClick={onNewSong} className="ml-auto mt-2 flex min-h-10 items-center gap-2 px-1 text-xs font-semibold text-white/65">
            <FolderPlus className="h-4 w-4 text-gold" />
            New song
          </button>
        )}
      </section>

      {projects.length > 1 && (
        <MobileProjectRail
          projects={projects}
          songs={songs}
          activeProjectId={activeSong?.project_id}
          studioPacks={studioPacks}
          onLoadSong={onLoadSong}
          onNewSong={onNewSong}
        />
      )}

      <section className="space-y-3 px-5 pt-5">
        <div className="rounded-2xl border border-white/10 bg-[#111113] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="label-hw">Writing pad</div>
              <div className="mt-1 text-sm text-white/90">{section.name} - target {section.target} bars</div>
            </div>
            <div
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                saveStatus === "error" ? "bg-gold/12 text-gold" : "bg-emerald-500/14 text-emerald-300",
              )}
            >
              {padStatus}
            </div>
          </div>
          <MobileSectionTabs sectionContent={sectionContent} activeSection={activeSection} onSetActiveSection={onSetActiveSection} preview />
          <div className="rounded-xl border border-border bg-black/35 p-3">
            <PadTransport
              beat={selectedBeat}
              playing={playing}
              recording={recording}
              compact={false}
              currentTime={beatCurrentTime}
              duration={beatDuration}
              error={beatError}
              onToggleBeat={onToggleBeat}
              onSeek={onSeekBeat}
              onSeekCommit={onCommitBeatSeek}
              onChangeBeat={onChangeBeat}
              onToggleRecording={onToggleRecording}
            />
            <RoughTakeStrip
              compact
              recording={recording}
              recordingSeconds={recordingSeconds}
              roughTakeUrl={roughTakeUrl}
              roughTakeDuration={roughTakeDuration}
              beat={roughTakeBeat}
              beatStartTime={roughTakeBeatPosition}
              error={recordError}
              saved={roughTakeSaved}
              saving={roughTakeSaving}
              analyzing={boothReady.performance.analyzing}
              analysis={boothReady.performance.analysis}
              onDelete={onDeleteRoughTake}
              onSave={onSaveRoughTake}
            />
            <button
              type="button"
              onClick={onContinue}
              data-testid="open-writer-flow"
              className="mt-3 min-h-[112px] w-full rounded-xl px-1 py-2 text-left font-mono text-[13px] leading-7 text-white/90 outline-none transition-colors hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-gold/45"
              aria-label={`Continue writing ${section.name}`}
            >
              {previewLines.length ? (
                previewLines.slice(0, 3).map((line, index) => <p key={`${section.name}-${index}`}>{line}</p>)
              ) : (
                <p className="text-white/40">Tap to start {section.name}...</p>
              )}
              <span className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-xs font-sans font-semibold text-gold">
                Continue {section.name}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </div>

        <MobileDrawer title="Session Guide" defaultOpen>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="label-hw text-gold/80">Best next action</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{completionPct}% complete</div>
            </div>
            <div className="mt-2 text-lg font-semibold">{beatIntel.nextMoveTitle}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{beatIntel.nextMoveBody}</p>
            <details className="group mt-4 border-t border-white/10 pt-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white/72">
                Session direction
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 pb-1 pt-2">
                <div>
                  <div className="label-hw">Beat pocket</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beatIntel.beatBrief}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {beatIntel.beatTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-gold/20 bg-gold/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-gold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="label-hw">Section cue</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beatIntel.sectionCue}</p>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="label-hw">Room direction</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">{studioDnaCue(studioDna, studioPack)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">{environmentIntel.missionCue}</p>
                </div>
              </div>
            </details>
          </div>
        </MobileDrawer>
        <MobileDrawer title="Producer Notes">
          <ProducerPassPanel
            sectionName={section.name}
            sectionText={sectionContent[section.name] ?? ""}
            beat={selectedBeat}
            studioDna={studioDna}
            environmentIntel={environmentIntel}
          />
        </MobileDrawer>
        <MobileDrawer title="Record Readiness">
          <BoothReadyPanel
            result={boothReady}
            environmentIntel={environmentIntel}
            onPrimaryAction={() => {
              if (boothReady.primaryAction === "record") {
                onToggleRecording();
                return;
              }
              if (boothReady.primaryAction === "save_take") {
                onSaveRoughTake();
                return;
              }
              onContinue();
            }}
          />
        </MobileDrawer>
      </section>
      <StudioPackSheet
        open={studioPackSheetOpen}
        active={studioPack.id}
        packs={studioPacks}
        getStudioPackAccess={getStudioPackAccess}
        onClose={() => setStudioPackSheetOpen(false)}
        onUnlock={onUnlockStudioPack}
        onPreview={onPreviewStudioPack}
        onOpenMembership={() => {
          setStudioPackSheetOpen(false);
          onOpenMembership();
        }}
        onStudioDna={() => {
          setStudioPackSheetOpen(false);
          onStudioDna();
        }}
        onSelect={(id) => {
          onStudioPack(id);
          setStudioPackSheetOpen(false);
        }}
      />
      <StudioAirSheet
        open={studioAirOpen}
        studioPack={studioPack}
        activeIndex={studioDna.studioAir.activeIndex}
        playing={studioAirPlaying}
        volume={studioDna.studioAir.volume}
        onClose={() => setStudioAirOpen(false)}
        onToggle={onToggleStudioAir}
        onVolume={onStudioAirVolume}
      />
    </div>
  );
}

function MobileWriter({
  readinessLaunchToken,
  activeSection,
  sectionContent,
  saveStatus,
  signedIn,
  boothReady,
  padActions,
  playing,
  recording,
  recordingSeconds,
  roughTakeUrl,
  roughTakeDuration,
  roughTakeBeat,
  roughTakeBeatPosition,
  recordError,
  roughTakeSaved,
  roughTakeSaving,
  selectedBeat,
  environmentIntel,
  beatCurrentTime,
  beatDuration,
  beatError,
  onBack,
  onOpenHistory,
  onSyncRequest,
  onSetActiveSection,
  onChange,
  onToggleBeat,
  onSeekBeat,
  onCommitBeatSeek,
  onChangeBeat,
  onToggleRecording,
  onDeleteRoughTake,
  onSaveRoughTake,
  onPrepareForBooth,
  studioPack,
  studioDna,
  studioAirPlaying,
  artistMembership,
  onUpgrade,
  onToggleStudioAir,
  onStudioAirVolume,
  producerActions,
}: {
  readinessLaunchToken: number;
  activeSection: number;
  sectionContent: Record<string, string>;
  saveStatus: "saved" | "saving" | "error";
  signedIn: boolean;
  boothReady: BoothReadyResult;
  padActions: PadActions;
  playing: boolean;
  recording: boolean;
  recordingSeconds: number;
  roughTakeUrl: string | null;
  roughTakeDuration: number;
  roughTakeBeat: SelectedBeat | null;
  roughTakeBeatPosition: number;
  recordError: string | null;
  roughTakeSaved: boolean;
  roughTakeSaving: boolean;
  selectedBeat: SelectedBeat;
  environmentIntel: EnvironmentIntelligence;
  beatCurrentTime: number;
  beatDuration: number;
  beatError: string | null;
  onBack: () => void;
  onOpenHistory: () => void;
  onSyncRequest: () => void;
  onSetActiveSection: (index: number) => void;
  onChange: (value: string) => void;
  onToggleBeat: () => void;
  onSeekBeat: (seconds: number) => void;
  onCommitBeatSeek: () => void;
  onChangeBeat: () => void;
  onToggleRecording: () => void;
  onDeleteRoughTake: () => void;
  onSaveRoughTake: () => void;
  onPrepareForBooth: () => void;
  studioPack: StudioPack;
  studioDna: StudioDna;
  studioAirPlaying: boolean;
  artistMembership: WorkspaceMembership | null;
  onUpgrade: () => void;
  onToggleStudioAir: (index: number) => void;
  onStudioAirVolume: (volume: number) => void;
  producerActions: ProducerActionControls;
}) {
  const section = mobileSections[activeSection];
  const sectionText = sectionContent[section.name] ?? "";
  const [penView, setPenView] = useState(false);
  const [ghostwriterOpen, setGhostwriterOpen] = useState(false);
  const [studioAirOpen, setStudioAirOpen] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [transportCompact, setTransportCompact] = useState(false);
  const writerScrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorPositionsRef = useRef<Record<string, { selectionStart: number; selectionEnd: number; scrollTop: number }>>({});
  const sectionBars = countBars(sectionText);
  const sectionWords = sectionText.trim() ? sectionText.trim().split(/\s+/).length : 0;
  const progressPct = Math.min(100, Math.round((sectionBars / section.target) * 100));
  const momentum = getWritingMomentum(section.name, sectionBars, section.target, boothReady);
  const writerSaveLabel = !signedIn ? "On device" : saveStatus === "error" ? "On device" : saveStatus;
  const hasPenView = artistMembership?.entitlements.full_pen_view === true;
  const hasHistory = artistMembership?.entitlements.version_history === true;
  const hasGhostwriter = artistMembership?.entitlements.ghostwriter === true;

  useEffect(() => {
    if (readinessLaunchToken > 0) setReadinessOpen(true);
  }, [readinessLaunchToken]);

  const rememberEditorPosition = useCallback((sectionName: string, editor = editorRef.current) => {
    if (!editor) return;
    editorPositionsRef.current[sectionName] = {
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      scrollTop: editor.scrollTop,
    };
  }, []);

  const switchSection = useCallback((index: number) => {
    if (index === activeSection) return;
    rememberEditorPosition(section.name);
    onSetActiveSection(index);
  }, [activeSection, onSetActiveSection, rememberEditorPosition, section.name]);

  useEffect(() => {
    if (penView) return;
    const frame = window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const savedPosition = editorPositionsRef.current[section.name];
      if (savedPosition) {
        const textLength = editor.value.length;
        editor.setSelectionRange(
          Math.min(savedPosition.selectionStart, textLength),
          Math.min(savedPosition.selectionEnd, textLength),
        );
        editor.scrollTop = savedPosition.scrollTop;
      }
      editor.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [penView, section.name]);

  return (
    <div
      ref={writerScrollRef}
      data-testid="writer-scroll"
      onScroll={(event) => setTransportCompact(event.currentTarget.scrollTop > 180)}
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#050506]"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cover opacity-[0.17] blur-[1px] saturate-[0.78]"
        style={{ backgroundImage: `url('${studioPack.image}')`, backgroundPosition: studioPack.position }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: studioPack.overlay }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(246,199,72,0.12),transparent_42%)]" />
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/52 px-5 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Exit writer">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <div className="label-hw text-gold">Writer Flow</div>
          <button
            type="button"
            onClick={() => setStudioAirOpen(true)}
            className="mx-auto mt-1 flex max-w-[13.5rem] items-center gap-1.5 text-xs text-muted-foreground"
            aria-label="Open room ambience"
          >
            <Headphones className={cn("h-3 w-3 shrink-0", studioAirPlaying && "text-gold")} />
            <span className="truncate">{studioPack.label}</span>
            {studioAirPlaying && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />}
          </button>
        </div>
        <button
          type="button"
          onClick={signedIn ? onOpenHistory : onSyncRequest}
          aria-label={signedIn ? "Open revision history" : "Protect device-only draft"}
          title={signedIn ? "Revision history" : "Sign in to sync"}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-white/8",
            !signedIn || saveStatus === "error" ? "bg-gold/12 text-gold" : "bg-emerald-500/12 text-emerald-300",
          )}
        >
          {signedIn ? <History className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
          {writerSaveLabel}
        </button>
      </div>

      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#070708]/94 backdrop-blur-xl">
        <MobileSectionTabs sectionContent={sectionContent} activeSection={activeSection} onSetActiveSection={switchSection} />
      </div>

      <div className="relative z-10 bg-[#070708]/88 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 pb-4 pt-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="label-hw">Now writing</div>
              <div className="mt-1 text-lg font-semibold">{section.name}</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div><span className="text-gold">{sectionBars}</span> / {section.target} bars</div>
              <div className="mt-1">{sectionWords} words</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold shadow-[0_0_16px_rgba(246,199,72,0.5)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${progressPct}%` }} />
          </div>
          <div key={momentum.label} className="mt-3 flex min-h-12 items-center gap-3 border-t border-white/10 pt-3 animate-[fade-in_240ms_ease-out] motion-reduce:animate-none">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/10 text-gold">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gold">{momentum.label}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{momentum.detail}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-none flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="sticky top-16 z-20 mb-3 transition-[padding] duration-200">
          <PadTransport
            beat={selectedBeat}
            playing={playing}
            recording={recording}
            compact={transportCompact}
            currentTime={beatCurrentTime}
            duration={beatDuration}
            error={beatError}
            onToggleBeat={onToggleBeat}
            onSeek={onSeekBeat}
            onSeekCommit={onCommitBeatSeek}
            onChangeBeat={onChangeBeat}
            onToggleRecording={onToggleRecording}
          />
          <RoughTakeStrip
            recording={recording}
            recordingSeconds={recordingSeconds}
            roughTakeUrl={roughTakeUrl}
            roughTakeDuration={roughTakeDuration}
            beat={roughTakeBeat}
            beatStartTime={roughTakeBeatPosition}
            error={recordError}
            saved={roughTakeSaved}
            saving={roughTakeSaving}
            analyzing={boothReady.performance.analyzing}
            analysis={boothReady.performance.analysis}
            onDelete={onDeleteRoughTake}
            onSave={onSaveRoughTake}
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/26 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-gold/28 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_3px_rgba(246,199,72,0.055),0_18px_50px_rgba(0,0,0,0.3)]">
          {penView ? (
            <PenView sectionName={section.name} text={sectionText} />
          ) : (
            <textarea
              ref={editorRef}
              autoFocus
              value={sectionText}
              onChange={(event) => {
                onChange(event.target.value);
                rememberEditorPosition(section.name, event.currentTarget);
              }}
              onSelect={(event) => rememberEditorPosition(section.name, event.currentTarget)}
              onScroll={(event) => rememberEditorPosition(section.name, event.currentTarget)}
              onBlur={(event) => rememberEditorPosition(section.name, event.currentTarget)}
              placeholder={`Start ${section.name}...`}
              aria-label={`${section.name} lyrics`}
              spellCheck={false}
              style={{
                backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 35px, rgba(255,255,255,0.05) 36px)",
                backgroundPosition: "0 20px",
                backgroundSize: "100% 36px",
              }}
              className="min-h-[54svh] w-full flex-none resize-none bg-transparent p-5 font-sans text-[18px] leading-9 text-white/92 caret-gold outline-none placeholder:text-white/28"
            />
          )}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-1 border-t border-white/10 bg-black/24 p-1.5 backdrop-blur-xl">
            <div className="min-w-0 px-2">
              <div className="text-[10px] font-semibold tabular-nums text-white/72">{sectionBars} / {section.target} bars</div>
              <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.13em] text-emerald-300/80">{writerSaveLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => hasPenView ? setPenView((current) => !current) : onUpgrade()}
              className={cn(
                "flex min-h-10 flex-col items-center justify-center rounded-full border px-2.5 text-[9px] font-semibold transition-colors",
                penView ? "border-gold/45 bg-gold/14 text-gold" : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.035]",
              )}
              aria-pressed={penView}
            >
              <Pencil className="mb-0.5 h-3.5 w-3.5" />
              {penView ? "Edit" : hasPenView ? "Pen View" : "Pen Pro"}
            </button>
            <button type="button" onClick={!signedIn ? onSyncRequest : hasHistory ? onOpenHistory : onUpgrade} className="flex min-h-10 flex-col items-center justify-center rounded-full border border-transparent px-2.5 text-[9px] font-semibold text-muted-foreground transition-colors hover:border-white/10 hover:bg-white/[0.035]">
              <History className="mb-0.5 h-3.5 w-3.5" />
              {hasHistory ? "History" : "History Pro"}
            </button>
            <button type="button" onClick={padActions.onSaveHook} disabled={padActions.status.state === "saving"} className="flex min-h-10 flex-col items-center justify-center rounded-full border border-transparent px-2.5 text-[9px] font-semibold text-gold transition-colors hover:border-gold/20 hover:bg-gold/[0.06] disabled:opacity-50">
              <Save className="mb-0.5 h-3.5 w-3.5" />
              Save hook
            </button>
          </div>
        </div>
        {padActions.status.message && (
          <div className={cn("mt-2 text-center text-[11px]", padActions.status.state === "error" ? "text-rec" : "text-gold")}>{padActions.status.message}</div>
        )}
        <button
          type="button"
          onClick={() => hasGhostwriter ? setGhostwriterOpen(true) : onUpgrade()}
          className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-gold/35 bg-gold/10 px-4 text-sm font-semibold text-gold"
        >
          <span className="inline-flex items-center gap-2"><WandSparkles className="h-4 w-4" />Ghostwriter{hasGhostwriter ? "" : " Pro"}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-4 space-y-2 pb-4">
          <MobileDrawer title="Session Actions">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Save song", icon: Briefcase, action: padActions.onSaveSong },
                { label: "Save beat", icon: Heart, action: padActions.onFavoriteBeat },
                { label: "Add to project", icon: FolderPlus, action: padActions.onAddBeatToProject },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} type="button" onClick={item.action} className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/22 px-2 text-[10px] font-semibold text-muted-foreground">
                    <Icon className="h-4 w-4 text-gold" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </MobileDrawer>
          <MobileDrawer title="Record Readiness" open={readinessOpen} onOpenChange={setReadinessOpen}>
            <BoothReadyPanel
              result={boothReady}
              environmentIntel={environmentIntel}
              onPrimaryAction={() => {
                if (boothReady.primaryAction === "record") {
                  onToggleRecording();
                  return;
                }
                if (boothReady.primaryAction === "save_take") {
                  onSaveRoughTake();
                  return;
                }
                if (boothReady.score >= 75) {
                  onPrepareForBooth();
                  return;
                }
                setGhostwriterOpen(true);
              }}
            />
          </MobileDrawer>
        </div>
      </div>
      <GhostwriterSheet
        open={ghostwriterOpen}
        sectionName={section.name}
        sectionText={sectionText}
        beat={selectedBeat}
        studioDna={studioDna}
        environmentIntel={environmentIntel}
        actions={producerActions}
        membership={artistMembership}
        onUpgrade={onUpgrade}
        onClose={() => setGhostwriterOpen(false)}
      />
      <StudioAirSheet
        open={studioAirOpen}
        studioPack={studioPack}
        activeIndex={studioDna.studioAir.activeIndex}
        playing={studioAirPlaying}
        volume={studioDna.studioAir.volume}
        onClose={() => setStudioAirOpen(false)}
        onToggle={onToggleStudioAir}
        onVolume={onStudioAirVolume}
      />
    </div>
  );
}

function RoughTakeStrip({
  recording,
  recordingSeconds,
  roughTakeUrl,
  roughTakeDuration,
  error,
  saved,
  saving,
  analyzing,
  analysis,
  beat,
  beatStartTime,
  compact = false,
  onDelete,
  onSave,
}: {
  recording: boolean;
  recordingSeconds: number;
  roughTakeUrl: string | null;
  roughTakeDuration: number;
  error: string | null;
  saved: boolean;
  saving: boolean;
  analyzing: boolean;
  analysis: RoughTakeAnalysis | null;
  beat: SelectedBeat | null;
  beatStartTime: number;
  compact?: boolean;
  onDelete: () => void;
  onSave: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reviewBeatRef = useRef<HTMLAudioElement | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [reviewTime, setReviewTime] = useState(0);
  const beatPreviewUrl = beat ? resolveBeatPreviewUrl(beat) : null;

  useEffect(() => {
    audioRef.current?.pause();
    reviewBeatRef.current?.pause();
    setReviewPlaying(false);
    setReviewTime(0);
  }, [beat?.id, roughTakeUrl]);

  useEffect(() => () => {
    audioRef.current?.pause();
    reviewBeatRef.current?.pause();
  }, []);

  if (!recording && !roughTakeUrl && !error) return null;

  const toggleReview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (reviewPlaying) {
      audio.pause();
      reviewBeatRef.current?.pause();
      setReviewPlaying(false);
      return;
    }
    const reviewBeat = reviewBeatRef.current;
    if (reviewBeat) {
      const beatDuration = beat ? getBeatDurationSeconds(beat) : 0;
      reviewBeat.currentTime = beatDuration > 0 ? (beatStartTime + audio.currentTime) % beatDuration : beatStartTime + audio.currentTime;
      void reviewBeat.play().catch(() => undefined);
    }
    void audio.play().then(() => setReviewPlaying(true)).catch(() => {
      reviewBeat?.pause();
      setReviewPlaying(false);
    });
  };

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-black/28 p-3", compact ? "mt-3" : "mt-3")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="label-hw text-gold/85">Rough Take</div>
          <div className="mt-1 text-sm text-white/90">
            {recording ? `Recording ${formatDuration(recordingSeconds)}` : roughTakeUrl ? `${saved ? "Saved take" : "Review take"} ${formatDuration(roughTakeDuration)}` : "Mic unavailable"}
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
            recording
              ? "bg-rec/12 text-rec"
              : saved
                ? "bg-emerald-500/14 text-emerald-300"
                : "bg-gold/10 text-gold",
          )}
        >
          {recording ? "Live" : analyzing ? "Analyzing" : saved ? "Kept" : "Unsaved"}
        </div>
      </div>

      {recording && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rec/20 bg-rec/8 p-3">
          <div className="h-2.5 w-2.5 rounded-full bg-rec shadow-[0_0_18px_rgba(255,71,87,0.8)]" />
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full animate-pulse rounded-full bg-rec" style={{ width: `${Math.min(100, recordingSeconds * 3)}%` }} />
            </div>
          </div>
          <span className="text-xs tabular-nums text-rec">{formatDuration(recordingSeconds)}</span>
        </div>
      )}

      {roughTakeUrl && !recording && (
        <div className="mt-3 rounded-xl border border-white/10 bg-[#111113] p-3">
          <audio
            ref={audioRef}
            src={roughTakeUrl}
            preload="metadata"
            onTimeUpdate={(event) => {
              const nextTime = event.currentTarget.currentTime;
              setReviewTime(nextTime);
              const reviewBeat = reviewBeatRef.current;
              if (!reviewBeat || !beat) return;
              const beatDuration = getBeatDurationSeconds(beat);
              const expectedTime = beatDuration > 0 ? (beatStartTime + nextTime) % beatDuration : beatStartTime + nextTime;
              if (Math.abs(reviewBeat.currentTime - expectedTime) > 0.35) reviewBeat.currentTime = expectedTime;
            }}
            onEnded={() => {
              const reviewBeat = reviewBeatRef.current;
              reviewBeat?.pause();
              if (reviewBeat) reviewBeat.currentTime = beatStartTime;
              setReviewPlaying(false);
              setReviewTime(0);
            }}
            className="hidden"
          />
          {beatPreviewUrl && <audio ref={reviewBeatRef} src={beatPreviewUrl} preload="metadata" className="hidden" />}
          <div className="flex items-center gap-3">
            <button onClick={toggleReview} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-black" aria-label={reviewPlaying ? "Pause rough take" : "Play rough take"}>
              {reviewPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-white/85">{beatPreviewUrl ? "Listen with beat" : saved ? "Kept take" : "Listen back"}</span>
                <span className="tabular-nums text-muted-foreground">{formatDuration(reviewTime)} / {formatDuration(roughTakeDuration)}</span>
              </div>
              <TakeWaveform currentTime={reviewTime} duration={roughTakeDuration} active={reviewPlaying} saved={saved} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={onSave}
              disabled={saved || saving || analyzing}
              className={cn(
                "min-h-10 rounded-xl border px-3 text-xs font-semibold",
                saved ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-300" : "border-gold/30 bg-gold/10 text-gold",
              )}
            >
              {analyzing ? "Reading Take..." : saving ? "Saving..." : saved ? "Kept in Session" : "Keep Take"}
            </button>
            <button onClick={onDelete} className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-muted-foreground">
              Retake
            </button>
          </div>
          {(analyzing || analysis) && (
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <span>{analyzing ? "Reading delivery..." : "Delivery read"}</span>
              {analysis && <span className="font-semibold text-gold">{analysis.deliveryScore}/100</span>}
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rec">{error}</p>}
    </div>
  );
}

function MobileLocker({
  beats,
  starterBeats,
  songs,
  hooks,
  roughTakes,
  sessionSongs,
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
  sessionSongs: SongRow[];
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
  type LockerTab = "songs" | "hooks" | "beats" | "purchases";
  const [tab, setTab] = useState<LockerTab>("songs");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [songFilter, setSongFilter] = useState<"all" | "draft" | "ready">("all");
  const [beatFilter, setBeatFilter] = useState<"all" | "included" | "private" | "favorite" | "licensed">("all");
  const [starterCollection, setStarterCollection] = useState("all");
  const [creativeDnaOpen, setCreativeDnaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const visibleProductUnlocks = productUnlocks.filter((unlock) => unlock.category !== "Producer Style");
  const purchaseCount = visibleProductUnlocks.length;
  const savedCount = songs.length + hooks.length + beats.length;
  const collectionCount = savedCount + starterBeats.length + purchaseCount;
  const boothReadyCount = songs.filter((song) => song.booth_ready).length;
  const totalBarsWritten = songs.reduce((total, song) => total + (lockerSnapshotNumber(song.snapshot, "totalBars", "total_bars") ?? lockerSongBarCount(song)), 0);
  const favoriteProducer = mostFrequent(beats.map((beat) => beat.producer).filter((value): value is string => Boolean(value))) ?? "Not enough saves yet";
  const favoriteMood = mostFrequent(beats.map((beat) => beat.mood).filter((value): value is string => Boolean(value))) ?? "Still taking shape";
  const sessionSongIds = new Set(sessionSongs.map((song) => song.id));
  const takesForSong = (song: SongLockerRow) => song.song_id
    ? roughTakes.filter((take) => take.song_id === song.song_id)
    : [];
  const tabs: Array<{ id: LockerTab; label: string; count: number; icon: typeof Save }> = [
    { id: "songs", label: "Songs", count: songs.length, icon: Save },
    { id: "hooks", label: "Hooks", count: hooks.length, icon: Pencil },
    { id: "beats", label: "Beats", count: beats.length + starterBeats.length, icon: Headphones },
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
  const globalSearchCount = visibleSongs.length + visibleHooks.length + visibleBeats.length + visibleStarterBeats.length + visibleUnlocks.length;

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const storedTab = window.sessionStorage.getItem("rapwriter:locker:tab") as LockerTab | null;
    const storedScroll = Number(window.sessionStorage.getItem("rapwriter:locker:scroll") ?? 0);
    if (storedTab && ["songs", "hooks", "beats", "purchases"].includes(storedTab)) setTab(storedTab);
    window.requestAnimationFrame(() => {
      if (scrollContainer && Number.isFinite(storedScroll)) scrollContainer.scrollTop = storedScroll;
    });
    return () => {
      if (scrollContainer) window.sessionStorage.setItem("rapwriter:locker:scroll", String(scrollContainer.scrollTop));
    };
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem("rapwriter:locker:tab", tab);
    setQuery("");
    setSearchOpen(false);
  }, [tab]);

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

          <div className="mt-5 grid grid-cols-4 gap-1.5" role="tablist" aria-label="Locker collections">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={cn("flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 transition-colors", tab === item.id ? "border-gold/40 bg-gold/10 text-gold" : "border-white/8 bg-white/[0.025] text-muted-foreground")}
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
              {visibleSongs.map((song) => <LockerSongCard key={`search-${song.id}`} song={song} takes={takesForSong(song)} live={sessionSongIds.has(song.song_id ?? "")} onResume={() => onResumeSong(song)} onPrepare={() => onPrepareSong(song)} onRemove={() => onRemove("songs", song.id)} />)}
              {visibleHooks.map((hook) => <LockerHookCard key={`search-${hook.id}`} hook={hook} onUse={() => onUseHook(hook)} onRemove={() => onRemove("hooks", hook.id)} />)}
              {visibleStarterBeats.map((beat) => <StarterBeatCard key={`search-starter-${beat.id}`} beat={beat} onUse={() => onUseStarterBeat(beat)} />)}
              {visibleBeats.map((beat) => <LockerBeatCard key={`search-${beat.id}`} beat={beat} onUse={() => onUseBeat(beat)} onRemove={() => onRemove("beats", beat.id)} />)}
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
              {tab === "songs" && visibleSongs.map((song) => <LockerSongCard key={song.id} song={song} takes={takesForSong(song)} live={sessionSongIds.has(song.song_id ?? "")} onResume={() => onResumeSong(song)} onPrepare={() => onPrepareSong(song)} onRemove={() => onRemove("songs", song.id)} />)}
              {tab === "songs" && visibleSongs.length === 0 && <LockerEmpty title={normalizedQuery ? "No songs match." : "No saved songs yet."} body="Save a song from the writing pad and it will be ready to resume here." actionLabel="Open Studio" onAction={onGoToStudio} />}

              {tab === "hooks" && visibleHooks.map((hook) => <LockerHookCard key={hook.id} hook={hook} onUse={() => onUseHook(hook)} onRemove={() => onRemove("hooks", hook.id)} />)}
              {tab === "hooks" && visibleHooks.length === 0 && <LockerEmpty title={normalizedQuery ? "No hooks match." : "No hooks saved yet."} body="Capture the lines worth returning to, then reuse them in any session." actionLabel="Write a Hook" onAction={onGoToStudio} />}

              {tab === "beats" && visibleStarterBeats.length > 0 && <div className="flex items-center justify-between gap-3 px-1"><div className="label-hw text-gold/75">Included with RapWriter</div><div className="text-[10px] text-muted-foreground">Full session use</div></div>}
              {tab === "beats" && displayedStarterBeats.map((beat) => <StarterBeatCard key={beat.id} beat={beat} onUse={() => onUseStarterBeat(beat)} />)}
              {tab === "beats" && beatFilter === "all" && visibleStarterBeats.length > displayedStarterBeats.length && (
                <button type="button" onClick={() => setBeatFilter("included")} className="min-h-11 w-full rounded-xl border border-gold/25 bg-gold/8 text-xs font-semibold text-gold">
                  See all {visibleStarterBeats.length} included beats
                </button>
              )}
              {tab === "beats" && visibleBeats.length > 0 && visibleStarterBeats.length > 0 && <div className="px-1 pt-2 label-hw text-white/45">Saved and licensed</div>}
              {tab === "beats" && visibleBeats.map((beat) => <LockerBeatCard key={beat.id} beat={beat} onUse={() => onUseBeat(beat)} onRemove={() => onRemove("beats", beat.id)} />)}
              {tab === "beats" && visibleBeats.length === 0 && visibleStarterBeats.length === 0 && <LockerEmpty title={normalizedQuery ? "No beats match." : "No beats saved yet."} body="Favorite a beat in Studio Store and keep the pocket close." actionLabel="Browse Beats" onAction={onGoToMarket} />}

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
          <PrivateBeatImportSheet open={importOpen} onClose={() => setImportOpen(false)} onImport={onImportBeat} />
        </>
      )}
    </div>
  );
}

function MobileRoleOnboarding({
  artistName,
  onComplete,
}: {
  artistName: string;
  onComplete: (accountType: OnboardingAccountType) => Promise<void>;
}) {
  const [selected, setSelected] = useState<OnboardingAccountType>("artist");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices: Array<{
    id: OnboardingAccountType;
    title: string;
    detail: string;
    icon: typeof Mic;
  }> = [
    { id: "artist", title: "Artist", detail: "Write, record rough takes, and finish songs.", icon: Mic },
    { id: "producer", title: "Producer", detail: "Upload beats, build playlists, and run a storefront.", icon: Headphones },
    { id: "artist_producer", title: "Artist + Producer", detail: "Write records and sell your own sound.", icon: Sparkles },
  ];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onComplete(selected);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save your workspace.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[430px] border-t border-gold/25 bg-[#0d0d0f] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 shadow-[0_-24px_80px_rgba(0,0,0,0.7)] sm:rounded-2xl sm:border">
        <div className="label-hw text-gold/85">Set up your workspace</div>
        <h1 className="mt-2 text-2xl font-semibold">How will you use RapWriter, {artistName}?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Choose the workspace you need today. Your music and profile stay together.
        </p>

        <div className="mt-5 space-y-2">
          {choices.map((choice) => {
            const Icon = choice.icon;
            const active = selected === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setSelected(choice.id)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-20 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                  active ? "border-gold/70 bg-gold/10" : "border-white/10 bg-white/[0.025]",
                )}
              >
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", active ? "border-gold/45 bg-black text-gold" : "border-white/10 text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{choice.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{choice.detail}</span>
                </span>
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", active ? "border-gold bg-gold text-black" : "border-white/20")}>
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-xs text-rec">{error}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="gold-seal mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Building workspace..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

function MobileFirstSessionActivation({
  artistName,
  beat,
  onComplete,
}: {
  artistName: string;
  beat: SelectedBeat;
  onComplete: (payload: {
    artistGoal: ArtistGoal;
    projectTitle: string;
    songTitle: string;
    useBeat: boolean;
  }) => Promise<void>;
}) {
  const [artistGoal, setArtistGoal] = useState<ArtistGoal>("finish_song");
  const [projectTitle, setProjectTitle] = useState(`${artistName}'s First Project`);
  const [songTitle, setSongTitle] = useState("Untitled Song");
  const [useBeat, setUseBeat] = useState(beat.id !== EMPTY_BEAT.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goals: Array<{ id: ArtistGoal; title: string; detail: string; icon: typeof Mic }> = [
    { id: "finish_song", title: "Finish a song", detail: "Build a complete record section by section.", icon: Award },
    { id: "write_hook", title: "Write a hook", detail: "Find the idea listeners remember first.", icon: Sparkles },
    { id: "write_verse", title: "Write 16 bars", detail: "Lock the pocket and finish a full verse.", icon: Pencil },
    { id: "freestyle", title: "Freestyle", detail: "Open the pad and follow the beat.", icon: Mic },
  ];

  const submit = async () => {
    if (!projectTitle.trim() || !songTitle.trim()) {
      setError("Name the project and song to start your session.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onComplete({ artistGoal, projectTitle: projectTitle.trim(), songTitle: songTitle.trim(), useBeat });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start the session.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/88 backdrop-blur-sm sm:items-center">
      <div className="max-h-[94svh] w-full max-w-[430px] overflow-y-auto border-t border-gold/25 bg-[#0d0d0f] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 shadow-[0_-24px_80px_rgba(0,0,0,0.72)] sm:rounded-2xl sm:border">
        <div className="label-hw text-gold/85">First session</div>
        <h1 className="mt-2 text-2xl font-semibold">What are we making tonight?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Set the target. RapWriter will open the right starting point.</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const active = artistGoal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => setArtistGoal(goal.id)}
                aria-pressed={active}
                className={cn("min-h-28 rounded-xl border p-3 text-left", active ? "border-gold/65 bg-gold/10" : "border-white/10 bg-white/[0.025]")}
              >
                <Icon className={cn("h-4 w-4", active ? "text-gold" : "text-muted-foreground")} />
                <span className="mt-3 block text-sm font-semibold">{goal.title}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{goal.detail}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="label-hw text-white/55">Project</span>
            <input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} maxLength={120} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm outline-none focus:border-gold/35" />
          </label>
          <label className="block">
            <span className="label-hw text-white/55">First song</span>
            <input value={songTitle} onChange={(event) => setSongTitle(event.target.value)} maxLength={160} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm outline-none focus:border-gold/35" />
          </label>
        </div>

        <div className="mt-5">
          <div className="label-hw text-white/55">Start with</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setUseBeat(true)} disabled={beat.id === EMPTY_BEAT.id} className={cn("min-h-16 rounded-xl border px-3 text-left disabled:opacity-40", useBeat ? "border-gold/65 bg-gold/10" : "border-white/10 bg-white/[0.025]")}>
              <span className="block truncate text-xs font-semibold">{beat.id === EMPTY_BEAT.id ? "Choose a beat later" : beat.title}</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">Beat loaded</span>
            </button>
            <button type="button" onClick={() => setUseBeat(false)} className={cn("min-h-16 rounded-xl border px-3 text-left", !useBeat ? "border-gold/65 bg-gold/10" : "border-white/10 bg-white/[0.025]")}>
              <span className="block text-xs font-semibold">No beat</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">Start with the words</span>
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-rec">{error}</p>}
        <button type="button" onClick={() => void submit()} disabled={busy} className="gold-seal mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60">
          {busy ? "Preparing Studio..." : "Start Writing"}
        </button>
      </div>
    </div>
  );
}

function MobileProfile({
  completionPct,
  boothReady,
  activeStudioPack,
  membership,
  profile,
  lockerCounts,
  loading,
  signedIn,
  emailVerified,
  isAdmin,
  error,
  onAuthRequired,
  onExpandWorkspace,
  onProfileAvatar,
  onProfileIdentity,
  onSignOut,
  onOpenStudio,
  onOpenMarket,
}: {
  completionPct: number;
  boothReady: BoothReadyResult;
  activeStudioPack: StudioPack;
  membership: MembershipSnapshot | null;
  profile: ProfileRow | null;
  lockerCounts: { beats: number; songs: number; hooks: number };
  loading: boolean;
  signedIn: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  error: string | null;
  onAuthRequired: () => void;
  onExpandWorkspace: () => Promise<void>;
  onProfileAvatar: (file: File | null) => Promise<ProfileRow | null>;
  onProfileIdentity: (artistName: string) => Promise<ProfileRow | null>;
  onSignOut: () => Promise<void>;
  onOpenStudio: () => void;
  onOpenMarket: () => void;
}) {
  const [workspaceUpgradeStatus, setWorkspaceUpgradeStatus] = useState<"idle" | "saving" | "error">("idle");
  const [workspaceUpgradeError, setWorkspaceUpgradeError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "saving" | "error">("idle");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const artistName = profile?.artist_name || profile?.display_name || profile?.email?.split("@")[0] || "RapWriter Artist";
  const [identityEditorOpen, setIdentityEditorOpen] = useState(false);
  const [artistNameDraft, setArtistNameDraft] = useState(artistName);
  const [identityStatus, setIdentityStatus] = useState<"idle" | "saving" | "error">("idle");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const joinedLabel = profile?.created_at
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(profile.created_at))
    : "Private beta";
  const vaultTotal = lockerCounts.songs + lockerCounts.hooks + lockerCounts.beats;
  const boothLabel = boothReady.locked ? "Keep writing" : `${boothReady.score}/100`;
  const profileLabel = accountTypeLabel(profile?.account_type);
  const canAccessProducer = Boolean(membership?.producer) || hasProducerWorkspace(profile?.account_type);
  const canAccessArtist = Boolean(membership?.artist) || hasArtistWorkspace(profile?.account_type);
  const canExpandWorkspace = !canAccessProducer || !canAccessArtist;
  const membershipLabel = [membership?.artist?.plan.name, membership?.producer?.plan.name].filter(Boolean).join(" + ");

  useEffect(() => {
    if (!identityEditorOpen) setArtistNameDraft(artistName);
  }, [artistName, identityEditorOpen]);

  const expandWorkspace = async () => {
    setWorkspaceUpgradeStatus("saving");
    setWorkspaceUpgradeError(null);
    try {
      await onExpandWorkspace();
      setWorkspaceUpgradeStatus("idle");
    } catch (upgradeError) {
      setWorkspaceUpgradeStatus("error");
      setWorkspaceUpgradeError(upgradeError instanceof Error ? upgradeError.message : "Workspace could not be added.");
    }
  };

  const changeAvatar = async (file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      setAvatarStatus("error");
      setAvatarError("Choose a photo smaller than 5 MB.");
      return;
    }
    setAvatarStatus("saving");
    setAvatarError(null);
    try {
      await onProfileAvatar(file);
      setAvatarStatus("idle");
    } catch (avatarUploadError) {
      setAvatarStatus("error");
      setAvatarError(avatarUploadError instanceof Error ? avatarUploadError.message : "Profile photo could not be updated.");
    }
  };

  const saveArtistIdentity = async () => {
    const nextName = artistNameDraft.trim();
    if (nextName.length < 2) {
      setIdentityStatus("error");
      setIdentityError("Enter an artist name with at least 2 characters.");
      return;
    }
    setIdentityStatus("saving");
    setIdentityError(null);
    try {
      await onProfileIdentity(nextName);
      setIdentityStatus("idle");
      setIdentityEditorOpen(false);
    } catch (identitySaveError) {
      setIdentityStatus("error");
      setIdentityError(identitySaveError instanceof Error ? identitySaveError.message : "Artist identity could not be updated.");
    }
  };

  if (!signedIn && !loading) {
    return (
      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-5">
        <div className="label-hw text-gold/85">Artist profile</div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-gold/20 bg-[#111113]">
          <div className="relative h-36">
            <img src={activeStudioPack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: activeStudioPack.position }} draggable={false} />
            <div className="absolute inset-0" style={{ background: activeStudioPack.overlay }} />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="label-hw text-gold/85">Private studio</div>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">Claim your RapWriter room.</h1>
            </div>
          </div>
          <div className="p-5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-gold/35 bg-black p-2 shadow-[0_0_26px_rgba(246,199,72,0.18)]">
            <img src="/brand/rapwriter-mark.webp" alt="" className="h-full w-full object-contain" draggable={false} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Save your rooms, songs, hooks, beats, rough takes, and Booth Ready progress across every device.
          </p>
          {error && <p className="mt-3 text-xs text-rec">{error}</p>}
          <button onClick={onAuthRequired} className="gold-seal mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold">
            Sign in with email
          </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-32 pt-5">
      <div className="label-hw text-gold/85">{profileLabel}</div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#111113] shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
        <div className="relative px-4 pb-4 pt-5">
          <img src={activeStudioPack.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" style={{ objectPosition: activeStudioPack.position }} draggable={false} />
          <div className="absolute inset-0" style={{ background: activeStudioPack.overlay }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(246,199,72,0.18),transparent_34%)]" />
          <div className="relative flex items-center gap-3">
            <div className="shrink-0 text-center">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  if (file) void changeAvatar(file);
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarStatus === "saving"}
                className="relative grid h-18 w-18 place-items-center overflow-hidden rounded-2xl border border-gold/35 bg-black p-2 shadow-[0_0_26px_rgba(246,199,72,0.18)] disabled:opacity-60"
                aria-label="Change profile photo"
                title="Change profile photo"
              >
                <img
                  src={profile?.avatar_url || "/brand/rapwriter-mark.webp"}
                  alt=""
                  className={cn("h-full w-full", profile?.avatar_url ? "rounded-xl object-cover" : "object-contain")}
                  draggable={false}
                />
                <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-lg border border-gold/35 bg-black/85 text-gold shadow-lg">
                  {avatarStatus === "saving" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </span>
              </button>
              {profile?.avatar_url && (
                <button type="button" onClick={() => void changeAvatar(null)} disabled={avatarStatus === "saving"} className="mt-1 text-[9px] font-semibold text-white/45 hover:text-gold disabled:opacity-50">
                  Use crown
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-xl font-semibold">{loading ? "Loading artist..." : artistName}</div>
                <ShieldCheck className="h-4 w-4 shrink-0 text-gold" />
                <button
                  type="button"
                  onClick={() => {
                    setArtistNameDraft(artistName);
                    setIdentityError(null);
                    setIdentityEditorOpen(true);
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-white/55 transition-colors hover:border-gold/30 hover:text-gold"
                  aria-label="Edit artist name"
                  title="Edit artist name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Member since {joinedLabel}</div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-gold">
                <Crown className="h-3 w-3" />
                {emailVerified ? "Verified account" : "Email confirmation pending"}
              </div>
              {membershipLabel && (
                <div className="mt-2 truncate text-[10px] font-semibold text-white/55">{membershipLabel}</div>
              )}
            </div>
          </div>
          {avatarError && <p className="relative mt-2 text-xs text-rec">{avatarError}</p>}

          <div className="relative mt-5 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-black/35 p-3">
            <div>
              <div className="label-hw text-gold/80">Tonight&apos;s session</div>
              <div className="mt-1 text-sm font-semibold">{activeStudioPack.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{activeStudioPack.bestFor.join(" / ")}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gold">{completionPct}%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Complete</div>
            </div>
            <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-gold shadow-[0_0_18px_rgba(246,199,72,0.6)]" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 border-t border-white/10 p-4 text-center">
          {[
            [String(lockerCounts.songs), "Songs"],
            [String(lockerCounts.hooks), "Hooks"],
            [String(lockerCounts.beats), "Beats"],
            [String(vaultTotal), "Vault"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-black/24 p-3">
              <div className="text-lg font-semibold text-gold">{value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <ProfileSignal title="Booth Ready" value={boothLabel} detail={boothReady.locked ? boothReady.lockedReason : boothReady.nextAction} />
      </div>

      <div id="profile-membership" className="scroll-mt-4 pt-4">
        <MembershipCard
          initialMembership={membership}
          onOpenStudio={onOpenStudio}
          onOpenMarket={onOpenMarket}
        />
      </div>

      <div className="mt-4 space-y-2">
        {canExpandWorkspace && (
          <MobileProfileRow
            icon={canAccessArtist ? Headphones : Pencil}
            title={canAccessArtist ? "Add Producer workspace" : "Add Artist workspace"}
            value={canAccessArtist ? "Upload beats and build a storefront" : "Write songs and enter Writer Flow"}
            onClick={() => void expandWorkspace()}
            disabled={workspaceUpgradeStatus === "saving"}
          />
        )}
        {canAccessProducer && <MobileProfileRow icon={Headphones} title="Producer HQ" value="Catalog, storefront, and business" href="/producer" />}
        <MobileProfileRow icon={LifeBuoy} title="Support" value="Get help and track support tickets" href="/support" />
        {isAdmin && <MobileProfileRow icon={LockKeyhole} title="Control room" value="Staff tools and catalog review" href="/admin" muted />}
      </div>
      {workspaceUpgradeStatus === "saving" && <p className="mt-3 text-xs text-gold">Preparing your combined workspace...</p>}
      {workspaceUpgradeError && <p className="mt-3 text-xs text-rec">{workspaceUpgradeError}</p>}
      <AccountControls email={profile?.email ?? null} onSignOut={onSignOut} />
      <button onClick={() => void onSignOut()} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-muted-foreground">
        Sign out
      </button>

      {identityEditorOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:py-6">
          <section role="dialog" aria-modal="true" aria-labelledby="artist-identity-title" className="w-full max-w-[400px] rounded-3xl border border-gold/25 bg-[#111113] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-hw text-gold">Artist identity</div>
                <h2 id="artist-identity-title" className="mt-2 text-xl font-semibold">How should artists know you?</h2>
              </div>
              <button type="button" onClick={() => setIdentityEditorOpen(false)} disabled={identityStatus === "saving"} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close artist identity editor"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">This name appears in your artist workspace. Your Producer HQ brand stays separate.</p>
            <label className="mt-5 block">
              <span className="label-hw text-white/50">Artist name</span>
              <input value={artistNameDraft} onChange={(event) => setArtistNameDraft(event.target.value)} maxLength={80} disabled={identityStatus === "saving"} autoFocus className="mt-2 min-h-12 w-full rounded-xl border border-white/12 bg-black/40 px-4 text-sm font-semibold outline-none focus:border-gold/50 disabled:opacity-50" />
            </label>
            {identityError && <p className="mt-3 text-xs leading-5 text-rec">{identityError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIdentityEditorOpen(false)} disabled={identityStatus === "saving"} className="min-h-12 rounded-xl border border-white/10 text-sm font-semibold text-white/70 disabled:opacity-40">Cancel</button>
              <button type="button" onClick={() => void saveArtistIdentity()} disabled={identityStatus === "saving" || artistNameDraft.trim().length < 2} className="gold-seal min-h-12 rounded-xl px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35">{identityStatus === "saving" ? "Saving..." : "Save artist name"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AccountControls({ email, onSignOut }: { email: string | null; onSignOut: () => Promise<void> }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const exportAccount = async () => {
    setBusy(true);
    setStatus("Preparing your archive...");
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Account export failed.");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `rapwriter-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus("Archive ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account export failed.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;

    setBusy(true);
    setStatus("Deleting account...");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Account deletion failed.");
      setDeleteDialogOpen(false);
      await onSignOut();
      window.location.assign("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account deletion failed.");
      setBusy(false);
    }
  };

  return (
    <>
      <details className="mt-4 rounded-2xl border border-white/10 bg-[#111113]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8 text-gold">
            <Settings className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Account settings</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{email ?? "Exports and account controls"}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </summary>
        <div className="border-t border-white/10 p-3">
          <button onClick={() => void exportAccount()} disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-4 text-sm font-semibold text-gold disabled:opacity-50">
            <Download className="h-4 w-4" />
            Export my data
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmation("");
              setStatus("");
              setDeleteDialogOpen(true);
            }}
            disabled={busy}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rec/25 bg-rec/8 px-4 text-sm font-semibold text-rec disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
          {status && <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">{status}</p>}
        </div>
      </details>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:py-6">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-[400px] rounded-3xl border border-rec/25 bg-[#111113] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-hw text-rec">Permanent action</div>
                <h2 id="delete-account-title" className="mt-2 text-xl font-semibold">Delete this account?</h2>
              </div>
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close account deletion"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">This permanently removes your songs, projects, Locker, rough takes, and account access. Export your data first if you need a copy.</p>
            <label className="mt-5 block">
              <span className="label-hw text-white/50">Type DELETE to continue</span>
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} disabled={busy} autoFocus aria-label="Account deletion confirmation" className="mt-2 min-h-12 w-full rounded-xl border border-white/12 bg-black/40 px-4 text-sm font-semibold outline-none focus:border-rec/50 disabled:opacity-50" />
            </label>
            {status && <p className="mt-3 text-xs leading-5 text-rec">{status}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={busy} className="min-h-12 rounded-xl border border-white/10 text-sm font-semibold text-white/70 disabled:opacity-40">Keep account</button>
              <button type="button" onClick={() => void deleteAccount()} disabled={busy || deleteConfirmation !== "DELETE"} className="min-h-12 rounded-xl border border-rec/35 bg-rec px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy ? "Deleting..." : "Delete permanently"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
