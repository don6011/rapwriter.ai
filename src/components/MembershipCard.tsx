"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Crown, LoaderCircle, Sparkles } from "lucide-react";
import type { MembershipSnapshot, PlanDefinition, WorkspaceMembership } from "@/lib/membership";
import { prepStudioTier, withPrepStudioPresentation } from "@/lib/prep-studio-plans";
import { cn } from "@/lib/utils";

type MembershipResponse = {
  membership?: MembershipSnapshot;
  plans?: PlanDefinition[];
};

export function MembershipCard() {
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/membership", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as MembershipResponse | { error?: string } | null;
        return response.ok ? payload as MembershipResponse : null;
      })
      .then((payload) => {
        if (active && payload?.membership) {
          setMembership(payload.membership);
          setPlans(payload.plans ?? []);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const artist = membership?.artist;
  if (!artist) return <div aria-hidden="true" className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />;
  const artistPlan = withPrepStudioPresentation(artist.plan);

  const allowance = numberLimit(artist, "ghostwriter_actions_monthly");
  const used = artist.usage.ghostwriter_actions ?? 0;
  const usagePct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  const hasGhostwriter = artist.entitlements.ghostwriter === true;
  const artistUpgrades = plans
    .filter((plan) => plan.audience === "artist" && plan.tier > artist.plan.tier)
    .map(withPrepStudioPresentation);

  const startCheckout = async (planId: string) => {
    setBillingBusy(planId);
    setBillingNotice(null);
    try {
      const response = await fetch("/api/stripe/subscriptions/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_id: planId, interval }),
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
          <span className="label-hw block text-gold/80">Prep Studio&trade; Membership</span>
          <span className="mt-1 block truncate text-sm font-semibold text-white">{artistPlan.name}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{artistPlan.tagline}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/45 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">
          {hasGhostwriter ? (
            <>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Studio assists this month</span>
                <span className="font-semibold text-white">{used} / {allowance}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gold" style={{ width: `${usagePct}%` }} />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-gold/15 bg-gold/[0.05] px-3 py-2.5 text-xs text-white/65">
              Pro helps you finish songs faster, sharpen lyrics, and leave the session Booth Ready&trade;.
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MembershipCapability label="Sharper lyrics" active={artist.entitlements.full_pen_view === true} />
            <MembershipCapability label="Finish faster" active={hasGhostwriter} />
            <MembershipCapability label="Booth Ready" active={artist.entitlements.advanced_booth_ready === true} />
          </div>

          {membership?.producer && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Producer HQ</span>
              <span className="text-xs font-semibold text-gold">{membership.producer.plan.name}</span>
            </div>
          )}

          {artist.source === "subscription" ? (
            <button
              type="button"
              onClick={() => void openBilling()}
              disabled={billingBusy !== null}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 text-sm font-semibold text-gold disabled:opacity-60"
            >
              {billingBusy === "portal" && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Manage membership
            </button>
          ) : artistUpgrades.length > 0 ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex rounded-xl border border-white/10 bg-black/25 p-1">
                {(["monthly", "annual"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setInterval(option)}
                    className={cn("min-h-9 flex-1 rounded-lg text-xs font-semibold capitalize", interval === option ? "bg-gold text-black" : "text-white/55")}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="mt-2 space-y-2">
                {artistUpgrades.map((plan) => {
                  const price = interval === "annual" ? plan.annual_price_cents : plan.monthly_price_cents;
                  const presentation = prepStudioTier(plan.id);
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => void startCheckout(plan.id)}
                      disabled={billingBusy !== null}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-left disabled:opacity-60"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/25 bg-gold/10 text-gold">
                        {billingBusy === plan.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-white">
                          {plan.name}
                          {presentation?.featured && <span className="rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[8px] uppercase text-gold">Recommended</span>}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">{presentation?.outcome ?? plan.tagline}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-gold">
                        {formatPlanPrice(price, interval)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[10px] text-white/42">Projects remain saved when you change or cancel a plan.</p>
            </div>
          ) : null}

          {billingNotice && <p className="mt-3 text-xs leading-relaxed text-gold">{billingNotice}</p>}
        </div>
      )}
    </section>
  );
}

function MembershipCapability({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl border px-2 py-2.5 text-center", active ? "border-gold/25 bg-gold/[0.08]" : "border-white/10 bg-black/20")}>
      <Sparkles className={cn("mx-auto h-3.5 w-3.5", active ? "text-gold" : "text-white/25")} />
      <div className={cn("mt-1.5 truncate text-[10px] font-semibold", active ? "text-white" : "text-white/45")}>{label}</div>
    </div>
  );
}

function numberLimit(workspace: WorkspaceMembership, key: string) {
  const value = workspace.limits[key];
  return typeof value === "number" && value >= 0 ? value : 0;
}

function formatPlanPrice(value: number | null, interval: "monthly" | "annual") {
  if (value === null) return "Unavailable";
  const dollars = value / 100;
  return interval === "annual" ? `$${dollars.toFixed(0)}/yr` : `$${dollars.toFixed(2)}/mo`;
}
