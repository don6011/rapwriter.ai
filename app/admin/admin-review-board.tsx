"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Clock3, FileAudio, Loader2, LockKeyhole, PackageCheck, Plus, Search, ShieldCheck, Sparkles, Trash2, Upload, UserPlus, XCircle } from "lucide-react";
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
  metadata: { featured?: boolean } | null;
  audio_url: string | null;
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
  security?: { admin_count: number };
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
  attribution: string;
  is_active: boolean;
  audio_url: string | null;
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
    <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="panel rounded-3xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="label-hw text-gold">Admin V2</div>
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
          <AdminMiniStat label={adminView === "review" ? "Beats" : "Catalog"} value={String(adminView === "review" ? submittedBeats.length : payload?.beats.length ?? 0)} />
          <AdminMiniStat label={adminView === "review" ? "Featured" : "Starter"} value={String(adminView === "review" ? featuredCount : payload?.starter_beats?.length ?? 0)} />
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-2xl border border-border bg-black/24 p-1">
          <button type="button" onClick={() => setAdminView("review")} className={cn("min-h-10 rounded-xl text-xs font-semibold transition-colors", adminView === "review" ? "bg-gold text-black" : "text-muted-foreground")}>Review queue</button>
          <button type="button" onClick={() => setAdminView("inventory")} className={cn("min-h-10 rounded-xl text-xs font-semibold transition-colors", adminView === "inventory" ? "bg-gold text-black" : "text-muted-foreground")}>Inventory</button>
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
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[beat.producer_profiles?.display_name, beat.region, beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key].filter(Boolean).join(" - ")}
                      </p>
                      <TagRow tags={[beat.genre, beat.mood, ...beat.tags].filter(Boolean) as string[]} />
                      {beat.audio_url && <audio controls src={beat.audio_url} className="mt-3 h-9 w-full max-w-xl" />}
                      <ReviewNote value={notes[beat.id] ?? ""} onChange={(value) => setNotes((current) => ({ ...current, [beat.id]: value }))} />
                    </div>
                    <div className="flex flex-col gap-2 lg:w-44">
                      <button
                        onClick={() => void review("beat", beat.id, "approved", true)}
                        disabled={busyId === beat.id}
                        className="gold-seal inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Approve + Feature
                      </button>
                      <ReviewActions
                        busy={busyId === beat.id}
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

      <aside className="space-y-4">
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
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-black/24 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">Privileged accounts</span>
            <span className="font-mono text-sm text-emerald-300">{payload?.security?.admin_count ?? 0}</span>
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
  const [producerDuration, setProducerDuration] = useState("");
  const [starterDuration, setStarterDuration] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const profiles = (payload?.profiles ?? []).filter((profile) => !normalizedQuery || [profile.display_name, profile.handle, profile.city, profile.status].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  const beats = (payload?.beats ?? []).filter((beat) => !normalizedQuery || [beat.title, beat.genre, beat.mood, beat.region, beat.producer_profiles?.display_name, beat.status].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  const starterBeats = (payload?.starter_beats ?? []).filter((beat) => !normalizedQuery || [beat.title, beat.producer_name, beat.genre, beat.mood, beat.source_type].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  const eligibleAccounts = (payload?.accounts ?? []).filter((account) => !account.has_producer_profile);

  async function createContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("content_type", createType);
    setBusyId("create");
    onNotice({ tone: "gold", message: "Adding Marketplace inventory..." });
    try {
      const response = await fetch("/api/admin/marketplace", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Marketplace inventory could not be added.");
      form.reset();
      setProducerDuration("");
      setStarterDuration("");
      onNotice({ tone: "green", message: contentTypeLabel(createType) + " added." });
      await onChanged();
    } catch (error) {
      onNotice({ tone: "red", message: error instanceof Error ? error.message : "Marketplace inventory could not be added." });
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
      <details className="overflow-hidden rounded-2xl border border-gold/20 bg-[linear-gradient(145deg,rgba(255,176,32,0.08),rgba(0,0,0,0.24))]">
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
              <AdminField name="display_name" label="Producer name" placeholder="808 Baron" required />
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
              <AdminFileInput name="audio" label="Beat audio" accept="audio/*" required onChange={(file) => void captureDuration(file, setProducerDuration)} />
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
              <AdminField name="tags" label="Discovery tags" placeholder="Trap, Starter, Dark" />
              <AdminTextarea name="attribution" label="Attribution" placeholder="Included with RapWriter. Courtesy of..." />
              <AdminFileInput name="audio" label="Starter beat audio" accept="audio/*" required onChange={(file) => void captureDuration(file, setStarterDuration)} />
            </>
          )}

          <button disabled={busyId === "create"} className="gold-seal flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">{busyId === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Add {contentTypeLabel(createType)}</button>
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
            <RemoveInventoryButton armed={armedRemoval === `producer_beat:${beat.id}`} busy={busyId === `producer_beat:${beat.id}`} label={`Remove ${beat.title}`} onClick={() => void removeContent("producer_beat", beat.id, beat.title)} />
          </InventoryRow>
        ))}
      </InventorySection>

      <InventorySection icon={PackageCheck} title="RapWriter starter beats" count={starterBeats.length} empty="No starter beats match this search.">
        {starterBeats.map((beat) => (
          <InventoryRow key={beat.id} title={beat.title} detail={[beat.producer_name, beat.genre, beat.source_type.replaceAll("_", " ")].filter(Boolean).join(" · ")} status={beat.is_active ? "active" : "hidden"} audioUrl={beat.audio_url}>
            <RemoveInventoryButton armed={armedRemoval === `starter_beat:${beat.id}`} busy={busyId === `starter_beat:${beat.id}`} label={`Remove ${beat.title}`} onClick={() => void removeContent("starter_beat", beat.id, beat.title)} />
          </InventoryRow>
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

function InventoryRow({ title, detail, status, audioUrl, children }: { title: string; detail: string; status: string; audioUrl?: string | null; children: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#101012] p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{title}</h3><span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{status}</span></div><p className="mt-1 truncate text-xs capitalize text-muted-foreground">{detail || "Details pending"}</p></div>
        {children}
      </div>
      {audioUrl && <audio controls preload="none" src={audioUrl} className="mt-3 h-8 w-full" />}
    </article>
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
  return <label className="flex min-h-16 cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-black/28 p-3"><input name={name} type="checkbox" value="true" className="mt-1 accent-[#ffb020]" /><span><span className="block text-xs font-semibold">{label}</span><span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{detail}</span></span></label>;
}

function contentTypeLabel(type: InventoryType) {
  if (type === "producer_profile") return "producer profile";
  if (type === "producer_beat") return "producer beat";
  return "starter beat";
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

function ReviewActions({ busy, canReject, onApprove, onReject }: { busy: boolean; canReject: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
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
