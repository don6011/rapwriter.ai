"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { PremiumMarketplace, type MarketCategory } from "@/components/PremiumMarketplace";
import { analyzeLyrics } from "@/lib/booth-ready-v2";
import {
  hasArtistWorkspace,
} from "@/lib/account-role";
import {
  useRapWriterData,
  isSessionConflictError,
  type ProjectRow,
  type SongRow,
  type SongLockerRow,
  type SessionRow,
} from "@/hooks/use-rapwriter-data";
import {
  MEMBERSHIP_ACCESS_EVENT,
  membershipAccessCopy,
  type MembershipAccessNotice,
} from "@/lib/client/membership-access";
import { consumePendingBeat, type Beat } from "@/lib/marketplace";
import { getTakeResumeBeatTime, resolveBeatPreviewUrl } from "@/lib/beat-playback";
import {
  defaultStudioRoomId,
  resolveStudioRoomAccess,
} from "@/lib/studio-room-access";
import { cn } from "@/lib/utils";
import { blankSections, countBars, countTotalBars } from "@/lib/studio/bars";
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
  scoreBoothReady,
} from "@/lib/studio/booth-ready";
import {
  normalizeStudioDna,
  readMobileDraftRecord,
  writeMobileDraftRecord,
} from "@/lib/studio/draft-storage";
import { buildBoothExportSnapshot } from "@/lib/studio/export-snapshot";
import { artistDisplayName } from "@/lib/studio/format";
import {
  buildBeatIntelligence,
  buildEnvironmentIntelligence,
} from "@/lib/studio/intelligence";
import {
  lockerSnapshotNumber,
  lockerSongBarCount,
  lockerSongProgress,
  sectionsFromLockerSnapshot,
} from "@/lib/studio/locker-snapshot";
import { trackMarketplaceEvent } from "@/lib/studio/telemetry";
import { getStudioPack, studioPacks } from "@/lib/studio/packs";
import { mobileSections } from "@/lib/studio/sections";
import { starterBeatsForArtist } from "@/lib/starter-beats";
import { lockerBeatCount, lockerCollectionCount } from "@/lib/studio/locker-counts";
import type {
  MobileDraftRecord,
  MobileNavView,
  PadActions,
  SelectedBeat,
  StudioDna,
  StudioPackId,
} from "@/lib/studio/types";
import { ImmersiveEnvironmentEffects } from "@/components/studio/panels/ImmersiveEnvironmentEffects";
import { StudioAccessHub } from "@/components/studio/panels/StudioAccessHub";
import { MobileBottomNav } from "@/components/studio/primitives/MobileBottomNav";
import { MobileHeader } from "@/components/studio/primitives/MobileHeader";
import { BeatSwitcherSheet } from "@/components/studio/sheets/BeatSwitcherSheet";
import { BoothExportSheet } from "@/components/studio/sheets/BoothExportSheet";
import { MobileAuthDrawer } from "@/components/studio/sheets/MobileAuthDrawer";
import { useAuthDrawer } from "@/components/studio/state/use-auth-drawer";
import { useBoothExport } from "@/components/studio/state/use-booth-export";
import { useVersionHistory } from "@/components/studio/state/use-version-history";
import { useBeatPlayback } from "@/components/studio/state/use-beat-playback";
import { useMarketplaceFeed } from "@/components/studio/state/use-marketplace-feed";
import { useRoughTake, type RecordingMode } from "@/components/studio/state/use-rough-take";
import { useSheetStack } from "@/components/studio/state/use-sheet-stack";
import { useStudioEnvironment } from "@/components/studio/state/use-studio-environment";
import { useProducerPass } from "@/components/studio/state/use-producer-pass";
import { useStudioCommerce } from "@/components/studio/state/use-studio-commerce";
import { useWritingPad } from "@/components/studio/state/use-writing-pad";
import { NewSongSheet } from "@/components/studio/sheets/NewSongSheet";
import { StudioDnaSheet } from "@/components/studio/sheets/StudioDnaSheet";
import { VersionHistorySheet } from "@/components/studio/sheets/VersionHistorySheet";
import { MobileFirstSessionActivation } from "@/components/studio/onboarding/MobileFirstSessionActivation";
import { MobileRoleOnboarding } from "@/components/studio/onboarding/MobileRoleOnboarding";
import { LockerScreen } from "@/components/studio/screens/LockerScreen";
import { ProfileScreen } from "@/components/studio/screens/ProfileScreen";
import { StudioScreen } from "@/components/studio/screens/StudioScreen";
import { WriterScreen } from "@/components/studio/screens/WriterScreen";

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
  // Declared ahead of the state hooks below: useStudioEnvironment takes setSyncMessage
  // as its notice channel, and a React setter keeps that callback stable.
  const [syncMessage, setSyncMessage] = useState("Saved on device");
  const { requestAuth, drawerProps: authDrawerProps } = useAuthDrawer(workspace);
  const [screen, setScreen] = useState<"home" | "writer">("home");
  const [activeNav, setActiveNav] = useState<MobileNavView>("studio");
  const [readinessLaunchToken, setReadinessLaunchToken] = useState(0);
  const [marketFocusCategory, setMarketFocusCategory] = useState<MarketCategory | null>(null);
  const {
    marketplaceFeed,
    marketplaceFeedLoading,
    marketplaceFeedError,
    starterBeats,
    starterBeatsLoading,
    starterBeatsError,
    mergedProductUnlocks,
    unlockedProductIds,
    saveSessionProductUnlock,
  } = useMarketplaceFeed(productEntitlements);
  const accessibleStarterBeats = useMemo(
    () => starterBeatsForArtist(starterBeats, membership?.artist?.plan.id),
    [membership?.artist?.plan.id, starterBeats],
  );
  const boothExport = useBoothExport(createBoothExport);
  const versionHistory = useVersionHistory();
  const { sheets, openSheet, closeSheet } = useSheetStack();
  const take = useRoughTake(roughTake);
  const {
    playing,
    beatCurrentTime,
    beatDuration,
    beatError,
    selectedBeat,
    setSelectedBeat,
    setBeatError,
    selectBeatKeepingPreview,
    seekTo,
    stopPreviewAndRewind,
    resetTransport,
    positionSeconds,
    stopBeatPreview,
    startBeatPreview,
    toggleBeatPlayback,
    seekBeatPlayback,
    previewMarketplaceBeat,
  } = useBeatPlayback({ onPause: () => queueUrgentSessionSync() });
  const {
    activeStudioPackId,
    activeStudioPack,
    studioDna,
    studioAirPlaying,
    setActiveStudioPackId,
    setStudioDna,
    stopStudioAir,
    toggleStudioAir,
    changeStudioAirVolume,
    persistPack,
    persistDna,
    hasSavedDna,
  } = useStudioEnvironment({ onNotice: setSyncMessage });
  const {
    activeSection,
    setActiveSection,
    sectionContent,
    setSectionContent,
    section,
    padActionStatus,
    setPadActionStatus,
    songSwitchStatus,
    setSongSwitchStatus,
    titleDraft,
    setTitleDraft,
    titleEditing,
    setTitleEditing,
    titleStatus,
    setTitleStatus,
  } = useWritingPad(activeSong?.title);
  const { unlockProduct, licenseBeat } = useStudioCommerce({
    user,
    unlockProductEntitlement,
    saveSessionProductUnlock,
    requestAuth,
    setPadActionStatus,
  });
  const {
    recording,
    recordingSeconds,
    error: recordError,
    url: roughTakeUrl,
    blob: roughTakeBlob,
    duration: roughTakeDuration,
    beat: roughTakeBeat,
    beatPosition: roughTakeBeatPosition,
    saved: roughTakeSaved,
    saving: roughTakeSaving,
    analyzing: roughTakeAnalyzing,
    analysis: roughTakeAnalysis,
  } = take.state;
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("with_beat");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongStartSection, setNewSongStartSection] = useState("Hook");
  const [newSongUseBeat, setNewSongUseBeat] = useState(true);
  const [newSongProjectId, setNewSongProjectId] = useState<string | null>(null);
  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [syncRetryNonce, setSyncRetryNonce] = useState(0);
  const pendingBeatHandledRef = useRef(false);
  const initialScreenOwnerRef = useRef<string | null>(null);
  const localDraftRef = useRef<MobileDraftRecord | null>(null);
  const skipNextDraftWriteRef = useRef(false);
  const retryUrgentRef = useRef(false);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const conflictBlockedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const activeSongIdRef = useRef<string | null>(null);
  const activeProjectId = session?.project_id ?? activeSong?.project_id ?? projects[0]?.id;
  const activeSongId = session?.song_id ?? activeSong?.id;
  activeProjectIdRef.current = activeProjectId ?? null;
  activeSongIdRef.current = activeSongId ?? null;

  useEffect(() => {
    const handleMembershipAccess = (event: Event) => {
      const notice = (event as CustomEvent<MembershipAccessNotice>).detail;
      if (!notice) return;
      closeSheet("beatSwitcher");
      setSyncMessage(membershipAccessCopy(notice));
      openSheet("studioAccess");
    };
    window.addEventListener(MEMBERSHIP_ACCESS_EVENT, handleMembershipAccess);
    return () => window.removeEventListener(MEMBERSHIP_ACCESS_EVENT, handleMembershipAccess);
  }, [closeSheet, openSheet]);

  useEffect(() => {
    const artist = membership?.artist;
    const producer = membership?.producer;
    if (!user || !artist || artist.plan.tier <= 0) return;
    const accessIdentity = `${artist.plan.id}:${producer?.plan.id ?? "none"}`;
    const storageKey = `rapwriter:membership-announced:${user.id}`;
    if (window.localStorage.getItem(storageKey) === accessIdentity) return;
    window.localStorage.setItem(storageKey, accessIdentity);
    openSheet("studioAccess");
  }, [membership?.artist, membership?.producer, openSheet, user]);

  const getStudioPackAccess = useCallback((id: StudioPackId) => {
    return resolveStudioRoomAccess(
      id,
      membership?.artist?.plan.id,
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
      playbackPositionSeconds: Math.max(0, positionSeconds()),
    };
  }, [activeStudioPack.id, positionSeconds, section.name, sectionContent, selectedBeat, studioDna]);

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
  }, [buildDraftRecord, setSelectedBeat, user]);

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

  function changeStudioPack(id: StudioPackId) {
    if (!canUseStudioPack(id)) {
      setSyncMessage(`${getStudioPack(id).label} is locked. Preview it in Studio Store first.`);
      setActiveNav("market");
      return;
    }
    stopStudioAir();
    setActiveStudioPackId(id);
    setStudioDna((current) => ({ ...current, environment: id }));
    persistPack(id);
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
        persistPack(patch.environment);
      }
      return next;
    });
  }

  function startStudioDnaSession() {
    const normalized = { ...studioDna, environment: getStudioPack(studioDna.environment).id };
    if (!canUseStudioPack(normalized.environment)) {
      setSyncMessage(`${getStudioPack(normalized.environment).label} is locked. Preview it in Studio Store first.`);
      setActiveNav("market");
      closeSheet("studioDna");
      return;
    }
    setStudioDna(normalized);
    setActiveStudioPackId(normalized.environment);
    persistPack(normalized.environment);
    persistDna(normalized);
    closeSheet("studioDna");
    setScreen("writer");
    setSyncMessage("Studio DNA loaded");
  }

  function continueWriterFlow(playBeat = false) {
    const hasSavedStudioDna = hasSavedDna();
    if (!hasSavedStudioDna) {
      openSheet("studioDna");
      return;
    }
    setScreen("writer");
    if (playBeat && !playing && selectedBeat.id !== EMPTY_BEAT.id && resolveBeatPreviewUrl(selectedBeat)) {
      toggleBeatPlayback();
    }
  }

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
    if (activeNav === "studio") return;
    stopStudioAir();
  }, [activeNav, stopStudioAir]);

  useEffect(() => {
    if (loading) return;
    const draft = readMobileDraftRecord(user?.id ?? null);
    localDraftRef.current = draft;
    skipNextDraftWriteRef.current = true;

    if (draft) {
      setSectionContent({ ...blankSections(), ...draft.sections });
      const sectionIndex = mobileSections.findIndex((item) => item.name === draft.activeSection);
      if (sectionIndex >= 0) setActiveSection(sectionIndex);
      selectBeatKeepingPreview(draft.beat);
      const pack = getStudioPack(draft.studioPackId).id;
      setActiveStudioPackId(pack);
      setStudioDna({ ...draft.studioDna, environment: pack });
      seekTo(draft.playbackPositionSeconds);
      setSaveStatus(draft.unsynced ? "error" : "saved");
      setSyncMessage(draft.unsynced ? "Recovered on device. Sync pending" : "Saved on device");
    }

    setDraftLoaded(true);
  }, [loading, seekTo, selectBeatKeepingPreview, setActiveSection, setActiveStudioPackId, setSectionContent, setStudioDna, user?.id]);

  useEffect(() => {
    if (loading || !draftLoaded) return;
    if (activeNav !== "studio") return;
    const ownerKey = user?.id ?? "device";
    if (initialScreenOwnerRef.current === ownerKey) return;
    if (countTotalBars(sectionContent) === 0) return;

    initialScreenOwnerRef.current = ownerKey;
    setScreen("writer");
  }, [activeNav, draftLoaded, loading, sectionContent, user?.id]);

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
      const playbackDirty = Math.abs(previous.playbackPositionSeconds - positionSeconds()) >= 1;
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
  }, [buildDraftRecord, positionSeconds]);

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
    if (!sheets.newSong) return;
    setNewSongTitle(`${beatIntel.titleSeed} ${songs.length + 1}`);
    setNewSongStartSection("Hook");
    setNewSongUseBeat(true);
  }, [beatIntel.titleSeed, sheets.newSong, songs.length]);

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
      selectBeatKeepingPreview(localDraft.beat);
      const localPack = canUseStudioPack(localDraft.studioPackId) ? localDraft.studioPackId : defaultStudioRoomId;
      const localDna = normalizeStudioDna(localDraft.studioDna, localPack);
      setActiveStudioPackId(localPack);
      setStudioDna({ ...localDna, environment: localPack });
      seekTo(localDraft.playbackPositionSeconds);
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
      selectBeatKeepingPreview(nextBeat);
      setActiveStudioPackId(remotePack);
      setStudioDna({ ...remoteDna, environment: remotePack });
      seekTo(playbackPosition);
      persistPack(remotePack);
      persistDna({ ...remoteDna, environment: remotePack });

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
  }, [activeSong, canUseStudioPack, draftLoaded, hydratedSessionId, persistDna, persistPack, seekTo, selectBeatKeepingPreview, session, setActiveSection, setActiveStudioPackId, setSectionContent, setStudioDna, user?.id]);

  useEffect(() => {
    if (loadingData || pendingBeatHandledRef.current) return;
    pendingBeatHandledRef.current = true;
    const pendingBeat = consumePendingBeat();
    if (!pendingBeat) return;

    setSelectedBeat(toBeatSnapshot(pendingBeat));
    setActiveNav("studio");
    setScreen("writer");
    resetTransport();
    setSyncMessage(`${pendingBeat.title} loaded from Studio Store`);
  }, [loadingData, resetTransport, setSelectedBeat]);

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
          playbackPositionSeconds: positionSeconds(),
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
    positionSeconds,
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
      if (currentDraft && Math.abs(currentDraft.playbackPositionSeconds - positionSeconds()) < 5) return;
      queueUrgentSessionSync();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [playing, positionSeconds, queueUrgentSessionSync]);

  const producerPass = useProducerPass({
    signedIn: Boolean(user),
    requestAuth,
    sectionName: section.name,
    sectionContent,
    setSectionContent,
    selectedBeat,
    studioDna,
    onNotice: setSyncMessage,
    onSaved: () => setSaveStatus("saved"),
    onEdit: () => {
      conflictBlockedRef.current = false;
    },
    prepareSession: async () => {
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
      if (!projectId || !songId) return null;
      return { projectId, songId, sessionId: session?.id };
    },
    saveBeforePass: ({ projectId, songId, sessionId }) =>
      saveNow({
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
      }),
  });

  const openVersionHistory = async () => {
    if (!user) {
      requestAuth("Sign in to view and restore writing history.");
      return;
    }
    if (membership?.artist?.entitlements.version_history !== true) {
      setScreen("home");
      setActiveNav("profile");
      setSyncMessage("RapWriter Pro unlocks revision history");
      return;
    }

    openSheet("versionHistory");
    await versionHistory.load(activeSongId, section.name);
  };

  const restoreSectionVersion = async (versionId: string) => {
    const result = await versionHistory.restore(versionId);
    if (!result.ok) return;
    if (result.sections) setSectionContent({ ...blankSections(), ...result.sections });
    producerPass.discardProposal();
    setSaveStatus("saved");
    setSyncMessage(`${section.name} restored from history`);
    versionHistory.markRestored();
    closeSheet("versionHistory");
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
          playbackPositionSeconds: positionSeconds(),
          studioDna: { ...studioDna, environment: activeStudioPack.id },
        });
      }

      stopBeatPreview({ reset: true });
      stopStudioAir();
      setSectionContent(nextSections);
      setActiveSection(nextSectionIndex >= 0 ? nextSectionIndex : 0);
      take.resetForSongSwitch();
      selectBeatKeepingPreview(nextBeat);
      setActiveStudioPackId(nextPack);
      setStudioDna({ ...nextDna, environment: nextPack });
      seekTo(nextPlaybackPosition);

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
    projectId,
  }: {
    title: string;
    startSection: string;
    useCurrentBeat: boolean;
    projectId?: string | null;
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
          playbackPositionSeconds: positionSeconds(),
          studioDna: { ...studioDna, environment: activeStudioPack.id },
        });
      }
      let project: ProjectRow | undefined = projects.find((item) => item.id === projectId) ?? projects.find((item) => item.id === activeProjectId) ?? projects[0];
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
      take.resetForNewSong();
      stopBeatPreview({ reset: true });
      stopStudioAir();
      selectBeatKeepingPreview(songBeat ?? EMPTY_BEAT);
      seekTo(0);
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
      setNewSongProjectId(null);
      closeSheet("newSong");
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

  const startRecording = async (
    resume?: { beat: SelectedBeat | null; beatPosition: number; recordingMode: RecordingMode; sectionName?: string },
    requestedMode?: RecordingMode,
  ) => {
    stopStudioAir();
    const nextRecordingMode = resume?.recordingMode ?? requestedMode ?? recordingMode;
    const recordingBeat = nextRecordingMode === "with_beat" ? (resume?.beat ?? selectedBeat) : null;
    if (nextRecordingMode === "vocals_only") {
      stopBeatPreview({ reset: false });
    } else if (resume && recordingBeat) {
      stopBeatPreview({ reset: false });
      if (recordingBeat.id !== selectedBeat.id) selectBeatKeepingPreview(recordingBeat);
      seekTo(resume.beatPosition);
    }
    await take.startRecording({
      recordingMode: nextRecordingMode,
      sectionName: resume?.sectionName ?? section.name,
      captureBeat: () => ({
        beat: recordingBeat ? { ...recordingBeat } : null,
        beatPosition: recordingBeat ? (resume?.beatPosition ?? Math.max(0, positionSeconds())) : 0,
      }),
      beforeStart: async (beatAtStart) => {
        if (!beatAtStart) return;
        if (playing && !resume) return;
        try {
          await startBeatPreview(beatAtStart);
        } catch {
          setBeatError("The beat could not start, but recording is still available.");
        }
      },
    });
  };

  const continueRoughTake = (takeOffsetSeconds: number) => {
    if (take.state.recordingMode === "vocals_only") {
      setRecordingMode("vocals_only");
      void startRecording({ beat: null, beatPosition: 0, recordingMode: "vocals_only", sectionName: take.state.sectionName });
      return;
    }
    const recordingBeat = roughTakeBeat ?? selectedBeat;
    const beatPosition = getTakeResumeBeatTime(
      roughTakeBeatPosition,
      takeOffsetSeconds,
      getBeatDurationSeconds(recordingBeat),
    );
    setRecordingMode("with_beat");
    void startRecording({ beat: recordingBeat, beatPosition, recordingMode: "with_beat", sectionName: take.state.sectionName });
  };

  const toggleRecording = (nextMode?: RecordingMode) => {
    if (recording) {
      take.stopRecording();
      return;
    }
    void startRecording(undefined, nextMode);
  };

  const deleteRoughTake = () => {
    take.deleteTake();
  };

  const saveRoughTake = async () => {
    if (!user) {
      requestAuth("Sign in to save rough takes.");
      return;
    }
    if (!roughTakeBlob) {
      take.blockSave(roughTakeSaved ? "This take is already saved." : "Record a take before saving.");
      return;
    }
    if (roughTakeAnalyzing) {
      take.blockSave("Let the delivery read finish before keeping this take.");
      return;
    }

    take.saveStarted();
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
        sectionName: take.state.sectionName,
        durationSeconds: roughTakeDuration,
        analysis: roughTakeAnalysis,
        beat: take.state.recordingMode === "vocals_only" ? null : (roughTakeBeat ?? take.recordBeatRef.current ?? selectedBeat),
        beatPositionSeconds: take.state.recordingMode === "vocals_only" ? 0 : (roughTakeBeatPosition || take.recordBeatPositionRef.current),
      });
      take.saveSucceeded();
    } catch (err) {
      take.saveFailed(err instanceof Error ? err.message : "Could not save rough take.");
    } finally {
      take.saveSettled();
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
    if (membership?.artist?.entitlements.premium_exports !== true) {
      setScreen("home");
      setActiveNav("profile");
      setSyncMessage("Export Song is included with RapWriter Pro");
      return;
    }

    boothExport.beginPrepare();
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

      boothExport.stageDraft({
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
      openSheet("boothExport");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Could not prepare Booth Ready export");
    }
  };

  const openLockerBoothExport = (lockerSong: SongLockerRow) => {
    if (!user) {
      requestAuth("Sign in to export songs from your Locker.");
      return;
    }
    if (membership?.artist?.entitlements.premium_exports !== true) {
      setScreen("home");
      setActiveNav("profile");
      setSyncMessage("Export Song is included with RapWriter Pro");
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

    boothExport.beginPrepare();
    boothExport.stageDraft({
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
    openSheet("boothExport");
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
          onOpenAccess={() => openSheet("studioAccess")}
          onAuthRequired={() => requestAuth("Sign in to open your studio activity.")}
        />
        <StudioAccessHub
          open={sheets.studioAccess}
          membership={membership}
          onClose={() => closeSheet("studioAccess")}
          onStartWriting={() => {
            closeSheet("studioAccess");
            setActiveNav("studio");
            setScreen("writer");
          }}
          onOpenReadiness={() => {
            closeSheet("studioAccess");
            setActiveNav("studio");
            setScreen("writer");
            setReadinessLaunchToken((current) => current + 1);
          }}
          onChooseRoom={() => {
            closeSheet("studioAccess");
            setActiveNav("studio");
            setScreen("home");
            openSheet("studioDna");
          }}
          onBrowseProducers={() => {
            closeSheet("studioAccess");
            setMarketFocusCategory("producer");
            setActiveNav("market");
            setScreen("home");
          }}
          onManage={() => {
            closeSheet("studioAccess");
            setActiveNav("profile");
            setScreen("home");
            window.requestAnimationFrame(() => document.getElementById("profile-membership")?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
        />
        {screen === "home" ? (
          <>
            {activeNav === "studio" && (
              <StudioScreen
                completionPct={completionPct}
                saveStatus={saveStatus}
                boothReady={boothReady}
                sectionContent={sectionContent}
                activeSection={activeSection}
                roughTakeUrl={roughTakeUrl}
                roughTakeDuration={roughTakeDuration}
                roughTakeBeat={roughTakeBeat}
                roughTakeBeatPosition={roughTakeBeatPosition}
                recording={recording}
                recordingMode={recordingMode}
                recordingSeconds={recordingSeconds}
                recordError={recordError}
                onDeleteRoughTake={deleteRoughTake}
                roughTakeSaved={roughTakeSaved}
                roughTakeSaving={roughTakeSaving}
                onSaveRoughTake={saveRoughTake}
                onContinueRoughTake={continueRoughTake}
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
                onRecordingModeChange={setRecordingMode}
                onSetActiveSection={setActiveSection}
                onToggleBeat={toggleBeatPlayback}
                onSeekBeat={seekBeatPlayback}
                onCommitBeatSeek={queueUrgentSessionSync}
                onChangeBeat={() => openSheet("beatSwitcher")}
                onContinue={() => continueWriterFlow(true)}
                songs={songs}
                projects={projects}
                signedIn={Boolean(user)}
                onSyncRequest={() => requestAuth("Sign in to protect this draft across devices.")}
                onLoadSong={(song) => void loadMobileSong(song)}
                onNewSong={(projectId) => {
                  if (!user) {
                    requestAuth("Sign in to create and switch between songs.");
                    return;
                  }
                  setNewSongProjectId(projectId ?? activeProjectId ?? null);
                  openSheet("newSong");
                }}
                studioPack={activeStudioPack}
                studioPacks={studioPacks}
                studioDna={studioDna}
                studioAirPlaying={studioAirPlaying}
                getStudioPackAccess={getStudioPackAccess}
                onOpenMembership={() => {
                  setActiveNav("profile");
                  window.requestAnimationFrame(() => document.getElementById("profile-membership")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                onStudioPack={changeStudioPack}
                onPreviewStudioPack={previewStudioPack}
                onStudioDna={() => openSheet("studioDna")}
                onToggleStudioAir={toggleStudioAir}
                onStudioAirVolume={changeStudioAirVolume}
              />
            )}
            {activeNav === "locker" && (
              <LockerScreen
                beats={beatLocker}
                starterBeats={accessibleStarterBeats}
                songs={songLocker}
                hooks={hookLocker}
                roughTakes={roughTakes}
                activeSongId={activeSongId ?? null}
                activeSectionContent={sectionContent}
                activeCompletionPct={completionPct}
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
                  stopPreviewAndRewind();
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
                  stopPreviewAndRewind();
                  selectBeatForSession(snapshot);
                  setActiveNav("studio");
                  setScreen("writer");
                  setSyncMessage(`${beat.title} loaded from RapWriter Beats`);
                }}
                activeStudioPack={activeStudioPack}
                studioPacks={studioPacks}
                onStudioPack={changeStudioPack}
                artistPlanId={membership?.artist?.plan.id}
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
              <ProfileScreen
                completionPct={completionPct}
                boothReady={boothReady}
                activeStudioPack={activeStudioPack}
                membership={membership}
                profile={profile}
                lockerCounts={{
                  ...lockerCounts,
                  beats: lockerBeatCount(beatLocker.map((beat) => beat.beat_id), accessibleStarterBeats.map((beat) => beat.id)),
                  collection: lockerCollectionCount({
                    beats: lockerBeatCount(beatLocker.map((beat) => beat.beat_id), accessibleStarterBeats.map((beat) => beat.id)),
                    songs: lockerCounts.songs,
                    hooks: lockerCounts.hooks,
                    roughTakes: roughTakes.length,
                    ownedItems: mergedProductUnlocks.filter((unlock) => unlock.category !== "Producer Style").length,
                  }),
                }}
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
          <WriterScreen
            songTitle={titleDraft.trim() || activeSong?.title || "Untitled Song"}
            readinessLaunchToken={readinessLaunchToken}
            activeSection={activeSection}
            sectionContent={sectionContent}
            saveStatus={saveStatus}
            signedIn={Boolean(user)}
            boothReady={boothReady}
            padActions={padActions}
            playing={playing}
            recording={recording}
            recordingMode={recordingMode}
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
            onChange={producerPass.changeActiveSectionContent}
            onToggleBeat={toggleBeatPlayback}
            onSeekBeat={seekBeatPlayback}
            onCommitBeatSeek={queueUrgentSessionSync}
            onChangeBeat={() => openSheet("beatSwitcher")}
            onToggleRecording={toggleRecording}
            onRecordingModeChange={setRecordingMode}
            onDeleteRoughTake={deleteRoughTake}
            onSaveRoughTake={saveRoughTake}
            onContinueRoughTake={continueRoughTake}
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
              proposal: producerPass.proposal,
              status: producerPass.status,
              error: producerPass.error,
              onGenerate: (actionType, attempt) => void producerPass.generate(actionType, attempt),
              onAccept: () => void producerPass.resolve("accept"),
              onReject: () => void producerPass.resolve("reject"),
              onRetry: () => void producerPass.retry(),
              onUndo: () => void producerPass.resolve("revert"),
            }}
          />
        )}
        <BeatSwitcherSheet
          open={sheets.beatSwitcher}
          signedIn={Boolean(user)}
          currentBeat={selectedBeat}
          starterBeats={accessibleStarterBeats}
          lockerBeats={beatLocker}
          marketplaceBeats={marketplaceFeed.beats}
          marketplaceLoading={marketplaceFeedLoading}
          marketplaceError={marketplaceFeedError}
          onClose={() => closeSheet("beatSwitcher")}
          onPreviewStart={() => stopBeatPreview()}
          onImportBeat={importPrivateBeat}
          onAuthRequired={() => {
            closeSheet("beatSwitcher");
            requestAuth("Sign in to import a private beat into your Locker.");
          }}
          onUseBeat={(beat) => {
            const snapshot = beatSnapshotFromLockerBeat(beat);
            stopPreviewAndRewind();
            selectBeatForSession(snapshot);
            closeSheet("beatSwitcher");
            setSyncMessage(`${beat.title} loaded. Saving session...`);
          }}
          onUseStarterBeat={(beat) => {
            const snapshot = beatSnapshotFromStarterBeat(beat);
            stopPreviewAndRewind();
            selectBeatForSession(snapshot);
            closeSheet("beatSwitcher");
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
          open={sheets.studioDna}
          dna={studioDna}
          studioPacks={studioPacks}
          canUseStudioPack={canUseStudioPack}
          onChange={updateStudioDna}
          onClose={() => closeSheet("studioDna")}
          onStart={startStudioDnaSession}
        />
        <NewSongSheet
          open={sheets.newSong}
          title={newSongTitle}
          startSection={newSongStartSection}
          useCurrentBeat={newSongUseBeat}
          beat={selectedBeat}
          projectTitle={projects.find((project) => project.id === newSongProjectId)?.title ?? null}
          status={songSwitchStatus}
          onTitle={setNewSongTitle}
          onStartSection={setNewSongStartSection}
          onUseCurrentBeat={setNewSongUseBeat}
          onClose={() => closeSheet("newSong")}
          onCreate={() =>
            void createMobileSong({
              title: newSongTitle,
              startSection: newSongStartSection,
              useCurrentBeat: newSongUseBeat,
              projectId: newSongProjectId,
            })
          }
        />
        <VersionHistorySheet
          open={sheets.versionHistory}
          sectionName={section.name}
          currentContent={sectionContent[section.name] ?? ""}
          versions={versionHistory.versions}
          status={versionHistory.status}
          error={versionHistory.error}
          onClose={() => closeSheet("versionHistory")}
          onRestore={(versionId) => void restoreSectionVersion(versionId)}
        />
        <BoothExportSheet
          open={sheets.boothExport}
          draft={boothExport.draft}
          exportRecord={boothExport.record}
          status={boothExport.status}
          error={boothExport.error}
          premiumExports={membership?.artist?.entitlements.premium_exports === true}
          onClose={() => closeSheet("boothExport")}
          onFreeze={() => void boothExport.freeze()}
          onUpgrade={() => {
            closeSheet("boothExport");
            setScreen("home");
            setActiveNav("profile");
            setSyncMessage("Export Song is included with RapWriter Pro");
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
