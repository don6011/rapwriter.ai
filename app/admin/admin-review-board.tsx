"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Loader2, PackageCheck, ShieldCheck, Sparkles, XCircle } from "lucide-react";
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
};

type ReviewStatus = "draft" | "submitted" | "approved" | "rejected";

export function AdminReviewBoard() {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "gold" | "green" | "red"; message: string } | null>(null);

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
            <h2 className="mt-2 text-2xl font-semibold">Marketplace review queue</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Approve producer profiles and submitted beats before they become public Marketplace inventory.
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
          <AdminMiniStat label="Profiles" value={String(submittedProfiles.length)} />
          <AdminMiniStat label="Beats" value={String(submittedBeats.length)} />
          <AdminMiniStat label="Featured" value={String(featuredCount)} />
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
        ) : (
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
        )}
      </div>

      <aside className="panel overflow-hidden rounded-3xl">
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
                    {product.title} · {product.price}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
          </div>
        </details>
      </aside>
    </section>
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
