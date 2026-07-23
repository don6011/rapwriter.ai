"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, Check, Handshake, Home, MessageCircle, Send, ShoppingCart, UserCircle, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

type CollaborationRequest = {
  id: string;
  artist_id: string;
  producer_id: string;
  title: string;
  brief: string;
  budget_cents: number | null;
  status: "submitted" | "countered" | "accepted" | "declined" | "canceled" | "completed";
  response_note: string | null;
  counter_price_cents: number | null;
  created_at: string;
  updated_at: string;
  producer_profiles: { display_name: string; handle: string | null } | null;
  producer_services: { title: string; service_type: string } | null;
  producer_beats: { title: string } | null;
  projects: { title: string } | null;
  songs: { title: string } | null;
};

type CollaborationMessage = { id: string; sender_id: string; body: string; created_at: string };

export function CollaborationWorkspace() {
  const [requests, setRequests] = useState<CollaborationRequest[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [message, setMessage] = useState("");
  const [counterPrice, setCounterPrice] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(() => requests.find((request) => request.id === selectedId) ?? null, [requests, selectedId]);
  const isProducer = Boolean(selected && selected.producer_id === viewerId);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/collaborations", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      if (response.status === 401) throw new Error("Sign in from Studio to open collaborations.");
      if (!response.ok) throw new Error(data.error || "Could not load collaborations.");
      setRequests(data.requests ?? []);
      setViewerId(data.viewer_id ?? "");
      setSelectedId((current) => current ?? data.requests?.[0]?.id ?? null);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load collaborations.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (requestId: string) => {
    const response = await fetch(`/api/collaborations/${requestId}/messages`, { cache: "no-store", credentials: "same-origin" });
    const data = await response.json();
    if (response.ok) setMessages(data.messages ?? []);
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useEffect(() => {
    setMessages([]);
    if (selected?.status === "accepted") void loadMessages(selected.id);
  }, [loadMessages, selected?.id, selected?.status]);

  async function decide(action: "accept" | "counter" | "decline" | "accept_counter" | "cancel" | "complete") {
    if (!selected || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/collaborations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          response_note: responseNote || null,
          counter_price_cents: action === "counter" && counterPrice ? Math.round(Number(counterPrice) * 100) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update this request.");
      setResponseNote("");
      setCounterPrice("");
      await loadRequests();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update this request.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !message.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/collaborations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body: message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send your message.");
      setMessage("");
      await loadMessages(selected.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-svh bg-[#060607] text-white">
      <div className="mx-auto min-h-svh w-full max-w-[430px] border-x border-white/8 bg-[#09090a] pb-24">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-black/88 px-4 backdrop-blur-xl">
          <Link href={isProducer ? "/producer" : "/"} className="grid h-10 w-10 place-items-center rounded-full border border-white/10" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
          <BrandLogo className="scale-90" />
          <div className="h-10 w-10" />
        </header>

        <section className="px-5 pb-4 pt-6">
          <div className="label-hw text-gold/80">Private sessions</div>
          <h1 className="mt-1 text-3xl font-semibold">Collaborations</h1>
          <p className="mt-2 text-sm text-muted-foreground">Requests first. A private room opens only after both sides agree.</p>
        </section>

        {notice && <div className="mx-5 mb-4 rounded-xl border border-gold/25 bg-gold/8 px-3 py-2 text-sm text-gold">{notice}</div>}

        {loading ? <div className="px-5 py-12 text-center text-sm text-muted-foreground">Opening your private rooms...</div> : requests.length === 0 ? (
          <div className="mx-5 rounded-2xl border border-white/10 bg-[#111113] p-6 text-center"><Handshake className="mx-auto h-7 w-7 text-gold" /><h2 className="mt-3 text-lg font-semibold">No requests yet</h2><p className="mt-2 text-sm text-muted-foreground">Artist requests and accepted producer sessions will appear here.</p><Link href="/?view=market" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-gold/25 px-4 text-sm font-semibold text-gold">Explore producers</Link></div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none]">
              {requests.map((request) => <button key={request.id} type="button" onClick={() => setSelectedId(request.id)} className={cn("min-w-[230px] rounded-2xl border p-3 text-left", selectedId === request.id ? "border-gold/45 bg-gold/10" : "border-white/10 bg-[#111113]")}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{request.title}</span><StatusBadge status={request.status} /></div><div className="mt-2 truncate text-xs text-muted-foreground">{request.producer_profiles?.display_name ?? "Producer"}{request.producer_beats?.title ? ` - ${request.producer_beats.title}` : ""}</div></button>)}
            </div>
            {selected && <section className="mx-5 rounded-3xl border border-white/10 bg-[#111113] p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="label-hw text-gold/80">{isProducer ? "Artist request" : "Producer session"}</div><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2></div><StatusBadge status={selected.status} /></div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/72">{selected.brief}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Detail label="Producer" value={selected.producer_profiles?.display_name ?? "Producer"} /><Detail label="Service" value={selected.producer_services?.title ?? "General collaboration"} />{selected.producer_beats?.title && <Detail label="Beat" value={selected.producer_beats.title} />}{selected.budget_cents != null && <Detail label="Artist budget" value={money(selected.budget_cents)} />}</div>
              {selected.response_note && <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/68"><span className="font-semibold text-white">Producer note:</span> {selected.response_note}</div>}
              {selected.counter_price_cents != null && selected.status === "countered" && <div className="mt-4 rounded-xl border border-gold/25 bg-gold/8 p-3 text-sm text-gold">Counteroffer: {money(selected.counter_price_cents)}</div>}

              {isProducer && selected.status === "submitted" && <div className="mt-5 space-y-3 border-t border-white/10 pt-4"><textarea rows={3} value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="Optional note to the artist" className="w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-gold/45" /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void decide("accept")} disabled={busy} className="gold-seal min-h-11 rounded-xl text-sm font-semibold text-black"><Check className="mr-1 inline h-4 w-4" />Accept</button><button type="button" onClick={() => void decide("decline")} disabled={busy} className="min-h-11 rounded-xl border border-white/10 text-sm font-semibold text-white/65"><X className="mr-1 inline h-4 w-4" />Decline</button></div><div className="flex gap-2"><input type="number" min="0" value={counterPrice} onChange={(event) => setCounterPrice(event.target.value)} placeholder="Counter price" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm" /><button type="button" onClick={() => void decide("counter")} disabled={busy || !counterPrice} className="rounded-xl border border-gold/25 px-4 text-sm font-semibold text-gold disabled:opacity-40">Counter</button></div></div>}
              {!isProducer && selected.status === "countered" && <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => void decide("accept_counter")} disabled={busy} className="gold-seal min-h-11 rounded-xl text-sm font-semibold text-black">Accept counter</button><button type="button" onClick={() => void decide("cancel")} disabled={busy} className="min-h-11 rounded-xl border border-white/10 text-sm font-semibold text-white/65">Pass</button></div>}
              {!isProducer && selected.status === "submitted" && <button type="button" onClick={() => void decide("cancel")} disabled={busy} className="mt-5 min-h-11 w-full rounded-xl border border-white/10 text-sm font-semibold text-white/60">Cancel request</button>}
              {selected.status === "accepted" && <div className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-gold" />Private room</div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{messages.map((item) => <div key={item.id} className={cn("max-w-[86%] rounded-xl px-3 py-2 text-sm", item.sender_id === viewerId ? "ml-auto bg-gold text-black" : "bg-white/[0.07] text-white/78")}><p>{item.body}</p><div className="mt-1 text-[9px] opacity-55">{new Date(item.created_at).toLocaleString()}</div></div>)}{messages.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">The room is open. Start with the creative direction.</p>}</div><form onSubmit={sendMessage} className="mt-3 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message privately" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm outline-none focus:border-gold/45" /><button type="submit" disabled={busy || !message.trim()} className="grid h-11 w-11 place-items-center rounded-xl bg-gold text-black disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button></form>{isProducer && <button type="button" onClick={() => void decide("complete")} disabled={busy} className="mt-3 min-h-10 w-full rounded-xl border border-white/10 text-xs font-semibold text-white/60">Mark session complete</button>}</div>}
            </section>}
          </>
        )}

        <nav className="fixed bottom-0 left-1/2 z-40 grid h-20 w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-white/8 bg-black/94 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"><Dock href="/" label="Studio" icon={Home} /><Dock href="/?view=locker" label="Locker" icon={Briefcase} /><Dock href="/?view=market" label="Market" icon={ShoppingCart} /><Dock href="/?view=profile" label="Profile" icon={UserCircle} /></nav>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: CollaborationRequest["status"] }) { return <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase", status === "accepted" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : status === "countered" ? "border-gold/30 bg-gold/10 text-gold" : "border-white/10 bg-black/25 text-white/50")}>{status}</span>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-black/25 p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-white/38">{label}</div><div className="mt-1 truncate font-semibold text-white/75">{value}</div></div>; }
function money(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100); }
function Dock({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) { return <Link href={href} className="flex flex-col items-center justify-center gap-1 text-[10px] text-white/45"><Icon className="h-5 w-5" />{label}</Link>; }
