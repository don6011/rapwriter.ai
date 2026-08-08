"use client";

import type { CommerceOrderRow } from "@/hooks/use-rapwriter-data";
import { formatShortDate } from "@/lib/studio/format";
import { Download, FileText } from "lucide-react";

export function LockerReceiptRow({ order }: { order: CommerceOrderRow }) {
  const item = order.commerce_order_items[0];
  const statusLabel = order.status.replace(/_/g, " ");
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: order.currency.toUpperCase(),
  }).format(order.total_cents / 100);
  return (
    <article className="flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-black/24 px-3 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-gold"><FileText className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{item?.title ?? order.order_number}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/45">{order.order_number} / {formatShortDate(order.created_at)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold text-gold">{amount}</div>
        <div className="mt-1 text-[9px] capitalize text-white/45">{statusLabel}</div>
      </div>
      {item?.item_type === "beat_license" && order.status === "fulfilled" && (
        <a href={`/api/orders/${order.id}/license`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/20 text-gold" aria-label="Download beat license" title="Download license">
          <Download className="h-4 w-4" />
        </a>
      )}
    </article>
  );
}
