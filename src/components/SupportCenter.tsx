"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, HelpCircle, Loader2, MessageSquare, Paperclip, Send, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { supportCategories, supportCategoryLabel, supportFaqs, ticketAllowsCustomerReply } from "@/lib/support";
import { cn } from "@/lib/utils";

type TicketRow = { id: string; ticket_number: string; category: string; subject: string; status: string; created_at: string; updated_at: string; description?: string };
type MessageRow = { id: string; sender_type: "customer" | "support"; body: string; created_at: string };
type AttachmentRow = { id: string; file_name: string; signed_url: string | null; size_bytes: number };

export function SupportCenter() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [mode, setMode] = useState<"help" | "submit" | "tickets">("help");
  const [category, setCategory] = useState("technical_problem");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedOrder, setRelatedOrder] = useState("");
  const [relatedPurchase, setRelatedPurchase] = useState("");
  const [relatedBeat, setRelatedBeat] = useState("");
  const [relatedLicense, setRelatedLicense] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const suggestions = useMemo(() => supportFaqs.filter((article) => article.categories.includes(category as never)), [category]);

  async function loadTickets() {
    setLoading(true);
    const response = await fetch("/api/support/tickets", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setTickets(data.tickets ?? []);
    else setError(response.status === 401 ? "Sign in from Profile to open RapWriter Support." : data.error ?? "Support Center could not load.");
    setLoading(false);
  }

  async function openTicket(ticket: TicketRow) {
    setBusy(true); setError("");
    const response = await fetch(`/api/support/tickets/${ticket.id}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setSelected(data.ticket); setMessages(data.messages ?? []); setAttachments(data.attachments ?? []); setMode("tickets"); }
    else setError(data.error ?? "Ticket could not load.");
    setBusy(false);
  }

  useEffect(() => {
    void loadTickets().then(() => {
      const id = new URLSearchParams(window.location.search).get("ticket");
      if (id) fetch(`/api/support/tickets/${id}`, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) return;
        const data = await response.json(); setSelected(data.ticket); setMessages(data.messages ?? []); setAttachments(data.attachments ?? []); setMode("tickets");
      });
    });
  }, []);

  async function submitTicket() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, subject, description, related_order_id: relatedOrder || null, related_entitlement_id: relatedPurchase || null, related_beat_id: relatedBeat || null, related_license_id: relatedLicense || null, platform: "web", app_version: document.documentElement.dataset.release ?? "web" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Ticket could not be submitted.");
      if (file) {
        const form = new FormData(); form.set("file", file);
        const upload = await fetch(`/api/support/tickets/${data.ticket.id}/attachments`, { method: "POST", body: form });
        if (!upload.ok) toast.warning("Ticket created, but the attachment did not upload.");
      }
      setSubject(""); setDescription(""); setRelatedOrder(""); setRelatedPurchase(""); setRelatedBeat(""); setRelatedLicense(""); setFile(null);
      await loadTickets(); await openTicket(data.ticket);
      toast.success(`${data.ticket.ticket_number} submitted`, { description: "RapWriter Support has your request." });
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Ticket could not be submitted."); }
    finally { setBusy(false); }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/support/tickets/${selected.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setReply(""); await openTicket(selected); toast.success("Reply sent"); }
    else setError(data.error ?? "Reply could not be sent.");
    setBusy(false);
  }

  return (
    <main className="min-h-[100svh] bg-[#070708] text-white">
      <div className="mx-auto min-h-[100svh] w-full max-w-[430px] border-x border-white/5 bg-[#09090a] pb-8">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-white/10 bg-black/90 px-4 backdrop-blur-xl">
          <Link href="/?view=profile" className="grid h-10 w-10 place-items-center rounded-full border border-white/10" aria-label="Back to Profile"><ArrowLeft className="h-4 w-4" /></Link>
          <BrandLogo compact />
          <div className="ml-auto text-right"><div className="label-hw text-gold">Support</div><div className="text-sm font-semibold">Support Center</div></div>
        </header>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-1.5">
            {[{ id: "help", label: "Get Help", icon: HelpCircle }, { id: "submit", label: "New Ticket", icon: Ticket }, { id: "tickets", label: "My Tickets", icon: MessageSquare }].map((item) => <button key={item.id} onClick={() => { setMode(item.id as typeof mode); if (item.id !== "tickets") setSelected(null); }} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold", mode === item.id ? "bg-gold text-black" : "text-white/55")}><item.icon className="h-4 w-4" />{item.label}</button>)}
          </div>
          {error && <div className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

          {mode === "help" && <section className="mt-5">
            <div className="label-hw text-gold">Get Help</div><h1 className="mt-2 text-2xl font-semibold">Start with the right answer.</h1><p className="mt-2 text-sm text-muted-foreground">Choose a topic. You can always submit a ticket.</p>
            <CategorySelect value={category} onChange={setCategory} />
            <div className="mt-5 space-y-2">{suggestions.length ? suggestions.map((article) => <details key={article.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold"><FileText className="h-4 w-4 text-gold" /><span className="flex-1">{article.title}</span><ChevronRight className="h-4 w-4" /></summary><p className="mt-3 text-sm leading-6 text-muted-foreground">{article.body}</p></details>) : <p className="rounded-2xl border border-white/10 p-4 text-sm text-muted-foreground">Tell us what happened and Support will route it correctly.</p>}</div>
            <button onClick={() => setMode("submit")} className="gold-seal mt-5 min-h-12 w-full rounded-2xl text-sm font-semibold">Submit a Ticket</button>
          </section>}

          {mode === "submit" && <section className="mt-5 space-y-4">
            <div><div className="label-hw text-gold">New Ticket</div><h1 className="mt-2 text-2xl font-semibold">Tell us what happened.</h1></div>
            <CategorySelect value={category} onChange={setCategory} />
            {suggestions.length > 0 && <div className="rounded-xl border border-gold/15 bg-gold/[0.05] p-3 text-xs text-white/65">Before sending: {suggestions[0].title}</div>}
            <label className="block"><span className="label-hw">Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 outline-none focus:border-gold/40" /></label>
            <label className="block"><span className="label-hw">Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={6000} className="mt-2 min-h-40 w-full resize-none rounded-xl border border-white/10 bg-black/35 p-4 text-sm leading-6 outline-none focus:border-gold/40" /></label>
            <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><summary className="cursor-pointer list-none text-xs font-semibold text-white/65">Related purchase, beat, or license (optional)</summary><div className="mt-3 grid gap-2"><ReferenceInput label="Order ID" value={relatedOrder} onChange={setRelatedOrder} /><ReferenceInput label="Purchase ID" value={relatedPurchase} onChange={setRelatedPurchase} /><ReferenceInput label="Beat ID" value={relatedBeat} onChange={setRelatedBeat} /><ReferenceInput label="License ID" value={relatedLicense} onChange={setRelatedLicense} /></div></details>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 text-sm text-white/65"><Paperclip className="h-4 w-4 text-gold" /><span className="min-w-0 flex-1 truncate">{file?.name ?? "Attach screenshot, PDF, or text file"}</span>{file && <button type="button" aria-label="Remove attachment" onClick={(event) => { event.preventDefault(); setFile(null); }}><X className="h-4 w-4" /></button>}<input type="file" aria-label="Ticket attachment" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
            <button onClick={() => void submitTicket()} disabled={busy || subject.trim().length < 4 || description.trim().length < 20} className="gold-seal flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-35">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit Ticket</button>
          </section>}

          {mode === "tickets" && (selected ? <TicketDetail ticket={selected} messages={messages} attachments={attachments} reply={reply} setReply={setReply} busy={busy} onBack={() => setSelected(null)} onReply={sendReply} /> : <section className="mt-5"><div className="label-hw text-gold">My Tickets</div><h1 className="mt-2 text-2xl font-semibold">Your support conversations.</h1>{loading ? <Loader2 className="mx-auto mt-12 h-6 w-6 animate-spin text-gold" /> : tickets.length ? <div className="mt-5 space-y-2">{tickets.map((ticket) => <button key={ticket.id} onClick={() => void openTicket(ticket)} className="w-full rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-gold">{ticket.ticket_number}</span><Status value={ticket.status} /></div><div className="mt-2 font-semibold">{ticket.subject}</div><div className="mt-2 flex justify-between gap-3 text-[10px] text-muted-foreground"><span>{supportCategoryLabel(ticket.category)}</span><span>{new Date(ticket.updated_at).toLocaleDateString()}</span></div></button>)}</div> : <div className="mt-5 rounded-2xl border border-white/10 p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-gold" /><p className="mt-3 text-sm text-muted-foreground">No support tickets yet.</p></div>}</section>)}
        </div>
      </div>
    </main>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="mt-5 block"><span className="label-hw">Topic</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#09090a] px-3 text-sm outline-none focus:border-gold/40">{supportCategories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>; }
function ReferenceInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-[9px] uppercase tracking-[0.12em] text-white/35">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="UUID" className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-xs outline-none focus:border-gold/35" /></label>; }
function Status({ value }: { value: string }) { return <span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold uppercase", value === "resolved" || value === "closed" ? "border-emerald-400/20 text-emerald-300" : value === "waiting_on_customer" ? "border-gold/25 text-gold" : "border-white/10 text-white/55")}>{value.replaceAll("_", " ")}</span>; }
function TicketDetail({ ticket, messages, attachments, reply, setReply, busy, onBack, onReply }: { ticket: TicketRow; messages: MessageRow[]; attachments: AttachmentRow[]; reply: string; setReply: (value: string) => void; busy: boolean; onBack: () => void; onReply: () => void }) { const canReply = ticketAllowsCustomerReply(ticket.status); return <section className="mt-5"><button onClick={onBack} className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" />All tickets</button><div className="mt-4 rounded-2xl border border-gold/20 bg-gold/[0.04] p-4"><div className="flex justify-between gap-3"><span className="text-xs font-semibold text-gold">{ticket.ticket_number}</span><Status value={ticket.status} /></div><h1 className="mt-2 text-xl font-semibold">{ticket.subject}</h1><p className="mt-2 text-xs text-muted-foreground">{supportCategoryLabel(ticket.category)} | Created {new Date(ticket.created_at).toLocaleDateString()}</p><p className="mt-4 text-sm leading-6 text-white/75">{ticket.description}</p></div><div className="mt-4 space-y-3">{messages.map((message) => <div key={message.id} className={cn("max-w-[88%] rounded-2xl p-3", message.sender_type === "customer" ? "ml-auto bg-gold/12" : "border border-white/10 bg-white/[0.04]")}><div className="text-[10px] font-semibold text-gold">{message.sender_type === "customer" ? "You" : "RapWriter Support"}</div><p className="mt-1 text-sm leading-6">{message.body}</p><div className="mt-2 text-[9px] text-muted-foreground">{new Date(message.created_at).toLocaleString()}</div></div>)}</div>{attachments.length > 0 && <div className="mt-4 space-y-2">{attachments.map((item) => <a key={item.id} href={item.signed_url ?? "#"} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3 text-xs"><Paperclip className="h-4 w-4 text-gold" /><span className="truncate">{item.file_name}</span></a>)}</div>}{canReply ? <div className="sticky bottom-2 mt-5 rounded-2xl border border-white/10 bg-black/90 p-3 backdrop-blur-xl"><textarea aria-label="Reply to Support" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to Support" className="min-h-24 w-full resize-none bg-transparent text-sm outline-none" /><button onClick={onReply} disabled={busy || !reply.trim()} className="gold-seal flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-35"><Send className="h-4 w-4" />Send Reply</button></div> : <div className="mt-5 rounded-xl border border-white/10 p-4 text-center text-xs text-muted-foreground">This ticket is closed to replies.</div>}</section>; }
