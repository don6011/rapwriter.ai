"use client";

import type { BeatLockerRow, PrivateBeatImportInput } from "@/hooks/use-rapwriter-data";
import { formatDuration, formatFileSize } from "@/lib/studio/format";
import { readAudioFileDuration } from "@/lib/studio/waveform";
import { Upload, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

export function PrivateBeatImportSheet({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (input: PrivateBeatImportInput) => Promise<BeatLockerRow | null>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [producer, setProducer] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setFile(null);
    setTitle("");
    setProducer("");
    setBpm("");
    setMusicalKey("");
    setDurationSeconds(0);
    setRightsConfirmed(false);
    setSubmitting(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  const chooseFile = async (nextFile?: File) => {
    setError(null);
    if (!nextFile) return;
    const extension = nextFile.name.toLowerCase().split(".").pop();
    if (!extension || !["mp3", "wav"].includes(extension) || nextFile.size > 100 * 1024 * 1024) {
      setError("Choose an MP3 or WAV file under 100 MB.");
      return;
    }
    try {
      const duration = await readAudioFileDuration(nextFile);
      setFile(nextFile);
      setDurationSeconds(Math.max(1, Math.round(duration)));
      if (!title.trim()) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
    } catch {
      setError("RapWriter could not read this audio file.");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !title.trim() || !durationSeconds || !rightsConfirmed) {
      setError("Add a beat, title it, and confirm you have permission to use it.");
      return;
    }
    const parsedBpm = bpm.trim() ? Number(bpm) : null;
    if (parsedBpm !== null && (!Number.isInteger(parsedBpm) || parsedBpm < 40 || parsedBpm > 240)) {
      setError("BPM must be a whole number between 40 and 240.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const imported = await onImport({
        file,
        title: title.trim(),
        producer: producer.trim(),
        bpm: parsedBpm,
        musicalKey: musicalKey.trim() || null,
        durationSeconds,
      });
      if (imported) onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The beat could not be imported.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 px-3 pt-16 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.stopPropagation()}>
      <section className="w-full max-w-[430px] overflow-hidden rounded-t-3xl border border-white/12 bg-[#101011] shadow-[0_-24px_80px_rgba(0,0,0,0.72)]" role="dialog" aria-modal="true" aria-labelledby="private-beat-title">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 pb-4 pt-3">
          <div><div className="label-hw text-gold/80">Beat Locker</div><h2 id="private-beat-title" className="mt-1 text-xl font-semibold">Import your beat</h2><p className="mt-1 text-xs text-muted-foreground">Private to your account. Ready in Writer Flow.</p></div>
          <button type="button" onClick={onClose} disabled={submitting} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close beat import"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="max-h-[72dvh] space-y-4 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
          <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-gold/30 bg-gold/[0.04] px-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8"><Upload className="h-4 w-4 text-gold" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file?.name || "Choose MP3 or WAV"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{file ? `${formatFileSize(file.size)} / ${formatDuration(durationSeconds)}` : "Up to 100 MB"}</span></span>
            <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </label>

          <label className="block"><span className="label-hw text-white/48">Beat title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Untitled beat" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
          <label className="block"><span className="label-hw text-white/48">Producer credit</span><input value={producer} onChange={(event) => setProducer(event.target.value)} maxLength={120} placeholder="Optional" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label-hw text-white/48">BPM</span><input value={bpm} onChange={(event) => setBpm(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Optional" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
            <label className="block"><span className="label-hw text-white/48">Key</span><input value={musicalKey} onChange={(event) => setMusicalKey(event.target.value)} maxLength={32} placeholder="Optional" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-gold/45" /></label>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#ffb11b]" />
            <span className="text-xs leading-relaxed text-white/72">I own this beat or have permission to use it.</span>
          </label>
          {error && <div className="rounded-xl border border-rec/25 bg-rec/8 px-3 py-2.5 text-xs text-rec" role="alert">{error}</div>}
          <div className="grid grid-cols-[0.72fr_1.28fr] gap-3">
            <button type="button" onClick={onClose} disabled={submitting} className="min-h-12 rounded-xl border border-white/10 text-sm font-semibold text-white/68">Cancel</button>
            <button type="submit" disabled={submitting} className="min-h-12 rounded-xl bg-gold text-sm font-semibold text-black disabled:opacity-55">{submitting ? "Importing..." : "Add to Beat Locker"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
