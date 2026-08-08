"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
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
  FileText,
  FolderPlus,
  Heart,
  Headphones,
  History,
  Home,
  LifeBuoy,
  LockKeyhole,
  Mail,
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
  Undo2,
  Upload,
  UserCircle,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ActivityInbox } from "@/components/ActivityInbox";
import { MembershipCard } from "@/components/MembershipCard";
import { PremiumMarketplace, type MarketCategory } from "@/components/PremiumMarketplace";
import {
  analyzeLyrics,
  analyzeRoughTakeAudio,
  type LyricAnalysis,
  type RoughTakeAnalysis,
} from "@/lib/booth-ready-v2";
import {
  producerActionEntitlement,
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
  type ProductEntitlementRow,
  type ProfileRow,
  type PrivateBeatImportInput,
  type ProjectRow,
  type RoughTakeRow,
  type SongRow,
  type SongLockerRow,
  type SessionRow,
} from "@/hooks/use-rapwriter-data";
import type { BoothExportRecord, BoothExportSnapshot } from "@/lib/booth-export";
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
  clampScore,
  getRecordReadiness,
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
import { buildBoothExportSnapshot, downloadBoothFile } from "@/lib/studio/export-snapshot";
import {
  artistDisplayName,
  formatDuration,
  formatFileSize,
  formatShortDate,
  formatVersionTime,
  getProgressPct,
  getProjectTitle,
  hasAllAccessMembership,
  membershipAccessLabel,
  productUnlockFromEntitlement,
  versionSourceLabel,
} from "@/lib/studio/format";
import {
  buildBeatIntelligence,
  buildEnvironmentIntelligence,
  findAnchorWord,
  getWritingMomentum,
  studioDnaCue,
} from "@/lib/studio/intelligence";
import {
  lockerBeatArt,
  lockerSnapshotNumber,
  lockerSongBarCount,
  lockerSongProgress,
  mostFrequent,
  sectionsFromLockerSnapshot,
  starterBeatArt,
} from "@/lib/studio/locker-snapshot";
import { analyzePenLines, linesFor } from "@/lib/studio/prosody";
import { trackMarketplaceEvent } from "@/lib/studio/telemetry";
import { buildSyntheticWaveBars, buildTakeWaveBars, readAudioFileDuration } from "@/lib/studio/waveform";
import { getStudioPack, studioPacks } from "@/lib/studio/packs";
import { blankStarterLyrics, mobileSections } from "@/lib/studio/sections";
import { artistGoals, defaultStudioDna, producerModes, sessionMoods, writingStyles } from "@/lib/studio/dna";
import type {
  ArtistGoal,
  BeatIntelligence,
  BoothReadyResult,
  EnvironmentIntelligence,
  MarketplaceBeat,
  MarketplaceFeed,
  MobileDraftRecord,
  MobileNavView,
  PadActionStatus,
  PadActions,
  ProducerActionControls,
  ProducerActionStatus,
  ProducerPassId,
  ProductUnlock,
  RecordReadiness,
  RecordReadinessStage,
  SectionVersion,
  SelectedBeat,
  StudioAirPreference,
  StudioDna,
  StudioPack,
  StudioPackId,
  VersionHistoryStatus,
} from "@/lib/studio/types";

const navItems: { id: MobileNavView; label: string; icon: typeof Home }[] = [
  { id: "studio", label: "Studio", icon: Home },
  { id: "locker", label: "Locker", icon: Briefcase },
  { id: "market", label: "Market", icon: ShoppingCart },
  { id: "profile", label: "Profile", icon: UserCircle },
];

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
    signIn,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    updatePassword,
    resendVerification,
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
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authRedirectUrl, setAuthRedirectUrl] = useState("/api/auth/callback");
  const [authRecoveryMode, setAuthRecoveryMode] = useState(false);
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
    const url = new URL(window.location.href);
    if (url.searchParams.get("auth_mode") !== "recovery") return;
    setAuthRecoveryMode(true);
    setAuthOpen(true);
    setAuthNotice("Choose a new password for your RapWriter account.");
    url.searchParams.delete("auth_mode");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

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
    setAuthRedirectUrl(`${window.location.origin}/api/auth/callback`);
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "market" || view === "locker" || view === "profile" || view === "studio") {
      setActiveNav(view);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const authError = params.get("auth_error");
    if (authError) {
      setAuthNotice(authError);
      setAuthOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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

  const requestAuth = (message = "Sign in to sync your studio.") => {
    setAuthNotice(message);
    setAuthOpen(true);
  };

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

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    const result = await signInWithPassword(authEmail, authPassword);
    if (result.error) {
      setAuthNotice(result.error.message);
      setAuthBusy(false);
      return;
    }
    setAuthNotice("Signed in. Syncing your studio...");
    setAuthBusy(false);
    setAuthOpen(false);
  };

  const createAccountWithPassword = async () => {
    setAuthBusy(true);
    const result = await signUpWithPassword(authEmail, authPassword);
    if (result.error) {
      setAuthNotice(result.error.message);
      setAuthBusy(false);
      return;
    }
    setAuthBusy(false);
    if (result.data.session) {
      setAuthNotice("Account created. Syncing your studio...");
      setAuthOpen(false);
      return;
    }
    setAuthNotice("Account created. Check your email to confirm, then sign in.");
  };

  const sendMagicLink = async () => {
    setAuthBusy(true);
    const next = `${window.location.pathname}${window.location.search}`;
    const result = await signIn(authEmail, next);
    setAuthBusy(false);
    if (result.error) {
      setAuthNotice(result.error.message);
      return;
    }
    setAuthNotice("Magic link sent. Open it in this same preview browser.");
  };

  const requestPasswordReset = async () => {
    if (!authEmail.includes("@")) {
      setAuthNotice("Enter the email for your RapWriter account first.");
      return;
    }
    setAuthBusy(true);
    const result = await sendPasswordReset(authEmail);
    setAuthBusy(false);
    setAuthNotice(result.error ? result.error.message : "Password reset sent. Open the email in this browser.");
  };

  const updateRecoveredPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authPassword.length < 8) {
      setAuthNotice("Use at least 8 characters for the new password.");
      return;
    }
    setAuthBusy(true);
    const result = await updatePassword(authPassword);
    setAuthBusy(false);
    if (result.error) {
      setAuthNotice(result.error.message);
      return;
    }
    setAuthRecoveryMode(false);
    setAuthNotice("Password updated. Your studio is ready.");
    setAuthOpen(false);
  };

  const resendConfirmation = async () => {
    if (!authEmail.includes("@")) {
      setAuthNotice("Enter the account email first.");
      return;
    }
    setAuthBusy(true);
    const result = await resendVerification(authEmail);
    setAuthBusy(false);
    setAuthNotice(result.error ? result.error.message : "Confirmation email sent.");
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
        <MobileAuthDrawer
          open={authOpen}
          email={authEmail}
          password={authPassword}
          busy={authBusy}
          notice={authNotice}
          redirectUrl={authRedirectUrl}
          recoveryMode={authRecoveryMode}
          onEmail={setAuthEmail}
          onPassword={setAuthPassword}
          onSubmit={authRecoveryMode ? updateRecoveredPassword : submitAuth}
          onCreateAccount={createAccountWithPassword}
          onMagicLink={sendMagicLink}
          onForgotPassword={requestPasswordReset}
          onResendVerification={resendConfirmation}
          onClose={() => {
            setAuthOpen(false);
            setAuthRecoveryMode(false);
          }}
        />
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

function ImmersiveEnvironmentEffects({ studioPack }: { studioPack: StudioPack }) {
  const tone =
    studioPack.id === "trap-house"
      ? "rgba(157,72,255,0.18)"
      : studioPack.id === "bedroom"
        ? "rgba(82,145,255,0.16)"
        : studioPack.id === "cypher"
          ? "rgba(255,255,255,0.08)"
          : "rgba(246,199,72,0.14)";

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="studio-depth-shift absolute -inset-8 bg-cover opacity-[0.055] blur-[3px] transition-[background-image,background-position] duration-700"
        style={{ backgroundImage: `url('${studioPack.image}')`, backgroundPosition: studioPack.position }}
      />
      <div className="studio-haze absolute inset-0 opacity-45" />
      <div className="studio-particles absolute inset-0 opacity-35" />
      <div
        className="studio-light-pulse absolute left-1/2 top-[-18%] h-[42svh] w-[88vw] max-w-[520px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${tone}, transparent 68%)` }}
      />
    </div>
  );
}

function StudioDnaSheet({
  open,
  dna,
  studioPacks,
  canUseStudioPack,
  onChange,
  onClose,
  onStart,
}: {
  open: boolean;
  dna: StudioDna;
  studioPacks: StudioPack[];
  canUseStudioPack: (id: StudioPackId) => boolean;
  onChange: (patch: Partial<StudioDna>) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  if (!open) return null;
  const activePack = getStudioPack(dna.environment);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="studio-dna-title" className="max-h-[92svh] w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative h-36">
          <img src={activePack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: activePack.position }} decoding="async" draggable={false} />
          <div className="absolute inset-0" style={{ background: activePack.overlay }} />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <div className="label-hw text-gold/85">Studio DNA</div>
              <h2 id="studio-dna-title" className="mt-2 text-2xl font-semibold">Set the room.</h2>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/30 text-muted-foreground" aria-label="Close Studio DNA">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92svh-9rem)] overflow-y-auto p-5">
          <StudioDnaChoice title="Environment" value={dna.environment} options={studioPacks.map((pack) => ({ value: pack.id, label: pack.label, locked: !canUseStudioPack(pack.id) }))} onSelect={(environment) => onChange({ environment: environment as StudioPackId })} />
          <StudioDnaChoice title="Artist Goal" value={dna.goal} options={artistGoals.map((label) => ({ value: label, label }))} onSelect={(goal) => onChange({ goal })} />
          <StudioDnaChoice title="Writing Style" value={dna.style} options={writingStyles.map((label) => ({ value: label, label }))} onSelect={(style) => onChange({ style })} />
          <StudioDnaChoice title="Mood" value={dna.mood} options={sessionMoods.map((label) => ({ value: label, label }))} onSelect={(mood) => onChange({ mood })} />
          <StudioDnaChoice title="Producer" value={dna.producer} options={producerModes.map((label) => ({ value: label, label }))} onSelect={(producer) => onChange({ producer })} />

          <div className="mt-5 rounded-2xl border border-gold/20 bg-gold/8 p-4">
            <div className="label-hw text-gold/85">Session intelligence</div>
            <p className="mt-2 text-sm leading-relaxed text-white/76">
              {studioDnaCue(dna, activePack)}
            </p>
          </div>

          <button onClick={onStart} className="gold-seal sticky bottom-0 z-10 mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-[0_-12px_28px_rgba(17,17,19,0.92)]">
            Start Session
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StudioDnaChoice({
  title,
  value,
  options,
  onSelect,
}: {
  title: string;
  value: string;
  options: Array<{ value: string; label: string; locked?: boolean }>;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="label-hw">{title}</div>
      <div className="relative mt-2">
        <div className="flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 pr-8 touch-pan-x [mask-image:linear-gradient(to_right,#000_0,#000_calc(100%-2.25rem),transparent_100%)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              aria-pressed={value === option.value}
              className={cn(
                "inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                value === option.value ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground",
              )}
            >
              {option.locked && <LockKeyhole className="h-3 w-3" />}
              {option.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 grid w-7 place-items-center text-gold/65" aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ProducerPassPanel({
  sectionName,
  sectionText,
  beat,
  studioDna,
  environmentIntel,
  actions,
  membership,
  onUpgrade,
}: {
  sectionName: string;
  sectionText: string;
  beat: SelectedBeat;
  studioDna: StudioDna;
  environmentIntel: EnvironmentIntelligence;
  actions?: ProducerActionControls;
  membership?: WorkspaceMembership | null;
  onUpgrade?: () => void;
}) {
  const [activePass, setActivePass] = useState<ProducerPassId>(() => passFromProducerMode(studioDna.producer));
  const [previewMode, setPreviewMode] = useState<"original" | "revision">("revision");
  useEffect(() => setActivePass(passFromProducerMode(studioDna.producer)), [studioDna.producer]);
  useEffect(() => setPreviewMode("revision"), [actions?.proposal?.id]);
  const report = useMemo(
    () => buildProducerPassReport(activePass, sectionName, sectionText, beat, environmentIntel),
    [activePass, beat, environmentIntel, sectionName, sectionText],
  );
  const options: Array<{ id: ProducerPassId; label: string }> = [
    { id: "hook", label: "Hook Doctor" },
    { id: "rewrite", label: "Producer Rewrite" },
    { id: "commercial", label: "Commercial Pass" },
    { id: "pocket", label: "Pocket Adjustment" },
  ];
  const activePassUnlocked = !actions || membership?.entitlements[producerActionEntitlement(activePass)] === true;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((option) => {
          const unlocked = !actions || membership?.entitlements[producerActionEntitlement(option.id)] === true;
          return (
            <button
              type="button"
              key={option.id}
              onClick={() => setActivePass(option.id)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold",
                activePass === option.id ? "border-gold/40 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground",
              )}
            >
              {!unlocked && <LockKeyhole className="h-3 w-3" />}
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-gold/20 bg-gold/8 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="label-hw text-gold/80">{report.title}</div>
          <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Live</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/74">{report.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {report.signals.map((signal) => (
          <div key={signal} className="rounded-xl border border-white/10 bg-black/24 p-3 text-xs leading-relaxed text-muted-foreground">{signal}</div>
        ))}
      </div>

      <div className="space-y-2">
        {report.actions.map((action) => (
          <div key={action} className="flex gap-2 rounded-xl border border-white/10 bg-black/24 p-3 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <span>{action}</span>
          </div>
        ))}
      </div>

      {actions && !actions.proposal && (
        <button
          type="button"
          onClick={() => activePassUnlocked ? actions.onGenerate(activePass) : onUpgrade?.()}
          disabled={actions.status === "generating" || actions.status === "applying" || (activePassUnlocked && linesFor(sectionText).length < 2)}
          className="gold-seal flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
        >
          {actions.status === "generating" ? <RefreshCw className="h-4 w-4 animate-spin" /> : activePassUnlocked ? <WandSparkles className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
          {actions.status === "generating" ? "Building Revision..." : activePassUnlocked ? `Create ${report.title} Revision` : `Unlock ${report.title}`}
        </button>
      )}

      {actions?.proposal && actions.proposal.status === "previewed" && (
        <div className="rounded-xl border border-gold/25 bg-gold/8 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label-hw text-gold/85">Revision Preview</div>
              <div className="mt-1 text-sm font-semibold">{actions.proposal.title}</div>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
              {(["original", "revision"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={cn(
                    "min-h-8 rounded-md px-2.5 text-[10px] font-semibold capitalize",
                    previewMode === mode ? "bg-gold text-black" : "text-muted-foreground",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <pre className="mt-3 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/36 p-3 font-mono text-[12px] leading-6 text-white/82">
            {previewMode === "original" ? actions.proposal.originalContent : actions.proposal.proposedContent}
          </pre>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{actions.proposal.rationale}</p>
          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
            {actions.proposal.changes.map((change) => (
              <div key={change} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="text-gold">+</span>
                <span>{change}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={actions.onAccept}
              disabled={actions.status === "applying"}
              className="gold-seal flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-55"
            >
              <Check className="h-4 w-4" />
              Accept
            </button>
            <button
              type="button"
              onClick={actions.onRetry}
              disabled={actions.status === "applying"}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gold/25 bg-black/24 px-3 text-sm font-semibold text-gold disabled:opacity-55"
            >
              <RefreshCw className="h-4 w-4" />
              Try Another
            </button>
          </div>
          <button
            type="button"
            onClick={actions.onReject}
            disabled={actions.status === "applying"}
            className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-muted-foreground disabled:opacity-55"
          >
            <X className="h-4 w-4" />
            Reject Revision
          </button>
        </div>
      )}

      {actions?.proposal && (actions.proposal.status === "accepted" || actions.proposal.status === "reverted") && (
        <div className={cn("rounded-xl border p-3", actions.proposal.status === "accepted" ? "border-emerald-500/20 bg-emerald-500/8" : "border-white/10 bg-black/24")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={cn("label-hw", actions.proposal.status === "accepted" ? "text-emerald-300" : "text-muted-foreground")}>{actions.proposal.status === "accepted" ? "Revision Saved" : "Original Restored"}</div>
              <p className="mt-1 text-xs text-muted-foreground">{actions.proposal.status === "accepted" ? "The previous lyrics are protected in version history." : "The accepted revision remains in version history."}</p>
            </div>
            {actions.proposal.status === "accepted" && (
              <button type="button" onClick={actions.onUndo} disabled={actions.status === "applying"} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-white/80 disabled:opacity-55">
                <Undo2 className="h-4 w-4" />
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      {actions?.error && <div className="rounded-xl border border-rec/25 bg-rec/10 p-3 text-xs leading-relaxed text-rec">{actions.error}</div>}
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/34">Analysis refreshes while you write</p>
    </div>
  );
}

function passFromProducerMode(mode: string): ProducerPassId {
  if (mode === "Hook Doctor") return "hook";
  if (mode === "Commercial Producer") return "commercial";
  if (mode === "Battle Coach" || mode === "Southern Producer") return "pocket";
  return "rewrite";
}

function buildProducerPassReport(
  pass: ProducerPassId,
  sectionName: string,
  sectionText: string,
  beat: SelectedBeat,
  environmentIntel: EnvironmentIntelligence,
) {
  const lines = sectionText.split("\n").map((line) => line.trim()).filter(Boolean);
  const wordCounts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
  const averageWords = wordCounts.length ? Math.round(wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length) : 0;
  const spread = wordCounts.length ? Math.max(...wordCounts) - Math.min(...wordCounts) : 0;
  const anchor = findAnchorWord(sectionText);
  const bpm = typeof beat.bpm === "number" ? beat.bpm : 84;
  const pace = bpm >= 120 ? "fast" : bpm >= 92 ? "driving" : "open";
  const emptyAction = `Write at least two lines in ${sectionName} to unlock a sharper read.`;

  if (pass === "hook") {
    return {
      title: "Hook Doctor",
      summary: lines.length ? `${sectionName} has ${lines.length} active lines. ${anchor ? `“${anchor}” is the clearest repeatable anchor.` : "A repeatable anchor has not emerged yet."}` : `Hook Doctor is waiting on the first lines of ${sectionName}.`,
      signals: [`${lines.length} written lines`, anchor ? `Anchor: ${anchor}` : "No anchor yet"],
      actions: lines.length ? [
        anchor ? `Bring “${anchor}” back at the emotional payoff instead of introducing another idea.` : "Choose one phrase the listener can repeat after one play.",
        averageWords > 10 ? "Shorten the longest line so the hook leaves room for melody." : "Keep the hook language this direct and protect the strongest phrase.",
        environmentIntel.producerNotes[0],
      ] : [emptyAction],
    };
  }

  if (pass === "rewrite") {
    const longestLine = lines.reduce((longest, line) => line.split(/\s+/).length > longest.split(/\s+/).length ? line : longest, lines[0] ?? "");
    return {
      title: "Producer Rewrite",
      summary: lines.length ? `The revision plan keeps your voice intact: clarify the image, tighten the longest setup, and protect the section payoff.` : `Producer Rewrite is ready to shape ${sectionName} without replacing the artist's voice.`,
      signals: [`${averageWords || 0} words per line`, spread <= 4 ? "Line shape is consistent" : "Line shape varies"],
      actions: lines.length ? [
        longestLine ? `Tighten this setup first: “${longestLine.slice(0, 72)}${longestLine.length > 72 ? "..." : "”"}` : emptyAction,
        anchor ? `Use “${anchor}” to connect the section instead of adding a new subject.` : "Add one concrete image that makes the emotion visible.",
        environmentIntel.missionCue,
      ] : [emptyAction],
    };
  }

  if (pass === "commercial") {
    const replayReady = lines.length >= 4 && Boolean(anchor) && averageWords <= 11;
    return {
      title: "Commercial Pass",
      summary: replayReady ? "The section has a usable replay shape. The next move is making the title phrase impossible to miss." : "The record needs a clearer repeat point before the commercial shape is ready.",
      signals: [replayReady ? "Replay shape ready" : "Replay shape forming", anchor ? "Memory phrase detected" : "Memory phrase missing"],
      actions: lines.length ? [
        anchor ? `Treat “${anchor}” as the memory phrase and place it near the section landing.` : "Choose one title-ready phrase and repeat it with intention.",
        lines.length > 8 ? "Remove one idea before adding another; commercial sections reward focus." : "Keep the section focused on one promise, image, or emotion.",
        "Read the section once without the beat. The record idea should still be obvious.",
      ] : [emptyAction],
    };
  }

  return {
    title: "Pocket Adjustment",
    summary: lines.length ? `This ${bpm} BPM beat has a ${pace} pocket. Your line-length spread is ${spread} words.` : `Pocket Adjustment is listening for line shape against the ${bpm} BPM beat.`,
    signals: [`${bpm} BPM ${pace} pocket`, spread <= 4 ? "Cadence is balanced" : `${spread}-word line spread`],
    actions: lines.length ? [
      spread > 5 ? "Trim the longest line or split it across two breath points." : "Line lengths are close enough to perform cleanly; preserve that balance.",
      bpm >= 120 ? "Use shorter setups and let the landing bar breathe." : "Leave a pocket after the strongest words instead of filling every count.",
      `Record one rough take of ${sectionName}; the pocket is easier to hear than to read.`,
    ] : [emptyAction],
  };
}

function MobileHeader({
  signedIn,
  membership,
  onOpenAccess,
  onAuthRequired,
}: {
  signedIn: boolean;
  membership: MembershipSnapshot | null;
  onOpenAccess: () => void;
  onAuthRequired: () => void;
}) {
  const accessLabel = membershipAccessLabel(membership);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-black/82 px-5 py-4 backdrop-blur-xl">
      <BrandLogo className="[&>span:first-child]:h-10 [&>span:first-child]:w-[9.25rem]" />
      <div className="flex items-center gap-2">
        {accessLabel && (
          <button
            type="button"
            onClick={onOpenAccess}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 text-[10px] font-semibold text-gold"
            aria-label={`Open ${accessLabel} studio access`}
          >
            <Crown className="h-3.5 w-3.5" />
            <span>{accessLabel}</span>
          </button>
        )}
        <ActivityInbox signedIn={signedIn} onAuthRequired={onAuthRequired} />
      </div>
    </header>
  );
}

function StudioAccessHub({
  open,
  membership,
  onClose,
  onStartWriting,
  onOpenReadiness,
  onChooseRoom,
  onBrowseProducers,
  onManage,
}: {
  open: boolean;
  membership: MembershipSnapshot | null;
  onClose: () => void;
  onStartWriting: () => void;
  onOpenReadiness: () => void;
  onChooseRoom: () => void;
  onBrowseProducers: () => void;
  onManage: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const artist = membership?.artist ?? null;
  const producer = membership?.producer ?? null;
  if (!open || !artist) return null;

  const planLabel = [artist.plan.name, producer?.plan.name].filter(Boolean).join(" + ");
  const allAccess = hasAllAccessMembership(membership);
  const roomLimit = allAccess ? -1 : typeof artist.limits.studio_rooms === "number" ? artist.limits.studio_rooms : 1;
  const hasWriterIntelligence = artist.entitlements.ghostwriter === true || artist.entitlements.full_pen_view === true;
  const hasAdvancedReadiness = artist.entitlements.advanced_booth_ready === true;
  const hasProducerConnections = artist.entitlements.producer_connections === true;

  return (
    <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/76 px-2 pt-14 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Studio access">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close studio access" />
      <section className="relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101012] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-28px_90px_rgba(0,0,0,0.72)]">
        <div className="relative overflow-hidden border-b border-gold/18 px-5 pb-5 pt-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(246,199,72,0.16),transparent_42%)]" />
          <div className="relative flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/35 bg-gold/10 text-gold"><Crown className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="label-hw text-gold/80">Your studio is upgraded</div>
              <h2 className="mt-1 text-xl font-semibold text-white">{membershipAccessLabel(membership) ?? artist.plan.name} is active.</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/52">{planLabel}. The tools below are ready where you create.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/55" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <AccessLaunchRow
            icon={WandSparkles}
            eyebrow="Create"
            title="Writer Flow"
            detail={hasWriterIntelligence ? "Ghostwriter, Pen View, rewrites, and version history are available inside the pad." : "Your focused writing room is ready."}
            action="Start writing"
            onClick={onStartWriting}
          />
          <AccessLaunchRow
            icon={ShieldCheck}
            eyebrow="Finish"
            title="Record Readiness"
            detail={hasAdvancedReadiness ? "Advanced Booth Ready, performance coaching, and premium exports are active." : "Track song completion and prepare the record for the booth."}
            action="Open session"
            onClick={onOpenReadiness}
          />
          <AccessLaunchRow
            icon={Home}
            eyebrow="Environment"
            title={roomLimit === -1 ? "All studio rooms" : `${Math.max(1, roomLimit)} studio rooms`}
            detail="Choose the room that matches the energy of tonight's record."
            action="Choose room"
            onClick={onChooseRoom}
          />
          <AccessLaunchRow
            icon={Headphones}
            eyebrow="Connect"
            title="Producer discovery"
            detail={hasProducerConnections ? "Matched producers, storefronts, beats, and messaging are unlocked." : "Find a producer and a beat that fit the session."}
            action="Browse producers"
            onClick={onBrowseProducers}
          />

          {producer && (
            <Link href="/producer" className="flex min-h-14 items-center gap-3 rounded-2xl border border-gold/25 bg-gold/[0.07] px-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/25 bg-black/24 text-gold"><Briefcase className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white">Open Producer HQ</span><span className="mt-0.5 block truncate text-[10px] text-white/45">Catalog, services, promotion, and intelligence</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gold" />
            </Link>
          )}

          <button type="button" onClick={onManage} className="min-h-10 w-full text-xs font-semibold text-white/45 hover:text-gold">Manage membership in Profile</button>
        </div>
      </section>
    </div>
  );
}

function AccessLaunchRow({
  icon: Icon,
  eyebrow,
  title,
  detail,
  action,
  onClick,
}: {
  icon: typeof Home;
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[82px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/[0.07] text-gold"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="label-hw block text-gold/68">{eyebrow}</span>
        <span className="mt-1 block text-sm font-semibold text-white">{title}</span>
        <span className="mt-1 block text-[10px] leading-relaxed text-white/45">{detail}</span>
      </span>
      <span className="shrink-0 text-[10px] font-semibold text-gold">{action}</span>
    </button>
  );
}

function BeatSwitcherSheet({
  open,
  signedIn,
  currentBeat,
  starterBeats,
  lockerBeats,
  marketplaceBeats,
  marketplaceLoading,
  marketplaceError,
  onClose,
  onPreviewStart,
  onImportBeat,
  onAuthRequired,
  onUseBeat,
  onUseStarterBeat,
}: {
  open: boolean;
  signedIn: boolean;
  currentBeat: SelectedBeat;
  starterBeats: StarterBeat[];
  lockerBeats: BeatLockerRow[];
  marketplaceBeats: MarketplaceBeat[];
  marketplaceLoading: boolean;
  marketplaceError: string | null;
  onClose: () => void;
  onPreviewStart: () => void;
  onImportBeat: (input: PrivateBeatImportInput) => Promise<BeatLockerRow | null>;
  onAuthRequired: () => void;
  onUseBeat: (beat: BeatLockerRow) => void;
  onUseStarterBeat: (beat: StarterBeat) => void;
}) {
  const [tab, setTab] = useState<"locker" | "preview">("locker");
  const [previewingBeatId, setPreviewingBeatId] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [starterCollection, setStarterCollection] = useState("all");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopSample = useCallback(() => {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      previewAudioRef.current = null;
    }
    setPreviewingBeatId(null);
    setPreviewProgress(0);
  }, []);

  useEffect(() => {
    if (!open) {
      stopSample();
      setImportOpen(false);
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open, stopSample]);

  useEffect(() => stopSample, [stopSample]);

  const toggleMarketplaceSample = async (beat: MarketplaceBeat) => {
    if (previewingBeatId === beat.id) {
      stopSample();
      return;
    }

    stopSample();
    onPreviewStart();
    setPreviewError(null);
    const snapshot = toBeatSnapshot(beat);
    const previewUrl = resolveBeatPreviewUrl(snapshot);
    if (!previewUrl) {
      setPreviewError("This producer has not added a playable preview yet.");
      return;
    }

    const audio = new Audio(previewUrl);
    const sampleLength = Math.max(1, Math.min(30, getBeatDurationSeconds(snapshot)));
    previewAudioRef.current = audio;
    setPreviewingBeatId(beat.id);
    audio.ontimeupdate = () => {
      const elapsed = Math.min(sampleLength, audio.currentTime);
      setPreviewProgress((elapsed / sampleLength) * 100);
      if (audio.currentTime >= sampleLength) stopSample();
    };
    audio.onended = stopSample;
    audio.onerror = () => {
      stopSample();
      setPreviewError("This preview could not be played.");
    };

    try {
      await audio.play();
      trackMarketplaceEvent("beat_play", beat.id);
    } catch {
      stopSample();
      setPreviewError("Tap again to start this preview.");
    }
  };

  if (!open) return null;

  const lockerByBeatId = new Map(lockerBeats.map((beat) => [beat.beat_id, beat]));
  const starterCollections = Array.from(new Map(starterBeats.filter((beat) => beat.collectionSlug && beat.collection).map((beat) => [beat.collectionSlug!, beat.collection!])).entries());
  const visibleStarterBeats = starterCollection === "all" ? starterBeats : starterBeats.filter((beat) => beat.collectionSlug === starterCollection);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/72 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="beat-switcher-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[82svh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold/22 bg-[#0d0d0e] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="px-5 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="label-hw text-gold">Beat pocket</div>
              <h2 id="beat-switcher-title" className="mt-1 text-xl font-semibold">Change the beat.</h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">Writing stays open. Your lyrics do not move.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close beat picker">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-xl border border-white/10 bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setTab("locker")}
              className={cn("min-h-9 rounded-lg text-xs font-semibold transition-colors", tab === "locker" ? "bg-gold/14 text-gold" : "text-muted-foreground")}
            >
              My Beats {starterBeats.length + lockerBeats.length > 0 ? `(${starterBeats.length + lockerBeats.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={cn("min-h-9 rounded-lg text-xs font-semibold transition-colors", tab === "preview" ? "bg-gold/14 text-gold" : "text-muted-foreground")}
            >
              30-sec Previews
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4">
          {tab === "locker" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <div className="min-w-0"><div className="label-hw text-white/50">Your Beat Locker</div><div className="mt-1 truncate text-[10px] text-muted-foreground">Switch pockets without leaving the pad.</div></div>
                <button
                  type="button"
                  onClick={() => signedIn ? setImportOpen(true) : onAuthRequired()}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/8 px-3 text-[11px] font-semibold text-gold"
                >
                  <Upload className="h-3.5 w-3.5" />Import beat
                </button>
              </div>
              {starterBeats.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <div className="label-hw text-gold/75">Included with RapWriter</div>
                  {starterCollections.length > 1 && (
                    <select value={starterCollection} onChange={(event) => setStarterCollection(event.target.value)} aria-label="Filter included beats by collection" className="min-h-8 max-w-[155px] rounded-lg border border-white/10 bg-[#0d0d0e] px-2 text-[10px] font-semibold text-white/70 outline-none focus:border-gold/35">
                      <option value="all">All collections</option>
                      {starterCollections.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                  )}
                </div>
              )}
              {visibleStarterBeats.map((beat) => {
                const active = currentBeat.id === `starter-beat-${beat.id}`;
                return (
                  <button
                    key={beat.id}
                    type="button"
                    onClick={() => onUseStarterBeat(beat)}
                    className={cn(
                      "flex min-h-[68px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active ? "border-gold/40 bg-gold/10" : "border-white/10 bg-white/[0.025] hover:border-gold/25",
                    )}
                  >
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", active ? "border-gold/45 bg-gold text-black" : "border-gold/25 bg-gold/8 text-gold")}>
                      {active ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{beat.title}</span>
                      <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {[beat.producer, beat.genre, beat.featured ? "Featured" : "Included"].filter(Boolean).join(" - ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-gold">{active ? "Active" : "Use"}</span>
                  </button>
                );
              })}
              {starterBeats.length > 0 && lockerBeats.length > 0 && <div className="px-1 pb-1 pt-3 label-hw text-white/45">Saved and licensed</div>}
              {lockerBeats.map((beat) => {
                const active = currentBeat.id === beat.beat_id;
                return (
                  <button
                    key={beat.id}
                    type="button"
                    onClick={() => onUseBeat(beat)}
                    className={cn(
                      "flex min-h-[68px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active ? "border-gold/40 bg-gold/10" : "border-white/10 bg-white/[0.025] hover:border-gold/25",
                    )}
                  >
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", active ? "border-gold/45 bg-gold text-black" : "border-gold/25 bg-gold/8 text-gold")}>
                      {active ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{beat.title}</span>
                      <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {[beat.producer, beat.bpm ? `${beat.bpm} BPM` : null, beat.license === "Favorite" ? "Saved" : beat.license].filter(Boolean).join(" - ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-gold">{active ? "Active" : "Use"}</span>
                  </button>
                );
              })}
              {starterBeats.length === 0 && lockerBeats.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center">
                  <Headphones className="mx-auto h-5 w-5 text-gold" />
                  <div className="mt-3 text-sm font-semibold">{signedIn ? "Your Beat Locker is ready." : "Sign in to open your Beat Locker."}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Save or license beats in Studio Store, then switch them here without leaving Writer Flow.</p>
                </div>
              )}
            </div>
          )}

          {tab === "preview" && (
            <div className="space-y-2">
              {marketplaceBeats.slice(0, 12).map((beat) => {
                const ownedBeat = lockerByBeatId.get(beat.id);
                const previewing = previewingBeatId === beat.id;
                return (
                  <div key={beat.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
                    <div className="flex min-h-[72px] items-center gap-3 px-3 py-2.5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-gold/20 bg-gold/8 text-xs font-semibold text-gold" style={{ background: beat.art, backgroundPosition: "center", backgroundSize: "cover" }}>
                        {beat.glyph}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{beat.title}</span>
                        <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {[beat.producer, beat.bpm ? `${beat.bpm} BPM` : null, "30 sec"].filter(Boolean).join(" - ")}
                        </span>
                      </span>
                      {ownedBeat ? (
                        <button type="button" onClick={() => onUseBeat(ownedBeat)} className="min-h-9 shrink-0 rounded-full border border-gold/35 bg-gold/10 px-3 text-[10px] font-semibold text-gold">
                          Use
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void toggleMarketplaceSample(beat)}
                          className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", previewing ? "border-gold bg-gold text-black" : "border-gold/35 bg-gold/10 text-gold")}
                          aria-label={previewing ? `Pause ${beat.title} preview` : `Play 30 second preview of ${beat.title}`}
                        >
                          {previewing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
                        </button>
                      )}
                    </div>
                    {previewing && <div className="h-0.5 bg-white/8"><div className="h-full bg-gold transition-[width] duration-150" style={{ width: `${previewProgress}%` }} /></div>}
                  </div>
                );
              })}
              {marketplaceLoading && <div className="py-10 text-center text-xs text-muted-foreground">Loading producer previews...</div>}
              {!marketplaceLoading && marketplaceBeats.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center text-sm text-muted-foreground">
                  {marketplaceError ?? "Producer previews will appear after beats are approved."}
                </div>
              )}
              {previewError && <div className="rounded-xl border border-rec/25 bg-rec/10 p-3 text-xs text-rec">{previewError}</div>}
              <p className="px-2 pt-2 text-center text-[10px] leading-relaxed text-muted-foreground">Previews stop at 30 seconds. Full session use unlocks from your Beat Locker.</p>
            </div>
          )}
        </div>
      </section>
      {signedIn && (
        <PrivateBeatImportSheet
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={async (input) => {
            const imported = await onImportBeat(input);
            if (imported) onUseBeat(imported);
            return imported;
          }}
        />
      )}
    </div>
  );
}

function NewSongSheet({
  open,
  title,
  startSection,
  useCurrentBeat,
  beat,
  status,
  onTitle,
  onStartSection,
  onUseCurrentBeat,
  onClose,
  onCreate,
}: {
  open: boolean;
  title: string;
  startSection: string;
  useCurrentBeat: boolean;
  beat: SelectedBeat;
  status: PadActionStatus;
  onTitle: (value: string) => void;
  onStartSection: (value: string) => void;
  onUseCurrentBeat: (value: boolean) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-3xl border border-white/10 bg-[#111113] p-5 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label-hw text-gold/85">New Song</div>
            <h2 className="mt-2 text-2xl font-semibold">Set the session.</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close new song">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-5 block">
          <span className="label-hw">Song title</span>
          <input
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            maxLength={160}
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-semibold outline-none placeholder:text-white/30"
            placeholder="Untitled Draft"
            autoFocus
          />
        </label>

        <div className="mt-5">
          <div className="label-hw">Start writing in</div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [overscroll-behavior-x:contain] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
            {mobileSections.slice(0, 4).map((item) => (
              <button
                key={item.name}
                onClick={() => onStartSection(item.name)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold",
                  startSection === item.name ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onUseCurrentBeat(!useCurrentBeat)}
          className={cn(
            "mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left",
            useCurrentBeat ? "border-gold/30 bg-gold/8" : "border-white/10 bg-black/24",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold">{useCurrentBeat ? "Current beat attached" : "Start without beat"}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {useCurrentBeat ? `${beat.title} - ${beat.producer ?? "Selected beat"}` : "You can attach a beat later."}
            </div>
          </div>
          <span className={cn("h-6 w-11 rounded-full border p-0.5 transition-colors", useCurrentBeat ? "border-gold/40 bg-gold/30" : "border-white/10 bg-white/5")}>
            <span className={cn("block h-5 w-5 rounded-full bg-white transition-transform", useCurrentBeat && "translate-x-5 bg-gold")} />
          </span>
        </button>

        {status.message && status.state === "error" && <div className="mt-3 rounded-xl border border-rec/25 bg-rec/10 p-3 text-sm text-rec">{status.message}</div>}

        <button
          onClick={onCreate}
          disabled={status.state === "saving"}
          className="gold-seal mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          {status.state === "saving" ? "Creating..." : "Create Song"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function VersionHistorySheet({
  open,
  sectionName,
  currentContent,
  versions,
  status,
  error,
  onClose,
  onRestore,
}: {
  open: boolean;
  sectionName: string;
  currentContent: string;
  versions: SectionVersion[];
  status: VersionHistoryStatus;
  error: string | null;
  onClose: () => void;
  onRestore: (versionId: string) => void;
}) {
  if (!open) return null;

  const visibleVersions = versions.filter((version, index) => index === 0 || version.content !== versions[index - 1].content);
  const restoring = status === "restoring";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/72 px-3 pb-3 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        className="flex max-h-[82svh] w-full max-w-[430px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.58)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gold/85">
              <History className="h-4 w-4" />
              <span className="label-hw">Revision History</span>
            </div>
            <h2 id="version-history-title" className="mt-2 truncate text-xl font-semibold">{sectionName} snapshots</h2>
            <p className="mt-1 text-xs text-muted-foreground">Restoring keeps your current draft in history.</p>
          </div>
          <button type="button" onClick={onClose} disabled={restoring} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close revision history">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {status === "loading" && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin text-gold" />
              <span className="text-sm">Loading snapshots...</span>
            </div>
          )}

          {error && status !== "loading" && (
            <div className="rounded-2xl border border-rec/25 bg-rec/10 p-4 text-sm leading-relaxed text-rec">{error}</div>
          )}

          {status === "ready" && !error && visibleVersions.length === 0 && (
            <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
              <History className="h-6 w-6 text-gold/65" />
              <div className="mt-3 text-sm font-semibold">No earlier snapshots yet</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">History begins after the next synced change.</p>
            </div>
          )}

          {visibleVersions.length > 0 && (
            <div className="space-y-2">
              {visibleVersions.map((version) => {
                const isCurrent = version.content === currentContent;
                return (
                  <article key={version.id} className={cn("rounded-2xl border p-3", isCurrent ? "border-emerald-400/25 bg-emerald-500/[0.06]" : "border-white/10 bg-black/24")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-white/90">{versionSourceLabel(version.source)}</span>
                          {isCurrent && <span className="rounded-full bg-emerald-500/14 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Current</span>}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {formatVersionTime(version.created_at)} - {version.bar_count} bars - {version.word_count} words
                        </div>
                      </div>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => onRestore(version.id)}
                          disabled={restoring}
                          className="min-h-9 shrink-0 rounded-xl border border-gold/30 bg-gold/8 px-3 text-xs font-semibold text-gold disabled:opacity-45"
                        >
                          {restoring ? "Restoring..." : "Restore"}
                        </button>
                      )}
                    </div>
                    <pre className="mt-3 max-h-20 overflow-hidden whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/65">{version.content || "Empty section"}</pre>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BoothExportSheet({
  open,
  draft,
  exportRecord,
  status,
  error,
  premiumExports,
  onClose,
  onFreeze,
  onUpgrade,
}: {
  open: boolean;
  draft: BoothExportCreateInput | null;
  exportRecord: BoothExportRecord | null;
  status: "idle" | "saving" | "error";
  error: string | null;
  premiumExports: boolean;
  onClose: () => void;
  onFreeze: () => void;
  onUpgrade: () => void;
}) {
  if (!open || !draft) return null;
  const snapshot = exportRecord?.snapshot ?? draft.snapshot;
  const score = exportRecord?.booth_score ?? snapshot.boothReady.score;
  const readyChecks = snapshot.boothReady.checklist.filter((item) => item.complete).length;
  const missingSections = mobileSections.filter((section) => !(snapshot.sections[section.name] ?? "").trim());

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/78 px-3 pt-12 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booth-export-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[90svh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-gold/20 bg-[#101011] shadow-[0_-28px_90px_rgba(0,0,0,0.72)] sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/18" />
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gold"><Download className="h-4 w-4" /><span className="label-hw">Booth Ready Export</span></div>
            <h2 id="booth-export-title" className="mt-2 truncate text-xl font-semibold">{draft.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Review the handoff, then freeze this exact version.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close Booth Ready export"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-gold/20 bg-gold/[0.07] py-4">
            <ExportMetric label="Booth Score" value={String(score)} />
            <ExportMetric label="Bars" value={String(snapshot.totalBars)} />
            <ExportMetric label="Ready" value={`${readyChecks}/${snapshot.boothReady.checklist.length}`} />
          </div>

          <section className="mt-3 rounded-2xl border border-white/10 bg-black/24 p-4">
            <div className="flex items-center justify-between gap-3"><span className="label-hw">Session Handoff</span>{exportRecord && <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Frozen V{exportRecord.version_number}</span>}</div>
            <div className="mt-3 space-y-2 text-xs">
              <ExportReviewRow label="Lyrics" value={missingSections.length === 0 ? "All sections included" : `${mobileSections.length - missingSections.length} of ${mobileSections.length} sections`} ready={missingSections.length === 0} />
              <ExportReviewRow label="Beat credits" value={typeof snapshot.beat.title === "string" ? snapshot.beat.title : "No beat selected"} ready={typeof snapshot.beat.title === "string"} />
              <ExportReviewRow label="Rough take" value={snapshot.roughTake ? `${formatDuration(snapshot.roughTake.durationSeconds)} attached` : "Not attached"} ready={Boolean(snapshot.roughTake)} />
              <ExportReviewRow label="Next move" value={snapshot.boothReady.nextAction || "Review the session"} ready />
            </div>
          </section>

          {!exportRecord ? (
            <>
              {error && <div className="mt-3 rounded-xl border border-rec/25 bg-rec/10 p-3 text-sm text-rec">{error}</div>}
              <button type="button" onClick={onFreeze} disabled={status === "saving"} className="gold-seal mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold disabled:opacity-55">
                {status === "saving" ? <><RefreshCw className="h-4 w-4 animate-spin" />Freezing version...</> : <><ShieldCheck className="h-4 w-4" />Freeze Booth Version</>}
              </button>
              <p className="mt-2 px-2 text-center text-[10px] leading-relaxed text-muted-foreground">Later edits create a new version. This one stays unchanged.</p>
            </>
          ) : (
            <div className="mt-4 space-y-2">
              <button type="button" onClick={() => downloadBoothFile(exportRecord.id, "txt")} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/85">
                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-gold" />Lyrics sheet</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">TXT</span>
              </button>
              {premiumExports ? (
                <>
                  <button type="button" onClick={() => downloadBoothFile(exportRecord.id, "pdf")} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/85">
                    <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-gold" />Studio lyric book</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">PDF</span>
                  </button>
                  <button type="button" onClick={() => downloadBoothFile(exportRecord.id, "zip")} className="gold-seal flex min-h-13 w-full items-center justify-between rounded-xl px-4 text-sm font-semibold">
                    <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" />Download studio package</span><span className="text-[10px] uppercase tracking-[0.12em]">ZIP</span>
                  </button>
                  {exportRecord.rough_take_id && (
                    <button type="button" onClick={() => downloadBoothFile(exportRecord.id, "rough-take")} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/25 text-xs font-semibold text-gold"><Mic className="h-4 w-4" />Download rough take</button>
                  )}
                </>
              ) : (
                <button type="button" onClick={onUpgrade} className="mt-1 flex min-h-14 w-full items-center justify-between rounded-xl border border-gold/30 bg-gold/8 px-4 text-left">
                  <span><span className="flex items-center gap-2 text-sm font-semibold text-gold"><LockKeyhole className="h-4 w-4" />Full Studio Package</span><span className="mt-1 block text-[10px] text-muted-foreground">PDF, ZIP, credits, session data, and rough take.</span></span><ChevronRight className="h-4 w-4 shrink-0 text-gold" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ExportMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-2 text-center"><div className="text-xl font-semibold tabular-nums text-gold">{value}</div><div className="mt-1 truncate text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div></div>;
}

function ExportReviewRow({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return <div className="flex items-start gap-2"><span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border", ready ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300" : "border-white/12 text-muted-foreground")}>{ready && <Check className="h-2.5 w-2.5" />}</span><span className="min-w-0"><span className="font-semibold text-white/82">{label}</span><span className="ml-1 text-muted-foreground">/ {value}</span></span></div>;
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

function StudioPackSheet({
  open,
  active,
  packs,
  getStudioPackAccess,
  onClose,
  onUnlock,
  onPreview,
  onOpenMembership,
  onStudioDna,
  onSelect,
}: {
  open: boolean;
  active: StudioPackId;
  packs: StudioPack[];
  getStudioPackAccess: (id: StudioPackId) => StudioRoomAccess;
  onClose: () => void;
  onUnlock: (id: StudioPackId) => void;
  onPreview: (id: StudioPackId) => void;
  onOpenMembership: () => void;
  onStudioDna: () => void;
  onSelect: (id: StudioPackId) => void;
}) {
  const [previewId, setPreviewId] = useState<StudioPackId>(active);
  const previewPack = getStudioPack(previewId);
  const previewAccess = getStudioPackAccess(previewPack.id);
  const previewProduct = studioRoomProducts.find((item) => item.id === getStudioRoomProductId(previewPack.id));

  useEffect(() => {
    if (open) setPreviewId(active);
  }, [active, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <div className="max-h-[82svh] w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="label-hw text-gold/85">Studio Packs</div>
            <h2 className="mt-2 text-2xl font-semibold">Choose the room.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Change the environment without crowding the writing screen.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onStudioDna} className="grid h-10 w-10 place-items-center rounded-full border border-gold/25 bg-gold/8 text-gold" aria-label="Set Studio DNA" title="Studio DNA">
              <Sparkles className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close studio packs">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="max-h-[calc(82svh-8rem)] space-y-3 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-2xl border border-gold/25 bg-gold/8">
            <div className="relative h-40">
              <img src={previewPack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: previewPack.position }} loading="lazy" decoding="async" draggable={false} />
              <div className="absolute inset-0" style={{ background: previewPack.overlay }} />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="label-hw text-gold/85">{previewAccess.available ? previewAccess.badge : "Locked Preview"}</div>
                <div className="mt-1 text-2xl font-semibold">{previewPack.label}</div>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{previewPack.line}</p>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{previewPack.writingCue}</p>
              {previewAccess.available ? (
                <button type="button" onClick={() => onSelect(previewPack.id)} className="gold-seal mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-black">
                  Use {previewPack.label}
                </button>
              ) : (
                <>
                  {process.env.NODE_ENV !== "production" && (
                    <button
                      type="button"
                      onClick={() => {
                        onPreview(previewPack.id);
                        onClose();
                      }}
                      className="mt-3 min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white"
                    >
                      Preview locally
                    </button>
                  )}
                  <button type="button" onClick={() => onUnlock(previewPack.id)} className="gold-seal mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-black">
                    Unlock Room {previewProduct ? `- ${previewProduct.price}` : ""}
                  </button>
                  {previewAccess.requiredPlan && (
                    <button type="button" onClick={onOpenMembership} className="mt-2 min-h-10 w-full rounded-xl border border-gold/25 bg-gold/8 px-4 text-xs font-semibold text-gold">
                      Included with Prep Studio {previewAccess.requiredPlan === "elite" ? "Elite" : "Pro"}
                    </button>
                  )}
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                    Own it permanently{previewAccess.requiredPlan ? ", or use it while membership is active" : " through Studio Store"}.
                  </p>
                  {process.env.NODE_ENV !== "production" && (
                    <p className="mt-1 text-center text-[10px] leading-relaxed text-white/40">
                      Local preview does not grant ownership or membership access.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {packs.map((pack) => {
              const access = getStudioPackAccess(pack.id);
              const locked = !access.available;
              const previewing = previewId === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPreviewId(pack.id)}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-black/24 text-left transition-colors",
                    previewing ? "border-gold/45 bg-gold/10" : "border-white/10",
                  )}
                >
                  <div className="relative h-20">
                    <img src={pack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: pack.position }} loading="lazy" decoding="async" draggable={false} />
                    <div className="absolute inset-0" style={{ background: pack.overlay }} />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-gold/20 bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-gold">
                        {access.badge}
                      </span>
                      {active === pack.id ? (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold text-black">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : locked ? (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 bg-black/45 text-white/70">
                          <LockKeyhole className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-xs font-semibold">{pack.label}</div>
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">{pack.bestFor.slice(0, 2).join(" / ")}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
            <div className="label-hw text-gold/80">Pack Access</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Membership unlocks room access while active. Studio Store purchases remain yours permanently.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioAirSheet({
  open,
  studioPack,
  activeIndex,
  playing,
  volume,
  onClose,
  onToggle,
  onVolume,
}: {
  open: boolean;
  studioPack: StudioPack;
  activeIndex: number;
  playing: boolean;
  volume: number;
  onClose: () => void;
  onToggle: (index: number) => void;
  onVolume: (volume: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Room ambience"
        className="max-h-[72svh] w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="label-hw text-gold/85">Room Ambience</div>
            <h2 className="mt-2 text-2xl font-semibold">Set the room.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Optional atmosphere for focus. The beat and lyrics stay in control.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close room ambience">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(72svh-8rem)] overflow-y-auto p-4">
          <StudioAirPanel
            studioPack={studioPack}
            activeIndex={activeIndex}
            playing={playing}
            volume={volume}
            onToggle={onToggle}
            onVolume={onVolume}
          />
        </div>
      </section>
    </div>
  );
}

function StudioAirPanel({
  studioPack,
  activeIndex,
  playing,
  volume,
  onToggle,
  onVolume,
}: {
  studioPack: StudioPack;
  activeIndex: number;
  playing: boolean;
  volume: number;
  onToggle: (index: number) => void;
  onVolume: (volume: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/20 bg-gold/8 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="label-hw text-gold/85">{studioPack.label}</div>
          <span className={cn("rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]", playing ? "bg-emerald-400/12 text-emerald-300" : "bg-white/8 text-muted-foreground")}>{playing ? "On" : "Off"}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/72">Sound under the beat. Quiet enough to keep the writing in focus.</p>
      </div>
      <div className="space-y-2">
        {studioPack.ambience.map((item, index) => (
          <button
            type="button"
            key={item.title}
            onClick={() => onToggle(index)}
            aria-pressed={playing && activeIndex === index}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-3 text-left",
              playing && activeIndex === index ? "border-gold/35 bg-gold/8" : "border-white/10 bg-black/24",
            )}
          >
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/20 bg-gold/10 text-[11px] font-semibold text-gold">
              {playing && activeIndex === index ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/24 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
            <Volume2 className="h-4 w-4 text-gold" /> Room level
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{volume}%</span>
        </div>
        <input
          type="range"
          min="4"
          max="32"
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          className="mt-3 h-1.5 w-full accent-[var(--amber)]"
          aria-label="Studio ambience volume"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Your choice is remembered with this session. Studio Air stays off after refresh and pauses before recording.</p>
      </div>
    </div>
  );
}

function MobileProjectRail({
  projects,
  songs,
  activeProjectId,
  studioPacks,
  onLoadSong,
  onNewSong,
}: {
  projects: ProjectRow[];
  songs: SongRow[];
  activeProjectId?: string;
  studioPacks: StudioPack[];
  onLoadSong: (song: SongRow) => void;
  onNewSong: () => void;
}) {
  return (
    <section className="pt-6" aria-labelledby="studio-projects-title">
      <div className="flex items-center justify-between px-5">
        <div>
          <div className="label-hw">Projects</div>
          <h2 id="studio-projects-title" className="mt-1 text-lg font-semibold">Keep the work moving</h2>
        </div>
        <button type="button" onClick={onNewSong} className="flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-gold">
          <FolderPlus className="h-4 w-4" />
          New
        </button>
      </div>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {projects.map((project, index) => {
          const projectSongs = songs
            .filter((song) => song.project_id === project.id)
            .sort((a, b) => (b.last_saved_at ?? "").localeCompare(a.last_saved_at ?? ""));
          const resumeSong = projectSongs[0];
          const completion = projectSongs.length
            ? Math.round(projectSongs.reduce((total, song) => total + (song.completion_pct ?? 0), 0) / projectSongs.length)
            : 0;
          const artworkValue = project.artwork.url ?? project.artwork.image_url;
          const artwork = typeof artworkValue === "string" && artworkValue ? artworkValue : studioPacks[index % studioPacks.length].image;
          const active = project.id === activeProjectId;

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => (resumeSong ? onLoadSong(resumeSong) : onNewSong())}
              className={cn(
                "w-[210px] shrink-0 snap-start overflow-hidden rounded-xl border bg-[#111113] text-left transition-[border-color,transform] active:scale-[0.99]",
                active ? "border-gold/55" : "border-white/10",
              )}
              aria-label={`${resumeSong ? "Open" : "Start a song in"} ${project.title}`}
            >
              <div className="relative h-24 overflow-hidden">
                <img src={artwork} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-black/15 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/58 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
                  {project.project_type || "Project"}
                </span>
              </div>
              <div className="p-3 pt-1">
                <div className="truncate text-sm font-semibold text-white">{project.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {projectSongs.length} {projectSongs.length === 1 ? "song" : "songs"} in motion
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${completion}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold tabular-nums text-gold">{completion}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
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

function PenView({ sectionName, text }: { sectionName: string; text: string }) {
  const analysis = useMemo(() => analyzePenLines(text), [text]);
  const rhymeGroups = useMemo(() => {
    const groups = new Map<string, string>();
    let groupIndex = 0;
    for (const line of analysis.lines) {
      if (!line.rhymeKey || line.rhymeCount < 2 || groups.has(line.rhymeKey)) continue;
      groups.set(line.rhymeKey, String.fromCharCode(65 + (groupIndex % 26)));
      groupIndex += 1;
    }
    return groups;
  }, [analysis.lines]);

  if (!analysis.lines.length) {
    return (
      <div className="grid min-h-[54svh] place-items-center bg-white/[0.012] px-8 text-center">
        <div>
          <Pencil className="mx-auto h-5 w-5 text-gold" />
          <div className="mt-3 text-sm font-semibold">Write a few lines first.</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Pen View will map line endings, syllables, and rhyme connections without changing your lyrics.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-[54svh] overflow-hidden bg-white/[0.012]" aria-label={`${sectionName} Pen View analysis`}>
      <div className="flex items-center justify-between border-b border-white/8 bg-black/18 px-4 py-3 backdrop-blur-lg">
        <div>
          <div className="label-hw text-gold/80">Pen View</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/38">Matching endings / syllables</div>
        </div>
        <div className="text-right text-[10px] text-white/45">
          <div>{analysis.totalSyllables} syllables</div>
          <div className="mt-1">{rhymeGroups.size} rhyme groups</div>
        </div>
      </div>
      <ol className="divide-y divide-white/[0.06] px-2 py-2">
        {analysis.lines.map((line) => {
          const group = line.rhymeKey ? rhymeGroups.get(line.rhymeKey) : undefined;
          const endingMatch = line.text.match(/([A-Za-z0-9']+)([^A-Za-z0-9']*)$/);
          const endingStart = endingMatch?.index ?? line.text.length;
          return (
            <li key={`${line.number}-${line.text}`} className="grid grid-cols-[1.75rem_1fr_auto] gap-2 rounded-lg px-2 py-3">
              <span className="pt-1 text-right font-mono text-[10px] tabular-nums text-white/28">{line.number}</span>
              <p className="min-w-0 whitespace-pre-wrap font-sans text-[16px] leading-7 text-white/88">
                {line.text.slice(0, endingStart)}
                {endingMatch ? (
                  <span className={cn("font-semibold", group ? "text-gold" : "text-white/82")}>
                    {endingMatch[1]}
                    {endingMatch[2]}
                  </span>
                ) : null}
              </p>
              <div className="flex min-w-8 flex-col items-end gap-1 pt-1">
                {group ? <span className="grid h-5 w-5 place-items-center rounded-full border border-gold/35 bg-gold/10 text-[9px] font-bold text-gold">{group}</span> : null}
                <span className="text-[9px] tabular-nums text-white/32">{line.syllables} syl</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function GhostwriterSheet({
  open,
  sectionName,
  sectionText,
  beat,
  studioDna,
  environmentIntel,
  actions,
  membership,
  onUpgrade,
  onClose,
}: {
  open: boolean;
  sectionName: string;
  sectionText: string;
  beat: SelectedBeat;
  studioDna: StudioDna;
  environmentIntel: EnvironmentIntelligence;
  actions: ProducerActionControls;
  membership: WorkspaceMembership | null;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/72 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ghostwriter-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[88svh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl border border-b-0 border-gold/22 bg-[#0d0d0e] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <div className="label-hw text-gold">Producer room</div>
            <h2 id="ghostwriter-title" className="mt-1 text-xl font-semibold">Ghostwriter</h2>
            <p className="mt-1 max-w-[19rem] text-xs leading-relaxed text-muted-foreground">Sharpen what is already on the page. Every change stays yours to accept.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close Ghostwriter">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">
          <ProducerPassPanel
            sectionName={sectionName}
            sectionText={sectionText}
            beat={beat}
            studioDna={studioDna}
            environmentIntel={environmentIntel}
            actions={actions}
            membership={membership}
            onUpgrade={onUpgrade}
          />
        </div>
      </section>
    </div>
  );
}

function MobileSectionTabs({
  sectionContent,
  activeSection,
  onSetActiveSection,
  preview = false,
}: {
  sectionContent: Record<string, string>;
  activeSection: number;
  onSetActiveSection: (index: number) => void;
  preview?: boolean;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    const activeTab = rail?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!rail || !activeTab) return;
    const centeredLeft = activeTab.offsetLeft - (rail.clientWidth - activeTab.clientWidth) / 2;
    rail.scrollTo({ left: Math.max(0, centeredLeft), behavior: "smooth" });
  }, [activeSection]);

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label="Song sections"
      className={cn(
        "flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        preview ? "-mx-1 mb-3 pb-1" : "px-4 py-3",
      )}
    >
      {mobileSections.map((item, index) => (
        <button
          key={item.name}
          type="button"
          role="tab"
          aria-selected={activeSection === index}
          onClick={() => onSetActiveSection(index)}
          className={cn(
            "min-h-10 shrink-0 rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md transition-[border-color,background-color,color,box-shadow]",
            preview
              ? "border-white/10 bg-black/20"
              : "border-white/12 bg-black/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
            activeSection === index && "border-gold/50 bg-gold/12 text-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(246,199,72,0.08)]",
          )}
        >
          {item.name} <span className="tabular-nums opacity-70">{countBars(sectionContent[item.name])}/{item.target}</span>
        </button>
      ))}
    </div>
  );
}

function PadTransport({
  beat,
  playing,
  recording,
  compact,
  currentTime,
  duration,
  error,
  onToggleBeat,
  onSeek,
  onSeekCommit,
  onChangeBeat,
  onToggleRecording,
}: {
  beat: SelectedBeat;
  playing: boolean;
  recording: boolean;
  compact: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  onToggleBeat: () => void;
  onSeek: (seconds: number) => void;
  onSeekCommit: () => void;
  onChangeBeat: () => void;
  onToggleRecording: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center border border-gold/15 bg-[#151516]/96 shadow-[0_14px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[height,border-radius,padding,gap] duration-200",
      compact ? "h-14 gap-2 rounded-xl px-2 py-1" : "gap-3 rounded-2xl px-3 py-2",
    )}>
      <button onClick={onToggleBeat} className={cn("grid shrink-0 place-items-center rounded-full bg-gold text-black", compact ? "h-9 w-9" : "h-11 w-11")} aria-label={playing ? "Pause beat" : "Play beat"}>
        {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{beat.title}</div>
          <button
            type="button"
            onClick={onChangeBeat}
            className={cn("grid shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-muted-foreground transition-colors hover:border-gold/30 hover:text-gold", compact ? "h-7 w-7" : "h-8 w-8")}
            aria-label="Change beat"
            title="Change beat"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className={cn("mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground", compact && "hidden")}>
          {formatDuration(currentTime)} / {formatDuration(duration)} - {[beat.producer, beat.bpm ? `${beat.bpm} BPM` : null, beat.key].filter(Boolean).join(" - ")}
        </div>
        <BeatWaveform beat={beat} currentTime={currentTime} duration={duration} active={playing || recording} recording={recording} compact={compact} onSeek={onSeek} onSeekCommit={onSeekCommit} />
        {error && <div className="mt-1 text-[10px] text-rec">{error}</div>}
      </div>
      <button
        onClick={onToggleRecording}
        className={cn(
          "grid shrink-0 place-items-center rounded-full border",
          compact ? "h-9 w-9" : "h-11 w-11",
          recording ? "border-rec bg-rec/18 text-rec" : "border-rec/50 bg-rec/12 text-rec",
        )}
        aria-label={recording ? "Stop recording" : "Record rough take"}
      >
        <Mic className="h-4 w-4" />
      </button>
    </div>
  );
}

function BeatWaveform({
  beat,
  currentTime,
  duration,
  active,
  recording = false,
  compact = false,
  onSeek,
  onSeekCommit,
}: {
  beat: SelectedBeat;
  currentTime: number;
  duration: number;
  active: boolean;
  recording?: boolean;
  compact?: boolean;
  onSeek?: (seconds: number) => void;
  onSeekCommit?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<{ destroy: () => void; setTime: (time: number) => void } | null>(null);
  const [waveReady, setWaveReady] = useState(false);
  const previewUrl = resolveBeatPreviewUrl(beat);
  const progressPct = recording ? 100 : getProgressPct(currentTime, duration);
  const seekFromPointer = (clientX: number, target: HTMLInputElement) => {
    if (!onSeek || duration <= 0) return;
    const bounds = target.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    onSeek(ratio * duration);
  };

  useEffect(() => {
    let mounted = true;
    setWaveReady(false);
    waveSurferRef.current?.destroy();
    waveSurferRef.current = null;

    if (!previewUrl || !containerRef.current) return;

    void import("wavesurfer.js")
      .then(({ default: WaveSurfer }) => {
        if (!mounted || !containerRef.current) return;
        const waveSurfer = WaveSurfer.create({
          container: containerRef.current,
          url: previewUrl,
          height: compact ? 14 : 22,
          normalize: true,
          interact: false,
          cursorWidth: 0,
          barWidth: 2,
          barGap: 2,
          barRadius: 2,
          waveColor: "rgba(255,255,255,0.18)",
          progressColor: recording ? "rgba(255,71,87,0.95)" : "rgba(246,199,72,0.95)",
        });
        waveSurfer.on("ready", () => {
          if (!mounted) return;
          setWaveReady(true);
          waveSurfer.setTime(0);
        });
        waveSurferRef.current = waveSurfer;
      })
      .catch(() => setWaveReady(false));

    return () => {
      mounted = false;
      waveSurferRef.current?.destroy();
      waveSurferRef.current = null;
    };
  }, [beat.id, compact, previewUrl, recording]);

  useEffect(() => {
    if (!waveReady || !waveSurferRef.current) return;
    waveSurferRef.current.setTime(Math.max(0, currentTime));
  }, [currentTime, waveReady]);

  if (previewUrl) {
    return (
      <div className={cn("relative mt-2 overflow-hidden rounded-full bg-white/[0.04]", compact ? "h-4" : "h-6")}>
        <div ref={containerRef} className="absolute inset-x-0 top-1/2 -translate-y-1/2" />
        {!waveReady && <SyntheticWaveform beat={beat} progressPct={progressPct} active={active} recording={recording} compact={compact} />}
        {onSeek && duration > 0 && !recording && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 z-[1] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/60 bg-gold shadow-[0_0_10px_rgba(246,199,72,0.65)]"
              style={{ left: `${progressPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={Math.min(currentTime, duration)}
              onChange={(event) => onSeek(Number(event.target.value))}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                seekFromPointer(event.clientX, event.currentTarget);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  seekFromPointer(event.clientX, event.currentTarget);
                }
              }}
              onPointerUp={(event) => {
                seekFromPointer(event.clientX, event.currentTarget);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                onSeekCommit?.();
              }}
              onPointerCancel={onSeekCommit}
              onKeyUp={onSeekCommit}
              onBlur={onSeekCommit}
              aria-label={`Seek ${beat.title}`}
              aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [touch-action:none]"
            />
          </>
        )}
      </div>
    );
  }

  return <SyntheticWaveform beat={beat} progressPct={progressPct} active={active} recording={recording} compact={compact} />;
}

function SyntheticWaveform({
  beat,
  progressPct,
  active,
  recording,
  compact,
}: {
  beat: SelectedBeat;
  progressPct: number;
  active: boolean;
  recording: boolean;
  compact: boolean;
}) {
  const bars = useMemo(() => buildSyntheticWaveBars(beat, compact ? 32 : 42), [beat, compact]);

  return (
    <div className={cn("mt-2 flex items-center gap-[2px] overflow-hidden rounded-full bg-white/[0.04] px-1.5", compact ? "h-4" : "h-6")}>
      {bars.map((height, index) => {
        const lit = (index / Math.max(1, bars.length - 1)) * 100 <= progressPct;
        return (
          <span
            key={`${beat.id}-${index}`}
            className={cn(
              "w-[2px] rounded-full transition-colors",
              lit ? (recording ? "bg-rec" : "bg-gold") : "bg-white/16",
              active && lit && "shadow-[0_0_8px_rgba(246,199,72,0.55)]",
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
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

function TakeWaveform({
  currentTime,
  duration,
  active,
  saved,
}: {
  currentTime: number;
  duration: number;
  active: boolean;
  saved: boolean;
}) {
  const bars = useMemo(() => buildTakeWaveBars(34), []);
  const progressPct = getProgressPct(currentTime, duration);
  return (
    <div className="mt-2 flex h-6 items-center gap-[2px] overflow-hidden rounded-full bg-white/[0.04] px-1.5">
      {bars.map((height, index) => {
        const lit = (index / Math.max(1, bars.length - 1)) * 100 <= progressPct;
        return (
          <span
            key={`take-${index}`}
            className={cn(
              "w-[2px] rounded-full transition-colors",
              lit ? (saved ? "bg-emerald-300" : "bg-gold") : "bg-white/16",
              active && lit && "shadow-[0_0_8px_rgba(246,199,72,0.55)]",
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

function BoothReadyPanel({
  result,
  environmentIntel,
  onPrimaryAction,
}: {
  result: BoothReadyResult;
  environmentIntel: EnvironmentIntelligence;
  onPrimaryAction: () => void;
}) {
  const readiness = getRecordReadiness(result);
  const metrics = [
    ["Structure", result.metrics.structure],
    ["Completion", result.metrics.completion],
    ["Cadence", result.metrics.cadence],
    ["Hook", result.metrics.hook],
    ["Originality", result.metrics.originality],
    ["Replay", result.metrics.replay],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/20 bg-gold/8 p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="label-hw text-gold/80">Record Readiness</div>
            <div className="mt-2 text-xl font-semibold text-white">{readiness.label}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-semibold text-gold">{result.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <div className={cn("rounded-full px-3 py-1 text-xs", readiness.certified ? "bg-emerald-500/14 text-emerald-300" : "bg-white/8 text-muted-foreground")}>
            {readiness.certified ? "Certified" : "In progress"}
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{readiness.detail}</p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="label-hw text-white/45">Best next action</div>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-white/88">{result.nextAction}</p>
        </div>
        <button onClick={onPrimaryAction} className="gold-seal mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
          {result.primaryActionLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <RecordReadinessJourney readiness={readiness} />

      <details className="group rounded-xl border border-white/10 bg-black/24">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-white/78">
          Why this status?
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-white/10 p-3">
          <div>
            <div className="label-hw text-gold/80">{environmentIntel.boothFocusTitle}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{environmentIntel.boothFocusBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {environmentIntel.focusMetrics.map((item) => (
                <span key={item} className="rounded-full border border-gold/20 bg-gold/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-gold">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <BoothReadyLane title="Lyrics" score={result.lyricScore} detail={result.locked ? "Draft check" : "Review active"} />
            <BoothReadyLane
              title="Performance"
              score={result.performanceScore}
              detail={result.performance.takeSaved ? "Take saved" : result.performance.takeExists ? "Take unsaved" : "No take yet"}
            />
          </div>

          <PerformanceRead performance={result.performance} />

          <div>
            <div className="label-hw">Readiness checks</div>
            <div className="mt-3 space-y-2">
              {result.checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                      item.complete ? "border-emerald-400/30 bg-emerald-500/14 text-emerald-300" : "border-white/15 bg-white/5 text-muted-foreground",
                    )}
                  >
                    {item.complete ? <Check className="h-3 w-3" /> : ""}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", item.complete ? "text-white/90" : "text-muted-foreground")}>{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums text-white/80">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>

          {result.blockers.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <div className="label-hw">Certification notes</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.blockers[0]}</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function PerformanceRead({ performance }: { performance: BoothReadyResult["performance"] }) {
  const analysis = performance.analysis;
  if (!performance.takeExists) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/24 p-3">
        <div className="label-hw">Recording read</div>
        <p className="mt-2 text-sm text-muted-foreground">Record a rough take to unlock delivery, level, silence, and clipping feedback.</p>
      </div>
    );
  }

  if (performance.analyzing) {
    return (
      <div className="rounded-xl border border-gold/20 bg-gold/8 p-3">
        <div className="label-hw text-gold/85">Recording read</div>
        <p className="mt-2 text-sm text-white/75">Analyzing the take for delivery control and recording health...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/24 p-3">
        <div className="label-hw">Recording read</div>
        <p className="mt-2 text-sm text-muted-foreground">This take can be reviewed, but detailed performance data is not available.</p>
      </div>
    );
  }

  const reads = [
    ["Voice", analysis.vocalPresence],
    ["Control", analysis.consistency],
    ["Silence", `${analysis.silencePct}%`],
    ["Clipping", `${analysis.clippingPct}%`],
  ] as const;

  return (
    <div className="rounded-xl border border-white/10 bg-black/24 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="label-hw">Recording read</div>
        <span className="text-sm font-semibold text-gold">{analysis.deliveryScore}/100</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {reads.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/8 bg-white/[0.03] px-1.5 py-2 text-center">
            <div className="text-xs font-semibold tabular-nums text-white/85">{value}</div>
            <div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs leading-relaxed text-muted-foreground">
        {analysis.findings.map((finding) => (
          <div key={finding} className="flex gap-2">
            <span className="text-gold">+</span>
            <span>{finding}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordReadinessJourney({ readiness }: { readiness: RecordReadiness }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/24 p-3">
      <div className="label-hw">Record journey</div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {readiness.stages.map((stage, index) => {
          const complete = index < readiness.currentIndex || readiness.certified;
          const active = index === readiness.currentIndex && !readiness.certified;
          return (
            <div key={stage.id} className="min-w-0 text-center">
              <div
                className={cn(
                  "mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold",
                  complete
                    ? "border-emerald-400/30 bg-emerald-500/14 text-emerald-300"
                    : active
                      ? "border-gold/45 bg-gold/14 text-gold"
                      : "border-white/10 bg-white/[0.03] text-white/28",
                )}
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <div className={cn("mt-2 text-[9px] font-semibold leading-tight", active ? "text-gold" : complete ? "text-white/72" : "text-white/30")}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoothReadyLane({ title, score, detail }: { title: string; score: number; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/24 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="label-hw">{title}</div>
        <div className="text-sm font-semibold text-gold">{score}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gold" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function MobileDrawer({ title, children, defaultOpen = false, open: controlledOpen, onOpenChange }: { title: string; children: ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111113]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="label-hw">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("border-t border-white/10 p-4", !open && "hidden")}>{children}</div>
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

function PrivateBeatImportSheet({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (input: PrivateBeatImportInput) => Promise<BeatLockerRow | null>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [producer, setProducer] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setFile(null);
    setTitle("");
    setProducer("");
    setBpm("");
    setMusicalKey("");
    setDurationSeconds(0);
    setRightsConfirmed(false);
    setSubmitting(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  const chooseFile = async (nextFile?: File) => {
    setError(null);
    if (!nextFile) return;
    const extension = nextFile.name.toLowerCase().split(".").pop();
    if (!extension || !["mp3", "wav"].includes(extension) || nextFile.size > 100 * 1024 * 1024) {
      setError("Choose an MP3 or WAV file under 100 MB.");
      return;
    }
    try {
      const duration = await readAudioFileDuration(nextFile);
      setFile(nextFile);
      setDurationSeconds(Math.max(1, Math.round(duration)));
      if (!title.trim()) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
    } catch {
      setError("RapWriter could not read this audio file.");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !title.trim() || !durationSeconds || !rightsConfirmed) {
      setError("Add a beat, title it, and confirm you have permission to use it.");
      return;
    }
    const parsedBpm = bpm.trim() ? Number(bpm) : null;
    if (parsedBpm !== null && (!Number.isInteger(parsedBpm) || parsedBpm < 40 || parsedBpm > 240)) {
      setError("BPM must be a whole number between 40 and 240.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const imported = await onImport({
        file,
        title: title.trim(),
        producer: producer.trim(),
        bpm: parsedBpm,
        musicalKey: musicalKey.trim() || null,
        durationSeconds,
      });
      if (imported) onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The beat could not be imported.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 px-3 pt-16 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.stopPropagation()}>
      <section className="w-full max-w-[430px] overflow-hidden rounded-t-3xl border border-white/12 bg-[#101011] shadow-[0_-24px_80px_rgba(0,0,0,0.72)]" role="dialog" aria-modal="true" aria-labelledby="private-beat-title">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 pb-4 pt-3">
          <div><div className="label-hw text-gold/80">Beat Locker</div><h2 id="private-beat-title" className="mt-1 text-xl font-semibold">Import your beat</h2><p className="mt-1 text-xs text-muted-foreground">Private to your account. Ready in Writer Flow.</p></div>
          <button type="button" onClick={onClose} disabled={submitting} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close beat import"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="max-h-[72dvh] space-y-4 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
          <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-gold/30 bg-gold/[0.04] px-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8"><Upload className="h-4 w-4 text-gold" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file?.name || "Choose MP3 or WAV"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{file ? `${formatFileSize(file.size)} / ${formatDuration(durationSeconds)}` : "Up to 100 MB"}</span></span>
            <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </label>

          <label className="block"><span className="label-hw text-white/48">Beat title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Untitled beat" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
          <label className="block"><span className="label-hw text-white/48">Producer credit</span><input value={producer} onChange={(event) => setProducer(event.target.value)} maxLength={120} placeholder="Optional" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label-hw text-white/48">BPM</span><input value={bpm} onChange={(event) => setBpm(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Optional" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
            <label className="block"><span className="label-hw text-white/48">Key</span><input value={musicalKey} onChange={(event) => setMusicalKey(event.target.value)} maxLength={32} placeholder="Optional" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#ffb11b]" />
            <span className="text-xs leading-relaxed text-white/72">I own this beat or have permission to use it.</span>
          </label>
          {error && <div className="rounded-xl border border-rec/25 bg-rec/8 px-3 py-2.5 text-xs text-rec" role="alert">{error}</div>}
          <div className="grid grid-cols-[0.72fr_1.28fr] gap-3">
            <button type="button" onClick={onClose} disabled={submitting} className="min-h-12 rounded-xl border border-white/10 text-sm font-semibold text-white/68">Cancel</button>
            <button type="submit" disabled={submitting} className="min-h-12 rounded-xl bg-gold text-sm font-semibold text-black disabled:opacity-55">{submitting ? "Importing..." : "Add to Beat Locker"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LockerFilterRow({ items, active, onChange }: { items: Array<{ id: string; label: string }>; active: string; onChange: (id: string) => void }) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onChange(item.id)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors", active === item.id ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-transparent text-muted-foreground")}>{item.label}</button>
      ))}
    </div>
  );
}

function LockerSummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 px-3 text-center first:pl-0 last:pr-0">
      <div className="text-xl font-semibold tabular-nums text-white">{value}</div>
      <div className="mt-1 truncate text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
    </div>
  );
}

function LockerDnaMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-white/8 p-4 odd:border-r [&:nth-last-child(-n+2)]:border-b-0">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 truncate text-xs font-semibold text-white/85">{value}</div>
    </div>
  );
}

function LockerLoading() {
  return (
    <div className="mt-4 space-y-3" role="status" aria-label="Loading Locker">
      {[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl border border-white/8 bg-white/[0.035]" />)}
    </div>
  );
}

function LockerSongCard({ song, takes, live, onResume, onPrepare, onRemove }: { song: SongLockerRow; takes: RoughTakeRow[]; live: boolean; onResume: () => void; onPrepare: () => void; onRemove: () => void }) {
  const progress = lockerSongProgress(song);
  const bars = lockerSnapshotNumber(song.snapshot, "totalBars", "total_bars");
  const [takesOpen, setTakesOpen] = useState(false);
  return (
    <article className="rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="label-hw text-gold/75">Song</span>{live && <span className="rounded-full bg-emerald-400/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Live</span>}</div>
          <h2 className="mt-2 truncate text-base font-semibold">{song.title}</h2>
          <div className="mt-1 text-[11px] text-muted-foreground">{bars !== null ? `${bars} bars / ` : ""}Saved {formatShortDate(song.updated_at || song.created_at)}</div>
        </div>
        <span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]", song.booth_ready ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300" : "border-gold/20 bg-gold/8 text-gold")}>{song.booth_ready ? "Booth Ready" : "Draft"}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="min-w-0 flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} /></div><div className="mt-1.5 text-[10px] text-muted-foreground">{progress}% written</div></div>
        <div className="flex shrink-0 items-center gap-2"><LockerRemoveButton label={`Remove ${song.title}`} onRemove={onRemove} /><button type="button" onClick={onPrepare} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/68 transition-colors hover:border-gold/25 hover:text-gold" aria-label={`Prepare ${song.title} for Booth`} title="Prepare for Booth"><FileText className="h-4 w-4" /></button><button type="button" onClick={onResume} className="flex min-h-10 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold"><Play className="h-3.5 w-3.5 fill-current" />Resume</button></div>
      </div>
      {takes.length > 0 && (
        <div className="mt-3 border-t border-white/8 pt-3">
          <button type="button" onClick={() => setTakesOpen((current) => !current)} className="flex min-h-9 w-full items-center justify-between gap-3 text-left" aria-expanded={takesOpen}>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/68"><Mic className="h-3.5 w-3.5 text-gold" />{takes.length} saved {takes.length === 1 ? "take" : "takes"}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", takesOpen && "rotate-180")} />
          </button>
          {takesOpen && (
            <div className="mt-2 space-y-2">
              {takes.slice(0, 3).map((take, index) => (
                <div key={take.id} className="rounded-xl border border-white/8 bg-black/24 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                    <span>{index === 0 ? "Latest" : formatShortDate(take.created_at)} / {take.section_name}</span>
                    <span className="tabular-nums">{formatDuration(take.duration_seconds)}</span>
                  </div>
                  <audio controls preload="none" src={take.signed_url} className="h-9 w-full" />
                </div>
              ))}
              {takes.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">Showing the 3 newest takes.</div>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function LockerHookCard({ hook, onUse, onRemove }: { hook: HookLockerRow; onUse: () => void; onRemove: () => void }) {
  const lineCount = hook.content.split(/\r?\n/).filter((line) => line.trim()).length;
  return (
    <article className="rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="label-hw text-gold/75">Saved Hook</div><h2 className="mt-2 truncate text-base font-semibold">{hook.title}</h2></div><span className="shrink-0 text-[10px] text-muted-foreground">{lineCount} {lineCount === 1 ? "line" : "lines"}</span></div>
      <blockquote className="mt-3 line-clamp-3 border-l border-gold/35 pl-3 text-sm leading-relaxed text-white/76">{hook.content}</blockquote>
      <div className="mt-4 flex items-center justify-between gap-3"><div className="min-w-0 truncate text-[10px] text-muted-foreground">{hook.tags.slice(0, 2).join(" / ") || hook.source_section || formatShortDate(hook.created_at)}</div><div className="flex shrink-0 items-center gap-2"><LockerRemoveButton label={`Remove ${hook.title}`} onRemove={onRemove} /><button type="button" onClick={onUse} className="flex min-h-10 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold"><FolderPlus className="h-3.5 w-3.5" />Insert</button></div></div>
    </article>
  );
}

function LockerBeatCard({ beat, onUse, onRemove }: { beat: BeatLockerRow; onUse: () => void; onRemove: () => void }) {
  const favorite = beat.license?.toLowerCase() === "favorite";
  return (
    <article className="rounded-2xl border border-white/10 bg-[#111113] p-3">
      <div className="flex gap-3">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/20" style={{ background: lockerBeatArt(beat) }}><Headphones className="h-5 w-5 text-gold" /><div className="absolute inset-x-2 bottom-2 h-0.5 rounded-full bg-gold/65" /></div>
        <div className="min-w-0 flex-1 py-1"><div className="flex items-center justify-between gap-2"><span className="label-hw text-gold/75">{favorite ? "Favorite" : beat.license || "Saved Beat"}</span>{beat.price !== null && beat.price > 0 && <span className="text-[10px] text-muted-foreground">${beat.price}</span>}</div><h2 className="mt-2 truncate text-base font-semibold">{beat.title}</h2><div className="mt-1 truncate text-[11px] text-muted-foreground">{beat.producer || "Independent producer"}</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3"><div className="min-w-0 truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{[beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key, beat.mood].filter(Boolean).join(" / ")}</div><div className="flex shrink-0 items-center gap-2"><LockerRemoveButton label={`Remove ${beat.title}`} onRemove={onRemove} /><button type="button" onClick={onUse} className="flex min-h-10 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold"><Play className="h-3.5 w-3.5 fill-current" />Load</button></div></div>
    </article>
  );
}

function StarterBeatCard({ beat, onUse }: { beat: StarterBeat; onUse: () => void }) {
  return (
    <article className="rounded-2xl border border-gold/20 bg-[#111113] p-3">
      <div className="flex gap-3">
        <div
          className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/25 bg-cover bg-center"
          style={{ background: starterBeatArt(beat) }}
        >
          <Headphones className="h-5 w-5 text-gold" />
          <div className="absolute inset-x-2 bottom-2 h-0.5 rounded-full bg-gold/70" />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="label-hw text-gold/80">{beat.collection ?? "RapWriter Originals"}</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">{beat.featured ? "Featured" : "Included"}</span>
          </div>
          <h2 className="mt-2 truncate text-base font-semibold">{beat.title}</h2>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{beat.producer}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
        <div className="min-w-0 truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {[beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : null, formatDuration(beat.duration)].filter(Boolean).join(" / ")}
        </div>
        <button type="button" onClick={onUse} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold">
          <Play className="h-3.5 w-3.5 fill-current" />Load
        </button>
      </div>
    </article>
  );
}

function LockerRemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => armed ? onRemove() : setArmed(true)}
      className={cn("flex min-h-10 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-semibold", armed ? "border-rec/35 bg-rec/10 text-rec" : "border-white/10 text-muted-foreground")}
      aria-label={armed ? `Confirm ${label.toLowerCase()}` : label}
      title={armed ? "Tap again to remove" : label}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {armed && "Remove"}
    </button>
  );
}

function LockerOwnedCard({ unlock }: { unlock: ProductUnlock }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8"><Check className="h-4 w-4 text-gold" /></div>
      <div className="min-w-0 flex-1"><div className="label-hw text-gold/70">{unlock.category}</div><div className="mt-1 truncate text-sm font-semibold">{unlock.title}</div><div className="mt-1 text-[10px] text-muted-foreground">Owned since {formatShortDate(unlock.unlockedAt)}</div></div>
      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Owned</span>
    </article>
  );
}

function LockerEmpty({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-[#111113] p-5">
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="gold-seal mt-4 min-h-11 w-full rounded-xl px-4 text-sm font-semibold">
          {actionLabel}
        </button>
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

function LockerReceiptRow({ order }: { order: CommerceOrderRow }) {
  const item = order.commerce_order_items[0];
  const statusLabel = order.status.replace(/_/g, " ");
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: order.currency.toUpperCase(),
  }).format(order.total_cents / 100);
  return (
    <article className="flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-black/24 px-3 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-gold"><FileText className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{item?.title ?? order.order_number}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/45">{order.order_number} / {formatShortDate(order.created_at)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold text-gold">{amount}</div>
        <div className="mt-1 text-[9px] capitalize text-white/45">{statusLabel}</div>
      </div>
      {item?.item_type === "beat_license" && order.status === "fulfilled" && (
        <a href={`/api/orders/${order.id}/license`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/20 text-gold" aria-label="Download beat license" title="Download license">
          <Download className="h-4 w-4" />
        </a>
      )}
    </article>
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

function ProfileSignal({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111113] p-4">
      <div className="label-hw text-gold/80">{title}</div>
      <div className="mt-2 truncate text-xl font-semibold">{value}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function MobileProfileRow({
  icon: Icon,
  title,
  value,
  href,
  onClick,
  disabled = false,
  muted = false,
}: {
  icon: typeof Home;
  title: string;
  value: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  const content = (
    <>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", muted ? "border-white/10 bg-white/[0.03] text-muted-foreground" : "border-gold/20 bg-gold/8 text-gold")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </>
  );

  if (href) {
    return (
      <a href={href} className={cn("flex w-full items-center gap-3 rounded-2xl border border-white/10 p-3 text-left", muted ? "bg-white/[0.025]" : "bg-[#111113]")}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("flex w-full items-center gap-3 rounded-2xl border border-white/10 p-3 text-left disabled:opacity-60", muted ? "bg-white/[0.025]" : "bg-[#111113]")}> 
      {content}
    </button>
  );
}

function MobileBottomNav({ activeNav, onChange }: { activeNav: MobileNavView; onChange: (view: MobileNavView) => void }) {
  return (
    <nav data-testid="app-dock" aria-label="RapWriter navigation" className="fixed bottom-0 left-1/2 z-40 grid h-[84px] w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-white/10 bg-black/90 px-2 pb-4 pt-2 backdrop-blur-xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => onChange(item.id)}
            className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", activeNav === item.id ? "text-gold" : "text-muted-foreground")}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileAuthDrawer({
  open,
  email,
  password,
  busy,
  notice,
  redirectUrl,
  recoveryMode,
  onEmail,
  onPassword,
  onSubmit,
  onCreateAccount,
  onMagicLink,
  onForgotPassword,
  onResendVerification,
  onClose,
}: {
  open: boolean;
  email: string;
  password: string;
  busy: boolean;
  notice: string | null;
  redirectUrl: string;
  recoveryMode: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCreateAccount: () => void;
  onMagicLink: () => void;
  onForgotPassword: () => void;
  onResendVerification: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-[430px] rounded-3xl border border-white/10 bg-[#111113] p-5 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label-hw text-gold/85">Studio Sync</div>
            <h2 className="mt-2 text-2xl font-semibold">{recoveryMode ? "Choose a new password." : "Sign in with email."}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close sign in">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {recoveryMode ? "Your recovery link is verified. Set the password you will use across devices." : "Sign in with a password to keep your studio synced across devices."}
        </p>
        {!recoveryMode && <div className="mt-3 rounded-xl border border-white/10 bg-black/24 p-3">
          <div className="label-hw text-gold/80">Allowed redirect URL</div>
          <div className="mt-1 break-all text-xs leading-relaxed text-muted-foreground">{redirectUrl}</div>
        </div>}
        {!recoveryMode && <label className="mt-5 block">
          <span className="label-hw">Email</span>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3">
            <Mail className="h-4 w-4 text-gold" />
            <input
              value={email}
              onChange={(event) => onEmail(event.target.value)}
              type="email"
              required
              placeholder="artist@example.com"
              className="min-h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
            />
          </div>
        </label>}
        <label className="mt-3 block">
          <span className="label-hw">Password</span>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <input
              value={password}
              onChange={(event) => onPassword(event.target.value)}
              type="password"
              required
              minLength={6}
              placeholder={recoveryMode ? "Minimum 8 characters" : "Password"}
              className="min-h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
            />
          </div>
        </label>
        {notice && <div className="mt-3 rounded-xl border border-gold/20 bg-gold/8 p-3 text-sm text-gold">{notice}</div>}
        <button
          type="submit"
          disabled={busy || (recoveryMode ? password.length < 8 : !email.includes("@") || password.length < 6)}
          className="gold-seal mt-5 min-h-12 w-full rounded-2xl px-4 text-sm font-semibold disabled:opacity-55"
        >
          {busy ? "Working..." : recoveryMode ? "Update Password" : "Sign In"}
        </button>
        {!recoveryMode && <button
          type="button"
          onClick={onCreateAccount}
          disabled={busy || !email.includes("@") || password.length < 6}
          className="mt-3 min-h-12 w-full rounded-2xl border border-gold/25 bg-gold/8 px-4 text-sm font-semibold text-gold disabled:opacity-55"
        >
          Create Account
        </button>}
        {!recoveryMode && <button
          type="button"
          onClick={onMagicLink}
          disabled={busy || !email.includes("@")}
          className="mt-3 min-h-10 w-full rounded-xl px-4 text-xs font-semibold text-muted-foreground disabled:opacity-55"
        >
          Send magic link instead
        </button>}
        {!recoveryMode && <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={onForgotPassword} disabled={busy || !email.includes("@")} className="min-h-10 rounded-xl px-2 text-xs font-semibold text-muted-foreground disabled:opacity-55">
            Forgot password?
          </button>
          <button type="button" onClick={onResendVerification} disabled={busy || !email.includes("@")} className="min-h-10 rounded-xl px-2 text-xs font-semibold text-muted-foreground disabled:opacity-55">
            Resend confirmation
          </button>
        </div>}
      </form>
    </div>
  );
}
