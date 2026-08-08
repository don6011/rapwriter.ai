"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminSubscription = {
  id: string;
  plan_id: string;
  plan_name: string;
  audience: "artist" | "producer";
  provider: string;
  current_period_end: string | null;
};

type AdminUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  artist_name: string | null;
  account_type: string;
  roles: string[];
  status: "active" | "suspended" | "blocked";
  status_reason: string | null;
  internal_note: string | null;
  status_expires_at: string | null;
  subscriptions: AdminSubscription[];
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
};

type AccountEvent = {
  id: string;
  subject_id: string;
  action: string;
  reason: string;
  created_at: string;
};

type PremiumPlan = {
  id: string;
  audience: "artist" | "producer";
  name: string;
};

type UserPayload = {
  users: AdminUser[];
  events: AccountEvent[];
  plans: PremiumPlan[];
  viewer_id: string;
  pagination: { page: number; per_page: number; total: number; has_more: boolean };
};

type AccountAction =
  | "moderator_granted"
  | "moderator_revoked"
  | "premium_granted"
  | "premium_revoked"
  | "account_suspended"
  | "account_blocked"
  | "account_restored";

type PendingAction = {
  action: AccountAction;
  title: string;
  description: string;
  confirmLabel: string;
  details?: Record<string, unknown>;
  destructive?: boolean;
};

export function AdminUserManagement() {
  const [payload, setPayload] = useState<UserPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [page, setPage] = useState(1);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [planId, setPlanId] = useState("");
  const [premiumDays, setPremiumDays] = useState("30");
  const [suspensionDays, setSuspensionDays] = useState("7");
  const [toast, setToast] = useState<{ tone: "green" | "red"; message: string } | null>(null);

  const selected = payload?.users.find((user) => user.id === selectedId) ?? null;
  const selectedEvents = useMemo(
    () => (payload?.events ?? []).filter((event) => event.subject_id === selected?.id).slice(0, 12),
    [payload?.events, selected?.id],
  );
  const totalPages = Math.max(1, Math.ceil((payload?.pagination.total ?? 0) / (payload?.pagination.per_page ?? 50)));

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set("query", query);
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Accounts could not be loaded.");
      setPayload(data);
      setSelectedId((current) => current && data.users.some((user: AdminUser) => user.id === current) ? current : null);
    } catch (error) {
      showToast("red", error instanceof Error ? error.message : "Accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!planId && payload?.plans[0]) setPlanId(payload.plans[0].id);
  }, [payload?.plans, planId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(tone: "green" | "red", message: string) {
    setToast({ tone, message });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setSelectedId(null);
    setQuery(queryDraft.trim());
  }

  function openAction(action: PendingAction) {
    setReason("");
    setInternalNote("");
    setPendingAction(action);
  }

  async function executeAction() {
    if (!selected || !pendingAction || reason.trim().length < 8) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selected.id,
          action: pendingAction.action,
          reason: reason.trim(),
          internal_note: internalNote.trim() || undefined,
          ...pendingAction.details,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The account action could not be completed.");
      const completed = pendingAction.title;
      setPendingAction(null);
      setReason("");
      setInternalNote("");
      await loadUsers();
      showToast("green", `${completed} completed. The account and audit history are updated.`);
    } catch (error) {
      showToast("red", error instanceof Error ? error.message : "The account action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-5 overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="label-hw text-gold">Account Operations</div>
          <h2 className="mt-2 text-2xl font-semibold">Users and access</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Select an account to manage premium access, moderator permissions, or account standing.
          </p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-gold/8 px-3 py-2 text-xs text-gold">{payload?.pagination.total ?? 0} accounts</div>
      </div>

      <form onSubmit={submitSearch} className="flex gap-2 border-b border-border p-4">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-black/28 px-3">
          <Search className="h-4 w-4 text-gold" />
          <input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Search email or artist name" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <button className="min-h-11 rounded-xl border border-gold/25 bg-gold/8 px-4 text-xs font-semibold text-gold">Search</button>
      </form>

      {loading && !payload ? (
        <div className="grid min-h-56 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-gold" /></div>
      ) : (
        <div>
          <div className="divide-y divide-border">
            {(payload?.users ?? []).map((user) => (
              <button key={user.id} type="button" onClick={() => setSelectedId(user.id)} className="flex min-h-[72px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-gold/[0.05] sm:px-5">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-xs font-semibold", user.status === "blocked" ? "border-rec/30 bg-rec/10 text-rec" : user.status === "suspended" ? "border-gold/30 bg-gold/10 text-gold" : "border-white/10 bg-white/[0.03] text-muted-foreground")}>{initials(user.artist_name || user.display_name || user.email || "RW")}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.artist_name || user.display_name || user.email || "RapWriter member"}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{user.email || user.id}</span></span>
                <span className="hidden flex-wrap justify-end gap-1 sm:flex">{user.roles.filter((role) => role !== "artist").map((role) => <span key={role} className="rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase text-muted-foreground">{role}</span>)}</span>
                <span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold uppercase", user.status === "blocked" ? "border-rec/30 text-rec" : user.status === "suspended" ? "border-gold/30 text-gold" : "border-emerald-400/20 text-emerald-300")}>{user.status}</span>
                <span className="hidden text-[10px] font-semibold text-gold sm:inline">Manage</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gold" />
              </button>
            ))}
            {!payload?.users.length && <p className="p-6 text-sm leading-6 text-muted-foreground">No accounts match this search.</p>}
          </div>
          {!query && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border p-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-border disabled:opacity-30" aria-label="Previous account page"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <button type="button" disabled={!payload?.pagination.has_more} onClick={() => setPage((current) => current + 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-border disabled:opacity-30" aria-label="Next account page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      )}

      {typeof document !== "undefined" && selected && payload && createPortal(
        <AccountDrawer
          user={selected}
          viewerId={payload.viewer_id}
          events={selectedEvents}
          plans={payload.plans}
          planId={planId}
          premiumDays={premiumDays}
          suspensionDays={suspensionDays}
          busy={busy}
          onPlanChange={setPlanId}
          onPremiumDaysChange={setPremiumDays}
          onSuspensionDaysChange={setSuspensionDays}
          onAction={openAction}
          onClose={() => setSelectedId(null)}
        />,
        document.body,
      )}

      {typeof document !== "undefined" && pendingAction && selected && createPortal(
        <ConfirmationDialog
          action={pendingAction}
          user={selected}
          reason={reason}
          internalNote={internalNote}
          busy={busy}
          onReasonChange={setReason}
          onInternalNoteChange={setInternalNote}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void executeAction()}
        />,
        document.body,
      )}

      {typeof document !== "undefined" && toast && createPortal(
        <div className={cn("fixed left-1/2 top-5 z-[110] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl", toast.tone === "green" ? "border-emerald-400/30 bg-[#07130f]/95 text-emerald-200" : "border-rec/30 bg-[#180b0d]/95 text-rec")} role="status" aria-live="polite">
          {toast.tone === "green" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
          <span className="min-w-0 flex-1 text-sm leading-5">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
        </div>,
        document.body,
      )}
    </section>
  );
}

function AccountDrawer({
  user,
  viewerId,
  events,
  plans,
  planId,
  premiumDays,
  suspensionDays,
  busy,
  onPlanChange,
  onPremiumDaysChange,
  onSuspensionDaysChange,
  onAction,
  onClose,
}: {
  user: AdminUser;
  viewerId: string;
  events: AccountEvent[];
  plans: PremiumPlan[];
  planId: string;
  premiumDays: string;
  suspensionDays: string;
  busy: boolean;
  onPlanChange: (value: string) => void;
  onPremiumDaysChange: (value: string) => void;
  onSuspensionDaysChange: (value: string) => void;
  onAction: (action: PendingAction) => void;
  onClose: () => void;
}) {
  const isOwner = user.roles.includes("admin");
  const isSelf = user.id === viewerId;
  const isModerator = user.roles.includes("moderator");
  const adminGrants = user.subscriptions.filter((subscription) => subscription.provider === "admin");
  const paidMemberships = user.subscriptions.filter((subscription) => subscription.provider === "stripe");
  const selectedPlan = plans.find((plan) => plan.id === planId);

  return (
    <div className="fixed inset-0 z-[60] bg-black/78 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_90px_rgba(0,0,0,0.72)] sm:inset-y-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="account-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-border p-4 sm:p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-sm font-semibold text-gold">{initials(user.artist_name || user.display_name || user.email || "RW")}</span>
          <div className="min-w-0 flex-1"><div className="label-hw text-gold">Manage Account</div><h3 id="account-drawer-title" className="mt-1 truncate text-xl font-semibold">{user.artist_name || user.display_name || "RapWriter member"}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{user.email || user.id}</p></div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Close account manager"><X className="h-4 w-4" /></button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap gap-1.5">{user.roles.map((role) => <span key={role} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] uppercase text-muted-foreground">{role}</span>)}<span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold uppercase", user.status === "blocked" ? "border-rec/30 text-rec" : user.status === "suspended" ? "border-gold/30 text-gold" : "border-emerald-400/20 text-emerald-300")}>{user.status}</span></div>

          {user.status !== "active" && <div className={cn("mb-4 rounded-2xl border p-4", user.status === "blocked" ? "border-rec/25 bg-rec/[0.07]" : "border-gold/25 bg-gold/[0.07]")}><div className="flex items-center gap-2 text-sm font-semibold"><Ban className="h-4 w-4" />Account {user.status}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{user.status_reason}</p>{user.status_expires_at && <p className="mt-2 text-[10px] text-gold">Ends {formatDate(user.status_expires_at)}</p>}</div>}

          <div className="space-y-3">
            <OperationBlock icon={Crown} title="Premium access" detail="Grant support access without affecting a paid Stripe membership.">
              {paidMemberships.length > 0 && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-[10px] text-emerald-300">Paid membership: {paidMemberships.map((item) => item.plan_name).join(", ")}. Billing remains customer-controlled.</div>}
              {adminGrants.length > 0 && <div className="mt-3 space-y-2">{adminGrants.map((grant) => <div key={grant.id} className="flex items-center gap-3 rounded-xl border border-gold/20 bg-gold/[0.05] p-3"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-gold">{grant.plan_name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{grant.current_period_end ? `Until ${formatDate(grant.current_period_end)}` : "No expiration"}</span></span><button type="button" disabled={busy} onClick={() => onAction({ action: "premium_revoked", title: `Revoke ${grant.plan_name}`, description: `Remove only the admin-granted ${grant.audience} membership. Paid subscriptions are untouched.`, confirmLabel: "Revoke premium", details: { audience: grant.audience }, destructive: true })} className="min-h-9 rounded-lg border border-rec/20 px-3 text-[10px] font-semibold text-rec disabled:opacity-40">Revoke</button></div>)}</div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_0.55fr_auto]">
                <select value={planId} onChange={(event) => onPlanChange(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#09090a] px-3 text-xs">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
                <select value={premiumDays} onChange={(event) => onPremiumDaysChange(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#09090a] px-3 text-xs"><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="">No expiry</option></select>
                <button type="button" disabled={busy || !selectedPlan} onClick={() => selectedPlan && onAction({ action: "premium_granted", title: `Grant ${selectedPlan.name}`, description: `${selectedPlan.name} will be active ${premiumDays ? `for ${premiumDays} days` : "without an expiration"}.`, confirmLabel: "Grant premium", details: { plan_id: selectedPlan.id, duration_days: premiumDays ? Number(premiumDays) : null } })} className="gold-seal min-h-11 rounded-xl px-4 text-xs font-semibold disabled:opacity-40">Grant premium</button>
              </div>
            </OperationBlock>

            <OperationBlock icon={UserCog} title="Moderator access" detail="Moderators review producer submissions. User, premium, and inventory controls stay admin-only.">
              {isOwner || isSelf ? <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] text-muted-foreground">Owner accounts are protected from staff-role changes.</p> : <button type="button" disabled={busy} onClick={() => onAction({ action: isModerator ? "moderator_revoked" : "moderator_granted", title: isModerator ? "Remove moderator access" : "Assign moderator access", description: isModerator ? "This account will immediately lose Control Room review access." : "This account can review producer profiles and beats, but cannot manage users or inventory.", confirmLabel: isModerator ? "Remove moderator" : "Assign moderator", destructive: isModerator })} className={cn("mt-3 min-h-11 w-full rounded-xl border px-3 text-xs font-semibold disabled:opacity-40", isModerator ? "border-rec/25 text-rec" : "border-gold/25 bg-gold/8 text-gold")}>{isModerator ? "Remove moderator" : "Assign moderator"}</button>}
            </OperationBlock>

            <OperationBlock icon={ShieldCheck} title="Account standing" detail={user.status === "active" ? "Temporarily suspend access or block a serious policy violation." : "Restore access when the issue has been resolved."}>
              {user.status !== "active" ? <button type="button" disabled={busy} onClick={() => onAction({ action: "account_restored", title: "Restore account access", description: "The account will regain normal platform access immediately.", confirmLabel: "Restore account" })} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Restore access</button> : isOwner || isSelf ? <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] text-muted-foreground">Owner accounts cannot be suspended or blocked from the Control Room.</p> : <div className="mt-3 grid grid-cols-[0.8fr_1fr_1fr] gap-2"><select value={suspensionDays} onChange={(event) => onSuspensionDaysChange(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#09090a] px-2 text-[10px]"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select><button type="button" disabled={busy} onClick={() => onAction({ action: "account_suspended", title: "Suspend account", description: `Platform access will be paused for ${suspensionDays} days. User work remains intact.`, confirmLabel: "Suspend account", details: { duration_days: Number(suspensionDays) }, destructive: true })} className="min-h-11 rounded-xl border border-gold/25 text-[10px] font-semibold text-gold">Suspend</button><button type="button" disabled={busy} onClick={() => onAction({ action: "account_blocked", title: "Block account", description: "Platform access will remain blocked until an admin restores it. User work is not deleted.", confirmLabel: "Block account", destructive: true })} className="min-h-11 rounded-xl border border-rec/25 text-[10px] font-semibold text-rec">Block</button></div>}
            </OperationBlock>

            <details className="overflow-hidden rounded-2xl border border-border bg-black/20">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4"><Clock3 className="h-4 w-4 text-gold" /><span className="min-w-0 flex-1 text-sm font-semibold">Account history</span><span className="text-xs text-gold">{events.length}</span></summary>
              <div className="divide-y divide-border border-t border-border px-4">{events.map((event) => <div key={event.id} className="py-3"><div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold capitalize">{event.action.replaceAll("_", " ")}</span><time className="shrink-0 text-[9px] text-muted-foreground">{formatDate(event.created_at)}</time></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{event.reason}</p></div>)}{!events.length && <p className="py-4 text-xs text-muted-foreground">No account adjustments have been recorded.</p>}</div>
            </details>
          </div>
        </div>
      </section>
    </div>
  );
}

function ConfirmationDialog({ action, user, reason, internalNote, busy, onReasonChange, onInternalNoteChange, onCancel, onConfirm }: { action: PendingAction; user: AdminUser; reason: string; internalNote: string; busy: boolean; onReasonChange: (value: string) => void; onInternalNoteChange: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  const reasonLength = reason.trim().length;
  const isReady = reasonLength >= 8;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/82 px-4 backdrop-blur-md" role="presentation" onMouseDown={onCancel}>
      <section className="w-full max-w-md rounded-3xl border border-white/12 bg-[#121214] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.8)]" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl border", action.destructive ? "border-rec/25 bg-rec/10 text-rec" : "border-gold/25 bg-gold/8 text-gold")}>{action.destructive ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</div>
        <div className="label-hw mt-4 text-gold">Confirm Account Change</div>
        <h3 id="confirm-action-title" className="mt-2 text-xl font-semibold">{action.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs"><span className="text-muted-foreground">Account: </span>{user.email || user.artist_name || user.id}</div>
        <label className="mt-4 block"><span className="flex items-center justify-between gap-3"><span className="label-hw text-gold/80">Reason required</span><span className={cn("text-[10px]", isReady ? "text-emerald-300" : "text-muted-foreground")}>{isReady ? "Ready" : `${reasonLength}/8 minimum`}</span></span><textarea autoFocus value={reason} onChange={(event) => onReasonChange(event.target.value)} maxLength={500} placeholder="Explain why this change is being made." className={cn("mt-2 min-h-24 w-full resize-none rounded-xl border bg-black/30 p-3 text-sm outline-none transition-[border-color,box-shadow]", isReady ? "border-emerald-400/35 shadow-[0_0_0_3px_rgba(52,211,153,0.06)]" : "border-white/10 focus:border-gold/35")} /></label>
        <label className="mt-3 block"><span className="label-hw text-gold/80">Private admin note</span><textarea value={internalNote} onChange={(event) => onInternalNoteChange(event.target.value)} maxLength={1000} placeholder="Optional supporting context." className="mt-2 min-h-16 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-gold/35" /></label>
        <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-white/10 text-xs font-semibold">Cancel</button><button type="button" disabled={busy || !isReady} onClick={onConfirm} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-[background-color,border-color,color,box-shadow,opacity]", !isReady ? "cursor-not-allowed border-white/10 bg-white/[0.035] text-white/30" : action.destructive ? "border-rec bg-rec text-white shadow-[0_0_22px_rgba(255,74,91,0.22)]" : "border-gold bg-gold text-black shadow-[0_0_24px_rgba(246,199,72,0.3)]")}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Applying..." : action.confirmLabel}</button></div>
      </section>
    </div>
  );
}

function OperationBlock({ icon: Icon, title, detail, children }: { icon: typeof UserCog; title: string; detail: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-black/20 p-4"><div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><div className="min-w-0"><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{detail}</p></div></div>{children}</section>;
}

function initials(value: string) {
  return value.split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RW";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
