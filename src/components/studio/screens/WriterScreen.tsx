"use client";

import { BoothReadyPanel } from "@/components/studio/panels/BoothReadyPanel";
import { MobileSectionTabs } from "@/components/studio/panels/MobileSectionTabs";
import { PadTransport } from "@/components/studio/panels/PadTransport";
import { PenView } from "@/components/studio/panels/PenView";
import { RoughTakeStrip } from "@/components/studio/panels/RoughTakeStrip";
import { MobileDrawer } from "@/components/studio/primitives/MobileDrawer";
import { GhostwriterSheet } from "@/components/studio/sheets/GhostwriterSheet";
import { StudioAirSheet } from "@/components/studio/sheets/StudioAirSheet";
import type { WorkspaceMembership } from "@/lib/membership";
import { countBars } from "@/lib/studio/bars";
import { getWritingMomentum } from "@/lib/studio/intelligence";
import { mobileSections } from "@/lib/studio/sections";
import type { BoothReadyResult, EnvironmentIntelligence, PadActions, ProducerActionControls, SelectedBeat, StudioDna, StudioPack } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Briefcase, ChevronRight, CloudOff, FolderPlus, Headphones, Heart, History, Pencil, Save, Sparkles, WandSparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function WriterScreen({
  readinessLaunchToken,
  activeSection,
  sectionContent,
  saveStatus,
  signedIn,
  boothReady,
  padActions,
  playing,
  recording,
  recordingSeconds,
  roughTakeUrl,
  roughTakeDuration,
  roughTakeBeat,
  roughTakeBeatPosition,
  recordError,
  roughTakeSaved,
  roughTakeSaving,
  selectedBeat,
  environmentIntel,
  beatCurrentTime,
  beatDuration,
  beatError,
  onBack,
  onOpenHistory,
  onSyncRequest,
  onSetActiveSection,
  onChange,
  onToggleBeat,
  onSeekBeat,
  onCommitBeatSeek,
  onChangeBeat,
  onToggleRecording,
  onDeleteRoughTake,
  onSaveRoughTake,
  onPrepareForBooth,
  studioPack,
  studioDna,
  studioAirPlaying,
  artistMembership,
  onUpgrade,
  onToggleStudioAir,
  onStudioAirVolume,
  producerActions,
}: {
  readinessLaunchToken: number;
  activeSection: number;
  sectionContent: Record<string, string>;
  saveStatus: "saved" | "saving" | "error";
  signedIn: boolean;
  boothReady: BoothReadyResult;
  padActions: PadActions;
  playing: boolean;
  recording: boolean;
  recordingSeconds: number;
  roughTakeUrl: string | null;
  roughTakeDuration: number;
  roughTakeBeat: SelectedBeat | null;
  roughTakeBeatPosition: number;
  recordError: string | null;
  roughTakeSaved: boolean;
  roughTakeSaving: boolean;
  selectedBeat: SelectedBeat;
  environmentIntel: EnvironmentIntelligence;
  beatCurrentTime: number;
  beatDuration: number;
  beatError: string | null;
  onBack: () => void;
  onOpenHistory: () => void;
  onSyncRequest: () => void;
  onSetActiveSection: (index: number) => void;
  onChange: (value: string) => void;
  onToggleBeat: () => void;
  onSeekBeat: (seconds: number) => void;
  onCommitBeatSeek: () => void;
  onChangeBeat: () => void;
  onToggleRecording: () => void;
  onDeleteRoughTake: () => void;
  onSaveRoughTake: () => void;
  onPrepareForBooth: () => void;
  studioPack: StudioPack;
  studioDna: StudioDna;
  studioAirPlaying: boolean;
  artistMembership: WorkspaceMembership | null;
  onUpgrade: () => void;
  onToggleStudioAir: (index: number) => void;
  onStudioAirVolume: (volume: number) => void;
  producerActions: ProducerActionControls;
}) {
  const section = mobileSections[activeSection];
  const sectionText = sectionContent[section.name] ?? "";
  const [penView, setPenView] = useState(false);
  const [ghostwriterOpen, setGhostwriterOpen] = useState(false);
  const [studioAirOpen, setStudioAirOpen] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [transportCompact, setTransportCompact] = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const writerScrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorPositionsRef = useRef<Record<string, { selectionStart: number; selectionEnd: number; scrollTop: number }>>({});
  const sectionBars = countBars(sectionText);
  const sectionWords = sectionText.trim() ? sectionText.trim().split(/\s+/).length : 0;
  const progressPct = Math.min(100, Math.round((sectionBars / section.target) * 100));
  const momentum = getWritingMomentum(section.name, sectionBars, section.target, boothReady);
  const writerSaveLabel = !signedIn ? "On device" : saveStatus === "error" ? "On device" : saveStatus;
  const hasPenView = artistMembership?.entitlements.full_pen_view === true;
  const hasHistory = artistMembership?.entitlements.version_history === true;
  const hasGhostwriter = artistMembership?.entitlements.ghostwriter === true;
  let logicalBarNumber = 0;
  const editorRows = sectionText.split("\n").map((text) => ({
    text,
    number: text.trim() ? ++logicalBarNumber : null,
  }));

  useEffect(() => {
    if (readinessLaunchToken > 0) setReadinessOpen(true);
  }, [readinessLaunchToken]);

  const rememberEditorPosition = useCallback((sectionName: string, editor = editorRef.current) => {
    if (!editor) return;
    editorPositionsRef.current[sectionName] = {
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      scrollTop: editor.scrollTop,
    };
  }, []);

  const switchSection = useCallback((index: number) => {
    if (index === activeSection) return;
    rememberEditorPosition(section.name);
    onSetActiveSection(index);
  }, [activeSection, onSetActiveSection, rememberEditorPosition, section.name]);

  useEffect(() => {
    if (penView) return;
    const frame = window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const savedPosition = editorPositionsRef.current[section.name];
      if (savedPosition) {
        const textLength = editor.value.length;
        editor.setSelectionRange(
          Math.min(savedPosition.selectionStart, textLength),
          Math.min(savedPosition.selectionEnd, textLength),
        );
        editor.scrollTop = savedPosition.scrollTop;
        setEditorScrollTop(savedPosition.scrollTop);
      } else {
        editor.scrollTop = 0;
        setEditorScrollTop(0);
      }
      editor.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [penView, section.name]);

  return (
    <div
      ref={writerScrollRef}
      data-testid="writer-scroll"
      onScroll={(event) => setTransportCompact(event.currentTarget.scrollTop > 180)}
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#050506]"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cover opacity-[0.24] blur-[1px] saturate-[0.82]"
        style={{ backgroundImage: `url('${studioPack.image}')`, backgroundPosition: studioPack.position }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: studioPack.overlay }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 0%, ${studioPack.tone}, transparent 42%)` }}
      />
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/52 px-5 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Exit writer">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <div className="label-hw text-gold">Writer Flow</div>
          <button
            type="button"
            onClick={() => setStudioAirOpen(true)}
            className="mx-auto mt-1 flex max-w-[13.5rem] items-center gap-1.5 text-xs text-muted-foreground"
            aria-label="Open room ambience"
          >
            <Headphones className={cn("h-3 w-3 shrink-0", studioAirPlaying && "text-gold")} />
            <span className="truncate">{studioPack.label}</span>
            {studioAirPlaying && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />}
          </button>
        </div>
        <button
          type="button"
          onClick={signedIn ? onOpenHistory : onSyncRequest}
          aria-label={signedIn ? "Open revision history" : "Protect device-only draft"}
          title={signedIn ? "Revision history" : "Sign in to sync"}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-white/8",
            !signedIn || saveStatus === "error" ? "bg-gold/12 text-gold" : "bg-emerald-500/12 text-emerald-300",
          )}
        >
          {signedIn ? <History className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
          {writerSaveLabel}
        </button>
      </div>

      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#070708]/94 backdrop-blur-xl">
        <MobileSectionTabs sectionContent={sectionContent} activeSection={activeSection} onSetActiveSection={switchSection} />
      </div>

      <div className="relative z-10 bg-[#070708]/88 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 pb-4 pt-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="label-hw">Now writing</div>
              <div className="mt-1 text-lg font-semibold">{section.name}</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div><span className="text-gold">{sectionBars}</span> / {section.target} bars</div>
              <div className="mt-1">{sectionWords} words</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold shadow-[0_0_16px_rgba(246,199,72,0.5)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${progressPct}%` }} />
          </div>
          <div key={momentum.label} className="mt-3 flex min-h-12 items-center gap-3 border-t border-white/10 pt-3 animate-[fade-in_240ms_ease-out] motion-reduce:animate-none">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/10 text-gold">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gold">{momentum.label}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{momentum.detail}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-none flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="sticky top-16 z-20 mb-3 transition-[padding] duration-200">
          <PadTransport
            beat={selectedBeat}
            playing={playing}
            recording={recording}
            compact={transportCompact}
            currentTime={beatCurrentTime}
            duration={beatDuration}
            error={beatError}
            onToggleBeat={onToggleBeat}
            onSeek={onSeekBeat}
            onSeekCommit={onCommitBeatSeek}
            onChangeBeat={onChangeBeat}
            onToggleRecording={onToggleRecording}
          />
          <RoughTakeStrip
            recording={recording}
            recordingSeconds={recordingSeconds}
            roughTakeUrl={roughTakeUrl}
            roughTakeDuration={roughTakeDuration}
            beat={roughTakeBeat}
            beatStartTime={roughTakeBeatPosition}
            error={recordError}
            saved={roughTakeSaved}
            saving={roughTakeSaving}
            analyzing={boothReady.performance.analyzing}
            analysis={boothReady.performance.analysis}
            onDelete={onDeleteRoughTake}
            onSave={onSaveRoughTake}
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/26 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-gold/28 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_3px_rgba(246,199,72,0.055),0_18px_50px_rgba(0,0,0,0.3)]">
          {penView ? (
            <PenView sectionName={section.name} text={sectionText} />
          ) : (
            <div className="relative min-h-[54svh] overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div className="p-5" style={{ transform: `translateY(-${editorScrollTop}px)` }}>
                  {editorRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-[36px_minmax(0,1fr)]">
                      <span className="pr-3 text-right font-mono text-[10px] leading-9 tabular-nums text-white/28">
                        {row.number}
                      </span>
                      <span className="invisible min-h-9 whitespace-pre-wrap break-words font-sans text-[18px] leading-9">
                        {row.text || "\u00a0"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <textarea
                ref={editorRef}
                autoFocus
                value={sectionText}
                onChange={(event) => {
                  onChange(event.target.value);
                  rememberEditorPosition(section.name, event.currentTarget);
                }}
                onSelect={(event) => rememberEditorPosition(section.name, event.currentTarget)}
                onScroll={(event) => {
                  setEditorScrollTop(event.currentTarget.scrollTop);
                  rememberEditorPosition(section.name, event.currentTarget);
                }}
                onBlur={(event) => rememberEditorPosition(section.name, event.currentTarget)}
                placeholder={`Start ${section.name}...`}
                aria-label={`${section.name} lyrics`}
                spellCheck={false}
                className="relative min-h-[54svh] w-full flex-none resize-none bg-transparent py-5 pl-14 pr-5 font-sans text-[18px] leading-9 text-white/92 caret-gold outline-none placeholder:text-white/28"
              />
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-1 border-t border-white/10 bg-black/24 p-1.5 backdrop-blur-xl">
            <div className="min-w-0 px-2">
              <div className="text-[10px] font-semibold tabular-nums text-white/72">{sectionBars} / {section.target} bars</div>
              <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.13em] text-emerald-300/80">{writerSaveLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => hasPenView ? setPenView((current) => !current) : onUpgrade()}
              className={cn(
                "flex min-h-10 flex-col items-center justify-center rounded-full border px-2.5 text-[9px] font-semibold transition-colors",
                penView ? "border-gold/45 bg-gold/14 text-gold" : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.035]",
              )}
              aria-pressed={penView}
            >
              <Pencil className="mb-0.5 h-3.5 w-3.5" />
              {penView ? "Edit" : hasPenView ? "Pen View" : "Pen Pro"}
            </button>
            <button type="button" onClick={!signedIn ? onSyncRequest : hasHistory ? onOpenHistory : onUpgrade} className="flex min-h-10 flex-col items-center justify-center rounded-full border border-transparent px-2.5 text-[9px] font-semibold text-muted-foreground transition-colors hover:border-white/10 hover:bg-white/[0.035]">
              <History className="mb-0.5 h-3.5 w-3.5" />
              {hasHistory ? "History" : "History Pro"}
            </button>
            <button type="button" onClick={padActions.onSaveHook} disabled={padActions.status.state === "saving"} className="flex min-h-10 flex-col items-center justify-center rounded-full border border-transparent px-2.5 text-[9px] font-semibold text-gold transition-colors hover:border-gold/20 hover:bg-gold/[0.06] disabled:opacity-50">
              <Save className="mb-0.5 h-3.5 w-3.5" />
              Save hook
            </button>
          </div>
        </div>
        {padActions.status.message && (
          <div className={cn("mt-2 text-center text-[11px]", padActions.status.state === "error" ? "text-rec" : "text-gold")}>{padActions.status.message}</div>
        )}
        <button
          type="button"
          onClick={() => hasGhostwriter ? setGhostwriterOpen(true) : onUpgrade()}
          className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-gold/35 bg-gold/10 px-4 text-sm font-semibold text-gold"
        >
          <span className="inline-flex items-center gap-2"><WandSparkles className="h-4 w-4" />Ghostwriter{hasGhostwriter ? "" : " Pro"}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-4 space-y-2 pb-4">
          <MobileDrawer title="Session Actions">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Save song", icon: Briefcase, action: padActions.onSaveSong },
                { label: "Save beat", icon: Heart, action: padActions.onFavoriteBeat },
                { label: "Add to project", icon: FolderPlus, action: padActions.onAddBeatToProject },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} type="button" onClick={item.action} className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/22 px-2 text-[10px] font-semibold text-muted-foreground">
                    <Icon className="h-4 w-4 text-gold" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </MobileDrawer>
          <MobileDrawer title="Record Readiness" open={readinessOpen} onOpenChange={setReadinessOpen}>
            <BoothReadyPanel
              result={boothReady}
              environmentIntel={environmentIntel}
              onPrimaryAction={() => {
                if (boothReady.primaryAction === "record") {
                  onToggleRecording();
                  return;
                }
                if (boothReady.primaryAction === "save_take") {
                  onSaveRoughTake();
                  return;
                }
                if (boothReady.score >= 75) {
                  onPrepareForBooth();
                  return;
                }
                setGhostwriterOpen(true);
              }}
            />
          </MobileDrawer>
        </div>
      </div>
      <GhostwriterSheet
        open={ghostwriterOpen}
        sectionName={section.name}
        sectionText={sectionText}
        beat={selectedBeat}
        studioDna={studioDna}
        environmentIntel={environmentIntel}
        actions={producerActions}
        membership={artistMembership}
        onUpgrade={onUpgrade}
        onClose={() => setGhostwriterOpen(false)}
      />
      <StudioAirSheet
        open={studioAirOpen}
        studioPack={studioPack}
        activeIndex={studioDna.studioAir.activeIndex}
        playing={studioAirPlaying}
        volume={studioDna.studioAir.volume}
        onClose={() => setStudioAirOpen(false)}
        onToggle={onToggleStudioAir}
        onVolume={onStudioAirVolume}
      />
    </div>
  );
}
