"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Disc3,
  Eye,
  FilePenLine,
  FolderPlus,
  Globe2,
  Headphones,
  Loader2,
  LockKeyhole,
  Music,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/hooks/use-auth";
import { getProducerUploadDraftBlockers } from "@/lib/producer-release";
import { cn } from "@/lib/utils";

type ProducerProfileRow = {
  id: string;
  display_name: string;
  handle: string | null;
  city: string | null;
  studio_name: string | null;
  state: string | null;
  country: string | null;
  years_producing: number | null;
  bio: string | null;
  genres: string[];
  specialties: string[];
  website_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  beatstars_url: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  verified: boolean;
  is_public: boolean;
};

type ProducerBeatRow = {
  id: string;
  title: string;
  bpm: number | null;
  duration_seconds: number;
  musical_key: string | null;
  genre: string | null;
  mood: string | null;
  region: string | null;
  tags: string[];
  license_tiers: Array<{ license: string; price: number }>;
  status: "draft" | "submitted" | "approved" | "rejected" | "archived";
  admin_notes: string | null;
  audio_url: string | null;
  artwork_url: string | null;
  created_at: string;
  updated_at: string;
};

type ProducerPlaylistRow = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  producer_playlist_items?: Array<{ beat_id: string; position: number }>;
};

type CatalogFilter = "active" | ProducerBeatRow["status"];

type BeatEditorDraft = {
  title: string;
  bpm: string;
  musical_key: string;
  genre: string;
  mood: string;
  region: string;
  tags: string;
  lease_price: string;
  premium_price: string;
  exclusive_price: string;
};

type ProducerPayload = {
  profile: ProducerProfileRow | null;
  beats: ProducerBeatRow[];
  playlists: ProducerPlaylistRow[];
  business: ProducerBusinessRow | null;
  billing: ProducerBillingRow;
  metrics: ProducerMetricsRow;
  reviews: ProducerReleaseReview[];
  release_readiness: ProducerReleaseReadiness;
  foundation_ready: boolean;
};

type ProducerReleaseReview = {
  id: string;
  target_type: "profile" | "beat";
  to_status: "approved" | "rejected";
  notes: string | null;
  created_at: string;
};

type ProducerReleaseReadiness = {
  phase: string;
  next_action: string;
  profile_ready: boolean;
  profile_blockers: string[];
  beat_blockers: Record<string, string[]>;
  live_beat_count: number;
};

type ProducerBusinessRow = {
  business_email: string | null;
  contact_preference: "platform" | "email" | "website" | "social" | "hidden";
  license_settings: { lease?: number; premium?: number; unlimited?: number; exclusive?: number };
  default_license_terms: string | null;
  automatic_delivery: boolean;
  onboarding_step: number;
  onboarding_completed: boolean;
};

type ProducerBillingRow = {
  plan: "free" | "studio_pro" | "elite";
  stripe_status: "not_connected" | "pending" | "restricted" | "active";
  payouts_enabled: boolean;
  charges_enabled: boolean;
  verification: Record<string, boolean>;
};

type ProducerMetricsRow = {
  profile_views: number;
  beat_plays: number;
  favorites: number;
  beat_adds: number;
  followers: number;
  sales: number;
  repeat_customers: number;
  revenue_cents: number;
  revenue_month_cents: number;
  revenue_year_cents: number;
  average_listen_seconds: number;
  top_city: string | null;
  top_state: string | null;
};

const emptyBilling: ProducerBillingRow = { plan: "free", stripe_status: "not_connected", payouts_enabled: false, charges_enabled: false, verification: {} };
const emptyMetrics: ProducerMetricsRow = {
  profile_views: 0,
  beat_plays: 0,
  favorites: 0,
  beat_adds: 0,
  followers: 0,
  sales: 0,
  repeat_customers: 0,
  revenue_cents: 0,
  revenue_month_cents: 0,
  revenue_year_cents: 0,
  average_listen_seconds: 0,
  top_city: null,
  top_state: null,
};
const emptyReleaseReadiness: ProducerReleaseReadiness = {
  phase: "profile",
  next_action: "Complete your producer profile.",
  profile_ready: false,
  profile_blockers: [],
  beat_blockers: {},
  live_beat_count: 0,
};

const defaultGenres = ["Trap", "Melodic Rap", "Drill", "Soul", "Lo-fi", "R&B", "Boom Bap", "Club"];
const producerSpecialties = ["Trap", "Southern", "Drill", "Boom Bap", "R&B", "Soul", "Melodic", "West Coast", "East Coast", "Club", "Lo-Fi", "Sample Based", "Experimental"];
const catalogFilters: Array<{ id: CatalogFilter; label: string }> = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "submitted", label: "In Review" },
  { id: "approved", label: "Live" },
  { id: "rejected", label: "Needs Work" },
  { id: "archived", label: "Archived" },
];

export function ProducerPortal() {
  const auth = useAuth();
  const [payload, setPayload] = useState<ProducerPayload>({ profile: null, beats: [], playlists: [], business: null, billing: emptyBilling, metrics: emptyMetrics, reviews: [], release_readiness: emptyReleaseReadiness, foundation_ready: true });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ tone: "idle" | "gold" | "green" | "red"; message: string }>({ tone: "idle", message: "" });
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    display_name: "",
    studio_name: "",
    handle: "",
    city: "",
    state: "",
    country: "United States",
    years_producing: "",
    bio: "",
    genres: ["Trap", "Melodic Rap"],
    specialties: ["Trap", "Melodic"],
    website_url: "",
    instagram_url: "",
    youtube_url: "",
    beatstars_url: "",
    business_email: "",
    contact_preference: "platform" as ProducerBusinessRow["contact_preference"],
    lease_price: "49",
    premium_price: "149",
    unlimited_price: "299",
    exclusive_price: "899",
    default_license_terms: "",
    automatic_delivery: true,
  });
  const [beatDraft, setBeatDraft] = useState({
    title: "",
    bpm: "",
    musical_key: "",
    genre: "Trap",
    mood: "Late Night",
    region: "Atlanta",
    tags: "Trap, Late Night, Street",
    lease_price: "49",
    premium_price: "149",
    exclusive_price: "899",
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [beatValidationVisible, setBeatValidationVisible] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("active");
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [editingBeat, setEditingBeat] = useState<ProducerBeatRow | null>(null);
  const [beatEditorDraft, setBeatEditorDraft] = useState<BeatEditorDraft>(() => emptyBeatEditorDraft());
  const [replacementAudio, setReplacementAudio] = useState<File | null>(null);
  const [replacementArtwork, setReplacementArtwork] = useState<File | null>(null);
  const [deleteBeatArmed, setDeleteBeatArmed] = useState(false);
  const [playlistComposerOpen, setPlaylistComposerOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [playlistBeatIds, setPlaylistBeatIds] = useState<string[]>([]);

  const profile = payload.profile;
  const submittedCount = payload.beats.filter((beat) => beat.status === "submitted" || beat.status === "approved").length;
  const draftCount = payload.beats.filter((beat) => beat.status === "draft").length;
  const planLabel = payload.billing.plan === "studio_pro" ? "Studio Pro" : payload.billing.plan === "elite" ? "Producer Elite" : "Free Producer";
  const storefrontChecks = [
    Boolean(profileDraft.display_name.trim() && profileDraft.handle.trim()),
    Boolean(profileDraft.city.trim() && profileDraft.country.trim()),
    profileDraft.bio.trim().length >= 40,
    profileDraft.genres.length > 0,
    profileDraft.specialties.length > 0,
    Number(profileDraft.lease_price) > 0,
    Boolean(profileDraft.business_email.trim()),
  ];
  const storefrontReadiness = Math.round((storefrontChecks.filter(Boolean).length / storefrontChecks.length) * 100);
  const profileCanQueueBeat = Boolean(
    payload.release_readiness.profile_ready
      && profile
      && (profile.status === "submitted" || profile.status === "approved"),
  );
  const beatUploadBlockers = getProducerUploadDraftBlockers({
    ...beatDraft,
    has_audio: Boolean(audioFile),
    has_artwork: Boolean(artworkFile),
  });
  const bpmValue = Number(beatDraft.bpm);
  const bpmError = beatDraft.bpm.trim() && (!Number.isInteger(bpmValue) || bpmValue < 40 || bpmValue > 220)
    ? "Use a whole number from 40 to 220."
    : "";
  const canSubmitBeat = profileCanQueueBeat;
  const profileReviewLocked = Boolean(
    profile && (profile.status === "submitted" || profile.status === "approved") && !profileEditMode,
  );
  const storefrontStatus = profile?.status === "submitted"
    ? { detail: "Profile in review", value: "In review" }
    : profile?.status === "approved"
      ? { detail: "Storefront approved", value: "Live" }
      : profile?.status === "rejected"
        ? { detail: "Changes requested", value: "Update" }
        : payload.release_readiness.profile_ready
          ? { detail: "Ready to submit", value: "Ready" }
          : { detail: `${storefrontReadiness}% complete`, value: `${storefrontReadiness}%` };
  const hasCatalogActivity = payload.beats.length > 0
    || payload.metrics.revenue_month_cents > 0
    || payload.metrics.profile_views > 0
    || payload.metrics.favorites > 0
    || payload.metrics.beat_adds > 0;

  const filteredBeats = useMemo(
    () => payload.beats.filter((beat) => catalogFilter === "active" ? beat.status !== "archived" : beat.status === catalogFilter),
    [catalogFilter, payload.beats],
  );

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.sessionReady || !auth.user) {
      setLoading(false);
      return;
    }
    void loadProducer();
  }, [auth.loading, auth.sessionReady, auth.user]);

  useEffect(() => {
    if (!profile) return;
    const business = payload.business;
    const licenses = business?.license_settings ?? {};
    setProfileDraft({
      display_name: profile.display_name,
      studio_name: profile.studio_name ?? "",
      handle: profile.handle ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      country: profile.country ?? "United States",
      years_producing: profile.years_producing?.toString() ?? "",
      bio: profile.bio ?? "",
      genres: profile.genres.length ? profile.genres : ["Trap", "Melodic Rap"],
      specialties: profile.specialties?.length ? profile.specialties : ["Trap", "Melodic"],
      website_url: profile.website_url ?? "",
      instagram_url: profile.instagram_url ?? "",
      youtube_url: profile.youtube_url ?? "",
      beatstars_url: profile.beatstars_url ?? "",
      business_email: business?.business_email ?? auth.user?.email ?? "",
      contact_preference: business?.contact_preference ?? "platform",
      lease_price: String(licenses.lease ?? 49),
      premium_price: String(licenses.premium ?? 149),
      unlimited_price: String(licenses.unlimited ?? 299),
      exclusive_price: String(licenses.exclusive ?? 899),
      default_license_terms: business?.default_license_terms ?? "",
      automatic_delivery: business?.automatic_delivery ?? true,
    });
    setOnboardingStep(business?.onboarding_step ?? 1);
  }, [auth.user?.email, payload.business, profile]);

  useEffect(() => {
    if (profile?.status === "submitted" || profile?.status === "approved") {
      setProfileEditMode(false);
    }
  }, [profile?.id, profile?.status]);

  useEffect(() => {
    if (status.tone !== "green" || !status.message) return;
    const timeout = window.setTimeout(() => {
      setStatus({ tone: "idle", message: "" });
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [status.message, status.tone]);

  async function loadProducer() {
    setLoading(true);
    try {
      const res = await fetch("/api/producer", { cache: "no-store", credentials: "same-origin" });
      const data = await res.json();
      if (res.status === 401) {
        setPayload({ profile: null, beats: [], playlists: [], business: null, billing: emptyBilling, metrics: emptyMetrics, reviews: [], release_readiness: emptyReleaseReadiness, foundation_ready: true });
        setStatus({ tone: "red", message: "Your producer session expired. Sign in again to continue." });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not load producer portal.");
      setPayload({
        profile: data.profile,
        beats: data.beats ?? [],
        playlists: data.playlists ?? [],
        business: data.business ?? null,
        billing: data.billing ?? emptyBilling,
        metrics: data.metrics ?? emptyMetrics,
        reviews: data.reviews ?? [],
        release_readiness: data.release_readiness ?? emptyReleaseReadiness,
        foundation_ready: data.foundation_ready !== false,
      });
    } catch (err) {
      setStatus({ tone: "red", message: err instanceof Error ? err.message : "Could not load producer portal." });
    } finally {
      setLoading(false);
    }
  }

  async function submitAuth(createAccount: boolean) {
    setStatus({ tone: "gold", message: createAccount ? "Creating account..." : "Signing in..." });
    const result = createAccount
      ? await auth.signUpWithPassword(authEmail, authPassword)
      : await auth.signInWithPassword(authEmail, authPassword);
    if (result.error) {
      setStatus({ tone: "red", message: result.error.message });
      return;
    }
    setStatus({
      tone: "green",
      message: result.data.session ? "Producer account ready." : "Account created. Confirm your email, then sign in.",
    });
  }

  async function requestPasswordReset() {
    if (!authEmail.includes("@")) {
      setStatus({ tone: "red", message: "Enter the email for your producer account first." });
      return;
    }
    setStatus({ tone: "gold", message: "Sending password reset..." });
    const result = await auth.sendPasswordReset(authEmail);
    setStatus({
      tone: result.error ? "red" : "green",
      message: result.error ? result.error.message : "Password reset sent. Open it in this browser.",
    });
  }

  async function saveProfile(submit = false) {
    setStatus({ tone: "gold", message: submit ? "Submitting producer profile..." : "Saving producer profile..." });
    try {
      const res = await fetch("/api/producer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileDraft,
          years_producing: profileDraft.years_producing ? Number(profileDraft.years_producing) : null,
          license_settings: {
            lease: Number(profileDraft.lease_price || 0),
            premium: Number(profileDraft.premium_price || 0),
            unlimited: Number(profileDraft.unlimited_price || 0),
            exclusive: Number(profileDraft.exclusive_price || 0),
          },
          onboarding_step: onboardingStep,
          submit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save profile.");
      await loadProducer();
      setProfileEditMode(false);
      setStatus({ tone: "green", message: submit ? "Profile submitted for approval." : "Profile saved." });
      return true;
    } catch (err) {
      setStatus({ tone: "red", message: err instanceof Error ? err.message : "Could not save profile." });
      return false;
    }
  }

  async function uploadBeat(event: FormEvent) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const shouldSubmit = submitter instanceof HTMLButtonElement && submitter.value === "submit";
    if (shouldSubmit && !profileCanQueueBeat) {
      setStatus({ tone: "red", message: payload.release_readiness.next_action });
      focusProfileRequirement();
      return;
    }
    if (shouldSubmit && beatUploadBlockers.length) {
      setBeatValidationVisible(true);
      setStatus({ tone: "red", message: beatUploadBlockers[0] });
      return;
    }
    if (bpmError) {
      setBeatValidationVisible(true);
      setStatus({ tone: "red", message: "BPM must be between 40 and 220." });
      return;
    }
    if (!audioFile) {
      setStatus({ tone: "red", message: "Choose an audio file first." });
      return;
    }
    setStatus({ tone: "gold", message: "Reading beat audio..." });
    let durationSeconds: number;
    try {
      durationSeconds = await readAudioDuration(audioFile);
    } catch (error) {
      setStatus({ tone: "red", message: error instanceof Error ? error.message : "Could not read beat duration." });
      return;
    }
    setStatus({ tone: "gold", message: shouldSubmit ? "Submitting beat for review..." : "Uploading beat draft..." });
    const formData = new FormData();
    Object.entries(beatDraft).forEach(([key, value]) => formData.append(key, value));
    formData.append("submit", shouldSubmit ? "true" : "false");
    formData.append("duration_seconds", String(durationSeconds));
    formData.append("audio", audioFile);
    if (artworkFile) formData.append("artwork", artworkFile);

    try {
      const res = await fetch("/api/producer/beats", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not upload beat.");
      await loadProducer();
      setBeatDraft((current) => ({ ...current, title: "" }));
      setAudioFile(null);
      setArtworkFile(null);
      setBeatValidationVisible(false);
      setStatus({ tone: "green", message: shouldSubmit ? "Beat submitted for Marketplace review." : "Beat uploaded as draft." });
    } catch (err) {
      setStatus({ tone: "red", message: err instanceof Error ? err.message : "Could not upload beat." });
    }
  }

  function focusProfileRequirement() {
    const blocker = payload.release_readiness.profile_blockers[0] ?? "";
    const step = /genre|specialty/i.test(blocker)
      ? 2
      : /email|onboarding/i.test(blocker) || payload.release_readiness.profile_blockers.length === 0
        ? 4
        : 1;
    setOnboardingStep(step);
    window.requestAnimationFrame(() => {
      document.getElementById("producer-onboarding")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openBeatEditor(beat: ProducerBeatRow) {
    setEditingBeat(beat);
    setBeatEditorDraft(beatEditorDraftFromBeat(beat));
    setReplacementAudio(null);
    setReplacementArtwork(null);
    setDeleteBeatArmed(false);
  }

  async function saveEditedBeat(action: "save" | "submit" | "archive" | "restore") {
    if (!editingBeat) return;
    let replacementDuration: number | null = null;
    if ((action === "save" || action === "submit") && replacementAudio) {
      try {
        replacementDuration = await readAudioDuration(replacementAudio);
      } catch (error) {
        setStatus({ tone: "red", message: error instanceof Error ? error.message : "Could not read replacement audio." });
        return;
      }
    }
    setCatalogBusy(true);
    setStatus({ tone: "gold", message: action === "submit" ? "Submitting beat for review..." : action === "archive" ? "Archiving beat..." : "Saving beat..." });
    const formData = new FormData();
    formData.set("action", action);
    if (action === "save" || action === "submit") {
      Object.entries(beatEditorDraft).forEach(([key, value]) => formData.set(key, value));
      if (replacementAudio) {
        formData.set("audio", replacementAudio);
        formData.set("duration_seconds", String(replacementDuration));
      }
      if (replacementArtwork) formData.set("artwork", replacementArtwork);
    }

    try {
      const res = await fetch(`/api/producer/beats/${editingBeat.id}`, { method: "PATCH", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Beat could not be updated.");
      const nextBeat = data.beat as ProducerBeatRow;
      setPayload((current) => ({ ...current, beats: current.beats.map((beat) => beat.id === nextBeat.id ? nextBeat : beat) }));
      setEditingBeat(nextBeat);
      setBeatEditorDraft(beatEditorDraftFromBeat(nextBeat));
      setReplacementAudio(null);
      setReplacementArtwork(null);
      setDeleteBeatArmed(false);
      setStatus({ tone: "green", message: action === "submit" ? "Beat submitted for review." : action === "archive" ? "Beat archived." : action === "restore" ? "Beat restored as a draft." : "Beat draft saved." });
      if (action === "archive" || action === "restore") setEditingBeat(null);
    } catch (err) {
      setStatus({ tone: "red", message: err instanceof Error ? err.message : "Beat could not be updated." });
    } finally {
      setCatalogBusy(false);
    }
  }

  async function deleteEditedBeat() {
    if (!editingBeat) return;
    if (!deleteBeatArmed) {
      setDeleteBeatArmed(true);
      return;
    }
    setCatalogBusy(true);
    setStatus({ tone: "gold", message: "Permanently deleting beat..." });
    try {
      const res = await fetch(`/api/producer/beats/${editingBeat.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Beat could not be deleted.");
      setPayload((current) => ({
        ...current,
        beats: current.beats.filter((beat) => beat.id !== editingBeat.id),
        playlists: current.playlists.map((playlist) => ({
          ...playlist,
          producer_playlist_items: playlist.producer_playlist_items?.filter((item) => item.beat_id !== editingBeat.id),
        })),
      }));
      setEditingBeat(null);
      setStatus({ tone: data.cleanup_warning ? "gold" : "green", message: data.cleanup_warning ? `Beat deleted. File cleanup: ${data.cleanup_warning}` : "Beat permanently deleted." });
    } catch (err) {
      setStatus({ tone: "red", message: err instanceof Error ? err.message : "Beat could not be deleted." });
    } finally {
      setCatalogBusy(false);
    }
  }

  function openPlaylistComposer(playlist?: ProducerPlaylistRow) {
    setEditingPlaylistId(playlist?.id ?? null);
    setPlaylistTitle(playlist?.title ?? "");
    setPlaylistDescription(playlist?.description ?? "");
    setPlaylistBeatIds(
      [...(playlist?.producer_playlist_items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((item) => item.beat_id),
    );
    setPlaylistComposerOpen(true);
  }

  function togglePlaylistBeat(beatId: string) {
    setPlaylistBeatIds((current) => current.includes(beatId) ? current.filter((id) => id !== beatId) : [...current, beatId]);
  }

  function movePlaylistBeat(beatId: string, direction: -1 | 1) {
    setPlaylistBeatIds((current) => {
      const index = current.indexOf(beatId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function savePlaylist(statusValue: ProducerPlaylistRow["status"]) {
    if (!playlistTitle.trim()) {
      setStatus({ tone: "red", message: "Name the playlist first." });
      return;
    }
    setCatalogBusy(true);
    setStatus({ tone: "gold", message: statusValue === "published" ? "Publishing playlist..." : statusValue === "archived" ? "Archiving playlist..." : "Saving playlist..." });
    try {
      const endpoint = editingPlaylistId ? `/api/producer/playlists/${editingPlaylistId}` : "/api/producer/playlists";
      const res = await fetch(endpoint, {
        method: editingPlaylistId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: playlistTitle,
          description: playlistDescription,
          beat_ids: playlistBeatIds,
          status: statusValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Playlist could not be saved.");
      const nextPlaylist = data.playlist as ProducerPlaylistRow;
      setPayload((current) => ({
        ...current,
        playlists: editingPlaylistId
          ? current.playlists.map((playlist) => playlist.id === nextPlaylist.id ? nextPlaylist : playlist)
          : [nextPlaylist, ...current.playlists],
      }));
      setPlaylistComposerOpen(false);
      setStatus({ tone: "green", message: statusValue === "published" ? "Playlist published to your storefront." : statusValue === "archived" ? "Playlist archived." : "Playlist draft saved." });
    } catch (err) {
      setStatus({ tone: "red", message: err instanceof Error ? err.message : "Playlist could not be saved." });
    } finally {
      setCatalogBusy(false);
    }
  }

  if (auth.loading || loading) {
    return (
      <ProducerShell>
        <div className="grid min-h-[70svh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </ProducerShell>
    );
  }

  if (!auth.sessionReady || !auth.user) {
    return (
      <ProducerShell>
        <div className="px-5 py-6">
          <ProducerHero eyebrow="Producer Portal" title="Upload beats. Build your store." body="Create a producer account, submit beats, and organize playlists for RapWriter Marketplace." />
          <div className="mt-5 rounded-3xl border border-white/10 bg-[#111113] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gold/25 bg-gold/8 text-gold">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <div className="label-hw text-gold/85">Producer Sign In</div>
                <div className="mt-1 text-sm text-muted-foreground">Use your verified RapWriter account.</div>
              </div>
            </div>
            <label className="mt-5 block">
              <span className="label-hw">Email</span>
              <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="producer@email.com" type="email" name="email" inputMode="email" autoComplete="email" className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
            </label>
            <label className="mt-3 block">
              <span className="label-hw">Password</span>
              <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" type="password" name="password" autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => void submitAuth(false)} className="gold-seal min-h-12 rounded-2xl px-4 font-semibold">Sign In</button>
              <button onClick={() => void submitAuth(true)} className="min-h-12 rounded-2xl border border-gold/25 bg-gold/8 px-4 font-semibold text-gold">Create</button>
            </div>
            <button onClick={() => void requestPasswordReset()} className="mt-2 min-h-10 w-full rounded-xl px-4 text-xs font-semibold text-muted-foreground">
              Forgot password?
            </button>
          </div>
          <StatusPill tone={status.tone} message={status.message || auth.error || ""} />
        </div>
      </ProducerShell>
    );
  }

  return (
    <ProducerShell>
      <div className="space-y-5 px-5 pb-28 pt-5">
        <ProducerHero
          eyebrow={profile ? "Producer Control Room" : "Producer Onboarding"}
          title={profile ? `Welcome, ${profile.display_name}.` : "Set up your storefront."}
          body={profile ? "Upload drafts, organize playlists, and prepare beats for Marketplace approval." : "Create the profile artists will see before they write to your beats."}
        />
        <StatusPill tone={status.tone} message={status.message} />

        {!payload.foundation_ready && (
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed text-gold">
            Producer Economy migration is ready in the codebase and still needs to be applied to this Supabase project.
          </div>
        )}

        {payload.beats.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <ProducerMetric label="Beats" value={String(payload.beats.length)} />
            <ProducerMetric label="Submitted" value={String(submittedCount)} />
            <ProducerMetric label="Drafts" value={String(draftCount)} />
          </div>
        )}

        <ReleasePipeline readiness={payload.release_readiness} profile={profile} beats={payload.beats} latestReview={payload.reviews[0]} onEditProfile={() => setProfileEditMode(true)} />

        {profile && hasCatalogActivity && (
          <section className="rounded-3xl border border-white/10 bg-[#111113] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="label-hw text-gold/85">Business snapshot</div>
                <h2 className="mt-1 text-xl font-semibold">Your producer business</h2>
              </div>
              <span className="rounded-full border border-gold/25 bg-gold/8 px-3 py-1 text-[11px] font-semibold text-gold">{planLabel}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ProducerMetric label="Revenue" value={formatMoney(payload.metrics.revenue_month_cents)} />
              <ProducerMetric label="Store views" value={formatCount(payload.metrics.profile_views)} />
              <ProducerMetric label="Favorites" value={formatCount(payload.metrics.favorites)} />
              <ProducerMetric label="Beat adds" value={formatCount(payload.metrics.beat_adds)} />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/24 p-3">
              <div>
                <div className="text-sm font-semibold">Storefront readiness</div>
                <div className="mt-1 text-xs text-muted-foreground">{storefrontStatus.detail}</div>
              </div>
              <div className="text-sm font-semibold text-gold">{storefrontStatus.value}</div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${storefrontReadiness}%` }} />
            </div>
            {profile.handle && (
              <a
                href={`/producer/${encodeURIComponent(profile.handle.replace(/^@+/, ""))}`}
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-2xl border border-gold/25 bg-gold/8 px-4 text-sm font-semibold text-gold"
              >
                Preview Storefront
              </a>
            )}
          </section>
        )}

        {!profileReviewLocked && <section id="producer-onboarding" className="scroll-mt-24 rounded-3xl border border-white/10 bg-[#111113] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label-hw text-gold/85">{profileReviewLocked ? "Producer profile" : "Producer onboarding"}</div>
              <h2 className="mt-1 text-xl font-semibold">{profileReviewLocked ? profile?.display_name : "Build your storefront"}</h2>
            </div>
            {profile?.status && <StatusBadge status={profile.status} />}
          </div>

          {profileReviewLocked ? (
            <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
              <ShieldCheck className={cn("h-5 w-5 shrink-0", profile?.status === "approved" ? "text-emerald-300" : "text-gold")} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{profile?.status === "approved" ? "Storefront approved" : "Admin review in progress"}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {profile?.status === "approved" ? "Your producer profile is live." : "Your profile is submitted. You can upload beats while you wait."}
                </div>
              </div>
              <button type="button" onClick={() => setProfileEditMode(true)} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-muted-foreground">
                Edit
              </button>
            </div>
          ) : (
            <>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {["Identity", "Sound", "Licenses", "Launch"].map((label, index) => {
              const step = index + 1;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setOnboardingStep(step)}
                  className={cn("min-h-12 rounded-xl border px-1 text-[10px] font-semibold", onboardingStep === step ? "border-gold/40 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground")}
                >
                  <span className="block text-[11px]">0{step}</span>
                  {label}
                </button>
              );
            })}
          </div>

          <fieldset className="mt-5 space-y-3">
            {onboardingStep === 1 && (
              <>
                <OnboardingHeading icon={Store} title="Basic information" detail="The identity artists see before they press play." />
                <ProducerInput value={profileDraft.display_name} onChange={(display_name) => setProfileDraft((current) => ({ ...current, display_name }))} placeholder="Producer name" />
                <ProducerInput value={profileDraft.studio_name} onChange={(studio_name) => setProfileDraft((current) => ({ ...current, studio_name }))} placeholder="Studio name (optional)" />
                <div className="grid grid-cols-2 gap-2">
                  <ProducerInput value={profileDraft.handle} onChange={(handle) => setProfileDraft((current) => ({ ...current, handle }))} placeholder="@handle" />
                  <ProducerInput value={profileDraft.years_producing} onChange={(years_producing) => setProfileDraft((current) => ({ ...current, years_producing }))} placeholder="Years producing" inputMode="numeric" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ProducerInput value={profileDraft.city} onChange={(city) => setProfileDraft((current) => ({ ...current, city }))} placeholder="City" />
                  <ProducerInput value={profileDraft.state} onChange={(state) => setProfileDraft((current) => ({ ...current, state }))} placeholder="State" />
                </div>
                <ProducerInput value={profileDraft.country} onChange={(country) => setProfileDraft((current) => ({ ...current, country }))} placeholder="Country" />
                <label className="block">
                  <span className="mb-2 flex items-center justify-between gap-3">
                    <span className="label-hw text-gold/75">Producer bio</span>
                    <span className={cn("text-[10px] tabular-nums", profileDraft.bio.trim().length >= 40 ? "text-emerald-300" : "text-muted-foreground")}>{profileDraft.bio.trim().length}/40 minimum</span>
                  </span>
                  <textarea value={profileDraft.bio} onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))} placeholder="Describe your sound, story, and creative point of view..." className={cn("min-h-28 w-full resize-none rounded-2xl border bg-black/35 p-4 outline-none", profileDraft.bio.length > 0 && profileDraft.bio.trim().length < 40 ? "border-gold/40" : "border-white/10")} />
                </label>
              </>
            )}

            {onboardingStep === 2 && (
              <>
                <OnboardingHeading icon={Building2} title="Producer identity" detail="Choose the lanes where your catalog is strongest." />
                <ChoiceGrid values={producerSpecialties} selected={profileDraft.specialties} limit={12} onChange={(specialties) => setProfileDraft((current) => ({ ...current, specialties }))} />
                <div className="label-hw pt-2 text-gold/70">Primary genres</div>
                <ChoiceGrid values={defaultGenres} selected={profileDraft.genres} limit={8} onChange={(genres) => setProfileDraft((current) => ({ ...current, genres }))} />
                <ProducerInput value={profileDraft.website_url} onChange={(website_url) => setProfileDraft((current) => ({ ...current, website_url }))} placeholder="Website" />
                <div className="grid grid-cols-2 gap-2">
                  <ProducerInput value={profileDraft.instagram_url} onChange={(instagram_url) => setProfileDraft((current) => ({ ...current, instagram_url }))} placeholder="Instagram" />
                  <ProducerInput value={profileDraft.youtube_url} onChange={(youtube_url) => setProfileDraft((current) => ({ ...current, youtube_url }))} placeholder="YouTube" />
                </div>
                <ProducerInput value={profileDraft.beatstars_url} onChange={(beatstars_url) => setProfileDraft((current) => ({ ...current, beatstars_url }))} placeholder="BeatStars" />
              </>
            )}

            {onboardingStep === 3 && (
              <>
                <OnboardingHeading icon={Banknote} title="License defaults" detail="Set a clean starting point for every new beat." />
                <div className="grid grid-cols-2 gap-2">
                  <PriceInput label="Lease" value={profileDraft.lease_price} onChange={(lease_price) => setProfileDraft((current) => ({ ...current, lease_price }))} />
                  <PriceInput label="Premium" value={profileDraft.premium_price} onChange={(premium_price) => setProfileDraft((current) => ({ ...current, premium_price }))} />
                  <PriceInput label="Unlimited" value={profileDraft.unlimited_price} onChange={(unlimited_price) => setProfileDraft((current) => ({ ...current, unlimited_price }))} />
                  <PriceInput label="Exclusive" value={profileDraft.exclusive_price} onChange={(exclusive_price) => setProfileDraft((current) => ({ ...current, exclusive_price }))} />
                </div>
                <textarea value={profileDraft.default_license_terms} onChange={(event) => setProfileDraft((current) => ({ ...current, default_license_terms: event.target.value }))} placeholder="Default license terms (optional)" className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/35 p-4 outline-none" />
                <button type="button" onClick={() => setProfileDraft((current) => ({ ...current, automatic_delivery: !current.automatic_delivery }))} className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-black/24 px-4 text-left">
                  <span><span className="block text-sm font-semibold">Automatic delivery</span><span className="mt-1 block text-xs text-muted-foreground">Release licensed files after payment clears.</span></span>
                  <span className={cn("relative h-6 w-11 rounded-full transition-colors", profileDraft.automatic_delivery ? "bg-gold" : "bg-white/15")}><span className={cn("absolute top-1 h-4 w-4 rounded-full bg-black transition-transform", profileDraft.automatic_delivery ? "translate-x-6" : "translate-x-1")} /></span>
                </button>
              </>
            )}

            {onboardingStep === 4 && (
              <>
                <OnboardingHeading icon={BadgeCheck} title="Launch readiness" detail="Review contact, payouts, and verification before submitting." />
                <ProducerInput value={profileDraft.business_email} onChange={(business_email) => setProfileDraft((current) => ({ ...current, business_email }))} placeholder="Business email" inputMode="email" />
                <select value={profileDraft.contact_preference} onChange={(event) => setProfileDraft((current) => ({ ...current, contact_preference: event.target.value as ProducerBusinessRow["contact_preference"] }))} className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 outline-none">
                  <option value="platform">RapWriter messages</option><option value="email">Public email</option><option value="website">External website</option><option value="social">Social links</option><option value="hidden">Contact hidden</option>
                </select>
                <ReadinessRow icon={Banknote} label="Payout account" value={payload.billing.stripe_status === "active" ? "Connected" : "Connect after review"} ready={payload.billing.stripe_status === "active"} />
                <ReadinessRow icon={ShieldCheck} label="Marketplace verification" value={profile?.verified ? "RapWriter Verified" : "Manual review required"} ready={Boolean(profile?.verified)} />
                <ReadinessRow icon={Globe2} label="Storefront" value={`${storefrontReadiness}% ready`} ready={payload.release_readiness.profile_ready} />
              </>
            )}

              <>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button type="button" onClick={() => setOnboardingStep((step) => Math.max(1, step - 1))} disabled={onboardingStep === 1} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 font-semibold text-muted-foreground disabled:opacity-35"><ChevronLeft className="h-4 w-4" />Back</button>
                  {onboardingStep < 4 ? (
                    <button type="button" onClick={() => void saveProfile(false).then((saved) => saved && setOnboardingStep((step) => Math.min(4, step + 1)))} className="gold-seal flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 font-semibold">Save & Continue<ChevronRight className="h-4 w-4" /></button>
                  ) : (
                    <button type="button" onClick={() => void saveProfile(true)} className="gold-seal min-h-12 rounded-2xl px-4 font-semibold">
                      {profile?.status === "rejected" ? "Resubmit Profile" : profileEditMode ? "Submit Profile Changes" : "Submit Profile"}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => void saveProfile(false)} className="min-h-10 w-full text-xs font-semibold text-muted-foreground">{profileEditMode ? "Save changes as draft" : "Save profile draft"}</button>
              </>
          </fieldset>
            </>
          )}
        </section>}

        <section id="beat-upload" className="scroll-mt-24 rounded-3xl border border-white/10 bg-[#111113] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label-hw text-gold/85">Beat Upload</div>
              <h2 className="mt-1 text-xl font-semibold">Upload a beat</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Save it privately or submit it for Marketplace review.</p>
            </div>
            <Upload className="h-5 w-5 text-gold" />
          </div>
          {!profileCanQueueBeat && (
            <div className="mt-3 flex items-center gap-3 border-y border-gold/15 py-3">
              <LockKeyhole className="h-4 w-4 shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Profile required for review</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{payload.release_readiness.next_action}</div>
              </div>
              <button type="button" onClick={focusProfileRequirement} className="shrink-0 rounded-xl border border-gold/30 bg-gold/8 px-3 py-2 text-xs font-semibold text-gold">
                {payload.release_readiness.profile_blockers.length ? "Fix profile" : "Submit profile"}
              </button>
            </div>
          )}
          <form onSubmit={(event) => void uploadBeat(event)} className="mt-4 space-y-3">
            <BeatField label="Beat title" value={beatDraft.title} onChange={(title) => setBeatDraft((current) => ({ ...current, title }))} placeholder="Pulse Code" />
            <div className="grid grid-cols-2 gap-2">
              <BeatField label="BPM" value={beatDraft.bpm} onChange={(bpm) => setBeatDraft((current) => ({ ...current, bpm }))} placeholder="84" inputMode="numeric" error={bpmError} />
              <BeatField label="Key" value={beatDraft.musical_key} onChange={(musical_key) => setBeatDraft((current) => ({ ...current, musical_key }))} placeholder="F# Minor" list="musical-key-options" />
              <BeatField label="Genre" value={beatDraft.genre} onChange={(genre) => setBeatDraft((current) => ({ ...current, genre }))} placeholder="Trap" />
              <BeatField label="Region" value={beatDraft.region} onChange={(region) => setBeatDraft((current) => ({ ...current, region }))} placeholder="Atlanta" />
            </div>
            <datalist id="musical-key-options">
              {["C Major", "C Minor", "C# Major", "C# Minor", "D Major", "D Minor", "D# Major", "D# Minor", "E Major", "E Minor", "F Major", "F Minor", "F# Major", "F# Minor", "G Major", "G Minor", "G# Major", "G# Minor", "A Major", "A Minor", "A# Major", "A# Minor", "B Major", "B Minor"].map((key) => <option key={key} value={key} />)}
            </datalist>
            <BeatField label="Mood" value={beatDraft.mood} onChange={(mood) => setBeatDraft((current) => ({ ...current, mood }))} placeholder="Late Night" />
            <BeatField label="Discovery tags" value={beatDraft.tags} onChange={(tags) => setBeatDraft((current) => ({ ...current, tags }))} placeholder="Trap, Late Night, Street" />
            <div className="label-hw pt-1 text-gold/75">License prices</div>
            <div className="grid grid-cols-3 gap-2">
              <PriceInput label="Lease" value={beatDraft.lease_price} onChange={(lease_price) => setBeatDraft((current) => ({ ...current, lease_price }))} />
              <PriceInput label="Premium" value={beatDraft.premium_price} onChange={(premium_price) => setBeatDraft((current) => ({ ...current, premium_price }))} />
              <PriceInput label="Exclusive" value={beatDraft.exclusive_price} onChange={(exclusive_price) => setBeatDraft((current) => ({ ...current, exclusive_price }))} />
            </div>
            <ProducerFileInput label="Beat audio" value={audioFile?.name ?? "Choose audio file"} accept="audio/*" onChange={setAudioFile} required />
            <ProducerFileInput label="Release artwork" value={artworkFile?.name ?? "Choose cover image"} accept="image/*" onChange={setArtworkFile} />
            {beatValidationVisible && beatUploadBlockers.length > 0 && (
              <div className="border-y border-rec/20 py-3">
                <div className="text-xs font-semibold text-rec">{beatUploadBlockers.length} item{beatUploadBlockers.length === 1 ? "" : "s"} to fix</div>
                <div className="mt-2 space-y-1">
                  {beatUploadBlockers.slice(0, 3).map((blocker) => <div key={blocker} className="text-xs leading-relaxed text-muted-foreground">{blocker}</div>)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button name="intent" value="draft" disabled={!profile} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.03] px-4 font-semibold text-muted-foreground disabled:opacity-45">
                Save as Draft
              </button>
              <button name="intent" value="submit" disabled={!canSubmitBeat} className="gold-seal min-h-12 rounded-2xl px-4 font-semibold disabled:opacity-45">
                Submit Beat
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111113] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label-hw text-gold/85">Beat Playlists</div>
              <h2 className="mt-1 text-xl font-semibold">Bundle your sound</h2>
            </div>
            <button onClick={() => openPlaylistComposer()} className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold" aria-label="Create playlist">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {payload.playlists.length ? payload.playlists.map((playlist) => (
              <button key={playlist.id} onClick={() => openPlaylistComposer(playlist)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/24 p-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8 text-gold"><FolderPlus className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{playlist.title}</span>
                  <span className="mt-1 block text-xs capitalize text-muted-foreground">{playlist.status} - {playlist.producer_playlist_items?.length ?? 0} beats</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )) : <p className="text-sm text-muted-foreground">Create playlists after uploading a few beats.</p>}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111113] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="label-hw text-gold/85">Catalog</div>
              <h2 className="mt-1 text-xl font-semibold">Your beats</h2>
            </div>
            <span className="text-xs text-muted-foreground">{filteredBeats.length} shown</span>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {catalogFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setCatalogFilter(filter.id)}
                className={cn("min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold", catalogFilter === filter.id ? "border-gold/40 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground")}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {filteredBeats.length ? filteredBeats.map((beat) => <ProducerBeatCard key={beat.id} beat={beat} onEdit={() => openBeatEditor(beat)} />) : (
              <p className="rounded-2xl border border-white/10 bg-black/24 p-4 text-sm leading-relaxed text-muted-foreground">No beats in this view.</p>
            )}
          </div>
        </section>
      </div>
      <BeatEditorSheet
        beat={editingBeat}
        draft={beatEditorDraft}
        audioFile={replacementAudio}
        artworkFile={replacementArtwork}
        busy={catalogBusy}
        canSubmit={canSubmitBeat}
        submitHint={payload.release_readiness.next_action}
        deleteArmed={deleteBeatArmed}
        onDraft={setBeatEditorDraft}
        onAudio={setReplacementAudio}
        onArtwork={setReplacementArtwork}
        onClose={() => setEditingBeat(null)}
        onSave={(action) => void saveEditedBeat(action)}
        onDelete={() => void deleteEditedBeat()}
      />
      <PlaylistComposerSheet
        open={playlistComposerOpen}
        title={playlistTitle}
        description={playlistDescription}
        selectedIds={playlistBeatIds}
        beats={payload.beats.filter((beat) => beat.status !== "archived")}
        currentStatus={payload.playlists.find((playlist) => playlist.id === editingPlaylistId)?.status ?? "draft"}
        busy={catalogBusy}
        onTitle={setPlaylistTitle}
        onDescription={setPlaylistDescription}
        onToggle={togglePlaylistBeat}
        onMove={movePlaylistBeat}
        onClose={() => setPlaylistComposerOpen(false)}
        onSave={(playlistStatus) => void savePlaylist(playlistStatus)}
      />
    </ProducerShell>
  );
}

function readAudioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const timeout = window.setTimeout(() => finish(() => reject(new Error("The beat audio could not be read."))), 12_000);

    const finish = (callback: () => void) => {
      window.clearTimeout(timeout);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      callback();
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration);
      if (!Number.isFinite(duration) || duration < 1 || duration > 7200) {
        finish(() => reject(new Error("Beat audio must be between 1 second and 2 hours.")));
        return;
      }
      finish(() => resolve(duration));
    };
    audio.onerror = () => finish(() => reject(new Error("Use a valid MP3, M4A, WAV, OGG, or WebM beat file.")));
    audio.src = url;
  });
}

function ProducerShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100svh] bg-[#070708] text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,176,32,0.16),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0),#070708_62%)]" />
      <div className="relative z-10 mx-auto min-h-[100svh] w-full max-w-[430px] overflow-hidden bg-[#070708]/96">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-black/82 px-5 py-4 backdrop-blur-xl">
          <BrandLogo className="[&>span:first-child]:h-10 [&>span:first-child]:w-[9.25rem]" />
          <Link href="/" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Back to studio">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </header>
        {children}
      </div>
    </main>
  );
}

function ProducerHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="rounded-3xl border border-gold/20 bg-[linear-gradient(145deg,rgba(255,176,32,0.14),rgba(17,17,19,0.92)_48%,rgba(0,0,0,0.72))] p-5">
      <div className="label-hw text-gold/85">{eyebrow}</div>
      <h1 className="mt-2 text-[30px] font-semibold leading-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

function StatusPill({ tone, message }: { tone: "idle" | "gold" | "green" | "red"; message: string }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "red"
          ? "border-rec/25 bg-rec/10 text-rec"
          : tone === "green"
            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
            : "border-gold/25 bg-gold/8 text-gold",
      )}
    >
      {message}
    </div>
  );
}

function ReleasePipeline({
  readiness,
  profile,
  beats,
  latestReview,
  onEditProfile,
}: {
  readiness: ProducerReleaseReadiness;
  profile: ProducerProfileRow | null;
  beats: ProducerBeatRow[];
  latestReview?: ProducerReleaseReview;
  onEditProfile: () => void;
}) {
  const hasReleaseReadyBeat = beats.some((beat) => (readiness.beat_blockers[beat.id] ?? []).length === 0);
  const hasSubmittedBeat = beats.some((beat) => beat.status === "submitted" || beat.status === "approved");
  const stages = [
    { label: "Profile", icon: Store, complete: readiness.profile_ready },
    { label: "Approved", icon: ShieldCheck, complete: profile?.status === "approved" },
    { label: "Release", icon: Upload, complete: hasReleaseReadyBeat || hasSubmittedBeat },
    { label: "Live", icon: Music, complete: readiness.live_beat_count > 0 },
  ];
  const visibleBlockers = readiness.profile_blockers.length
    ? readiness.profile_blockers
    : Object.values(readiness.beat_blockers).find((blockers) => blockers.length) ?? [];
  const phaseLabels: Record<string, string> = {
    profile: "Profile setup",
    submit_profile: "Profile action",
    profile_review: "Profile in review",
    upload_beat: "Beat needed",
    finish_beat: "Finish beat",
    submit_beat: "Beat ready",
    beat_review: "Beat in review",
    live: "Marketplace live",
  };
  const reviewPhase = readiness.phase === "profile_review" || readiness.phase === "beat_review";
  const livePhase = readiness.phase === "live";

  return (
    <section className="rounded-3xl border border-gold/20 bg-[linear-gradient(145deg,rgba(255,176,32,0.11),rgba(17,17,19,0.96)_52%,rgba(0,0,0,0.78))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label-hw text-gold/85">First Release</div>
          <h2 className="mt-1 text-xl font-semibold">From setup to Marketplace</h2>
        </div>
        <span className={cn(
          "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
          livePhase
            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
            : reviewPhase
              ? "border-white/10 bg-white/[0.03] text-muted-foreground"
              : "border-gold/25 bg-gold/8 text-gold",
        )}>
          {phaseLabels[readiness.phase] ?? readiness.phase.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {stages.map(({ label, icon: Icon, complete }, index) => (
          <div key={label} className="min-w-0 text-center">
            <div className={cn("mx-auto grid h-10 w-10 place-items-center rounded-xl border", complete ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-black/30 text-muted-foreground")}>
              {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className={cn("mt-2 truncate text-[10px] font-semibold", complete ? "text-emerald-300" : index === stages.findIndex((stage) => !stage.complete) ? "text-gold" : "text-muted-foreground")}>{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-sm font-semibold">{readiness.next_action}</div>
          {(profile?.status === "submitted" || profile?.status === "approved") && (
            <button type="button" onClick={onEditProfile} className="shrink-0 text-xs font-semibold text-muted-foreground">
              Edit profile
            </button>
          )}
        </div>
        {visibleBlockers.length > 0 && (
          <div className="mt-2 space-y-1">
            {visibleBlockers.slice(0, 2).map((blocker) => <div key={blocker} className="text-xs leading-relaxed text-muted-foreground">{blocker}</div>)}
          </div>
        )}
        {latestReview?.to_status === "rejected" && latestReview.notes && (
          <div className="mt-3 rounded-xl border border-rec/20 bg-rec/[0.07] px-3 py-2 text-xs leading-relaxed text-rec">
            Latest review: {latestReview.notes}
          </div>
        )}
      </div>
    </section>
  );
}

function ProducerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111113] p-3">
      <div className="text-xl font-semibold text-gold">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}

function OnboardingHeading({ icon: Icon, title, detail }: { icon: typeof Store; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gold/15 bg-gold/[0.06] p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-black/25 text-gold"><Icon className="h-4 w-4" /></div>
      <div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</div></div>
    </div>
  );
}

function ProducerInput({ value, onChange, placeholder, inputMode = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; inputMode?: "text" | "numeric" | "email" | "url" }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block truncate label-hw text-gold/70">{placeholder}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="min-h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
    </label>
  );
}

function BeatField({ label, value, onChange, placeholder, inputMode = "text", error = "", list }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; inputMode?: "text" | "numeric"; error?: string; list?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block truncate label-hw text-gold/70">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} list={list} className={cn("min-h-12 w-full min-w-0 rounded-2xl border bg-black/35 px-4 outline-none", error ? "border-rec/45" : "border-white/10")} />
      {error && <span className="mt-1.5 block text-[10px] leading-relaxed text-rec">{error}</span>}
    </label>
  );
}

function ChoiceGrid({ values, selected, limit, onChange }: { values: string[]; selected: string[]; limit: number; onChange: (values: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const active = selected.includes(value);
        return <button key={value} type="button" onClick={() => onChange(active ? selected.filter((item) => item !== value) : [...selected, value].slice(0, limit))} className={cn("rounded-full border px-3 py-2 text-xs font-semibold", active ? "border-gold/45 bg-gold/12 text-gold" : "border-white/10 bg-white/[0.03] text-muted-foreground")}>{active && <Check className="mr-1 inline h-3 w-3" />}{value}</button>;
      })}
    </div>
  );
}

function PriceInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2">
      <span className="label-hw text-gold/70">{label}</span>
      <span className="mt-1 flex items-center gap-1 text-sm"><span className="text-muted-foreground">$</span><input value={value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" className="min-w-0 flex-1 bg-transparent py-1 outline-none" /></span>
    </label>
  );
}

function ReadinessRow({ icon: Icon, label, value, ready }: { icon: typeof Store; label: string; value: string; ready: boolean }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/24 px-4">
      <Icon className={cn("h-4 w-4 shrink-0", ready ? "text-emerald-300" : "text-gold")} />
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{label}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{value}</div></div>
      {ready ? <Check className="h-4 w-4 text-emerald-300" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

function emptyBeatEditorDraft(): BeatEditorDraft {
  return {
    title: "",
    bpm: "",
    musical_key: "",
    genre: "",
    mood: "",
    region: "",
    tags: "",
    lease_price: "49",
    premium_price: "149",
    exclusive_price: "899",
  };
}

function beatEditorDraftFromBeat(beat: ProducerBeatRow): BeatEditorDraft {
  const price = (license: string, fallback: number) => beat.license_tiers.find((tier) => tier.license === license)?.price ?? fallback;
  return {
    title: beat.title,
    bpm: beat.bpm?.toString() ?? "",
    musical_key: beat.musical_key ?? "",
    genre: beat.genre ?? "",
    mood: beat.mood ?? "",
    region: beat.region ?? "",
    tags: beat.tags.join(", "),
    lease_price: String(price("Lease", 49)),
    premium_price: String(price("Premium Lease", 149)),
    exclusive_price: String(price("Exclusive", 899)),
  };
}

function formatPortalDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function ProducerFileInput({ label, value, accept, required, onChange }: { label: string; value: string; accept: string; required?: boolean; onChange: (file: File | null) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4">
      <span className="min-w-0">
        <span className="block label-hw text-gold/70">{label}</span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">{value}</span>
      </span>
      <Upload className="h-4 w-4 shrink-0 text-gold" />
      <input required={required} type="file" accept={accept} className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
    </label>
  );
}

function ProducerBeatCard({ beat, onEdit }: { beat: ProducerBeatRow; onEdit: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
      <div className="flex items-center gap-3">
        {beat.artwork_url ? <img src={beat.artwork_url} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-white/10 object-cover" loading="lazy" decoding="async" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold"><Music className="h-5 w-5" /></div>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{beat.title}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {[beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key, beat.genre].filter(Boolean).join(" - ") || "Metadata pending"}
          </div>
        </div>
        <StatusBadge status={beat.status} />
      </div>
      {beat.admin_notes && <div className="mt-3 rounded-xl border border-rec/20 bg-rec/[0.07] px-3 py-2 text-xs leading-relaxed text-rec">Review note: {beat.admin_notes}</div>}
      <div className="mt-3 flex items-center gap-2">
        {beat.audio_url && <audio controls preload="none" src={beat.audio_url} className="h-9 min-w-0 flex-1" />}
        <button onClick={onEdit} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold" aria-label={`Edit ${beat.title}`}>
          <FilePenLine className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BeatEditorSheet({
  beat,
  draft,
  audioFile,
  artworkFile,
  busy,
  canSubmit,
  submitHint,
  deleteArmed,
  onDraft,
  onAudio,
  onArtwork,
  onClose,
  onSave,
  onDelete,
}: {
  beat: ProducerBeatRow | null;
  draft: BeatEditorDraft;
  audioFile: File | null;
  artworkFile: File | null;
  busy: boolean;
  canSubmit: boolean;
  submitHint: string;
  deleteArmed: boolean;
  onDraft: (draft: BeatEditorDraft) => void;
  onAudio: (file: File | null) => void;
  onArtwork: (file: File | null) => void;
  onClose: () => void;
  onSave: (action: "save" | "submit" | "archive" | "restore") => void;
  onDelete: () => void;
}) {
  if (!beat) return null;
  const deletable = (["draft", "rejected", "archived"] as string[]).includes(beat.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/72 px-3 pb-3 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="beat-editor-title" className="flex max-h-[88svh] w-full max-w-[430px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.58)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="label-hw text-gold/85">Catalog Editor</div>
            <h2 id="beat-editor-title" className="mt-2 truncate text-xl font-semibold">{beat.title}</h2>
          </div>
          <button onClick={onClose} disabled={busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close beat editor"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/24 p-3">
            <div className="min-w-0"><div className="text-sm font-semibold">Marketplace status</div><div className="mt-1 text-xs text-muted-foreground">Updated {formatPortalDate(beat.updated_at)}</div></div>
            <StatusBadge status={beat.status} />
          </div>
          {beat.admin_notes && <div className="rounded-2xl border border-rec/25 bg-rec/10 p-3 text-sm leading-relaxed text-rec"><span className="font-semibold">Review feedback:</span> {beat.admin_notes}</div>}
          {beat.status === "approved" && <div className="rounded-2xl border border-gold/25 bg-gold/8 p-3 text-xs leading-relaxed text-gold">Saving changes moves this beat out of the live Marketplace until it is approved again.</div>}

          <input value={draft.title} onChange={(event) => onDraft({ ...draft, title: event.target.value })} placeholder="Beat title" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={draft.bpm} onChange={(event) => onDraft({ ...draft, bpm: event.target.value })} placeholder="BPM" inputMode="numeric" className="min-h-12 min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
            <input value={draft.musical_key} onChange={(event) => onDraft({ ...draft, musical_key: event.target.value })} placeholder="Key" className="min-h-12 min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
            <input value={draft.genre} onChange={(event) => onDraft({ ...draft, genre: event.target.value })} placeholder="Genre" className="min-h-12 min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
            <input value={draft.region} onChange={(event) => onDraft({ ...draft, region: event.target.value })} placeholder="Region" className="min-h-12 min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
          </div>
          <input value={draft.mood} onChange={(event) => onDraft({ ...draft, mood: event.target.value })} placeholder="Mood" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
          <input value={draft.tags} onChange={(event) => onDraft({ ...draft, tags: event.target.value })} placeholder="Tags, comma separated" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />

          <div className="grid grid-cols-3 gap-2">
            <PriceInput label="Lease" value={draft.lease_price} onChange={(lease_price) => onDraft({ ...draft, lease_price })} />
            <PriceInput label="Premium" value={draft.premium_price} onChange={(premium_price) => onDraft({ ...draft, premium_price })} />
            <PriceInput label="Exclusive" value={draft.exclusive_price} onChange={(exclusive_price) => onDraft({ ...draft, exclusive_price })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ProducerFileInput label="Beat audio" value={audioFile?.name ?? "Keep current audio"} accept="audio/*" onChange={onAudio} />
            <ProducerFileInput label="Release artwork" value={artworkFile?.name ?? "Keep current artwork"} accept="image/*" onChange={onArtwork} />
          </div>
          {beat.audio_url && <audio controls preload="none" src={beat.audio_url} className="h-10 w-full" />}
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4">
          {beat.status === "archived" ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onSave("restore")} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gold/25 bg-gold/8 px-4 font-semibold text-gold disabled:opacity-45"><RotateCcw className="h-4 w-4" />Restore Draft</button>
              <button onClick={onDelete} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rec/25 bg-rec/10 px-3 text-sm font-semibold text-rec disabled:opacity-45"><Trash2 className="h-4 w-4" />{deleteArmed ? "Confirm Delete" : "Delete"}</button>
            </div>
          ) : (
            <>
              {!canSubmit && <p className="mb-3 text-xs leading-relaxed text-gold/80">{submitHint}</p>}
              <div className="grid grid-cols-[44px_1fr_1fr] gap-2">
                <button onClick={() => onSave("archive")} disabled={busy} className="grid min-h-12 place-items-center rounded-2xl border border-white/10 text-muted-foreground disabled:opacity-45" aria-label="Archive beat"><Archive className="h-4 w-4" /></button>
                <button onClick={() => onSave("save")} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-muted-foreground disabled:opacity-45"><Save className="h-4 w-4" />Save Draft</button>
                <button onClick={() => onSave("submit")} disabled={busy || !canSubmit} className="gold-seal flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold disabled:opacity-45"><Send className="h-4 w-4" />Submit</button>
              </div>
              {deletable && <button onClick={onDelete} disabled={busy} className="mt-2 min-h-9 w-full text-xs font-semibold text-rec/80 disabled:opacity-45">{deleteArmed ? "Tap again to permanently delete" : "Delete permanently"}</button>}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function PlaylistComposerSheet({
  open,
  title,
  description,
  selectedIds,
  beats,
  currentStatus,
  busy,
  onTitle,
  onDescription,
  onToggle,
  onMove,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  selectedIds: string[];
  beats: ProducerBeatRow[];
  currentStatus: ProducerPlaylistRow["status"];
  busy: boolean;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onToggle: (beatId: string) => void;
  onMove: (beatId: string, direction: -1 | 1) => void;
  onClose: () => void;
  onSave: (status: ProducerPlaylistRow["status"]) => void;
}) {
  if (!open) return null;
  const selectedBeats = selectedIds.map((id) => beats.find((beat) => beat.id === id)).filter((beat): beat is ProducerBeatRow => Boolean(beat));
  const availableBeats = beats.filter((beat) => !selectedIds.includes(beat.id));
  const publishReady = selectedBeats.length > 0 && selectedBeats.every((beat) => beat.status === "approved");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/72 px-3 pb-3 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="playlist-composer-title" className="flex max-h-[88svh] w-full max-w-[430px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.58)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div><div className="label-hw text-gold/85">Collection Builder</div><h2 id="playlist-composer-title" className="mt-2 text-xl font-semibold">Shape the sequence.</h2></div>
          <button onClick={onClose} disabled={busy} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close playlist composer"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <input value={title} onChange={(event) => onTitle(event.target.value)} placeholder="Playlist name" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 outline-none" />
          <textarea value={description} onChange={(event) => onDescription(event.target.value)} placeholder="Collection description" className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/35 p-4 outline-none" />

          <div className="mt-5 flex items-center justify-between"><div className="label-hw text-gold/80">Sequence</div><span className="text-xs text-muted-foreground">{selectedBeats.length} beats</span></div>
          <div className="mt-2 space-y-2">
            {selectedBeats.map((beat, index) => (
              <div key={beat.id} className="flex items-center gap-2 rounded-2xl border border-gold/20 bg-gold/[0.06] p-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/30 text-xs font-semibold text-gold">{index + 1}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{beat.title}</div><div className="mt-0.5 text-[10px] capitalize text-muted-foreground">{beat.status}</div></div>
                <button onClick={() => onMove(beat.id, -1)} disabled={index === 0} className="grid h-8 w-8 place-items-center text-muted-foreground disabled:opacity-25" aria-label={`Move ${beat.title} up`}><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => onMove(beat.id, 1)} disabled={index === selectedBeats.length - 1} className="grid h-8 w-8 place-items-center text-muted-foreground disabled:opacity-25" aria-label={`Move ${beat.title} down`}><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => onToggle(beat.id)} className="grid h-8 w-8 place-items-center text-rec/80" aria-label={`Remove ${beat.title}`}><X className="h-4 w-4" /></button>
              </div>
            ))}
            {!selectedBeats.length && <div className="rounded-2xl border border-dashed border-white/12 p-4 text-center text-sm text-muted-foreground">Choose beats below to build the sequence.</div>}
          </div>

          <div className="mt-5 label-hw text-gold/80">Available Beats</div>
          <div className="mt-2 space-y-2">
            {availableBeats.map((beat) => (
              <button key={beat.id} onClick={() => onToggle(beat.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/24 p-3 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-gold"><Plus className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{beat.title}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{beat.status} - {beat.bpm ?? "--"} BPM</span></span>
                <StatusBadge status={beat.status} />
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4">
          {!publishReady && selectedBeats.length > 0 && <p className="mb-3 text-xs leading-relaxed text-gold/80">Every beat must be approved before this collection can go live.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onSave("draft")} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 font-semibold text-muted-foreground disabled:opacity-45"><Save className="h-4 w-4" />{currentStatus === "archived" ? "Restore Draft" : "Save Draft"}</button>
            <button onClick={() => onSave("published")} disabled={busy || !publishReady} className="gold-seal flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:opacity-40"><Eye className="h-4 w-4" />Publish</button>
          </div>
          {currentStatus !== "archived" && <button onClick={() => onSave("archived")} disabled={busy} className="mt-2 min-h-9 w-full text-xs font-semibold text-muted-foreground disabled:opacity-45">Archive collection</button>}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const approved = status === "approved";
  const submitted = status === "submitted";
  const rejected = status === "rejected";
  const archived = status === "archived";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", approved ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : submitted ? "border-gold/25 bg-gold/8 text-gold" : rejected ? "border-rec/25 bg-rec/10 text-rec" : "border-white/10 bg-white/[0.03] text-muted-foreground")}>
      {approved ? <ShieldCheck className="h-3 w-3" /> : submitted ? <Check className="h-3 w-3" /> : archived ? <Archive className="h-3 w-3" /> : <Disc3 className="h-3 w-3" />}
      {status}
    </span>
  );
}
