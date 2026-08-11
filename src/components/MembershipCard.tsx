"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, Crown, LoaderCircle, Mic2, Sparkles, X } from "lucide-react";
import type {
  MembershipSnapshot,
  PlanDefinition,
  WorkspaceMembership,
} from "@/lib/membership";
import { withPrepStudioPresentation } from "@/lib/prep-studio-plans";
import { cn } from "@/lib/utils";

type MembershipResponse = {
  membership?: MembershipSnapshot;
  plans?: PlanDefinition[];
};

type LaunchCampaign = {
  slug: string;
  name: string;
  description: string;
  audience: "artist" | "producer";
  max_claims: number;
  claim_count: number;
  duration_days: number;
};

type MembershipView = "artist" | "producer";

type MembershipCardProps = {
  initialMembership?: MembershipSnapshot | null;
  onOpenStudio?: () => void;
  onOpenMarket?: () => void;
};

export function MembershipCard({ initialMembership = null, onOpenStudio, onOpenMarket }: MembershipCardProps) {
  const [membership, setMembership] = useState<MembershipSnapshot | null>(initialMembership);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [view, setView] = useState<MembershipView>("artist");
  const [accessGuideOpen, setAccessGuideOpen] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<LaunchCampaign[]>([]);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);

  const refreshMembership = useCallback(() => {
    return fetch("/api/membership", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as MembershipResponse | null;
        return response.ok ? payload : null;
      })
      .then((payload) => {
        if (!payload?.membership) return;
        setMembership(payload.membership);
        setPlans(payload.plans ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const load = () => {
      void refreshMembership();
    };
    load();
    const handleFocus = () => load();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshMembership]);

  useEffect(() => {
    fetch("/api/launch-campaigns", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => setCampaigns(payload?.campaigns ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (initialMembership) setMembership(initialMembership);
  }, [initialMembership]);

  const artist = membership?.artist;
  if (!artist) return <div aria-hidden="true" className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />;

  const artistPlan = withPrepStudioPresentation(artist.plan);
  const producer = membership?.producer ?? null;
  const artistUpgrades = plans
    .filter((plan) => plan.audience === "artist" && plan.metadata.retired !== true && plan.tier > artist.plan.tier)
    .map(withPrepStudioPresentation);
  const accessSummary = membershipAccessSummary(artist, producer);
  const showBillingInterval = view === "artist" && artist.source === "free" && artistUpgrades.length > 0;

  const startCheckout = async (input: { planId: string }) => {
    const busyKey = input.planId;
    setBillingBusy(busyKey);
    setBillingNotice(null);
    try {
      const response = await fetch("/api/stripe/subscriptions/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_id: input.planId, interval }),
      });
      const payload = await response.json().catch(() => ({})) as { checkout_url?: string; error?: string };
      if (!response.ok || !payload.checkout_url) throw new Error(payload.error ?? "Checkout could not be opened.");
      window.location.assign(payload.checkout_url);
    } catch (error) {
      setBillingNotice(error instanceof Error ? error.message : "Checkout could not be opened.");
      setBillingBusy(null);
    }
  };

  const openBilling = async () => {
    setBillingBusy("portal");
    setBillingNotice(null);
    try {
      const response = await fetch("/api/stripe/billing-portal", { method: "POST", credentials: "same-origin" });
      const payload = await response.json().catch(() => ({})) as { portal_url?: string; error?: string };
      if (!response.ok || !payload.portal_url) throw new Error(payload.error ?? "Billing could not be opened.");
      window.location.assign(payload.portal_url);
    } catch (error) {
      setBillingNotice(error instanceof Error ? error.message : "Billing could not be opened.");
      setBillingBusy(null);
    }
  };

  const claimCampaign = async (campaign: LaunchCampaign) => {
    setClaimBusy(campaign.slug);
    setBillingNotice(null);
    try {
      const response = await fetch("/api/launch-campaigns", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: campaign.slug }),
      });
      const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(campaignClaimMessage(payload.error));
      setCampaigns((items) => items.filter((item) => item.slug !== campaign.slug));
      await refreshMembership();
      setBillingNotice(`${campaign.name} access is active.`);
    } catch (error) {
      setBillingNotice(error instanceof Error ? error.message : "Promotional access could not be claimed.");
    } finally { setClaimBusy(null); }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gold/20 bg-[#111113] shadow-[0_14px_44px_rgba(0,0,0,0.25)]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-20 w-full items-center gap-3 px-4 py-4 text-left"
        aria-expanded={expanded}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Crown className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-hw block text-gold/80">Your Memberships</span>
          <span className="mt-1 block truncate text-sm font-semibold text-white">
            {artistPlan.name}<span className="px-1.5 text-white/25">/</span>{producer ? "Producer HQ Free" : "Producer HQ not active"}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">One account. Two independent workspaces.</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/45 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
            <MembershipTab active={view === "artist"} icon={Mic2} label="Artist" onClick={() => setView("artist")} />
            <MembershipTab active={view === "producer"} icon={BriefcaseBusiness} label="Producer" onClick={() => setView("producer")} />
          </div>

          {campaigns.filter((campaign) => view === "artist" && campaign.audience === "artist").map((campaign) => {
            const remaining = Math.max(0, campaign.max_claims - campaign.claim_count);
            return <div key={campaign.slug} className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.07] p-3">
              <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/25 bg-black/25 text-gold"><Crown className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white">{campaign.name}</span><span className="mt-1 block text-[10px] leading-4 text-white/55">{remaining.toLocaleString()} spots remaining · {campaign.duration_days} days included</span></span></div>
              <button type="button" disabled={claimBusy !== null || remaining === 0} onClick={() => claimCampaign(campaign)} className="gold-seal mt-3 min-h-10 w-full rounded-xl px-3 text-xs font-semibold disabled:opacity-40">{claimBusy === campaign.slug ? "Activating..." : "Claim founding access"}</button>
            </div>;
          })}

          <button
            type="button"
            onClick={() => setAccessGuideOpen(true)}
            className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.07] px-3 text-left"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/25 bg-black/25 text-gold">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white">See everything you unlocked</span>
              <span className="mt-0.5 block truncate text-[10px] text-white/50">{accessSummary}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-gold" />
          </button>

          <div className="mt-3 min-h-[220px]">
            {view === "artist" && (
              <WorkspacePanel
                eyebrow="RapWriter Membership"
                name={artistPlan.name}
                tagline={artistPlan.tagline}
                capabilities={[
                  ["Sharper lyrics", artist.entitlements.full_pen_view === true],
                  ["Finish faster", artist.entitlements.ghostwriter === true],
                  ["Booth Ready", artist.entitlements.advanced_booth_ready === true],
                ]}
              >
                <ArtistUsage workspace={artist} />
                {artist.provider === "stripe" && artist.cancel_at_period_end && (
                  <p className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2.5 text-xs leading-relaxed text-gold">
                    Pro stays active through {membershipDate(artist.renews_at)}. It will not renew.
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ActionButton label="Start Writer Flow" onClick={onOpenStudio} />
                  <ActionButton label="Browse beats" onClick={onOpenMarket} subtle />
                </div>
                {artist.provider === "stripe" ? (
                  <ManageButton busy={billingBusy === "portal"} disabled={billingBusy !== null} onClick={openBilling} />
                ) : artist.source === "subscription" ? (
                  <GrantedAccess onExplore={() => setAccessGuideOpen(true)} />
                ) : (
                  <UpgradeList plans={artistUpgrades} interval={interval} busy={billingBusy} onCheckout={(planId) => startCheckout({ planId })} />
                )}
              </WorkspacePanel>
            )}

            {view === "producer" && (
              producer ? (
                <WorkspacePanel
                  eyebrow="Producer HQ Membership"
                  name="Producer HQ Free"
                  tagline="Upload, sell, and understand your catalog. No monthly fee."
                  capabilities={[
                    ["Sell your sound", producer.entitlements.producer_storefront === true],
                    ["Know your audience", producer.entitlements.producer_intelligence === true],
                    ["Grow your business", producer.entitlements.promotions === true],
                  ]}
                >
                  <Link href="/producer" className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 text-sm font-semibold text-gold">
                    Open Producer HQ
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {producer.provider === "stripe" && (
                    <ManageButton busy={billingBusy === "portal"} disabled={billingBusy !== null} onClick={openBilling} />
                  )}
                </WorkspacePanel>
              ) : (
                <WorkspacePanel
                  eyebrow="Producer HQ"
                  name="Build your producer business"
                  tagline="Create a storefront, upload beats, and run your catalog with no monthly fee."
                  capabilities={[["Unlimited catalog", true], ["Full analytics", true], ["Keep 100%", true]]}
                >
                  <Link href="/producer" className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-gold px-4 text-sm font-semibold text-black">
                    Set up Producer HQ
                  </Link>
                </WorkspacePanel>
              )
            )}

          </div>

          {showBillingInterval && <BillingInterval value={interval} onChange={setInterval} />}
          {billingNotice && <p className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2.5 text-xs leading-relaxed text-gold">{billingNotice}</p>}
          <p className="mt-3 text-center text-[10px] text-white/42">RapWriter Pro upgrades your writing tools. Producer HQ stays free.</p>
        </div>
      )}
      <MembershipAccessGuide
        open={accessGuideOpen}
        artist={artist}
        producer={producer}
        onClose={() => setAccessGuideOpen(false)}
        onOpenStudio={onOpenStudio}
        onOpenMarket={onOpenMarket}
      />
    </section>
  );
}

function campaignClaimMessage(code?: string) {
  if (code === "already_claimed") return "This founding offer has already been claimed.";
  if (code === "campaign_full") return "All founding spots have been claimed.";
  if (code === "campaign_expired" || code === "campaign_inactive") return "This founding offer is no longer active.";
  return "Promotional access could not be claimed.";
}

function membershipDate(value: string | null) {
  if (!value) return "the end of this billing period";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function MembershipTab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Mic2; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold", active ? "bg-gold text-black" : "text-white/50")}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

function WorkspacePanel({ eyebrow, name, tagline, capabilities, children }: {
  eyebrow: string;
  name: string;
  tagline: string;
  capabilities: Array<[string, boolean]>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label-hw text-gold/75">{eyebrow}</div>
      <div className="mt-1 text-lg font-semibold text-white">{name}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tagline}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {capabilities.map(([label, active]) => <MembershipCapability key={label} label={label} active={active} />)}
      </div>
      {children}
    </div>
  );
}

function ArtistUsage({ workspace }: { workspace: WorkspaceMembership }) {
  const allowance = numberLimit(workspace, "ghostwriter_actions_monthly");
  const used = workspace.usage.ghostwriter_actions ?? 0;
  const unlimited = allowance === -1;
  const usagePct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Studio assists this month</span>
        <span className="font-semibold text-white">{unlimited ? `${used} / Unlimited` : `${used} / ${allowance}`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gold" style={{ width: unlimited ? "100%" : `${usagePct}%` }} />
      </div>
    </div>
  );
}

function UpgradeList({ plans, interval, busy, onCheckout }: {
  plans: PlanDefinition[];
  interval: "monthly" | "annual";
  busy: string | null;
  onCheckout: (planId: string) => void;
}) {
  if (!plans.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {plans.map((plan) => {
        const price = interval === "annual" ? plan.annual_price_cents : plan.monthly_price_cents;
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onCheckout(plan.id)}
            disabled={busy !== null}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-left disabled:opacity-60"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/25 bg-gold/10 text-gold">
              {busy === plan.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">{plan.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{plan.tagline}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-gold">{formatPlanPrice(price, interval)}</span>
          </button>
        );
      })}
    </div>
  );
}

function BillingInterval({ value, onChange }: { value: "monthly" | "annual"; onChange: (value: "monthly" | "annual") => void }) {
  return (
    <div className="mt-3 flex rounded-xl border border-white/10 bg-black/25 p-1">
      {(["monthly", "annual"] as const).map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={cn("min-h-9 flex-1 rounded-lg text-xs font-semibold capitalize", value === option ? "bg-white/10 text-white" : "text-white/45")}>
          {option}
        </button>
      ))}
    </div>
  );
}

function ManageButton({ busy, disabled, onClick }: { busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={() => void onClick()} disabled={disabled} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 text-sm font-semibold text-gold disabled:opacity-60">
      {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
      Manage billing
    </button>
  );
}

function ActionButton({ label, onClick, subtle = false }: { label: string; onClick?: () => void; subtle?: boolean }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-semibold",
        subtle ? "border border-white/10 bg-black/20 text-white/75" : "bg-gold text-black",
      )}
    >
      {label}
    </button>
  );
}

function GrantedAccess({ onExplore }: { onExplore: () => void }) {
  return (
    <button
      type="button"
      onClick={onExplore}
      className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-3 text-left"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><Check className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-emerald-300">Access granted by RapWriter</span>
        <span className="mt-0.5 block text-[10px] text-white/45">View unlocked access</span>
      </span>
      <ArrowRight className="h-4 w-4 text-emerald-300" />
    </button>
  );
}

function MembershipCapability({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl border px-2 py-2.5 text-center", active ? "border-gold/25 bg-gold/[0.08]" : "border-white/10 bg-black/20")}>
      <Sparkles className={cn("mx-auto h-3.5 w-3.5", active ? "text-gold" : "text-white/25")} />
      <div className={cn("mt-1.5 text-[10px] font-semibold leading-tight", active ? "text-white" : "text-white/45")}>{label}</div>
    </div>
  );
}

type AccessItem = {
  key: string;
  label: string;
  detail: string;
};

type AccessGroup = {
  title: string;
  items: AccessItem[];
};

function MembershipAccessGuide({
  open,
  artist,
  producer,
  onClose,
  onOpenStudio,
  onOpenMarket,
}: {
  open: boolean;
  artist: WorkspaceMembership;
  producer: WorkspaceMembership | null;
  onClose: () => void;
  onOpenStudio?: () => void;
  onOpenMarket?: () => void;
}) {
  const [workspace, setWorkspace] = useState<"artist" | "producer">("artist");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const current = workspace === "artist" ? artist : producer;
  const groups = workspace === "artist" ? artistAccessGroups(artist) : producer ? producerAccessGroups(producer) : [];
  const roomCount = numberLimit(artist, "studio_rooms");

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 px-2 pt-12 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Unlocked membership access">
      <button type="button" aria-label="Close unlocked access" onClick={onClose} className="absolute inset-0" />
      <div className="relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111113] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_rgba(0,0,0,0.72)]">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-[#111113]/95 px-4 pb-4 pt-5 backdrop-blur-xl">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><Crown className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="label-hw text-gold/80">Your unlocked access</div>
            <h2 className="mt-1 text-lg font-semibold text-white">Everything available now</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/50">Open a workspace below and start using your membership.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/55" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className={cn("grid gap-1 rounded-xl border border-white/10 bg-black/25 p-1", producer ? "grid-cols-2" : "grid-cols-1")}>
            <MembershipTab active={workspace === "artist"} icon={Mic2} label={artist.plan.name} onClick={() => setWorkspace("artist")} />
            {producer && <MembershipTab active={workspace === "producer"} icon={BriefcaseBusiness} label="Producer HQ Free" onClick={() => setWorkspace("producer")} />}
          </div>

          <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/[0.06] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="label-hw text-gold/75">{workspace === "artist" ? "RapWriter" : "Producer HQ"}</div>
                <div className="mt-1 text-lg font-semibold text-white">{workspace === "producer" ? "Producer HQ Free" : current?.plan.name}</div>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-semibold text-emerald-300">Active</span>
            </div>
            {workspace === "artist" && (
              <div className="mt-3 flex gap-2 text-[10px] text-white/55">
                <span className="rounded-full border border-white/10 px-2.5 py-1">{roomCount === -1 ? "All rooms" : `${roomCount || 1} rooms`}</span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">{numberLimit(artist, "active_projects") === -1 ? "Unlimited projects" : "Project access"}</span>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {groups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="label-hw text-gold/75">{group.title}</div>
                <div className="mt-2 divide-y divide-white/[0.07]">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex gap-3 py-2.5 first:pt-1 last:pb-1">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-300"><Check className="h-3 w-3" /></span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">{item.label}</div>
                        <div className="mt-0.5 text-[10px] leading-relaxed text-white/45">{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {workspace === "artist" ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ActionButton label="Start Writer Flow" onClick={() => { onClose(); onOpenStudio?.(); }} />
              <ActionButton label="Browse beats" onClick={() => { onClose(); onOpenMarket?.(); }} subtle />
            </div>
          ) : (
            <Link href="/producer" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-black">
              Open Producer HQ
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function enabled(workspace: WorkspaceMembership, key: string) {
  return workspace.entitlements[key] === true;
}

function activeItems(workspace: WorkspaceMembership, items: AccessItem[]) {
  return items.filter((item) => enabled(workspace, item.key));
}

function artistAccessGroups(workspace: WorkspaceMembership): AccessGroup[] {
  return [
    {
      title: "Write better",
      items: activeItems(workspace, [
        { key: "ghostwriter", label: "Ghostwriter", detail: "Develop ideas and finish sections without leaving Writer Flow." },
        { key: "full_pen_view", label: "Pen View", detail: "Inspect rhyme, structure, and line-level writing signals." },
        { key: "hook_doctor", label: "Hook Doctor", detail: "Strengthen the replay value and clarity of your hook." },
        { key: "rewrite", label: "Rewrite", detail: "Explore stronger versions while keeping your original draft." },
        { key: "producer_pass", label: "Producer Pass", detail: "Get record-focused feedback from the other side of the glass." },
        { key: "commercial_pass", label: "Commercial Pass", detail: "Review replay value and commercial song structure." },
      ]),
    },
    {
      title: "Finish the record",
      items: activeItems(workspace, [
        { key: "advanced_booth_ready", label: "Advanced Booth Ready", detail: "See what is holding the song back and what to fix next." },
        { key: "performance_coach", label: "Performance Coach", detail: "Prepare delivery, emphasis, and recording decisions." },
        { key: "version_history", label: "Version history", detail: "Return to earlier drafts as the record develops." },
        { key: "premium_exports", label: "Premium exports", detail: "Take clean, organized lyrics into the booth." },
        { key: "commercial_intelligence", label: "Commercial intelligence", detail: "Understand structure and replay signals before recording." },
      ]),
    },
    {
      title: "Studio & connections",
      items: activeItems(workspace, [
        { key: "elite_rooms", label: "Elite rooms", detail: "Use the expanded collection of immersive writing environments." },
        { key: "multi_device_cloud_sync", label: "Cloud sync", detail: "Keep projects and sessions current across devices." },
        { key: "unlimited_priority_ai", label: "Priority studio intelligence", detail: "Use the highest membership priority for studio assists." },
      ]),
    },
  ].filter((group) => group.items.length > 0);
}

function producerAccessGroups(workspace: WorkspaceMembership): AccessGroup[] {
  return [
    {
      title: "Catalog",
      items: activeItems(workspace, [
        { key: "producer_storefront", label: "Producer storefront", detail: "Publish a focused home for your sound and releases." },
        { key: "catalog_import", label: "Catalog import", detail: "Bring catalog details from the platforms you already use." },
        { key: "custom_storefront", label: "Store customization", detail: "Shape how artists experience your producer identity." },
        { key: "collections", label: "Collections", detail: "Organize beats into branded, intentional releases." },
        { key: "bundles", label: "Bundles", detail: "Package related releases and creative offers together." },
      ]),
    },
    {
      title: "Grow the business",
      items: activeItems(workspace, [
        { key: "producer_intelligence", label: "Producer intelligence", detail: "See how artists discover and use your catalog." },
        { key: "advanced_customer_insights", label: "Audience insights", detail: "Understand the artists responding to your sound." },
        { key: "promotions", label: "Promotions", detail: "Create campaigns that bring more writers to your beats." },
      ]),
    },
    {
      title: "Artist relationships",
      items: activeItems(workspace, [
        { key: "automatic_delivery", label: "Automatic delivery", detail: "Keep approved purchases and files moving cleanly." },
        { key: "custom_license_templates", label: "License templates", detail: "Prepare consistent licensing options for your catalog." },
      ]),
    },
  ].filter((group) => group.items.length > 0);
}

function membershipAccessSummary(artist: WorkspaceMembership, producer: WorkspaceMembership | null) {
  const roomCount = numberLimit(artist, "studio_rooms");
  const artistSummary = roomCount === -1 ? "all studio rooms" : `${roomCount || 1} studio rooms`;
  return producer ? `${artistSummary}, artist intelligence, and Producer HQ Free` : `${artistSummary} and your artist tools`;
}

function numberLimit(workspace: WorkspaceMembership, key: string) {
  const value = workspace.limits[key];
  return typeof value === "number" ? value : 0;
}

function formatPlanPrice(value: number | null, interval: "monthly" | "annual") {
  if (value === null) return "Unavailable";
  const dollars = value / 100;
  return interval === "annual" ? `$${dollars.toFixed(2)}/yr` : `$${dollars.toFixed(2)}/mo`;
}
