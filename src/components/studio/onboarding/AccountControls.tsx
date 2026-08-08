"use client";

import { ChevronDown, Download, Settings, Trash2, X } from "lucide-react";
import { useState } from "react";

export function AccountControls({ email, onSignOut }: { email: string | null; onSignOut: () => Promise<void> }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const exportAccount = async () => {
    setBusy(true);
    setStatus("Preparing your archive...");
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Account export failed.");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `rapwriter-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus("Archive ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account export failed.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;

    setBusy(true);
    setStatus("Deleting account...");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Account deletion failed.");
      setDeleteDialogOpen(false);
      await onSignOut();
      window.location.assign("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account deletion failed.");
      setBusy(false);
    }
  };

  return (
    <>
      <details className="mt-4 rounded-2xl border border-white/10 bg-[#111113]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8 text-gold">
            <Settings className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Account settings</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{email ?? "Exports and account controls"}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </summary>
        <div className="border-t border-white/10 p-3">
          <button onClick={() => void exportAccount()} disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-4 text-sm font-semibold text-gold disabled:opacity-50">
            <Download className="h-4 w-4" />
            Export my data
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmation("");
              setStatus("");
              setDeleteDialogOpen(true);
            }}
            disabled={busy}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rec/25 bg-rec/8 px-4 text-sm font-semibold text-rec disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
          {status && <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">{status}</p>}
        </div>
      </details>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:py-6">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-[400px] rounded-3xl border border-rec/25 bg-[#111113] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-hw text-rec">Permanent action</div>
                <h2 id="delete-account-title" className="mt-2 text-xl font-semibold">Delete this account?</h2>
              </div>
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close account deletion"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">This permanently removes your songs, projects, Locker, rough takes, and account access. Export your data first if you need a copy.</p>
            <label className="mt-5 block">
              <span className="label-hw text-white/50">Type DELETE to continue</span>
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} disabled={busy} autoFocus aria-label="Account deletion confirmation" className="mt-2 min-h-12 w-full rounded-xl border border-white/12 bg-black/40 px-4 text-sm font-semibold outline-none focus:border-rec/50 disabled:opacity-50" />
            </label>
            {status && <p className="mt-3 text-xs leading-5 text-rec">{status}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={busy} className="min-h-12 rounded-xl border border-white/10 text-sm font-semibold text-white/70 disabled:opacity-40">Keep account</button>
              <button type="button" onClick={() => void deleteAccount()} disabled={busy || deleteConfirmation !== "DELETE"} className="min-h-12 rounded-xl border border-rec/35 bg-rec px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy ? "Deleting..." : "Delete permanently"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
