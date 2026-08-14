"use client";

import { BoothReadyPanel } from "@/components/studio/panels/BoothReadyPanel";
import { MobileSectionTabs } from "@/components/studio/panels/MobileSectionTabs";
import { PadTransport } from "@/components/studio/panels/PadTransport";
import { PenView } from "@/components/studio/panels/PenView";
import { RoughTakeStrip } from "@/components/studio/panels/RoughTakeStrip";
import { MobileDrawer } from "@/components/studio/primitives/MobileDrawer";
import { GhostwriterSheet } from "@/components/studio/sheets/GhostwriterSheet";
import { RevisionHistoryUpgradeSheet } from "@/components/studio/sheets/RevisionHistoryUpgradeSheet";
import { StudioAirSheet } from "@/components/studio/sheets/StudioAirSheet";
import type { WorkspaceMembership } from "@/lib/membership";
import { countBars } from "@/lib/studio/bars";
import { getWritingMomentum } from "@/lib/studio/intelligence";
import { mobileSections } from "@/lib/studio/sections";
import type { BoothReadyResult, EnvironmentIntelligence, PadActions, ProducerActionControls, SelectedBeat, StudioDna, StudioPack } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Briefcase, ChevronRight, CloudOff, Download, FolderPlus, Headphones, Heart, History, LockKeyhole, Pencil, Save, WandSparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordingMode } from "@/components/studio/state/use-rough-take";
import { toast } from "sonner";

export function WriterScreen({
  songTitle,
  readinessLaunchToken,
  activeSection,
  sectionContent,
  saveStatus,
  signedIn,
  boothReady,
  padActions,
  playing,
  recording,
  recordingMode,
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
  onRecordingModeChange,
  onDeleteRoughTake,
  onSaveRoughTake,
  onContinueRoughTake,
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
  songTitle: string;
  readinessLaunchToken: number;
  activeSection: number;
  sectionContent: Record<string, string>;
  saveStatus: "saved" | "saving" | "error";
  signedIn: boolean;
  boothReady: BoothReadyResult;
  padActions: PadActions;
  playing: boolean;
  recording: boolean;
  recordingMode: RecordingMode;
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
  onToggleRecording: (mode?: RecordingMode) => void;
  onRecordingModeChange: (mode: RecordingMode) => void;
  onDeleteRoughTake: () => void;
  onSaveRoughTake: () => void;
  onContinueRoughTake: (takeOffsetSeconds: number) => void;
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
  const [historyUpgradeOpen, setHistoryUpgradeOpen] = useState(false);
  const [transportCompact, setTransportCompact] = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const writerScrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorPositionsRef = useRef<Record<string, { selectionStart: number; selectionEnd: number; scrollTop: number }>>({});
  const sectionBars = countBars(sectionText);
  const momentum = getWritingMomentum(section.name, sectionBars, section.target, boothReady);
  const previousMomentumRef = useRef(momentum.label);
  const writerSaveLabel = !signedIn ? "On device" : saveStatus === "error" ? "On device" : saveStatus;
  const hasPenView = artistMembership?.entitlements.full_pen_view === true;
  const hasHistory = artistMembership?.entitlements.version_history === true;
  const hasGhostwriter = artistMembership?.entitlements.ghostwriter === true;
  const hasPremiumExports = artistMembership?.entitlements.premium_exports === true;
  const savePrimary = section.name === "Hook" ? padActions.onSaveHook : padActions.onSaveSong;
  const savePrimaryLabel = section.name === "Hook" ? "Save hook" : "Save song";
  let logicalBarNumber = 0;
  const editorRows = sectionText.split("\n").map((text) => ({
    text,
    number: text.trim() ? ++logicalBarNumber : null,
  }));

  const openHistory = () => {
    if (!signedIn) {
      onSyncRequest();
      return;
    }
    if (!hasHistory) {
      setHistoryUpgradeOpen(true);
      return;
    }
    onOpenHistory();
  };

  useEffect(() => {
    if (readinessLaunchToken > 0) setReadinessOpen(true);
  }, [readinessLaunchToken]);

  useEffect(() => {
    if (previousMomentumRef.current === momentum.label) return;
    previousMomentumRef.current = momentum.label;
    toast(momentum.label, { description: momentum.detail });
  }, [momentum.detail, momentum.label]);

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
        <div className="min-w-0 flex-1 px-2 text-center">
          <div className="truncate text-sm font-semibold text-white/92">{songTitle}</div>
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
          onClick={openHistory}
          aria-label={!signedIn ? "Protect device-only draft" : hasHistory ? "Open revision history" : "Learn about revision history"}
          title={!signedIn ? "Sign in to sync" : hasHistory ? "Revision history" : "Revision history with Pro"}
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
        <MobileSectionTabs sectionContent={sectionContent} activeSection={activeSection} onSetActiveSection={switchSection} disabled={recording} />
      </div>

      <div className="relative z-10 flex flex-none flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="sticky top-16 z-20 mb-3 transition-[padding] duration-200">
          <PadTransport
            beat={selectedBeat}
            playing={playing}
            recording={recording}
            recordingMode={recordingMode}
            compact={transportCompact}
            currentTime={beatCurrentTime}
            duration={beatDuration}
            error={beatError}
            onToggleBeat={onToggleBeat}
            onSeek={onSeekBeat}
            onSeekCommit={onCommitBeatSeek}
            onChangeBeat={onChangeBeat}
            onToggleRecording={onToggleRecording}
            onRecordingModeChange={onRecordingModeChange}
          />
          <RoughTakeStrip
            overlay
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
            onContinue={onContinueRoughTake}
          />
        </div>
        <div className="isolate overflow-hidden rounded-2xl border border-white/12 bg-black/26 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-gold/28 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_3px_rgba(246,199,72,0.055),0_18px_50px_rgba(0,0,0,0.3)]">
          {penView ? (
            <PenView sectionName={section.name} text={sectionText} />
          ) : (
            <div className="relative min-h-[54svh] overflow-hidden bg-black/18 backdrop-blur-sm">
              <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-14 top-0 z-0 w-px bg-white/[0.055]" />
              <div
                aria-hidden="true"
                data-testid="bar-gutter"
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
              >
                <div className="p-5" style={{ transform: `translateY(-${editorScrollTop}px)` }}>
                  {editorRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-[44px_minmax(0,1fr)]">
                      <span className="pr-4 text-right font-mono text-[10px] leading-9 tabular-nums text-white/18">
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
                className="relative z-10 min-h-[54svh] w-full flex-none resize-none bg-transparent py-5 pl-16 pr-5 font-sans text-[18px] leading-9 text-white/92 caret-gold outline-none placeholder:text-white/28"
              />
            </div>
          )}
          <div className="relative z-20 grid grid-cols-[1fr_auto_auto_auto] items-center gap-1 border-t border-white/10 bg-black/24 p-1.5 backdrop-blur-xl">
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
            <button type="button" onClick={openHistory} className="flex min-h-10 flex-col items-center justify-center rounded-full border border-transparent px-2.5 text-[9px] font-semibold text-muted-foreground transition-colors hover:border-white/10 hover:bg-white/[0.035]">
              <History className="mb-0.5 h-3.5 w-3.5" />
              {hasHistory ? "History" : "History Pro"}
            </button>
            <button type="button" onClick={savePrimary} disabled={padActions.status.state === "saving" || (section.name === "Hook" && !sectionText.trim())} className="flex min-h-10 flex-col items-center justify-center rounded-full border border-transparent px-2.5 text-[9px] font-semibold text-gold transition-colors hover:border-gold/20 hover:bg-gold/[0.06] disabled:opacity-40">
              <Save className="mb-0.5 h-3.5 w-3.5" />
              {savePrimaryLabel}
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
            <button
              type="button"
              onClick={() => signedIn && !hasPremiumExports ? onUpgrade() : onPrepareForBooth()}
              className="mt-2 flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/[0.07] px-4 text-left transition-colors hover:border-gold/45 hover:bg-gold/10"
            >
              <span className="inline-flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/25 bg-black/25 text-gold">
                  <Download className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">Export Song</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">Lyrics, studio package, and rough take</span>
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/25 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-gold">
                {!hasPremiumExports && <LockKeyhole className="h-3 w-3" />}
                {hasPremiumExports ? "Ready" : "Pro"}
              </span>
            </button>
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
      <RevisionHistoryUpgradeSheet open={historyUpgradeOpen} onClose={() => setHistoryUpgradeOpen(false)} onUpgrade={onUpgrade} />
    </div>
  );
}
