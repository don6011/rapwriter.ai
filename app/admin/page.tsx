import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { getAdminSession } from "@/lib/admin";
import type { Beat } from "@/lib/marketplace";
import { loadApprovedMarketplaceCatalog } from "@/lib/server/marketplace-catalog";
import { BrandLogo } from "@/components/BrandLogo";
import { AdminSignIn } from "./admin-sign-in";
import { AdminOpsBoard } from "./admin-ops-board";
import { AdminReviewBoard } from "./admin-review-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Control Room | RapWriter.ai",
  robots: { index: false, follow: false, nocache: true },
};

type BeatWithPreview = Beat & {
  previewUrl?: string;
  audioUrl?: string;
};

function getBeatPreview(beat: Beat) {
  const candidate = beat as BeatWithPreview;
  return candidate.previewUrl ?? candidate.audioUrl ?? "";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="label-hw">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-gold">{value}</div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

function Gate({
  title,
  body,
  detail,
  signIn,
  signInError,
}: {
  title: string;
  body: string;
  detail?: string;
  signIn?: boolean;
  signInError?: string;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
        <section className="panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <BrandLogo compact />
            <div>
              <div className="label-hw text-gold">Admin</div>
              <h1 className="text-2xl font-semibold">{title}</h1>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">{body}</p>
          {detail && (
            <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/8 p-3 font-mono text-xs leading-5 text-gold">
              {detail}
            </div>
          )}
          {signIn && <AdminSignIn error={signInError} />}
          <Link
            href="/"
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-black/35 px-4 text-sm font-semibold text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Studio
          </Link>
        </section>
      </div>
    </main>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  let adminSession: Awaited<ReturnType<typeof getAdminSession>>;
  try {
    adminSession = await getAdminSession();
  } catch {
    return (
      <Gate
        title="Supabase is not configured"
        body="Admin needs the same Supabase environment as the studio. Add the Supabase URL and publishable key, then restart the server."
        detail="NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required."
      />
    );
  }

  if (!adminSession.user) {
    return (
      <Gate
        title="Sign in required"
        body="Sign in with an account that has the database-backed admin role to open the Control Room."
        signIn
        signInError={params.error}
      />
    );
  }

  if (!adminSession.isAdmin) {
    return (
      <Gate
        title="Admin access not enabled"
        body="This account is signed in, but it has not been granted the admin role."
        detail={`Signed in as ${adminSession.user.email ?? "unknown account"}. An existing admin must grant access in the database.`}
      />
    );
  }

  const userEmail = adminSession.user.email ?? "Admin";
  const catalog = await loadApprovedMarketplaceCatalog(200).catch(() => ({ beats: [], producers: [] }));
  const { beats, producers } = catalog;
  const previewReady = beats.filter((beat) => Boolean(getBeatPreview(beat))).length;
  const measuredBeats = beats.filter((beat) => beat.boothReadyScore > 0);
  const avgScore = measuredBeats.length
    ? Math.round(measuredBeats.reduce((sum, beat) => sum + beat.boothReadyScore, 0) / measuredBeats.length)
    : 0;
  const activeWriters = beats.reduce((sum, beat) => sum + beat.writingNow, 0);
  const totalPlays = beats.reduce((sum, beat) => sum + beat.plays, 0);
  const topBeats = [...beats].sort((a, b) => b.plays - a.plays).slice(0, 6);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="brushed sticky top-0 z-20 border-b border-border/80 px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo compact />
            <div>
              <div className="label-hw hidden text-gold sm:block">RapWriter Admin</div>
              <h1 className="whitespace-nowrap text-lg font-semibold sm:text-xl">Control Room</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 text-sm font-semibold text-gold"
            >
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>
            <form action="/api/admin/sign-out" method="post">
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-black/35 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
                title="Lock the Control Room and sign out"
              >
                <LockKeyhole className="h-4 w-4" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6">
        {(beats.length > 0 || producers.length > 0) && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatCard label="Beat Catalog" value={String(beats.length)} note={`${previewReady} previews wired for playback.`} />
            <StatCard label="Producer Roster" value={String(producers.length)} note="Approved public producer storefronts." />
            <StatCard label="Total Plays" value={formatNumber(totalPlays)} note="Recorded Marketplace beat plays." />
            <StatCard label="Writers Active" value={String(activeWriters)} note={measuredBeats.length ? `Average Booth Ready score is ${avgScore}/100.` : "Session scoring begins after real beat usage."} />
          </section>
        )}

        <AdminReviewBoard />

        {beats.length > 0 && <AdminOpsBoard beats={beats} />}

        <details className="panel mt-5 rounded-2xl">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <span className="min-w-0 flex-1 text-sm font-semibold">Admin access</span>
            <span className="max-w-[55%] truncate text-xs text-muted-foreground">{userEmail}</span>
          </summary>
          <div className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">
            Admin authority is stored in Supabase and checked again on every protected request.
          </div>
        </details>

        {topBeats.length > 0 && <section className="mt-5 panel rounded-3xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="label-hw text-gold">Beat Catalog</div>
              <h2 className="mt-2 text-2xl font-semibold">Operational view</h2>
            </div>
            <div className="hidden rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:block">
              Top {topBeats.length} by plays
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border">
            <div className="hidden grid-cols-[1.3fr_0.7fr_0.7fr_0.6fr_1fr] gap-3 border-b border-border bg-black/30 px-4 py-3 text-xs text-muted-foreground md:grid">
              <span>Beat</span>
              <span>Region</span>
              <span>Signal</span>
              <span>Preview</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-border">
              {topBeats.map((beat) => {
                const preview = getBeatPreview(beat);
                return (
                  <article key={beat.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.3fr_0.7fr_0.7fr_0.6fr_1fr] md:items-center">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 font-mono text-sm text-gold">
                        {beat.glyph}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{beat.title}</div>
                        <div className="text-xs text-muted-foreground">{beat.producer} · {beat.bpm} BPM · {beat.key}</div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{beat.region}</div>
                    <div className="text-sm">
                      <span className="text-gold">{beat.boothReadyScore}</span>
                      <span className="text-muted-foreground">/100 · {formatNumber(beat.plays)}</span>
                    </div>
                    <div>
                      {preview ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/8 px-2.5 py-1 text-xs text-gold">
                          <LockKeyhole className="h-3 w-3" />
                          Needs file
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 rounded-xl border border-border bg-black/24 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {preview || `supabase://beat-previews/${beat.id}.mp3`}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>}

        {producers.length > 0 && <section className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {producers.map((producer) => (
            <article key={producer.id} className="panel rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/25 bg-gold/8 font-mono text-sm text-gold">
                  {producer.glyph}
                </span>
                <div>
                  <div className="font-semibold">{producer.name}</div>
                  <div className="text-xs text-muted-foreground">{producer.city}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border bg-black/24 p-3">
                  <div className="label-hw">Sales</div>
                  <div className="mt-1 text-gold">{formatNumber(producer.sales)}</div>
                </div>
                <div className="rounded-xl border border-border bg-black/24 p-3">
                  <div className="label-hw">Rating</div>
                  <div className="mt-1 text-gold">{producer.rating > 0 ? producer.rating.toFixed(1) : "New"}</div>
                </div>
              </div>
            </article>
          ))}
        </section>}
      </div>
    </main>
  );
}
