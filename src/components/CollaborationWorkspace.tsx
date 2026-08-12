"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Briefcase, Check, Handshake, Home, LayoutDashboard, ListMusic, MessageCircle, Plus, Send, ShoppingCart, UserCircle, X } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { CollaborationHandoff } from "@/components/CollaborationHandoff";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/studio/primitives/alert-dialog";
import { refreshActivityInbox } from "@/lib/client/activity-events";
import type { CollaborationAction } from "@/lib/collaboration";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type CollaborationRequest = {
  id: string;
  artist_id: string;
  producer_id: string;
  title: string;
  brief: string;
  budget_cents: number | null;
  status: "submitted" | "countered" | "accepted" | "declined" | "canceled" | "completed";
  handoff_status: "not_started" | "delivered" | "revision_requested" | "approved";
  response_note: string | null;
  counter_price_cents: number | null;
  requested_deadline: string | null;
  created_at: string;
  updated_at: string;
  artist_profile: { display_name: string } | null;
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
  const [workspaceMode, setWorkspaceMode] = useState<"artist" | "producer">("artist");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [message, setMessage] = useState("");
  const [counterPrice, setCounterPrice] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<CollaborationAction | null>(null);
  const [roomSyncMode, setRoomSyncMode] = useState<"connecting" | "live" | "polling">("connecting");
  const messageListRef = useRef<HTMLDivElement>(null);

  const visibleRequests = useMemo(
    () => requests.filter((request) => workspaceMode === "producer" ? request.producer_id === viewerId : request.artist_id === viewerId),
    [requests, viewerId, workspaceMode],
  );
  const selected = useMemo(() => visibleRequests.find((request) => request.id === selectedId) ?? null, [selectedId, visibleRequests]);
  const selectedRequestId = selected?.id;
  const selectedStatus = selected?.status;
  const isProducer = Boolean(selected && selected.producer_id === viewerId);
  const producerContext = workspaceMode === "producer";

  const loadRequests = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/collaborations", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      if (response.status === 401) throw new Error("Sign in from Studio to open collaborations.");
      if (!response.ok) throw new Error(data.error || "Could not load collaborations.");
      setRequests(data.requests ?? []);
      setViewerId(data.viewer_id ?? "");
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load collaborations.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (requestId: string, quiet = false) => {
    if (!quiet) setMessagesLoading(true);
    try {
      const response = await fetch(`/api/collaborations/${requestId}/messages`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not open this private room.");
      setMessages(data.messages ?? []);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open this private room.");
    } finally {
      if (!quiet) setMessagesLoading(false);
    }
  }, []);
  const refreshRequestsQuietly = useCallback(() => { void loadRequests(true); }, [loadRequests]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setWorkspaceMode(search.get("from") === "producer-hq" ? "producer" : "artist");
    setRequestedId(search.get("request"));
  }, []);
  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useEffect(() => {
    setSelectedId((current) => {
      if (visibleRequests.some((request) => request.id === current)) return current;
      if (requestedId && visibleRequests.some((request) => request.id === requestedId)) return requestedId;
      return visibleRequests[0]?.id ?? null;
    });
  }, [requestedId, visibleRequests]);
  useEffect(() => {
    setMessages([]);
    if (selectedRequestId && selectedStatus && ["accepted", "completed"].includes(selectedStatus)) void loadMessages(selectedRequestId);
  }, [loadMessages, selectedRequestId, selectedStatus]);
  useEffect(() => {
    if (!messages.length) return;
    const frame = window.requestAnimationFrame(() => {
      const list = messageListRef.current;
      if (list) list.scrollTo({ top: list.scrollHeight, behavior: messages.length > 1 ? "smooth" : "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, selected?.id]);
  useEffect(() => {
    if (!selected || !viewerId) return;

    let active = true;
    let disposeRealtime = () => undefined;
    const requestId = selected.id;
    const refreshRequest = () => void loadRequests(true);
    const refreshMessages = () => {
      if (["accepted", "completed"].includes(selected.status)) void loadMessages(requestId, true);
    };
    const polling = window.setInterval(() => {
      refreshRequest();
      refreshMessages();
    }, 12_000);

    try {
      setRoomSyncMode("connecting");
      const supabase = createClient();
      const channel = supabase
        .channel(`collaboration-workspace:${requestId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "producer_collaboration_requests",
            filter: `id=eq.${requestId}`,
          },
          (payload) => {
            if (!active) return;
            const next = payload.new as Partial<CollaborationRequest>;
            refreshRequest();
            if (next.status && next.status !== selected.status && statusChangedByOtherParticipant(selected, viewerId, next.status, next.handoff_status)) {
              toast.success(collaborationUpdateCopy[next.status]);
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "producer_collaboration_messages",
            filter: `request_id=eq.${requestId}`,
          },
          (payload) => {
            if (!active) return;
            const incoming = payload.new as Partial<CollaborationMessage>;
            refreshMessages();
            if (incoming.sender_id && incoming.sender_id !== viewerId) {
              toast("New private message", { description: messagePreview(incoming.body) });
            }
          },
        )
        .subscribe((status) => {
          if (!active) return;
          setRoomSyncMode(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "polling" : "connecting");
        });
      disposeRealtime = () => { void supabase.removeChannel(channel); };
    } catch {
      setRoomSyncMode("polling");
      // Quiet polling keeps the room current when Realtime is unavailable.
    }

    return () => {
      active = false;
      window.clearInterval(polling);
      disposeRealtime();
    };
  }, [loadMessages, loadRequests, selected, viewerId]);

  async function decide(action: CollaborationAction) {
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
      await loadRequests(true);
      refreshActivityInbox();
      toast.success(decisionSuccess[action]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update this request.";
      setNotice(message);
      toast.error(message);
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
      refreshActivityInbox();
      toast.success("Message sent", { duration: 1_800 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send your message.";
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-svh bg-[#060607] text-white">
      <div className="mx-auto min-h-svh w-full max-w-[430px] border-x border-white/8 bg-[#09090a] pb-24">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-black/88 px-4 backdrop-blur-xl">
          <Link href={producerContext ? "/producer" : "/?view=market"} className="grid h-10 w-10 place-items-center rounded-full border border-white/10" aria-label={producerContext ? "Back to Producer HQ" : "Back to Studio Store"}><ArrowLeft className="h-4 w-4" /></Link>
          <BrandLogo className="scale-90" />
          <div className="h-10 w-10" />
        </header>

        <section className="px-5 pb-4 pt-6">
          <div className="label-hw text-gold/80">{producerContext ? "Producer inbox" : "Private sessions"}</div>
          <h1 className="mt-1 text-3xl font-semibold">{producerContext ? "Artist requests" : "Collaborations"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{producerContext ? "Review incoming briefs. A private room opens only after you accept." : "Requests first. A private room opens only after both sides agree."}</p>
        </section>

        {notice && <div className="mx-5 mb-4 rounded-xl border border-gold/25 bg-gold/8 px-3 py-2 text-sm text-gold">{notice}</div>}

        {loading ? <div className="px-5 py-12 text-center text-sm text-muted-foreground">Opening your private rooms...</div> : visibleRequests.length === 0 ? (
          <div className="mx-5 rounded-2xl border border-white/10 bg-[#111113] p-6 text-center"><Handshake className="mx-auto h-7 w-7 text-gold" /><h2 className="mt-3 text-lg font-semibold">{producerContext ? "No artist requests yet" : "No requests yet"}</h2><p className="mt-2 text-sm text-muted-foreground">{producerContext ? "New briefs will appear here when artists request one of your published services." : "Your producer requests and accepted sessions will appear here."}</p><Link href={producerContext ? "/producer" : "/?view=market"} className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-gold/25 px-4 text-sm font-semibold text-gold">{producerContext ? "Open Producer HQ" : "Explore producers"}</Link></div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none]">
              {visibleRequests.map((request) => <button key={request.id} type="button" onClick={() => setSelectedId(request.id)} className={cn("min-w-[230px] rounded-2xl border p-3 text-left", selectedId === request.id ? "border-gold/45 bg-gold/10" : "border-white/10 bg-[#111113]")}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{request.title}</span><StatusBadge status={request.status} /></div><div className="mt-2 truncate text-xs text-muted-foreground">{producerContext ? request.artist_profile?.display_name ?? "Artist" : request.producer_profiles?.display_name ?? "Producer"}{request.producer_beats?.title ? ` - ${request.producer_beats.title}` : ""}</div></button>)}
            </div>
            {selected && <section className="mx-5 rounded-3xl border border-white/10 bg-[#111113] p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="label-hw text-gold/80">{isProducer ? "Artist request" : "Producer session"}</div><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2></div><StatusBadge status={selected.status} /></div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/72">{selected.brief}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">{producerContext && <Detail label="Artist" value={selected.artist_profile?.display_name ?? "Artist"} />}<Detail label="Producer" value={selected.producer_profiles?.display_name ?? "Producer"} /><Detail label="Service" value={selected.producer_services?.title ?? "General collaboration"} />{selected.producer_beats?.title && <Detail label="Beat" value={selected.producer_beats.title} />}{selected.projects?.title && <Detail label="Project" value={selected.projects.title} />}{selected.songs?.title && <Detail label="Song" value={selected.songs.title} />}{selected.requested_deadline && <Detail label="Target date" value={new Date(`${selected.requested_deadline}T00:00:00`).toLocaleDateString()} />}{selected.budget_cents != null && <Detail label="Artist budget" value={money(selected.budget_cents)} />}</div>
              {!producerContext && selected.producer_profiles?.handle && <Link href={`/producer/${encodeURIComponent(selected.producer_profiles.handle)}`} className="mt-3 flex min-h-10 items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-semibold text-white/68"><span>View producer storefront</span><ArrowLeft className="h-3.5 w-3.5 rotate-180 text-gold" /></Link>}
              {selected.response_note && <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/68"><span className="font-semibold text-white">Producer note:</span> {selected.response_note}</div>}
              {selected.counter_price_cents != null && selected.status === "countered" && <div className="mt-4 rounded-xl border border-gold/25 bg-gold/8 p-3 text-sm text-gold">Counteroffer: {money(selected.counter_price_cents)}</div>}

              {isProducer && selected.status === "submitted" && <div className="mt-5 space-y-3 border-t border-white/10 pt-4"><textarea rows={3} value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="Optional note to the artist" className="w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-gold/45" /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void decide("accept")} disabled={busy} className="gold-seal min-h-11 rounded-xl text-sm font-semibold text-black"><Check className="mr-1 inline h-4 w-4" />Accept</button><button type="button" onClick={() => setPendingDecision("decline")} disabled={busy} className="min-h-11 rounded-xl border border-white/10 text-sm font-semibold text-white/65"><X className="mr-1 inline h-4 w-4" />Decline</button></div><div className="flex gap-2"><input type="number" min="0" value={counterPrice} onChange={(event) => setCounterPrice(event.target.value)} placeholder="Counter price" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm" /><button type="button" onClick={() => void decide("counter")} disabled={busy || !counterPrice} className="rounded-xl border border-gold/25 px-4 text-sm font-semibold text-gold disabled:opacity-40">Counter</button></div></div>}
              {!isProducer && selected.status === "countered" && <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => void decide("accept_counter")} disabled={busy} className="gold-seal min-h-11 rounded-xl text-sm font-semibold text-black">Accept counter</button><button type="button" onClick={() => setPendingDecision("cancel")} disabled={busy} className="min-h-11 rounded-xl border border-white/10 text-sm font-semibold text-white/65">Pass</button></div>}
              {!isProducer && selected.status === "submitted" && <button type="button" onClick={() => setPendingDecision("cancel")} disabled={busy} className="mt-5 min-h-11 w-full rounded-xl border border-white/10 text-sm font-semibold text-white/60">Cancel request</button>}
              {["accepted", "completed"].includes(selected.status) && <div className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-gold" />Private room</div><span className={cn("flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]", roomSyncMode === "live" ? "text-emerald-300" : "text-gold/75")}><span className={cn("h-1.5 w-1.5 rounded-full", roomSyncMode === "live" ? "bg-emerald-400" : "bg-gold")} />{roomSyncMode === "live" ? "Live" : "Syncing"}</span></div><div ref={messageListRef} aria-live="polite" className="mt-3 max-h-72 space-y-2 overflow-y-auto overscroll-contain">{messages.map((item) => <div key={item.id} className={cn("max-w-[86%] rounded-xl px-3 py-2 text-sm", item.sender_id === viewerId ? "ml-auto bg-gold text-black" : "bg-white/[0.07] text-white/78")}><p>{item.body}</p><div className="mt-1 text-[9px] opacity-55">{new Date(item.created_at).toLocaleString()}</div></div>)}{messagesLoading ? <p className="py-4 text-center text-xs text-muted-foreground">Opening the conversation...</p> : messages.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">The room is open. Start with the creative direction.</p>}</div>{selected.status === "accepted" && <form onSubmit={sendMessage} className="mt-3 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message privately" disabled={messagesLoading} className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm outline-none focus:border-gold/45 disabled:opacity-50" /><button type="submit" disabled={busy || messagesLoading || !message.trim()} className="grid h-11 w-11 place-items-center rounded-xl bg-gold text-black disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button></form>}<CollaborationHandoff requestId={selected.id} isProducer={isProducer} requestStatus={selected.status as "accepted" | "completed"} handoffStatus={selected.handoff_status} onRequestUpdated={refreshRequestsQuietly} /></div>}
            </section>}
          </>
        )}

        <AlertDialog open={pendingDecision !== null} onOpenChange={(open) => !open && setPendingDecision(null)}>
          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[390px] rounded-2xl border-white/12 bg-[#111113] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingDecision ? decisionConfirmation[pendingDecision].title : "Confirm action"}</AlertDialogTitle>
              <AlertDialogDescription>{pendingDecision ? decisionConfirmation[pendingDecision].description : "This will update the collaboration for both people."}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:space-x-0">
              <AlertDialogCancel className="min-h-11 rounded-xl border-white/12 bg-transparent text-white hover:bg-white/5 hover:text-white">Keep current status</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 rounded-xl bg-gold font-semibold text-black hover:bg-gold/90"
                onClick={() => {
                  const action = pendingDecision;
                  setPendingDecision(null);
                  if (action) void decide(action);
                }}
              >
                {pendingDecision ? decisionConfirmation[pendingDecision].confirm : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {producerContext ? (
          <nav data-testid="producer-hq-dock" aria-label="Producer HQ" className="fixed bottom-0 left-1/2 z-40 grid h-20 w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-gold/20 bg-black/94 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"><Dock href="/producer" label="HQ" icon={LayoutDashboard} active /><Dock href="/producer?view=catalog" label="Catalog" icon={ListMusic} /><Dock href="/producer?view=upload" label="Add beat" icon={Plus} /><Dock href="/producer?view=analytics" label="Analytics" icon={BarChart3} /></nav>
        ) : (
          <nav data-testid="app-dock" aria-label="RapWriter navigation" className="fixed bottom-0 left-1/2 z-40 grid h-20 w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-white/8 bg-black/94 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"><Dock href="/" label="Studio" icon={Home} /><Dock href="/?view=locker" label="Locker" icon={Briefcase} /><Dock href="/?view=market" label="Market" icon={ShoppingCart} /><Dock href="/?view=profile" label="Profile" icon={UserCircle} /></nav>
        )}
      </div>
    </main>
  );
}

const decisionSuccess: Record<CollaborationAction, string> = {
  accept: "Request accepted. The private room is open.",
  counter: "Counteroffer sent to the artist.",
  decline: "Request declined.",
  accept_counter: "Counteroffer accepted. The private room is open.",
  cancel: "Request canceled.",
};

const decisionConfirmation: Record<CollaborationAction, { title: string; description: string; confirm: string }> = {
  accept: { title: "Accept this request?", description: "A private room will open for you and the artist.", confirm: "Accept request" },
  counter: { title: "Send this counteroffer?", description: "The artist will be notified and can accept or pass.", confirm: "Send counter" },
  decline: { title: "Decline this request?", description: "The artist will be notified. This request cannot be reopened.", confirm: "Decline request" },
  accept_counter: { title: "Accept this counteroffer?", description: "The private room will open and both sides can begin working.", confirm: "Accept counter" },
  cancel: { title: "Close this request?", description: "The other person will be notified and this request cannot continue.", confirm: "Close request" },
};

const collaborationUpdateCopy: Record<CollaborationRequest["status"], string> = {
  submitted: "A new collaboration request arrived.",
  countered: "The producer sent a counteroffer.",
  accepted: "The request was accepted. Your private room is open.",
  declined: "The producer declined this request.",
  canceled: "The artist closed this request.",
  completed: "The artist approved the delivery. This session is complete.",
};

function statusChangedByOtherParticipant(request: CollaborationRequest, viewerId: string, nextStatus: CollaborationRequest["status"], nextHandoff?: CollaborationRequest["handoff_status"]) {
  const actor = nextStatus === "canceled" || (nextStatus === "accepted" && request.status === "countered") || (nextStatus === "completed" && nextHandoff === "approved") ? "artist" : "producer";
  const viewer = request.producer_id === viewerId ? "producer" : "artist";
  return actor !== viewer;
}

function messagePreview(body?: string) {
  const value = body?.trim();
  if (!value) return "Your collaboration room has an update.";
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function StatusBadge({ status }: { status: CollaborationRequest["status"] }) {
  const label = status === "accepted" ? "Room open" : status === "completed" ? "Complete" : status;
  return <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase", status === "accepted" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : status === "countered" ? "border-gold/30 bg-gold/10 text-gold" : "border-white/10 bg-black/25 text-white/50")}>{label}</span>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-black/25 p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-white/38">{label}</div><div className="mt-1 truncate font-semibold text-white/75">{value}</div></div>; }
function money(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100); }
function Dock({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: typeof Home; active?: boolean }) { return <Link href={href} className={cn("flex flex-col items-center justify-center gap-1 text-[10px]", active ? "text-gold" : "text-white/45")}><Icon className="h-5 w-5" />{label}</Link>; }
