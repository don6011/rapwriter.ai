"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Check, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AdminOrder = {
  id: string;
  order_number: string;
  status: "pending_payment" | "paid" | "fulfilled" | "canceled" | "refund_pending" | "refunded" | "disputed";
  currency: string;
  total_cents: number;
  platform_fee_cents: number;
  seller_earnings_cents: number;
  provider_payment_id: string | null;
  created_at: string;
  commerce_order_items: Array<{ id: string; title: string; item_type: string; license_name: string | null }>;
};

type OrderAction = "cancel" | "request_refund" | "mark_disputed" | "resolve_for_seller";

export function AdminOrderManagement() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [action, setAction] = useState<OrderAction>("cancel");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const financialOrders = useMemo(() => orders.filter((order) => order.status !== "canceled" || order.provider_payment_id), [orders]);

  useEffect(() => { void loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load orders.");
      setOrders(data.orders ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  function availableActions(order: AdminOrder): Array<{ id: OrderAction; label: string }> {
    if (order.status === "pending_payment") return [{ id: "cancel", label: "Cancel unpaid order" }];
    if (order.status === "paid" || order.status === "fulfilled") return [
      { id: "request_refund", label: "Request refund" },
      { id: "mark_disputed", label: "Place on dispute hold" },
    ];
    if (order.status === "disputed" || order.status === "refund_pending") return [{ id: "resolve_for_seller", label: "Resolve and restore" }];
    return [];
  }

  function openAction(order: AdminOrder) {
    const first = availableActions(order)[0];
    if (!first) return;
    setSelected(order);
    setAction(first.id);
    setReason("");
  }

  async function submitAction() {
    if (!selected || reason.trim().length < 8) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: selected.id, action, reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Order action failed.");
      toast.success(`${selected.order_number} updated.`);
      setSelected(null);
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-5 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div><div className="label-hw text-gold">Commerce</div><h2 className="mt-2 text-2xl font-semibold">Orders and licenses</h2><p className="mt-2 text-sm text-muted-foreground">Payment state, producer earnings, and support actions in one record.</p></div>
        <button type="button" onClick={() => void loadOrders()} disabled={loading} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 text-gold" aria-label="Refresh orders" title="Refresh orders"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
      </div>
      {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading transactions...</div> : financialOrders.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/24 p-4 text-sm text-muted-foreground">No financial orders yet. Completed Studio Store purchases will appear here.</div>
      ) : (
        <div className="mt-5 space-y-2">
          {financialOrders.slice(0, 20).map((order) => {
            const item = order.commerce_order_items[0];
            const actions = availableActions(order);
            return <article key={order.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/24 p-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/20 text-gold"><Banknote className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item?.title ?? order.order_number}</span><span className="mt-1 block text-[10px] text-muted-foreground">{order.order_number} / {item?.license_name ?? item?.item_type?.replace(/_/g, " ")}</span></span><span className="text-right"><span className="block text-sm font-semibold text-gold">{formatMoney(order.total_cents, order.currency)}</span><span className="mt-1 block text-[9px] capitalize text-white/45">{order.status.replace(/_/g, " ")}</span></span>{actions.length > 0 && <button type="button" onClick={() => openAction(order)} className="min-h-9 rounded-xl border border-white/10 px-3 text-xs font-semibold">Manage</button>}</article>;
          })}
        </div>
      )}
      {selected && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-gold/25 bg-[#111113] p-5"><div className="flex items-start justify-between gap-3"><div><div className="label-hw text-gold">Order action</div><h3 className="mt-1 text-xl font-semibold">{selected.order_number}</h3></div><button type="button" onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10" aria-label="Close"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-2">{availableActions(selected).map((option) => <button key={option.id} type="button" onClick={() => setAction(option.id)} className={cn("min-h-11 w-full rounded-xl border px-3 text-left text-sm font-semibold", action === option.id ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10")}>{option.label}</button>)}</div><label className="mt-4 block"><span className="label-hw">Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this order is changing..." className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/35 p-3 outline-none" /></label><button type="button" onClick={() => void submitAction()} disabled={busy || reason.trim().length < 8} className="gold-seal mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : action === "mark_disputed" ? <ShieldAlert className="h-4 w-4" /> : action === "cancel" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}Confirm action</button></section></div>}
    </section>
  );
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
