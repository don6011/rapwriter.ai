"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { AccountType, OnboardingAccountType } from "@/lib/account-role";
import type { RoughTakeAnalysis } from "@/lib/booth-ready-v2";
import type { License } from "@/lib/marketplace";
import type { MembershipSnapshot } from "@/lib/membership";
import type { BoothExportRecord, BoothExportSnapshot } from "@/lib/booth-export";
import { notifyMembershipAccess } from "@/lib/client/membership-access";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type BeatSnapshot = {
  id: string;
  title: string;
  producer?: string;
  bpm?: number;
  key?: string;
  mood?: string;
  [key: string]: unknown;
};

export type ProjectRow = {
  id: string;
  title: string;
  project_type: string;
  status: string;
  artwork: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type SongRow = {
  id: string;
  project_id: string;
  title: string;
  track_number: number;
  song_state: number;
  sections: Record<string, string>;
  active_section: string;
  beat_id: string | null;
  beat_snapshot: Record<string, unknown>;
  completion_pct: number;
  booth_score: number;
  total_bars: number;
  last_saved_at: string | null;
  projects?: {
    title?: string | null;
    project_type?: string | null;
  } | null;
};

export type SessionRow = {
  id: string;
  project_id: string;
  song_id: string;
  mode: string;
  ambiance: string;
  section_content: Record<string, string>;
  active_section: string;
  song_state: number;
  completion_pct: number;
  booth_score: number;
  total_bars: number;
  beat_id: string | null;
  beat_snapshot: Record<string, unknown>;
  last_active_at: string;
  revision: number;
  playback_position_seconds: number;
  studio_dna: Record<string, unknown>;
  client_updated_at: string | null;
};

type LockerCounts = {
  beats: number;
  songs: number;
  hooks: number;
};

export type BeatLockerRow = {
  id: string;
  beat_id: string;
  title: string;
  producer: string | null;
  bpm: number | null;
  musical_key: string | null;
  mood: string | null;
  license: string | null;
  price: number | null;
  beat_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PrivateBeatImportInput = {
  file: File;
  title: string;
  producer: string;
  bpm: number | null;
  musicalKey: string | null;
  durationSeconds: number;
};

export type SongLockerRow = {
  id: string;
  project_id: string | null;
  song_id: string | null;
  title: string;
  status: string;
  booth_ready: boolean;
  snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BoothExportCreateInput = {
  projectId: string;
  songId: string;
  sessionId?: string | null;
  roughTakeId?: string | null;
  title: string;
  snapshot: BoothExportSnapshot;
};

export type HookLockerRow = {
  id: string;
  project_id: string | null;
  song_id: string | null;
  title: string;
  content: string;
  source_section: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type RoughTakeRow = {
  id: string;
  project_id: string | null;
  song_id: string | null;
  session_id: string | null;
  section_name: string;
  duration_seconds: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  signed_url: string;
  beat_id: string | null;
  beat_snapshot: BeatSnapshot;
  beat_position_seconds: number;
  analysis: RoughTakeAnalysis | Record<string, never>;
  analysis_version: string;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductEntitlementRow = {
  id: string;
  owner_id: string;
  product_id: string;
  product_type: "studio_room" | "ai_style" | "vocal_chain" | "writing_pack" | "ambient_pack" | "theme" | "bundle" | "producer_profile" | "beat_license";
  title: string;
  price_cents: number;
  currency: string;
  source: "dev_unlock" | "stripe" | "admin_grant";
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  artist_name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | "studio";
  account_type: AccountType;
  role_onboarding_completed: boolean;
  onboarding_completed: boolean;
  first_session_completed: boolean;
  artist_goal: "finish_song" | "write_hook" | "write_verse" | "freestyle" | null;
  created_at: string;
  updated_at: string;
};

type SavePayload = {
  projectId: string;
  songId: string;
  sessionId?: string;
  beat?: BeatSnapshot | null;
  mode: string;
  ambiance: string;
  sectionContent: Record<string, string>;
  activeSection: string;
  songState: number;
  completionPct: number;
  boothScore: number;
  totalBars: number;
  expectedRevision?: number;
  playbackPositionSeconds?: number;
  studioDna?: Record<string, unknown>;
  clientUpdatedAt?: string;
};

type CreateSongPayload = {
  projectId: string;
  title: string;
  trackNumber?: number;
  sections: Record<string, string>;
  activeSection?: string;
  beat?: BeatSnapshot | null;
};

type UpdateSongPayload = {
  id: string;
  title?: string;
  songState?: number;
  completionPct?: number;
  boothScore?: number;
  totalBars?: number;
  activeSection?: string;
  sections?: Record<string, string>;
  beat?: BeatSnapshot | null;
};

function persistedBeat(beat?: BeatSnapshot | null) {
  return beat && beat.id !== "no-beat" ? beat : null;
}

export class RapWriterApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly payload?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RapWriterApiError";
  }
}

export function isSessionConflictError(error: unknown): error is RapWriterApiError {
  return error instanceof RapWriterApiError && error.code === "SESSION_CONFLICT";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: isFormData
      ? init?.headers
      : {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    notifyMembershipAccess(json, res.status);
    throw new RapWriterApiError(
      typeof json.error === "string" ? json.error : "Request failed",
      res.status,
      typeof json.code === "string" ? json.code : undefined,
      json as Record<string, unknown>,
    );
  }
  return json as T;
}

export function useRapWriterData() {
  const auth = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [beatLocker, setBeatLocker] = useState<BeatLockerRow[]>([]);
  const [songLocker, setSongLocker] = useState<SongLockerRow[]>([]);
  const [hookLocker, setHookLocker] = useState<HookLockerRow[]>([]);
  const [roughTake, setRoughTake] = useState<RoughTakeRow | null>(null);
  const [productEntitlements, setProductEntitlements] = useState<ProductEntitlementRow[]>([]);
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const [lockerCounts, setLockerCounts] = useState<LockerCounts>({ beats: 0, songs: 0, hooks: 0 });
  const [loadingData, setLoadingData] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<SessionRow | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refresh = useCallback(async () => {
    if (!auth.sessionReady || !auth.user) return;
    setLoadingData(true);
    setError(null);
    try {
      const [projectRes, songRes, sessionRes, beatRes, songLockerRes, hookRes, entitlementRes, membershipRes] = await Promise.all([
        api<{ projects: ProjectRow[] }>("/api/projects"),
        api<{ songs: SongRow[] }>("/api/songs"),
        api<{ session: SessionRow | null }>("/api/sessions"),
        api<{ beats: BeatLockerRow[] }>("/api/locker/beats"),
        api<{ songs: SongLockerRow[] }>("/api/locker/songs"),
        api<{ hooks: HookLockerRow[] }>("/api/locker/hooks"),
        api<{ entitlements: ProductEntitlementRow[] }>("/api/entitlements"),
        api<{ membership: MembershipSnapshot }>("/api/membership"),
      ]);
      const profileRes = await api<{ profile: ProfileRow }>("/api/profile");
      setProjects(projectRes.projects);
      setSongs(songRes.songs);
      setSession(sessionRes.session);
      sessionRef.current = sessionRes.session;
      setProfile(profileRes.profile);
      setBeatLocker(beatRes.beats);
      setSongLocker(songLockerRes.songs);
      setHookLocker(hookRes.hooks);
      setProductEntitlements(entitlementRes.entitlements);
      setMembership(membershipRes.membership);
      setLockerCounts({
        beats: beatRes.beats.length,
        songs: songLockerRes.songs.length,
        hooks: hookRes.hooks.length,
      });
      setLastSaved(sessionRes.session?.last_active_at ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load RapWriter data.");
    } finally {
      setLoadingData(false);
    }
  }, [auth.sessionReady, auth.user]);

  const loadLatestRoughTake = useCallback(
    async (scope?: { sessionId?: string | null; songId?: string | null }) => {
      if (!auth.user) return null;
      const params = new URLSearchParams();
      if (scope?.sessionId) params.set("session_id", scope.sessionId);
      else if (scope?.songId) params.set("song_id", scope.songId);
      const res = await api<{ roughTake: RoughTakeRow | null }>(`/api/rough-takes${params.size ? `?${params}` : ""}`);
      setRoughTake(res.roughTake);
      return res.roughTake;
    },
    [auth.user],
  );

  useEffect(() => {
    if (auth.loading) return;
    if (auth.sessionReady && auth.user) {
      void refresh();
      return;
    }

    setProjects([]);
    setSongs([]);
    setSession(null);
    setProfile(null);
    setBeatLocker([]);
    setSongLocker([]);
    setHookLocker([]);
    setRoughTake(null);
    setProductEntitlements([]);
    setMembership(null);
    setLockerCounts({ beats: 0, songs: 0, hooks: 0 });
    setLastSaved(null);
    setLoadingData(false);
  }, [auth.loading, auth.sessionReady, auth.user, refresh]);

  const ensureWorkspace = useCallback(
    async (seed: {
      title: string;
      songTitle?: string;
      project_type: string;
      sections: Record<string, string>;
      beat?: BeatSnapshot | null;
    }) => {
      if (!auth.user) return null;
      const beat = persistedBeat(seed.beat);
      const project = await api<{ project: ProjectRow }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: seed.title,
          project_type: seed.project_type,
          artwork: {},
          metadata: { source: "studio" },
        }),
      });
      const song = await api<{ song: SongRow }>("/api/songs", {
        method: "POST",
        body: JSON.stringify({
          project_id: project.project.id,
          title: seed.songTitle ?? "Untitled Song",
          track_number: 1,
          sections: seed.sections,
          beat_id: beat?.id ?? null,
          beat_snapshot: beat ?? {},
        }),
      });
      await refresh();
      return { project: project.project, song: song.song };
    },
    [auth.user, refresh],
  );

  const saveNow = useCallback(async (payload: SavePayload) => {
    if (!auth.user) return null;
    const beat = persistedBeat(payload.beat);
    const currentSession = sessionRef.current;
    const sessionId = payload.sessionId ?? currentSession?.id;
    const expectedRevision = payload.expectedRevision ?? (
      currentSession && (!sessionId || currentSession.id === sessionId)
        ? currentSession.revision
        : undefined
    );
    let saved: { session: SessionRow };

    try {
      saved = await api<{ session: SessionRow }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          id: sessionId,
          project_id: payload.projectId,
          song_id: payload.songId,
          beat_id: beat?.id ?? null,
          beat_snapshot: beat ?? {},
          mode: payload.mode,
          ambiance: payload.ambiance,
          section_content: payload.sectionContent,
          active_section: payload.activeSection,
          song_state: payload.songState,
          completion_pct: payload.completionPct,
          booth_score: payload.boothScore,
          total_bars: payload.totalBars,
          is_active: true,
          expected_revision: expectedRevision,
          playback_position_seconds: payload.playbackPositionSeconds ?? currentSession?.playback_position_seconds ?? 0,
          studio_dna: payload.studioDna ?? currentSession?.studio_dna ?? {},
          client_updated_at: payload.clientUpdatedAt ?? new Date().toISOString(),
        }),
      });
    } catch (error) {
      if (isSessionConflictError(error)) {
        const current = error.payload?.session as SessionRow | undefined;
        if (current?.id) sessionRef.current = current;
      }
      throw error;
    }

    sessionRef.current = saved.session;
    setSession(saved.session);
    setLastSaved(saved.session.last_active_at);
    return saved.session;
  }, [auth.user]);

  const createSong = useCallback(
    async (payload: CreateSongPayload) => {
      if (!auth.user) return null;
      const beat = persistedBeat(payload.beat);
      const created = await api<{ song: SongRow }>("/api/songs", {
        method: "POST",
        body: JSON.stringify({
          project_id: payload.projectId,
          title: payload.title,
          track_number: payload.trackNumber ?? songs.length + 1,
          sections: payload.sections,
          active_section: payload.activeSection ?? "Hook",
          beat_id: beat?.id ?? null,
          beat_snapshot: beat ?? {},
        }),
      });
      await refresh();
      return created.song;
    },
    [auth.user, refresh, songs.length],
  );

  const updateSong = useCallback(
    async (payload: UpdateSongPayload) => {
      if (!auth.user) return null;
      const beat = payload.beat === undefined ? undefined : persistedBeat(payload.beat);
      const updated = await api<{ song: SongRow }>("/api/songs", {
        method: "PATCH",
        body: JSON.stringify({
          id: payload.id,
          title: payload.title,
          song_state: payload.songState,
          completion_pct: payload.completionPct,
          booth_score: payload.boothScore,
          total_bars: payload.totalBars,
          active_section: payload.activeSection,
          sections: payload.sections,
          beat_id: beat === undefined ? undefined : beat?.id ?? null,
          beat_snapshot: beat === undefined ? undefined : beat ?? {},
        }),
      });
      setSongs((current) => current.map((song) => (song.id === updated.song.id ? { ...song, ...updated.song } : song)));
      return updated.song;
    },
    [auth.user],
  );

  const queueAutosave = useCallback(
    (payload: SavePayload) => {
      if (!auth.user) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveNow(payload).catch((err) => setError(err instanceof Error ? err.message : "Autosave failed."));
      }, 5000);
    },
    [auth.user, saveNow],
  );

  const addBeatLicense = useCallback(
    async (beat: BeatSnapshot, license: License | "Favorite", price: number, checkoutSessionId?: string) => {
      if (!auth.user) return;
      await api("/api/locker/beats", {
        method: "POST",
        body: JSON.stringify({
          beat_id: beat.id,
          title: beat.title,
          producer: beat.producer,
          bpm: beat.bpm,
          musical_key: beat.key,
          mood: beat.mood,
          license,
          price,
          stripe_checkout_session_id: checkoutSessionId,
          beat_snapshot: beat,
        }),
      });
      await refresh();
    },
    [auth.user, refresh],
  );

  const importPrivateBeat = useCallback(
    async (input: PrivateBeatImportInput) => {
      if (!auth.user) return null;
      const metadata = {
        title: input.title,
        producer: input.producer,
        bpm: input.bpm,
        musical_key: input.musicalKey,
        duration_seconds: input.durationSeconds,
        file_name: input.file.name,
        file_size: input.file.size,
        mime_type: input.file.type || "application/octet-stream",
        rights_confirmed: true as const,
      };
      const prepared = await api<{
        upload: { bucket: string; path: string; token: string; contentType: string };
      }>("/api/locker/beats/import", {
        method: "POST",
        body: JSON.stringify(metadata),
      });

      const supabase = createSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(prepared.upload.bucket)
        .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, input.file, {
          contentType: prepared.upload.contentType,
        });
      if (uploadError) throw new RapWriterApiError(uploadError.message, 500, "private_beat_upload_failed");

      try {
        const completed = await api<{ beat: BeatLockerRow }>("/api/locker/beats/import", {
          method: "PATCH",
          body: JSON.stringify({
            ...metadata,
            storage_path: prepared.upload.path,
            content_type: prepared.upload.contentType,
          }),
        });
        setBeatLocker((current) => [completed.beat, ...current.filter((beat) => beat.id !== completed.beat.id)]);
        setLockerCounts((current) => ({ ...current, beats: current.beats + 1 }));
        return completed.beat;
      } catch (error) {
        await api(`/api/locker/beats/import?path=${encodeURIComponent(prepared.upload.path)}`, { method: "DELETE" }).catch(() => undefined);
        throw error;
      }
    },
    [auth.user],
  );

  const saveHook = useCallback(
    async (payload: { projectId?: string; songId?: string; title: string; content: string }) => {
      if (!auth.user || !payload.content.trim()) return;
      await api("/api/locker/hooks", {
        method: "POST",
        body: JSON.stringify({
          project_id: payload.projectId ?? null,
          song_id: payload.songId ?? null,
          title: payload.title,
          content: payload.content,
          source_section: "Hook",
          tags: ["Hook"],
        }),
      });
      await refresh();
    },
    [auth.user, refresh],
  );

  const saveSongToLocker = useCallback(
    async (payload: { projectId?: string; songId?: string; title: string; status: string; boothReady: boolean; snapshot: unknown }) => {
      if (!auth.user) return;
      await api("/api/locker/songs", {
        method: "POST",
        body: JSON.stringify({
          project_id: payload.projectId ?? null,
          song_id: payload.songId ?? null,
          title: payload.title,
          status: payload.status,
          booth_ready: payload.boothReady,
          snapshot: payload.snapshot,
        }),
      });
      await refresh();
    },
    [auth.user, refresh],
  );

  const createBoothExport = useCallback(
    async (payload: BoothExportCreateInput) => {
      if (!auth.user) return null;
      const result = await api<{ export: BoothExportRecord }>("/api/booth-exports", {
        method: "POST",
        body: JSON.stringify({
          project_id: payload.projectId,
          song_id: payload.songId,
          session_id: payload.sessionId ?? null,
          rough_take_id: payload.roughTakeId ?? null,
          title: payload.title,
          snapshot: payload.snapshot,
        }),
      });
      return result.export;
    },
    [auth.user],
  );

  const removeLockerItem = useCallback(
    async (kind: "beats" | "songs" | "hooks", id: string) => {
      if (!auth.user) return;
      await api(`/api/locker/${kind}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (kind === "beats") setBeatLocker((current) => current.filter((item) => item.id !== id));
      if (kind === "songs") setSongLocker((current) => current.filter((item) => item.id !== id));
      if (kind === "hooks") setHookLocker((current) => current.filter((item) => item.id !== id));
      setLockerCounts((current) => ({ ...current, [kind]: Math.max(0, current[kind] - 1) }));
    },
    [auth.user],
  );

  const unlockProductEntitlement = useCallback(
    async (productId: string) => {
      if (!auth.user) return null;
      const res = await api<{ entitlement: ProductEntitlementRow }>("/api/entitlements", {
        method: "POST",
        body: JSON.stringify({ product_id: productId }),
      });
      setProductEntitlements((current) => {
        const withoutDuplicate = current.filter((item) => item.product_id !== res.entitlement.product_id);
        return [res.entitlement, ...withoutDuplicate];
      });
      return res.entitlement;
    },
    [auth.user],
  );

  const updateAccountRole = useCallback(
    async (accountType: OnboardingAccountType) => {
      if (!auth.user) return null;
      const res = await api<{ profile: ProfileRow }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ account_type: accountType }),
      });
      setProfile(res.profile);
      return res.profile;
    },
    [auth.user],
  );

  const activateFirstSession = useCallback(
    async (payload: {
      artistGoal: "finish_song" | "write_hook" | "write_verse" | "freestyle";
      projectTitle: string;
      songTitle: string;
      beat?: BeatSnapshot | null;
    }) => {
      if (!auth.user) return null;
      const res = await api<{
        profile: ProfileRow;
        project: ProjectRow;
        song: SongRow;
        session: SessionRow;
      }>("/api/activation", {
        method: "POST",
        body: JSON.stringify({
          artist_goal: payload.artistGoal,
          project_title: payload.projectTitle,
          song_title: payload.songTitle,
          beat: persistedBeat(payload.beat),
        }),
      });
      setProfile(res.profile);
      setProjects((current) => [res.project, ...current.filter((item) => item.id !== res.project.id)]);
      setSongs((current) => [res.song, ...current.filter((item) => item.id !== res.song.id)]);
      setSession(res.session);
      sessionRef.current = res.session;
      setLastSaved(res.session.last_active_at);
      return res;
    },
    [auth.user],
  );

  const activeSong = useMemo(() => {
    if (session) return songs.find((song) => song.id === session.song_id) ?? null;
    return songs[0] ?? null;
  }, [session, songs]);

  useEffect(() => {
    if (!auth.user) return;
    const sessionId = session?.id ?? null;
    const songId = activeSong?.id ?? session?.song_id ?? null;
    if (!sessionId && !songId) return;
    void loadLatestRoughTake({ sessionId, songId }).catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load rough take."),
    );
  }, [activeSong?.id, auth.user, loadLatestRoughTake, session?.id, session?.song_id]);

  const uploadRoughTake = useCallback(
    async (payload: {
      file: Blob;
      projectId?: string | null;
      songId?: string | null;
      sessionId?: string | null;
      sectionName: string;
      durationSeconds: number;
      analysis?: RoughTakeAnalysis | null;
      beat?: BeatSnapshot | null;
      beatPositionSeconds?: number;
    }) => {
      if (!auth.user) return null;
      const formData = new FormData();
      formData.set("file", payload.file, `rough-take.${payload.file.type.includes("mp4") ? "m4a" : "webm"}`);
      if (payload.projectId) formData.set("project_id", payload.projectId);
      if (payload.songId) formData.set("song_id", payload.songId);
      if (payload.sessionId) formData.set("session_id", payload.sessionId);
      formData.set("section_name", payload.sectionName);
      formData.set("duration_seconds", String(payload.durationSeconds));
      if (payload.analysis) formData.set("analysis", JSON.stringify(payload.analysis));
      if (payload.beat) {
        formData.set("beat_id", payload.beat.id);
        formData.set("beat_snapshot", JSON.stringify(payload.beat));
      }
      formData.set("beat_position_seconds", String(Math.max(0, payload.beatPositionSeconds ?? 0)));
      const res = await api<{ roughTake: RoughTakeRow }>("/api/rough-takes", { method: "POST", body: formData });
      setRoughTake(res.roughTake);
      return res.roughTake;
    },
    [auth.user],
  );

  return {
    ...auth,
    loadingData,
    error: error ?? auth.error,
    projects,
    songs,
    activeSong,
    session,
    profile,
    beatLocker,
    songLocker,
    hookLocker,
    roughTake,
    productEntitlements,
    membership,
    lockerCounts,
    lastSaved,
    refresh,
    ensureWorkspace,
    createSong,
    updateSong,
    saveNow,
    queueAutosave,
    addBeatLicense,
    importPrivateBeat,
    saveHook,
    saveSongToLocker,
    createBoothExport,
    removeLockerItem,
    loadLatestRoughTake,
    uploadRoughTake,
    unlockProductEntitlement,
    updateAccountRole,
    activateFirstSession,
  };
}
