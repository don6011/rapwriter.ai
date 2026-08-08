"use client";

import type { WorkspaceMembership } from "@/lib/membership";
import { producerActionEntitlement } from "@/lib/producer-actions";
import { findAnchorWord } from "@/lib/studio/intelligence";
import { linesFor } from "@/lib/studio/prosody";
import type { EnvironmentIntelligence, ProducerActionControls, ProducerPassId, SelectedBeat, StudioDna } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Check, LockKeyhole, RefreshCw, Undo2, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function ProducerPassPanel({
  sectionName,
  sectionText,
  beat,
  studioDna,
  environmentIntel,
  actions,
  membership,
  onUpgrade,
}: {
  sectionName: string;
  sectionText: string;
  beat: SelectedBeat;
  studioDna: StudioDna;
  environmentIntel: EnvironmentIntelligence;
  actions?: ProducerActionControls;
  membership?: WorkspaceMembership | null;
  onUpgrade?: () => void;
}) {
  const [activePass, setActivePass] = useState<ProducerPassId>(() => passFromProducerMode(studioDna.producer));
  const [previewMode, setPreviewMode] = useState<"original" | "revision">("revision");
  useEffect(() => setActivePass(passFromProducerMode(studioDna.producer)), [studioDna.producer]);
  useEffect(() => setPreviewMode("revision"), [actions?.proposal?.id]);
  const report = useMemo(
    () => buildProducerPassReport(activePass, sectionName, sectionText, beat, environmentIntel),
    [activePass, beat, environmentIntel, sectionName, sectionText],
  );
  const options: Array<{ id: ProducerPassId; label: string }> = [
    { id: "hook", label: "Hook Doctor" },
    { id: "rewrite", label: "Producer Rewrite" },
    { id: "commercial", label: "Commercial Pass" },
    { id: "pocket", label: "Pocket Adjustment" },
  ];
  const activePassUnlocked = !actions || membership?.entitlements[producerActionEntitlement(activePass)] === true;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((option) => {
          const unlocked = !actions || membership?.entitlements[producerActionEntitlement(option.id)] === true;
          return (
            <button
              type="button"
              key={option.id}
              onClick={() => setActivePass(option.id)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold",
                activePass === option.id ? "border-gold/40 bg-gold/12 text-gold" : "border-white/10 bg-black/24 text-muted-foreground",
              )}
            >
              {!unlocked && <LockKeyhole className="h-3 w-3" />}
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-gold/20 bg-gold/8 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="label-hw text-gold/80">{report.title}</div>
          <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Live</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/74">{report.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {report.signals.map((signal) => (
          <div key={signal} className="rounded-xl border border-white/10 bg-black/24 p-3 text-xs leading-relaxed text-muted-foreground">{signal}</div>
        ))}
      </div>

      <div className="space-y-2">
        {report.actions.map((action) => (
          <div key={action} className="flex gap-2 rounded-xl border border-white/10 bg-black/24 p-3 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <span>{action}</span>
          </div>
        ))}
      </div>

      {actions && !actions.proposal && (
        <button
          type="button"
          onClick={() => activePassUnlocked ? actions.onGenerate(activePass) : onUpgrade?.()}
          disabled={actions.status === "generating" || actions.status === "applying" || (activePassUnlocked && linesFor(sectionText).length < 2)}
          className="gold-seal flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
        >
          {actions.status === "generating" ? <RefreshCw className="h-4 w-4 animate-spin" /> : activePassUnlocked ? <WandSparkles className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
          {actions.status === "generating" ? "Building Revision..." : activePassUnlocked ? `Create ${report.title} Revision` : `Unlock ${report.title}`}
        </button>
      )}

      {actions?.proposal && actions.proposal.status === "previewed" && (
        <div className="rounded-xl border border-gold/25 bg-gold/8 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label-hw text-gold/85">Revision Preview</div>
              <div className="mt-1 text-sm font-semibold">{actions.proposal.title}</div>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
              {(["original", "revision"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={cn(
                    "min-h-8 rounded-md px-2.5 text-[10px] font-semibold capitalize",
                    previewMode === mode ? "bg-gold text-black" : "text-muted-foreground",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <pre className="mt-3 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/36 p-3 font-mono text-[12px] leading-6 text-white/82">
            {previewMode === "original" ? actions.proposal.originalContent : actions.proposal.proposedContent}
          </pre>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{actions.proposal.rationale}</p>
          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
            {actions.proposal.changes.map((change) => (
              <div key={change} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="text-gold">+</span>
                <span>{change}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={actions.onAccept}
              disabled={actions.status === "applying"}
              className="gold-seal flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-55"
            >
              <Check className="h-4 w-4" />
              Accept
            </button>
            <button
              type="button"
              onClick={actions.onRetry}
              disabled={actions.status === "applying"}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gold/25 bg-black/24 px-3 text-sm font-semibold text-gold disabled:opacity-55"
            >
              <RefreshCw className="h-4 w-4" />
              Try Another
            </button>
          </div>
          <button
            type="button"
            onClick={actions.onReject}
            disabled={actions.status === "applying"}
            className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-muted-foreground disabled:opacity-55"
          >
            <X className="h-4 w-4" />
            Reject Revision
          </button>
        </div>
      )}

      {actions?.proposal && (actions.proposal.status === "accepted" || actions.proposal.status === "reverted") && (
        <div className={cn("rounded-xl border p-3", actions.proposal.status === "accepted" ? "border-emerald-500/20 bg-emerald-500/8" : "border-white/10 bg-black/24")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={cn("label-hw", actions.proposal.status === "accepted" ? "text-emerald-300" : "text-muted-foreground")}>{actions.proposal.status === "accepted" ? "Revision Saved" : "Original Restored"}</div>
              <p className="mt-1 text-xs text-muted-foreground">{actions.proposal.status === "accepted" ? "The previous lyrics are protected in version history." : "The accepted revision remains in version history."}</p>
            </div>
            {actions.proposal.status === "accepted" && (
              <button type="button" onClick={actions.onUndo} disabled={actions.status === "applying"} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-white/80 disabled:opacity-55">
                <Undo2 className="h-4 w-4" />
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      {actions?.error && <div className="rounded-xl border border-rec/25 bg-rec/10 p-3 text-xs leading-relaxed text-rec">{actions.error}</div>}
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/34">Analysis refreshes while you write</p>
    </div>
  );
}

function passFromProducerMode(mode: string): ProducerPassId {
  if (mode === "Hook Doctor") return "hook";
  if (mode === "Commercial Producer") return "commercial";
  if (mode === "Battle Coach" || mode === "Southern Producer") return "pocket";
  return "rewrite";
}

function buildProducerPassReport(
  pass: ProducerPassId,
  sectionName: string,
  sectionText: string,
  beat: SelectedBeat,
  environmentIntel: EnvironmentIntelligence,
) {
  const lines = sectionText.split("\n").map((line) => line.trim()).filter(Boolean);
  const wordCounts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
  const averageWords = wordCounts.length ? Math.round(wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length) : 0;
  const spread = wordCounts.length ? Math.max(...wordCounts) - Math.min(...wordCounts) : 0;
  const anchor = findAnchorWord(sectionText);
  const bpm = typeof beat.bpm === "number" ? beat.bpm : 84;
  const pace = bpm >= 120 ? "fast" : bpm >= 92 ? "driving" : "open";
  const emptyAction = `Write at least two lines in ${sectionName} to unlock a sharper read.`;

  if (pass === "hook") {
    return {
      title: "Hook Doctor",
      summary: lines.length ? `${sectionName} has ${lines.length} active lines. ${anchor ? `“${anchor}” is the clearest repeatable anchor.` : "A repeatable anchor has not emerged yet."}` : `Hook Doctor is waiting on the first lines of ${sectionName}.`,
      signals: [`${lines.length} written lines`, anchor ? `Anchor: ${anchor}` : "No anchor yet"],
      actions: lines.length ? [
        anchor ? `Bring “${anchor}” back at the emotional payoff instead of introducing another idea.` : "Choose one phrase the listener can repeat after one play.",
        averageWords > 10 ? "Shorten the longest line so the hook leaves room for melody." : "Keep the hook language this direct and protect the strongest phrase.",
        environmentIntel.producerNotes[0],
      ] : [emptyAction],
    };
  }

  if (pass === "rewrite") {
    const longestLine = lines.reduce((longest, line) => line.split(/\s+/).length > longest.split(/\s+/).length ? line : longest, lines[0] ?? "");
    return {
      title: "Producer Rewrite",
      summary: lines.length ? `The revision plan keeps your voice intact: clarify the image, tighten the longest setup, and protect the section payoff.` : `Producer Rewrite is ready to shape ${sectionName} without replacing the artist's voice.`,
      signals: [`${averageWords || 0} words per line`, spread <= 4 ? "Line shape is consistent" : "Line shape varies"],
      actions: lines.length ? [
        longestLine ? `Tighten this setup first: “${longestLine.slice(0, 72)}${longestLine.length > 72 ? "..." : "”"}` : emptyAction,
        anchor ? `Use “${anchor}” to connect the section instead of adding a new subject.` : "Add one concrete image that makes the emotion visible.",
        environmentIntel.missionCue,
      ] : [emptyAction],
    };
  }

  if (pass === "commercial") {
    const replayReady = lines.length >= 4 && Boolean(anchor) && averageWords <= 11;
    return {
      title: "Commercial Pass",
      summary: replayReady ? "The section has a usable replay shape. The next move is making the title phrase impossible to miss." : "The record needs a clearer repeat point before the commercial shape is ready.",
      signals: [replayReady ? "Replay shape ready" : "Replay shape forming", anchor ? "Memory phrase detected" : "Memory phrase missing"],
      actions: lines.length ? [
        anchor ? `Treat “${anchor}” as the memory phrase and place it near the section landing.` : "Choose one title-ready phrase and repeat it with intention.",
        lines.length > 8 ? "Remove one idea before adding another; commercial sections reward focus." : "Keep the section focused on one promise, image, or emotion.",
        "Read the section once without the beat. The record idea should still be obvious.",
      ] : [emptyAction],
    };
  }

  return {
    title: "Pocket Adjustment",
    summary: lines.length ? `This ${bpm} BPM beat has a ${pace} pocket. Your line-length spread is ${spread} words.` : `Pocket Adjustment is listening for line shape against the ${bpm} BPM beat.`,
    signals: [`${bpm} BPM ${pace} pocket`, spread <= 4 ? "Cadence is balanced" : `${spread}-word line spread`],
    actions: lines.length ? [
      spread > 5 ? "Trim the longest line or split it across two breath points." : "Line lengths are close enough to perform cleanly; preserve that balance.",
      bpm >= 120 ? "Use shorter setups and let the landing bar breathe." : "Leave a pocket after the strongest words instead of filling every count.",
      `Record one rough take of ${sectionName}; the pocket is easier to hear than to read.`,
    ] : [emptyAction],
  };
}
