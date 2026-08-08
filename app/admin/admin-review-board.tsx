"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Clock3, FileAudio, Loader2, LockKeyhole, PackageCheck, Plus, Search, ShieldCheck, Sparkles, Trash2, Upload, UserPlus, XCircle } from "lucide-react";
import { createProducerBeatPreview } from "@/lib/audio-preview-client";
import { marketplaceProducts } from "@/lib/product-catalog";
import { cn } from "@/lib/utils";

type ProducerProfile = {
  id: string;
  display_name: string;
  handle: string | null;
  city: string | null;
  bio: string | null;
  genres: string[];
  status: "draft" | "submitted" | "approved" | "rejected";
  verified: boolean;
  is_public: boolean;
  updated_at: string;
};

type ProducerBeat = {
  id: string;
  title: string;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  mood: string | null;
  region: string | null;
  tags: string[];
  license_tiers: Array<{ license: string; price: number }>;
  status: "draft" | "submitted" | "approved" | "rejected";
  admin_notes: string | null;
  metadata: { featured?: boolean; preview_path?: string; preview_duration_seconds?: number } | null;
  audio_url: string | null;
  preview_url: string | null;
  preview_ready: boolean;
  preview_duration_seconds: number | null;
  artwork_url: string | null;
  updated_at: string;
  producer_profiles?: {
    display_name?: string | null;
    handle?: string | null;
    city?: string | null;
    status?: string | null;
    verified?: boolean | null;
  } | null;
};

type AdminPayload = {
  configured: boolean;
  error?: string;
  profiles: ProducerProfile[];
  beats: ProducerBeat[];
  starter_beats: StarterBeat[];
  accounts: AdminAccount[];
  activity?: ReviewEvent[];
  permissions?: { can_manage_inventory: boolean; can_manage_users: boolean };
  security?: { admin_count: number; moderator_count: number };
};

type StarterBeat = {
  id: string;
  slug: string;
  title: string;
  producer_name: string;
  producer_profile_id: string | null;
  source_type: "suno_licensed" | "producer_donated";
  rights_holder: string;
  duration_seconds: number;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  mood: string | null;
  tags: string[];
  collection_slug: string | null;
  energy: "low" | "medium" | "high" | null;
  writing_fit: string[];
  attribution: string;
  status: "draft" | "published" | "archived";
  is_active: boolean;
  is_featured: boolean;
  preview_seconds: number;
  audio_url: string | null;
  artwork_url: string | null;
  updated_at: string;
};

type AdminAccount = {
  id: string;
  email: string | null;
  has_producer_profile: boolean;
};

type ReviewEvent = {
  id: string;
  target_type: "profile" | "beat";
  target_id: string;
  from_status: string;
  to_status: "approved" | "rejected";
  notes: string | null;
  blockers: string[];
  created_at: string;
};

type ReviewStatus = "draft" | "submitted" | "approved" | "rejected";
type AdminView = "review" | "inventory";
type InventoryType = "producer_profile" | "producer_beat" | "starter_beat";

export function AdminReviewBoard() {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "gold" | "green" | "red"; message: string } | null>(null);
  const [adminView, setAdminView] = useState<AdminView>("review");

  const submittedProfiles = useMemo(() => payload?.profiles.filter((profile) => profile.status === "submitted") ?? [], [payload]);
  const submittedBeats = useMemo(() => payload?.beats.filter((beat) => beat.status === "submitted") ?? [], [payload]);
  const approvedBeats = useMemo(() => payload?.beats.filter((beat) => beat.status === "approved") ?? [], [payload]);
  const featuredCount = approvedBeats.filter((beat) => Boolean(beat.metadata?.featured)).length;

  useEffect(() => {
    void loadReviewQueue();
  }, []);

  async function loadReviewQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load review queue.");
      setPayload(data);
      if (data.configured === false) setNotice({ tone: "red", message: data.error ?? "Admin database access is not configured." });
    } catch (err) {
      setNotice({ tone: "red", message: err instanceof Error ? err.message : "Could not load review queue." });
    } finally {
      setLoading(false);
    }
  }

  async function review(target: "profile" | "beat", id: string, status: ReviewStatus, featured = false) {
    setBusyId(id);
    setNotice({ tone: "gold", message: "Saving review..." });
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, id, status, featured, admin_notes: notes[id]?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save review.");
      setNotice({ tone: "green", message: status === "approved" ? "Approved for Marketplace." : "Review saved." });
      setNotes((current) => ({ ...current, [id]: "" }));
      await loadReviewQueue();
    } catch (err) {
      setNotice({ tone: "red", message: err instanceof Error ? err.message : "Could not save review." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="panel min-w-0 rounded-3xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="label-hw text-gold">Control Room</div>
            <h2 className="mt-2 text-2xl font-semibold">{adminView === "review" ? "Marketplace review queue" : "Marketplace inventory"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {adminView === "review"
                ? "Approve producer profiles and submitted beats before they become public Marketplace inventory."
                : "Add, inspect, and remove every database-backed item that can appear in the Marketplace or Beat Locker."}
            </p>
          </div>
          <button
            onClick={() => void loadReviewQueue()}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gold/25 bg-gold/8 px-3 text-xs font-semibold text-gold"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <AdminMiniStat label={adminView === "review" ? "Profiles" : "Producers"} value={String(adminView === "review" ? submittedProfiles.length : payload?.profiles.length ?? 0)} />
          <AdminMiniStat label={adminView === "review" ? "Beats" : "Producer beats"} value={String(adminView === "review" ? submittedBeats.length : payload?.beats.length ?? 0)} />
          <AdminMiniStat label={adminView === "review" ? "Featured" : "Starter beats"} value={String(adminView === "review" ? featuredCount : payload?.starter_beats?.length ?? 0)} />
        </div>

        <div className={cn("mt-4 grid rounded-2xl border border-border bg-black/24 p-1", payload?.permissions?.can_manage_inventory ? "grid-cols-2" : "grid-cols-1")}>
          <button type="button" onClick={() => setAdminView("review")} className={cn("min-h-10 rounded-xl text-xs font-semibold transition-colors", adminView === "review" ? "bg-gold text-black" : "text-muted-foreground")}>Review queue</button>
          {payload?.permissions?.can_manage_inventory && <button type="button" onClick={() => setAdminView("inventory")} className={cn("min-h-10 rounded-xl text-xs font-semibold transition-colors", adminView === "inventory" ? "bg-gold text-black" : "text-muted-foreground")}>Inventory</button>}
        </div>

        {notice && (
          <div
            className={cn(
              "mt-4 rounded-2xl border px-4 py-3 text-sm",
              notice.tone === "red"
                ? "border-rec/25 bg-rec/10 text-rec"
                : notice.tone === "green"
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                  : "border-gold/25 bg-gold/8 text-gold",
            )}
          >
            {notice.message}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-56 place-items-center">
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
          </div>
        ) : adminView === "review" ? (
          <div className="mt-5 space-y-4">
            <QueueBlock title="Producer Profiles" empty="No submitted producer profiles.">
              {submittedProfiles.map((profile) => (
                <article key={profile.id} className="rounded-2xl border border-border bg-black/24 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{profile.display_name}</h3>
                        <StatusBadge status={profile.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[profile.handle ? `@${profile.handle}` : null, profile.city].filter(Boolean).join(" - ") || "Producer details pending"}
                      </p>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{profile.bio || "No bio yet."}</p>
                      <TagRow tags={profile.genres} />
                      <ReviewNote value={notes[profile.id] ?? ""} onChange={(value) => setNotes((current) => ({ ...current, [profile.id]: value }))} />
                    </div>
                    <ReviewActions
                      busy={busyId === profile.id}
                      canReject={Boolean(notes[profile.id]?.trim())}
                      onApprove={() => void review("profile", profile.id, "approved")}
                      onReject={() => void review("profile", profile.id, "rejected")}
                    />
                  </div>
                </article>
              ))}
            </QueueBlock>

            <QueueBlock title="Submitted Beats" empty="No submitted beats waiting for review.">
              {submittedBeats.map((beat) => (
                <article key={beat.id} className="rounded-2xl border border-border bg-black/24 p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{beat.title}</h3>
                        <StatusBadge status={beat.status} />
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                          beat.preview_ready
                            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                            : "border-gold/25 bg-gold/8 text-gold",
                        )}>
                          {beat.preview_ready ? <ShieldCheck className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {beat.preview_ready ? "Preview Ready" : "Needs Preview"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[beat.producer_profiles?.display_name, beat.region, beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key].filter(Boolean).join(" - ")}
                      </p>
                      <TagRow tags={[beat.genre, beat.mood, ...beat.tags].filter(Boolean) as string[]} />
                      {beat.preview_url && (
                        <div className="mt-3 max-w-xl">
                          <div className="label-hw mb-1 text-emerald-300">30-second Store preview</div>
                          <audio controls src={beat.preview_url} className="h-9 w-full" />
                        </div>
                      )}
                      {beat.audio_url && (
                        <details className="mt-3 max-w-xl rounded-xl border border-white/10 bg-black/24">
                          <summary className="flex min-h-10 cursor-pointer list-none items-center px-3 text-xs font-semibold text-muted-foreground">Review full master</summary>
                          <div className="border-t border-white/10 p-3">
                            <audio controls src={beat.audio_url} className="h-9 w-full" />
                          </div>
                        </details>
                      )}
                      {!beat.preview_ready && <p className="mt-3 text-xs leading-5 text-gold">Create the secure Store preview before approving this release.</p>}
                      <ReviewNote value={notes[beat.id] ?? ""} onChange={(value) => setNotes((current) => ({ ...current, [beat.id]: value }))} />
                    </div>
                    <div className="flex flex-col gap-2 lg:w-44">
                      <button
                        onClick={() => void review("beat", beat.id, "approved", true)}
                        disabled={busyId === beat.id || !beat.preview_ready}
                        className="gold-seal inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Approve + Feature
                      </button>
                      <ReviewActions
                        busy={busyId === beat.id}
                        canApprove={beat.preview_ready}
                        canReject={Boolean(notes[beat.id]?.trim())}
                        onApprove={() => void review("beat", beat.id, "approved")}
                        onReject={() => void review("beat", beat.id, "rejected")}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </QueueBlock>
          </div>
        ) : (
          <AdminInventoryManager
            payload={payload}
            onChanged={loadReviewQueue}
            onNotice={setNotice}
          />
        )}
      </div>

      <aside className="min-w-0 space-y-4">
        <section className="panel rounded-3xl p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="label-hw text-gold">Private Access</div>
              <h3 className="mt-1 text-lg font-semibold">Owner-controlled</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Every review request verifies the signed-in account and its database role before elevated access is used.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-black/24 px-3 py-2.5"><span className="block text-[10px] text-muted-foreground">Admins</span><span className="mt-1 block font-mono text-sm text-emerald-300">{payload?.security?.admin_count ?? 0}</span></div>
            <div className="rounded-xl border border-border bg-black/24 px-3 py-2.5"><span className="block text-[10px] text-muted-foreground">Moderators</span><span className="mt-1 block font-mono text-sm text-gold">{payload?.security?.moderator_count ?? 0}</span></div>
          </div>
        </section>

        <section className="panel overflow-hidden rounded-3xl">
          <div className="flex min-h-20 items-center gap-3 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold">
              <Clock3 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="label-hw block text-gold">Audit Trail</span>
              <span className="mt-1 block text-lg font-semibold">Recent decisions</span>
            </span>
            <span className="text-xs tabular-nums text-gold">{payload?.activity?.length ?? 0}</span>
          </div>
          <div className="border-t border-border px-5 pb-5">
            <div className="divide-y divide-border">
              {(payload?.activity ?? []).slice(0, 8).map((event) => (
                <ReviewActivity key={event.id} event={event} payload={payload} />
              ))}
              {!payload?.activity?.length && (
                <p className="py-4 text-sm leading-6 text-muted-foreground">Approval history will appear after the first review.</p>
              )}
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden rounded-3xl">
          <details>
            <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold">
                <PackageCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="label-hw block text-gold">Marketplace Control</span>
                <span className="mt-1 block text-lg font-semibold">Product inventory</span>
              </span>
              <span className="text-xs tabular-nums text-gold">{marketplaceProducts.length}</span>
            </summary>
            <div className="border-t border-border px-5 pb-5">
              <p className="py-4 text-sm leading-6 text-muted-foreground">
                Paid catalog items currently available across Market and Locker.
              </p>
              <div className="space-y-3">
                {Object.entries(groupProducts()).map(([type, products]) => (
                  <div key={type} className="rounded-2xl border border-border bg-black/24 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 text-gold" />
                        <span className="text-sm font-semibold">{labelProductType(type)}</span>
                      </div>
                      <span className="text-xs tabular-nums text-gold">{products.length}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {products.map((product) => (
                        <span key={product.id} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-muted-foreground">
                          {product.title} {"\u00b7"} {product.price}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </section>
      </aside>
    </section>
  );
}

function AdminInventoryManager({
  payload,
  onChanged,
  onNotice,
}: {
  payload: AdminPayload | null;
  onChanged: () => Promise<void>;
  onNotice: (notice: { tone: "gold" | "green" | "red"; message: string } | null) => void;
}) {
  const [createType, setCreateType] = useState<InventoryType>("producer_beat");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [armedRemoval, setArmedRemoval] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [starterStatus, setStarterStatus] = useState<"all" | StarterBeat["status"]>("all");
  const [starterCollection, setStarterCollection] = useState("all");
  const [producerDuration, setProducerDuration] = useState("");
  const [producerPreview, setProducerPreview] = useState<{ file: File; durationSeconds: number } | null>(null);
  const [producerPreviewBusy, setProducerPreviewBusy] = useState(false);
  const [starterDuration, setStarterDuration] = useState("");
  const [claimSelections, setClaimSelections] = useState<Record<string, string>>({});
  const [claimReasons, setClaimReasons] = useState<Record<string, string>>({});
  const [armedClaim, setArmedClaim] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const profiles = (payload?.profiles ?? []).filter((profile) => !normalizedQuery || [profile.display_name, profile.handle, profile.city, profile.status].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  const beats = (payload?.beats ?? []).filter((beat) => !normalizedQuery || [beat.title, beat.genre, beat.mood, beat.region, beat.producer_profiles?.display_name, beat.status].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  const allStarterBeats = payload?.starter_beats ?? [];
  const starterCollections = Array.from(new Set(allStarterBeats.map((beat) => beat.collection_slug).filter((value): value is string => Boolean(value)))).sort();
  const starterBeats = allStarterBeats.filter((beat) => {
    const matchesQuery = !normalizedQuery || [beat.title, beat.producer_name, beat.genre, beat.mood, beat.collection_slug, beat.source_type].some((value) => value?.toLowerCase().includes(normalizedQuery));
    const matchesStatus = starterStatus === "all" || beat.status === starterStatus;
    const matchesCollection = starterCollection === "all" || beat.collection_slug === starterCollection;
    return matchesQuery && matchesStatus && matchesCollection;
  });
  const starterBeatGroups = Array.from(
    starterBeats.reduce((groups, beat) => {
      const collection = beat.collection_slug || "uncategorized";
      groups.set(collection, [...(groups.get(collection) ?? []), beat]);
      return groups;
    }, new Map<string, StarterBeat[]>()),
  );
  const eligibleAccounts = (payload?.accounts ?? []).filter((account) => !account.has_producer_profile);

  async function createContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("content_type", createType);
    if (createType === "producer_beat") {
      if (!producerPreview) {
        onNotice({ tone: "red", message: "Wait for the secure 30-second preview to finish." });
        return;
      }
      formData.set("preview_audio", producerPreview.file);
      formData.set("preview_duration_seconds", String(producerPreview.durationSeconds));
    }
    setBusyId("create");
    onNotice({ tone: "gold", message: "Adding Marketplace inventory..." });
    try {
      const response = await fetch("/api/admin/marketplace", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Marketplace inventory could not be added.");
      form.reset();
      setProducerDuration("");
      setProducerPreview(null);
      setStarterDuration("");
      onNotice({ tone: "green", message: contentTypeLabel(createType) + " added." });
      await onChanged();
    } catch (error) {
      onNotice({ tone: "red", message: error instanceof Error ? error.message : "Marketplace inventory could not be added." });
    } finally {
      setBusyId(null);
    }
  }

  async function repairProducerPreview(beat: ProducerBeat) {
    if (!beat.audio_url) {
      onNotice({ tone: "red", message: "The producer master is unavailable." });
      return;
    }
    const key = `producer_beat:${beat.id}:preview`;
    setBusyId(key);
    onNotice({ tone: "gold", message: `Preparing a secure preview for ${beat.title}...` });
    try {
      const masterResponse = await fetch(beat.audio_url, { cache: "no-store" });
      if (!masterResponse.ok) throw new Error("The producer master could not be loaded.");
      const masterBlob = await masterResponse.blob();
      const masterFile = new File([masterBlob], `${beat.id}-master`, {
        type: masterBlob.type.startsWith("audio/") ? masterBlob.type : "audio/mpeg",
      });
      const preview = await createProducerBeatPreview(masterFile);
      const formData = new FormData();
      formData.set("id", beat.id);
      formData.set("preview_audio", preview.file);
      formData.set("preview_duration_seconds", String(preview.durationSeconds));
      const response = await fetch("/api/admin/marketplace", { method: "PUT", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The secure preview could not be saved.");
      onNotice({ tone: "green", message: `${beat.title} now has a secure 30-second Store preview.` });
      await onChanged();
    } catch (error) {
      onNotice({ tone: "red", message: error instanceof Error ? error.message : "The secure preview could not be created." });
    } finally {
      setBusyId(null);
    }
  }

  async function removeContent(contentType: InventoryType, id: string, label: string) {
    const key = `${contentType}:${id}`;
    if (armedRemoval !== key) {
      setArmedRemoval(key);
      onNotice({ tone: "gold", message: `Tap Confirm remove to permanently delete ${label}.` });
      return;
    }

    setBusyId(key);
    onNotice({ tone: "gold", message: `Removing ${label}...` });
    try {
      const response = await fetch("/api/admin/marketplace", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: contentType, id, confirmation: "REMOVE" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Inventory could not be removed.");
      setArmedRemoval(null);
      onNotice({ tone: data.cleanup_warning ? "gold" : "green", message: data.cleanup_warning ? `Removed. Storage warning: ${data.cleanup_warning}` : `${label} removed.` });
      await onChanged();
    } catch (error) {
      onNotice({ tone: "red", message: error instanceof Error ? error.message : "Inventory could not be removed." });
    } finally {
      setBusyId(null);
    }
  }

  async function prepareProducerAudio(file: File | null) {
    setProducerDuration("");
    setProducerPreview(null);
    if (!file) return;
    setProducerPreviewBusy(true);
    onNotice({ tone: "gold", message: "Preparing secure 30-second Store preview..." });
    try {
      const [duration, preview] = await Promise.all([readAudioDuration(file), createProducerBeatPreview(file)]);
      setProducerDuration(String(duration));
      setProducerPreview(preview);
      onNotice({ tone: "green", message: "Beat master and secure Store preview are ready." });
    } catch (error) {
      onNotice({ tone: "red", message: error instanceof Error ? error.message : "The beat audio could not be prepared." });
    } finally {
      setProducerPreviewBusy(false);
    }
  }

  async function updateStarterBeat(beat: StarterBeat, status: StarterBeat["status"], featured = beat.is_featured) {
    const key = `starter_beat:${beat.id}:${status}`;
    setBusyId(key);
    onNotice({ tone: "gold", message: status === "published" ? `Publishing ${beat.title}...` : status === "archived" ? `Archiving ${beat.title}...` : `Moving ${beat.title} to drafts...` });
    try {
      const response = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "editorial", content_type: "starter_beat", id: beat.id, status, featured }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Starter beat could not be updated.");
      onNotice({ tone: "green", message: status === "published" ? `${beat.title} is live in every Beat Locker.` : status === "archived" ? `${beat.title} is hidden from artists.` : `${beat.title} is now a private draft.` });
      await onChanged();
    } catch (error) {
      onNotice({ tone: "red", message: error instanceof Error ? error.message : "Starter beat could not be updated." });
    } finally {
      setBusyId(null);
    }
  }

  async function updateStarterBeatProducer(beat: StarterBeat, producerProfileId: string | null) {
    const reason = (claimReasons[beat.id] ?? "").trim();
    const key = `starter_beat:${beat.id}:producer`;
    const targetName = producerProfileId
      ? payload?.profiles.find((profile) => profile.id === producerProfileId)?.display_name ?? "this producer"
      : "the linked producer";

    if (reason.length < 8) {
      onNotice({ tone: "red", message: "Add a verification reason of at least 8 characters." });
      return;
    }
    if (armedClaim !== key) {
      setArmedClaim(key);
      onNotice({
        tone: "gold",
        message: producerProfileId
          ? `Confirm that ${targetName} owns or supplied ${beat.title}.`
          : `Confirm removal of ${beat.title} from ${targetName}'s catalog.`,
      });
      return;
    }

    setBusyId(key);
    try {
      const response = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_producer",
          content_type: "starter_beat",
          id: beat.id,
          producer_profile_id: producerProfileId,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Producer catalog credit could not be updated.");
      setArmedClaim(null);
      setClaimReasons((current) => ({ ...current, [beat.id]: "" }));
      onNotice({ tone: "green", message: data.message ?? "Producer catalog credit updated." });
      await onChanged();
    } catch (error) {
      onNotice({ tone: "red", message: error instanceof Error ? error.message : "Producer catalog credit could not be updated." });
    } finally {
      setBusyId(null);
    }
  }

  async function captureDuration(file: File | null, setter: (value: string) => void) {
    if (!file) {
      setter("");
      return;
    }
    try {
      setter(String(await readAudioDuration(file)));
    } catch {
      setter("");
      onNotice({ tone: "red", message: "The audio duration could not be read. Try another MP3, M4A, WAV, OGG, or WebM file." });
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <details className="overflow-hidden rounded-2xl border border-gold/20 bg-[linear-gradient(145deg,rgba(246,199,72,0.08),rgba(0,0,0,0.24))]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold"><Plus className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="label-hw block text-gold">Add inventory</span><span className="mt-1 block text-sm font-semibold">Publish or prepare Marketplace content</span></span>
        </summary>
        <form onSubmit={(event) => void createContent(event)} className="space-y-3 border-t border-border p-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-black/30 p-1">
            {(["producer_profile", "producer_beat", "starter_beat"] as InventoryType[]).map((type) => (
              <button key={type} type="button" onClick={() => setCreateType(type)} className={cn("min-h-10 rounded-lg px-1 text-[10px] font-semibold", createType === type ? "bg-gold text-black" : "text-muted-foreground")}>{type === "producer_profile" ? "Profile" : type === "producer_beat" ? "Beat" : "Starter"}</button>
            ))}
          </div>

          {createType === "producer_profile" && (
            <>
              <AdminSelect name="owner_id" label="RapWriter account" required defaultValue="">
                <option value="" disabled>Select account</option>
                {eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.email || account.id}</option>)}
              </AdminSelect>
              {!eligibleAccounts.length && <p className="text-xs leading-5 text-muted-foreground">Every loaded account already has a producer profile.</p>}
              <AdminField name="display_name" label="Producer name" placeholder="Producer or studio name" required />
              <div className="grid grid-cols-2 gap-2"><AdminField name="handle" label="Handle" placeholder="808baron" required /><AdminField name="city" label="City" placeholder="Atlanta" /></div>
              <AdminField name="genres" label="Genres" placeholder="Trap, Melodic Rap" required />
              <AdminTextarea name="bio" label="Producer bio" placeholder="Describe the producer's sound and creative point of view." />
            </>
          )}

          {createType === "producer_beat" && (
            <>
              <AdminSelect name="producer_profile_id" label="Producer profile" required defaultValue="">
                <option value="" disabled>Select producer</option>
                {(payload?.profiles ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name} · {profile.status}</option>)}
              </AdminSelect>
              <AdminField name="title" label="Beat title" placeholder="Smoke & Velvet" required />
              <div className="grid grid-cols-3 gap-2"><AdminField name="bpm" label="BPM" placeholder="84" inputMode="numeric" /><AdminField name="musical_key" label="Key" placeholder="F# Minor" /><AdminField name="duration_seconds" label="Seconds" placeholder="222" inputMode="numeric" value={producerDuration} onChange={setProducerDuration} required /></div>
              <div className="grid grid-cols-2 gap-2"><AdminField name="genre" label="Genre" placeholder="Trap Soul" /><AdminField name="mood" label="Mood" placeholder="Late Night" /><AdminField name="region" label="Region" placeholder="Atlanta" /><AdminField name="tags" label="Tags" placeholder="Pain, Storytelling" /></div>
              <div className="grid grid-cols-3 gap-2"><AdminField name="lease_price" label="Lease" placeholder="49" defaultValue="49" inputMode="numeric" /><AdminField name="premium_price" label="Premium" placeholder="149" defaultValue="149" inputMode="numeric" /><AdminField name="exclusive_price" label="Exclusive" placeholder="899" defaultValue="899" inputMode="numeric" /></div>
              <AdminFileInput name="audio" label="Beat audio" accept="audio/*" required onChange={(file) => void prepareProducerAudio(file)} />
              {producerPreview && <div className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-3 text-xs font-semibold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />30-second Store preview ready</div>}
              <AdminFileInput name="artwork" label="Release artwork" accept="image/jpeg,image/png,image/webp" />
              <div className="grid grid-cols-2 gap-2"><AdminCheckbox name="publish" label="Publish now" detail="Requires an approved profile and complete release." /><AdminCheckbox name="featured" label="Feature beat" detail="Applied only when publishing." /></div>
            </>
          )}

          {createType === "starter_beat" && (
            <>
              <AdminField name="title" label="Starter beat title" placeholder="City Shadows" required />
              <AdminField name="slug" label="Slug" placeholder="city-shadows" required />
              <div className="grid grid-cols-2 gap-2"><AdminField name="producer_name" label="Producer credit" placeholder="N0izepack Ent" required /><AdminField name="rights_holder" label="Rights holder" placeholder="N0izepack Ent" required /></div>
              <AdminSelect name="source_type" label="Rights source" required defaultValue="suno_licensed"><option value="suno_licensed">Suno licensed</option><option value="producer_donated">Producer donated</option></AdminSelect>
              <div className="grid grid-cols-3 gap-2"><AdminField name="bpm" label="BPM" placeholder="88" inputMode="numeric" /><AdminField name="musical_key" label="Key" placeholder="A Minor" /><AdminField name="duration_seconds" label="Seconds" placeholder="180" inputMode="numeric" value={starterDuration} onChange={setStarterDuration} required /></div>
              <div className="grid grid-cols-2 gap-2"><AdminField name="genre" label="Genre" placeholder="Trap" /><AdminField name="mood" label="Mood" placeholder="Dark" /></div>
              <div className="grid grid-cols-2 gap-2">
                <AdminSelect name="collection_slug" label="Collection" defaultValue="midnight-sessions"><option value="midnight-sessions">Midnight Sessions</option><option value="memphis-pressure">Memphis Pressure</option><option value="story-mode">Story Mode</option><option value="trap-energy">Trap Energy</option><option value="commercial-drive">Commercial Drive</option></AdminSelect>
                <AdminSelect name="energy" label="Energy" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></AdminSelect>
              </div>
              <AdminField name="tags" label="Discovery tags" placeholder="Trap, Starter, Dark" />
              <AdminField name="writing_fit" label="Best for" placeholder="Hooks, Storytelling, Performance practice" />
              <AdminTextarea name="attribution" label="Attribution" placeholder="Included with RapWriter. Courtesy of..." />
              <AdminFileInput name="audio" label="Starter beat audio" accept="audio/*" required onChange={(file) => void captureDuration(file, setStarterDuration)} />
              <AdminFileInput name="artwork" label="Beat artwork" accept="image/jpeg,image/png,image/webp" />
              <div className="grid grid-cols-2 gap-2"><AdminCheckbox name="publish" label="Publish now" detail="Adds it to every artist's included beats." /><AdminCheckbox name="featured" label="Feature beat" detail="Pins it near the top while published." /></div>
            </>
          )}

          <button disabled={busyId === "create" || (createType === "producer_beat" && producerPreviewBusy)} className="gold-seal flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">{busyId === "create" || producerPreviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Add {contentTypeLabel(createType)}</button>
        </form>
      </details>

      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-black/24 px-4">
        <Search className="h-4 w-4 text-gold" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Marketplace inventory" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>

      <InventorySection icon={UserPlus} title="Producer profiles" count={profiles.length} empty="No producer profiles match this search.">
        {profiles.map((profile) => (
          <InventoryRow key={profile.id} title={profile.display_name} detail={[profile.handle ? `@${profile.handle}` : null, profile.city, profile.status].filter(Boolean).join(" · ")} status={profile.status}>
            <RemoveInventoryButton armed={armedRemoval === `producer_profile:${profile.id}`} busy={busyId === `producer_profile:${profile.id}`} label={`Remove ${profile.display_name}`} onClick={() => void removeContent("producer_profile", profile.id, profile.display_name)} warning="Removing a producer also removes every beat and playlist they own." />
          </InventoryRow>
        ))}
      </InventorySection>

      <InventorySection icon={FileAudio} title="Producer beats" count={beats.length} empty="No producer beats match this search.">
        {beats.map((beat) => (
          <InventoryRow key={beat.id} title={beat.title} detail={[beat.producer_profiles?.display_name, beat.genre, beat.bpm ? `${beat.bpm} BPM` : null].filter(Boolean).join(" · ")} status={beat.status} audioUrl={beat.audio_url}>
            <span className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-semibold uppercase tracking-[0.1em]",
              beat.preview_ready
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                : "border-gold/25 bg-gold/8 text-gold",
            )}>
              {beat.preview_ready ? <ShieldCheck className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {beat.preview_ready ? "Preview Ready" : "Needs Preview"}
            </span>
            <InventoryActionButton
              busy={busyId === `producer_beat:${beat.id}:preview`}
              label={beat.preview_ready ? "Regenerate Preview" : "Create Preview"}
              onClick={() => void repairProducerPreview(beat)}
            />
            <RemoveInventoryButton armed={armedRemoval === `producer_beat:${beat.id}`} busy={busyId === `producer_beat:${beat.id}`} label={`Remove ${beat.title}`} onClick={() => void removeContent("producer_beat", beat.id, beat.title)} />
          </InventoryRow>
        ))}
      </InventorySection>

      <div className="rounded-2xl border border-border bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div>
            <div className="label-hw text-gold">Starter release desk</div>
            <p className="mt-1 text-xs text-muted-foreground">{starterBeats.length} shown of {allStarterBeats.length}</p>
          </div>
          {(starterStatus !== "all" || starterCollection !== "all") && (
            <button type="button" onClick={() => { setStarterStatus("all"); setStarterCollection("all"); }} className="min-h-9 rounded-xl border border-white/10 px-3 text-[10px] font-semibold text-muted-foreground">
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={starterStatus} onChange={(event) => setStarterStatus(event.target.value as "all" | StarterBeat["status"])} aria-label="Filter starter beats by status" className="min-h-11 rounded-xl border border-white/10 bg-[#09090a] px-3 text-xs text-white outline-none focus:border-gold/45">
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </select>
          <select value={starterCollection} onChange={(event) => setStarterCollection(event.target.value)} aria-label="Filter starter beats by collection" className="min-h-11 rounded-xl border border-white/10 bg-[#09090a] px-3 text-xs text-white outline-none focus:border-gold/45">
            <option value="all">All collections</option>
            {starterCollections.map((collection) => <option key={collection} value={collection}>{formatCollectionName(collection)}</option>)}
          </select>
        </div>
      </div>

      <InventorySection icon={PackageCheck} title="RapWriter starter beats" count={starterBeats.length} empty="No starter beats match these filters.">
        {starterBeatGroups.map(([collection, collectionBeats]) => (
          <section key={collection} className="space-y-2">
            <div className="flex items-center justify-between gap-3 px-1 pt-1">
              <span className="label-hw text-white/55">{formatCollectionName(collection)}</span>
              <span className="text-[10px] tabular-nums text-gold/75">{collectionBeats.length}</span>
            </div>
            {collectionBeats.map((beat) => {
          const linkedProfile = payload?.profiles.find((profile) => profile.id === beat.producer_profile_id);
          const verifiedProfiles = (payload?.profiles ?? []).filter((profile) => profile.status === "approved" && profile.verified);
          const selectedProfileId = claimSelections[beat.id] ?? "";
          const claimKey = `starter_beat:${beat.id}:producer`;
          return (
            <InventoryRow key={beat.id} title={beat.title} detail={[beat.producer_name, linkedProfile ? `catalog: ${linkedProfile.display_name}` : beat.source_type === "producer_donated" ? "catalog unclaimed" : null, beat.collection_slug?.replaceAll("-", " "), beat.genre, beat.is_featured ? "featured" : null].filter(Boolean).join(" · ")} status={beat.status} audioUrl={beat.audio_url} artworkUrl={beat.artwork_url}>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {beat.status !== "published" && <InventoryActionButton busy={busyId === `starter_beat:${beat.id}:published`} label="Publish" onClick={() => void updateStarterBeat(beat, "published")} />}
                {beat.status === "published" && <InventoryActionButton busy={busyId === `starter_beat:${beat.id}:published`} label={beat.is_featured ? "Unfeature" : "Feature"} onClick={() => void updateStarterBeat(beat, "published", !beat.is_featured)} />}
                {beat.status !== "archived" && <InventoryActionButton busy={busyId === `starter_beat:${beat.id}:archived`} label="Archive" onClick={() => void updateStarterBeat(beat, "archived", false)} muted />}
                <RemoveInventoryButton armed={armedRemoval === `starter_beat:${beat.id}`} busy={busyId === `starter_beat:${beat.id}`} label={`Remove ${beat.title}`} onClick={() => void removeContent("starter_beat", beat.id, beat.title)} />
              </div>
              {beat.source_type === "producer_donated" && (
                <details className="mt-3 rounded-xl border border-white/10 bg-black/24">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold">
                    <span>{linkedProfile ? `Verified catalog · ${linkedProfile.display_name}` : "Verify producer ownership"}</span>
                    <ShieldCheck className={cn("h-4 w-4", linkedProfile ? "text-emerald-300" : "text-gold")} />
                  </summary>
                  <div className="space-y-2 border-t border-white/10 p-3">
                    {!linkedProfile && (
                      <select
                        value={selectedProfileId}
                        onChange={(event) => {
                          setClaimSelections((current) => ({ ...current, [beat.id]: event.target.value }));
                          setArmedClaim(null);
                        }}
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-[#09090a] px-3 text-xs text-white outline-none focus:border-gold/45"
                      >
                        <option value="">Select verified producer</option>
                        {verifiedProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}{profile.handle ? ` · @${profile.handle}` : ""}</option>)}
                      </select>
                    )}
                    <input
                      value={claimReasons[beat.id] ?? ""}
                      onChange={(event) => {
                        setClaimReasons((current) => ({ ...current, [beat.id]: event.target.value }));
                        setArmedClaim(null);
                      }}
                      placeholder={linkedProfile ? "Reason for unlinking" : "How identity and ownership were verified"}
                      className="min-h-11 w-full rounded-xl border border-white/10 bg-[#09090a] px-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-gold/45"
                    />
                    <button
                      type="button"
                      disabled={busyId === claimKey || (!linkedProfile && !selectedProfileId)}
                      onClick={() => void updateStarterBeatProducer(beat, linkedProfile ? null : selectedProfileId)}
                      className={cn("min-h-11 w-full rounded-xl border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40", armedClaim === claimKey ? "border-gold bg-gold text-black" : linkedProfile ? "border-red-400/25 bg-red-500/8 text-red-200" : "border-gold/30 bg-gold/10 text-gold")}
                    >
                      {busyId === claimKey ? "Updating..." : armedClaim === claimKey ? "Confirm catalog change" : linkedProfile ? "Unlink producer" : "Link verified producer"}
                    </button>
                    {!verifiedProfiles.length && !linkedProfile && <p className="text-[11px] leading-5 text-muted-foreground">Approve and verify the producer profile before linking donated beats.</p>}
                  </div>
                </details>
              )}
            </InventoryRow>
          );
            })}
          </section>
        ))}
      </InventorySection>
    </div>
  );
}

function InventorySection({ icon: Icon, title, count, empty, children }: { icon: typeof PackageCheck; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <details open className="overflow-hidden rounded-2xl border border-border bg-black/20">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4">
        <Icon className="h-4 w-4 text-gold" /><span className="min-w-0 flex-1 text-sm font-semibold">{title}</span><span className="text-xs tabular-nums text-gold">{count}</span>
      </summary>
      <div className="space-y-2 border-t border-border p-3">{count ? children : <p className="p-2 text-sm text-muted-foreground">{empty}</p>}</div>
    </details>
  );
}

function InventoryRow({ title, detail, status, audioUrl, artworkUrl, children }: { title: string; detail: string; status: string; audioUrl?: string | null; artworkUrl?: string | null; children: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#101012] p-3">
      <div className="flex items-start gap-3">
        {artworkUrl ? (
          <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-lg border border-white/10 bg-cover bg-center" style={{ backgroundImage: `url('${artworkUrl}')` }} />
        ) : (
          <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-gold/55"><FileAudio className="h-5 w-5" /></span>
        )}
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{title}</h3><span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{status}</span></div><p className="mt-1 truncate text-xs capitalize text-muted-foreground">{detail || "Details pending"}</p></div>
      </div>
      <div className="mt-3">{children}</div>
      {audioUrl && <audio controls preload="none" src={audioUrl} className="mt-3 h-8 w-full" />}
    </article>
  );
}

function InventoryActionButton({ busy, label, muted = false, onClick }: { busy: boolean; label: string; muted?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={cn("flex min-h-9 items-center justify-center rounded-xl border px-2.5 text-[10px] font-semibold disabled:opacity-50", muted ? "border-white/10 text-muted-foreground" : "border-gold/30 bg-gold/8 text-gold")}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : label}
    </button>
  );
}

function RemoveInventoryButton({ armed, busy, label, warning, onClick }: { armed: boolean; busy: boolean; label: string; warning?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} title={warning} aria-label={label} className={cn("flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-semibold disabled:opacity-50", armed ? "border-rec/35 bg-rec/12 text-rec" : "border-white/10 text-muted-foreground")}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{armed ? "Confirm" : "Remove"}
    </button>
  );
}

function AdminField({ name, label, value, onChange, ...props }: { name: string; label: string; value?: string; onChange?: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "value" | "onChange">) {
  return (
    <label className="block"><span className="label-hw text-gold/75">{label}</span><input name={name} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} {...props} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm outline-none focus:border-gold/35" /></label>
  );
}

function AdminTextarea({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return <label className="block"><span className="label-hw text-gold/75">{label}</span><textarea name={name} placeholder={placeholder} maxLength={1000} className="mt-2 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-gold/35" /></label>;
}

function AdminSelect({ name, label, children, ...props }: { name: string; label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <label className="block"><span className="label-hw text-gold/75">{label}</span><select name={name} {...props} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#0a0a0b] px-3 text-sm outline-none focus:border-gold/35">{children}</select></label>;
}

function AdminFileInput({ name, label, accept, required, onChange }: { name: string; label: string; accept: string; required?: boolean; onChange?: (file: File | null) => void }) {
  return (
    <label className="flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-3"><Upload className="h-4 w-4 text-gold" /><span className="min-w-0 flex-1 text-sm font-semibold">{label}</span><span className="text-[10px] text-muted-foreground">Choose file</span><input name={name} type="file" accept={accept} required={required} className="sr-only" onChange={(event) => onChange?.(event.target.files?.[0] ?? null)} /></label>
  );
}

function AdminCheckbox({ name, label, detail }: { name: string; label: string; detail: string }) {
  return <label className="flex min-h-16 cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-black/28 p-3"><input name={name} type="checkbox" value="true" className="mt-1 accent-[#f6c748]" /><span><span className="block text-xs font-semibold">{label}</span><span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{detail}</span></span></label>;
}

function contentTypeLabel(type: InventoryType) {
  if (type === "producer_profile") return "producer profile";
  if (type === "producer_beat") return "producer beat";
  return "starter beat";
}

function formatCollectionName(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readAudioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const finish = (callback: () => void) => {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      callback();
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration);
      if (!Number.isFinite(duration) || duration < 1 || duration > 7200) return finish(() => reject(new Error("Invalid duration")));
      finish(() => resolve(duration));
    };
    audio.onerror = () => finish(() => reject(new Error("Unreadable audio")));
    audio.src = url;
  });
}

function ReviewActivity({ event, payload }: { event: ReviewEvent; payload: AdminPayload | null }) {
  const target = event.target_type === "profile"
    ? payload?.profiles.find((profile) => profile.id === event.target_id)?.display_name
    : payload?.beats.find((beat) => beat.id === event.target_id)?.title;
  const approved = event.to_status === "approved";
  const when = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.created_at));

  return (
    <div className="flex gap-3 py-3">
      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", approved ? "bg-emerald-400" : "bg-rec")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="truncate text-sm font-semibold">
            {target ?? (event.target_type === "profile" ? "Producer profile" : "Beat submission")}
          </div>
          <time className="shrink-0 text-[10px] text-muted-foreground">{when}</time>
        </div>
        <div className={cn("mt-1 text-xs capitalize", approved ? "text-emerald-300" : "text-rec")}>{event.to_status}</div>
        {event.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{event.notes}</p>}
      </div>
    </div>
  );
}

function AdminMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-black/24 p-3">
      <div className="text-2xl font-semibold text-gold">{value}</div>
      <div className="label-hw mt-1">{label}</div>
    </div>
  );
}

function QueueBlock({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <div className="mb-2 label-hw text-gold/85">{title}</div>
      <div className="space-y-3">{hasItems ? children : <div className="rounded-2xl border border-border bg-black/24 p-4 text-sm text-muted-foreground">{empty}</div>}</div>
    </section>
  );
}

function ReviewNote({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Review note (required for rejection)"
      maxLength={1000}
      className="mt-3 min-h-20 w-full max-w-2xl resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-gold/35"
    />
  );
}

function ReviewActions({ busy, canApprove = true, canReject, onApprove, onReject }: { busy: boolean; canApprove?: boolean; canReject: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onApprove}
        disabled={busy || !canApprove}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 disabled:opacity-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approve
      </button>
      <button
        onClick={onReject}
        disabled={busy || !canReject}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rec/25 bg-rec/10 px-3 text-xs font-semibold text-rec disabled:opacity-50"
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const approved = status === "approved";
  const submitted = status === "submitted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
        approved ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : submitted ? "border-gold/25 bg-gold/8 text-gold" : "border-white/10 bg-white/[0.03] text-muted-foreground",
      )}
    >
      {approved ? <ShieldCheck className="h-3 w-3" /> : <Award className="h-3 w-3" />}
      {status}
    </span>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  const clean = tags.filter(Boolean).slice(0, 8);
  if (!clean.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {clean.map((tag) => (
        <span key={tag} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-muted-foreground">
          {tag}
        </span>
      ))}
    </div>
  );
}

function groupProducts() {
  return marketplaceProducts.reduce<Record<string, typeof marketplaceProducts>>((acc, product) => {
    acc[product.type] = acc[product.type] ?? [];
    acc[product.type].push(product);
    return acc;
  }, {});
}

function labelProductType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
