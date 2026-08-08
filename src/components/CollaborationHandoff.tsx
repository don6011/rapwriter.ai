"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileAudio, Loader2, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
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
import { collaborationFileError } from "@/lib/collaboration-deliverables";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Deliverable = {
  id: string;
  version_number: number;
  title: string;
  note: string;
  file_name: string;
  byte_size: number;
  status: "delivered" | "revision_requested" | "approved";
  artist_feedback: string | null;
  delivered_at: string;
  reviewed_at: string | null;
  download_url: string | null;
};

type ReviewAction = "approve" | "request_revision";

export function CollaborationHandoff({
  requestId,
  isProducer,
  requestStatus,
  handoffStatus,
  onRequestUpdated,
}: {
  requestId: string;
  isProducer: boolean;
  requestStatus: "accepted" | "completed";
  handoffStatus: "not_started" | "delivered" | "revision_requested" | "approved";
  onRequestUpdated: () => void;
}) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("Session delivery");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pendingReview, setPendingReview] = useState<ReviewAction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDeliverables = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/collaborations/${requestId}/deliverables`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load session deliveries.");
      setDeliverables(data.deliverables ?? []);
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "Could not load session deliveries.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { void loadDeliverables(); }, [loadDeliverables]);
  useEffect(() => {
    const polling = window.setInterval(() => void loadDeliverables(true), 12_000);
    const supabase = createClient();
    const channel = supabase
      .channel(`collaboration-handoff:${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "producer_collaboration_deliverables", filter: `request_id=eq.${requestId}` }, () => {
        void loadDeliverables(true);
        onRequestUpdated();
      })
      .subscribe();
    return () => {
      window.clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [loadDeliverables, onRequestUpdated, requestId]);

  async function uploadDelivery() {
    if (!file || busy) return;
    const fileError = collaborationFileError(file);
    if (fileError) {
      toast.error(fileError);
      return;
    }
    if (title.trim().length < 2) {
      toast.error("Add a short title for this delivery.");
      return;
    }
    setBusy(true);
    try {
      const authorization = await fetch(`/api/collaborations/${requestId}/deliverables/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ file_name: file.name, mime_type: file.type, byte_size: file.size }),
      });
      const upload = await authorization.json().catch(() => ({}));
      if (!authorization.ok) throw new Error(upload.error || "Could not prepare this upload.");

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const confirmation = await fetch(`/api/collaborations/${requestId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: title.trim(),
          note: note.trim(),
          storage_path: upload.path,
          file_name: file.name,
          mime_type: file.type,
          byte_size: file.size,
        }),
      });
      const result = await confirmation.json().catch(() => ({}));
      if (!confirmation.ok) throw new Error(result.error || "The file uploaded, but delivery confirmation failed.");

      setFile(null);
      setNote("");
      setTitle("Session delivery");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDeliverables(true);
      onRequestUpdated();
      refreshActivityInbox();
      toast.success("Delivery sent", { description: "The artist can now review this version." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deliver this file.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewDelivery(action: ReviewAction) {
    const latest = deliverables[0];
    if (!latest || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/collaborations/${requestId}/deliverables/${latest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, feedback: feedback.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not review this delivery.");
      setFeedback("");
      await loadDeliverables(true);
      onRequestUpdated();
      refreshActivityInbox();
      toast.success(action === "approve" ? "Delivery approved" : "Revision requested", {
        description: action === "approve" ? "The completed session is now preserved in this room." : "The producer received your notes.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review this delivery.");
    } finally {
      setBusy(false);
      setPendingReview(null);
    }
  }

  const canDeliver = isProducer && requestStatus === "accepted" && ["not_started", "revision_requested"].includes(handoffStatus);
  const latest = deliverables[0];
  const canReview = !isProducer && requestStatus === "accepted" && handoffStatus === "delivered" && latest?.status === "delivered";

  return (
    <section className="mt-5 border-t border-white/10 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label-hw text-gold/80">Session handoff</div>
          <h3 className="mt-1 text-base font-semibold">Deliverables</h3>
        </div>
        <HandoffBadge status={handoffStatus} />
      </div>

      {canDeliver && (
        <div className="mt-4 space-y-3">
          {handoffStatus === "revision_requested" && latest?.artist_feedback && (
            <div className="border-l-2 border-gold pl-3 text-sm text-white/72">
              <span className="font-semibold text-white">Artist note:</span> {latest.artist_feedback}
            </div>
          )}
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Delivery title" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm outline-none focus:border-gold/45" />
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1500} rows={2} placeholder="Optional note about this version" className="w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-gold/45" />
          <input ref={fileInputRef} type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/webm,.zip" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-dashed border-white/16 px-3 text-left text-sm text-white/65">
            <span className="flex min-w-0 items-center gap-2"><FileAudio className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{file?.name ?? "Choose audio or ZIP"}</span></span>
            <span className="text-[10px] text-white/35">250 MB max</span>
          </button>
          <button type="button" onClick={() => void uploadDelivery()} disabled={!file || busy} className="gold-seal flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-black disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {handoffStatus === "revision_requested" ? "Deliver revision" : "Deliver version"}
          </button>
        </div>
      )}

      {canReview && (
        <div className="mt-4 space-y-3">
          <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={1500} rows={3} placeholder="Add notes if this version needs changes" className="w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-gold/45" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPendingReview("request_revision")} disabled={busy || feedback.trim().length < 3} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-xs font-semibold text-white/65 disabled:opacity-35"><RotateCcw className="h-3.5 w-3.5" />Request revision</button>
            <button type="button" onClick={() => setPendingReview("approve")} disabled={busy} className="gold-seal flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-black disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" />Approve</button>
          </div>
        </div>
      )}

      {!canDeliver && !canReview && !loading && requestStatus === "accepted" && (
        <p className="mt-4 text-sm text-white/48">
          {handoffStatus === "delivered" ? (isProducer ? "Waiting for the artist to review the latest version." : "The latest version is ready for your review.") : handoffStatus === "revision_requested" ? "The producer is preparing a revised version." : "The producer will deliver the first version here."}
        </p>
      )}
      {requestStatus === "completed" && <p className="mt-4 flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />Approved by the artist. Session complete.</p>}

      <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
        {loading ? <p className="py-4 text-sm text-muted-foreground">Loading deliveries...</p> : deliverables.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No files delivered yet.</p> : deliverables.map((item) => (
          <div key={item.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-white/85">v{item.version_number} · {item.title}</p><p className="mt-0.5 truncate text-xs text-white/38">{item.file_name} · {formatBytes(item.byte_size)}</p></div>
              {item.download_url && <a href={item.download_url} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-gold" aria-label={`Download ${item.file_name}`}><Download className="h-4 w-4" /></a>}
            </div>
            {item.note && <p className="mt-2 text-xs leading-relaxed text-white/52">{item.note}</p>}
            {item.artist_feedback && <p className="mt-2 border-l border-gold/50 pl-2 text-xs leading-relaxed text-white/62">{item.artist_feedback}</p>}
            <div className="mt-2 text-[9px] uppercase tracking-[0.12em] text-white/32">{item.status.replace("_", " ")} · {new Date(item.delivered_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <AlertDialog open={pendingReview !== null} onOpenChange={(open) => !open && setPendingReview(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[390px] rounded-2xl border-white/12 bg-[#111113] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingReview === "approve" ? "Approve this delivery?" : "Request this revision?"}</AlertDialogTitle>
            <AlertDialogDescription>{pendingReview === "approve" ? "This will complete the session and preserve the approved version here." : "The producer will receive your note and can deliver a new version."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel className="min-h-11 rounded-xl border-white/12 bg-transparent text-white hover:bg-white/5 hover:text-white">Keep reviewing</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 rounded-xl bg-gold font-semibold text-black hover:bg-gold/90" onClick={() => pendingReview && void reviewDelivery(pendingReview)}>{pendingReview === "approve" ? "Approve delivery" : "Send revision note"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function HandoffBadge({ status }: { status: "not_started" | "delivered" | "revision_requested" | "approved" }) {
  const label = status === "not_started" ? "Not delivered" : status.replace("_", " ");
  return <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase", status === "approved" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : status === "delivered" ? "border-gold/30 bg-gold/10 text-gold" : "border-white/10 text-white/45")}>{label}</span>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
