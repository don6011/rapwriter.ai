"use client";

import { BoothReadyPanel } from "@/components/studio/panels/BoothReadyPanel";
import { MobileProjectRail } from "@/components/studio/panels/MobileProjectRail";
import { MobileSectionTabs } from "@/components/studio/panels/MobileSectionTabs";
import { PadTransport } from "@/components/studio/panels/PadTransport";
import { ProducerPassPanel } from "@/components/studio/panels/ProducerPassPanel";
import { RoughTakeStrip } from "@/components/studio/panels/RoughTakeStrip";
import { MobileDrawer } from "@/components/studio/primitives/MobileDrawer";
import { StudioAirSheet } from "@/components/studio/sheets/StudioAirSheet";
import { StudioPackSheet } from "@/components/studio/sheets/StudioPackSheet";
import type { ProjectRow, SongRow } from "@/hooks/use-rapwriter-data";
import type { StudioRoomAccess } from "@/lib/studio-room-access";
import { getProjectTitle } from "@/lib/studio/format";
import { studioDnaCue } from "@/lib/studio/intelligence";
import { mobileSections } from "@/lib/studio/sections";
import type { BeatIntelligence, BoothReadyResult, EnvironmentIntelligence, PadActionStatus, SelectedBeat, StudioDna, StudioPack, StudioPackId } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, CloudOff, FolderPlus, Headphones, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { RecordingMode } from "@/components/studio/state/use-rough-take";

export function StudioScreen({
  completionPct,
  boothReady,
  saveStatus,
  sectionContent,
  activeSection,
  roughTakeUrl,
  roughTakeDuration,
  roughTakeBeat,
  roughTakeBeatPosition,
  recording,
  recordingMode,
  recordingSeconds,
  recordError,
  onDeleteRoughTake,
  roughTakeSaved,
  roughTakeSaving,
  onSaveRoughTake,
  onContinueRoughTake,
  activeSong,
  songTitleDraft,
  titleEditing,
  titleStatus,
  songState,
  selectedBeat,
  beatIntel,
  environmentIntel,
  playing,
  beatCurrentTime,
  beatDuration,
  beatError,
  onTitleDraft,
  onStartTitleEdit,
  onCancelTitleEdit,
  onSaveTitle,
  onToggleRecording,
  onRecordingModeChange,
  onSetActiveSection,
  onToggleBeat,
  onSeekBeat,
  onCommitBeatSeek,
  onChangeBeat,
  onContinue,
  songs,
  projects,
  signedIn,
  onSyncRequest,
  onLoadSong,
  onNewSong,
  studioPack,
  studioPacks,
  studioDna,
  studioAirPlaying,
  getStudioPackAccess,
  onOpenMembership,
  onStudioPack,
  onPreviewStudioPack,
  onStudioDna,
  onToggleStudioAir,
  onStudioAirVolume,
}: {
  completionPct: number;
  boothReady: BoothReadyResult;
  saveStatus: "saved" | "saving" | "error";
  sectionContent: Record<string, string>;
  activeSection: number;
  roughTakeUrl: string | null;
  roughTakeDuration: number;
  roughTakeBeat: SelectedBeat | null;
  roughTakeBeatPosition: number;
  recording: boolean;
  recordingMode: RecordingMode;
  recordingSeconds: number;
  recordError: string | null;
  onDeleteRoughTake: () => void;
  roughTakeSaved: boolean;
  roughTakeSaving: boolean;
  onSaveRoughTake: () => void;
  onContinueRoughTake: (takeOffsetSeconds: number) => void;
  activeSong: SongRow | null;
  songTitleDraft: string;
  titleEditing: boolean;
  titleStatus: PadActionStatus;
  songState: { label: string; tone: "muted" | "gold" | "green" };
  selectedBeat: SelectedBeat;
  beatIntel: BeatIntelligence;
  environmentIntel: EnvironmentIntelligence;
  playing: boolean;
  beatCurrentTime: number;
  beatDuration: number;
  beatError: string | null;
  onTitleDraft: (value: string) => void;
  onStartTitleEdit: () => void;
  onCancelTitleEdit: () => void;
  onSaveTitle: () => void;
  onToggleRecording: (mode?: RecordingMode) => void;
  onRecordingModeChange: (mode: RecordingMode) => void;
  onSetActiveSection: (index: number) => void;
  onToggleBeat: () => void;
  onSeekBeat: (seconds: number) => void;
  onCommitBeatSeek: () => void;
  onChangeBeat: () => void;
  onContinue: () => void;
  songs: SongRow[];
  projects: ProjectRow[];
  signedIn: boolean;
  onSyncRequest: () => void;
  onLoadSong: (song: SongRow) => void;
  onNewSong: (projectId?: string) => void;
  studioPack: StudioPack;
  studioPacks: StudioPack[];
  studioDna: StudioDna;
  studioAirPlaying: boolean;
  getStudioPackAccess: (id: StudioPackId) => StudioRoomAccess;
  onOpenMembership: () => void;
  onStudioPack: (id: StudioPackId) => void;
  onPreviewStudioPack: (id: StudioPackId) => void;
  onStudioDna: () => void;
  onToggleStudioAir: (index: number) => void;
  onStudioAirVolume: (volume: number) => void;
}) {
  const section = mobileSections[activeSection];
  const [studioPackSheetOpen, setStudioPackSheetOpen] = useState(false);
  const [studioAirOpen, setStudioAirOpen] = useState(false);
  const previewLines = (sectionContent[section.name] || "").split("\n").filter((line) => line.trim());
  const songTitle = activeSong?.title ?? "Untitled Song";
  const projectTitle = getProjectTitle(activeSong) ?? "No project selected";
  const sessionStatus = signedIn
    ? saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "error"
        ? "Sync pending"
        : "Saved to cloud"
    : "Saved on device";
  const padStatus = saveStatus === "saving" ? "Saving" : saveStatus === "error" ? "On device" : "Saved";

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none pb-32">
      <section className="relative h-[288px] overflow-hidden">
        <img
          src={studioPack.image}
          alt={studioPack.label}
          className="studio-depth-shift absolute inset-0 h-full w-full object-cover transition-[object-position,filter] duration-700"
          style={{ objectPosition: studioPack.position }}
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        <div className="absolute inset-0 transition-colors duration-700" style={{ background: studioPack.overlay }} />
        <div className="absolute bottom-8 left-5 right-5">
          <h1 className="max-w-[22rem] text-[30px] font-semibold leading-[1.05]">{studioPack.headline}</h1>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStudioPackSheetOpen(true)}
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-gold/25 bg-black/38 px-3 py-1.5 text-left text-sm font-medium text-gold backdrop-blur-md"
              aria-label="Open studio packs"
            >
              <span className="truncate">{studioPack.label}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setStudioAirOpen(true)}
              className={cn(
                "relative grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-black/38 backdrop-blur-md",
                studioAirPlaying ? "border-gold/45 text-gold" : "border-gold/25 text-gold/75",
              )}
              aria-label="Open room ambience"
              title="Room ambience"
            >
              <Headphones className="h-3.5 w-3.5" />
              {studioAirPlaying && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />}
            </button>
          </div>
        </div>
      </section>

      <section className="px-5">
        <div className="-mt-1 label-hw mb-2">Current session</div>
        <div className="rounded-2xl border border-white/10 bg-[#151516]/92 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.34)]">
          <div className="flex items-center gap-3">
            <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-gold/20 bg-black">
              <img src="/brand/rapwriter-main-logo.webp" alt="Project artwork" className="h-full w-full object-cover" draggable={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {titleEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={songTitleDraft}
                        onChange={(event) => onTitleDraft(event.target.value)}
                        className="min-h-10 min-w-0 flex-1 rounded-xl border border-gold/30 bg-black/42 px-3 text-base font-semibold outline-none"
                        maxLength={160}
                        autoFocus
                      />
                      <button onClick={onSaveTitle} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-black" aria-label="Save song title">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={onCancelTitleEdit} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Cancel title edit">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-lg font-semibold leading-tight">{songTitle}</div>
                      <button onClick={onStartTitleEdit} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Rename song">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{projectTitle}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        songState.tone === "green"
                          ? "bg-emerald-500/14 text-emerald-300"
                          : songState.tone === "gold"
                            ? "bg-gold/12 text-gold"
                            : "bg-white/8 text-muted-foreground",
                      )}
                    >
                      {songState.label}
                    </span>
                  </div>
                  {titleStatus.message && (
                    <div className={cn("mt-2 text-[11px]", titleStatus.state === "error" ? "text-rec" : "text-gold")}>{titleStatus.message}</div>
                  )}
                </div>
                <div className="pt-8 text-xs tabular-nums text-white/85">{completionPct}%</div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
                <div className="h-full rounded-full bg-[var(--amber)] shadow-[0_0_14px_rgba(246,199,72,0.55)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
            {signedIn ? (
              <span className={cn("font-medium", saveStatus === "error" ? "text-gold" : "text-muted-foreground")}>{sessionStatus}</span>
            ) : (
              <button type="button" onClick={onSyncRequest} className="inline-flex items-center gap-1.5 font-medium text-gold" aria-label="Protect device-only draft">
                <CloudOff className="h-3.5 w-3.5" />
                {sessionStatus}
              </button>
            )}
            <button type="button" onClick={onContinue} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-gold/25 bg-gold/8 px-3 font-semibold text-gold" aria-label={`Continue writing ${songTitle}`}>
              Continue writing
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {projects.length <= 1 && (
          <button type="button" onClick={() => onNewSong()} className="ml-auto mt-2 flex min-h-10 items-center gap-2 px-1 text-xs font-semibold text-white/65">
            <FolderPlus className="h-4 w-4 text-gold" />
            New song
          </button>
        )}
      </section>

      {projects.length > 1 && (
        <MobileProjectRail
          projects={projects}
          songs={songs}
          activeProjectId={activeSong?.project_id}
          studioPacks={studioPacks}
          onLoadSong={onLoadSong}
          onNewSong={onNewSong}
        />
      )}

      <section className="space-y-3 px-5 pt-5">
        <div className="rounded-2xl border border-white/10 bg-[#111113] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="label-hw">Writing pad</div>
              <div className="mt-1 text-sm text-white/90">{section.name} - target {section.target} bars</div>
            </div>
            <div
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                saveStatus === "error" ? "bg-gold/12 text-gold" : "bg-emerald-500/14 text-emerald-300",
              )}
            >
              {padStatus}
            </div>
          </div>
          <MobileSectionTabs sectionContent={sectionContent} activeSection={activeSection} onSetActiveSection={onSetActiveSection} preview />
          <div className="rounded-xl border border-border bg-black/35 p-3">
            <PadTransport
              beat={selectedBeat}
              playing={playing}
              recording={recording}
              recordingMode={recordingMode}
              compact={false}
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
              compact
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
            <button
              type="button"
              onClick={onContinue}
              data-testid="open-writer-flow"
              className="mt-3 min-h-[112px] w-full rounded-xl px-1 py-2 text-left font-mono text-[13px] leading-7 text-white/90 outline-none transition-colors hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-gold/45"
              aria-label={`Continue writing ${section.name}`}
            >
              {previewLines.length ? (
                previewLines.slice(0, 3).map((line, index) => <p key={`${section.name}-${index}`}>{line}</p>)
              ) : (
                <p className="text-white/40">Tap to start {section.name}...</p>
              )}
              <span className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-xs font-sans font-semibold text-gold">
                Continue {section.name}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </div>

        <MobileDrawer title="Session Guide" defaultOpen>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="label-hw text-gold/80">Best next action</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{completionPct}% complete</div>
            </div>
            <div className="mt-2 text-lg font-semibold">{beatIntel.nextMoveTitle}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{beatIntel.nextMoveBody}</p>
            <details className="group mt-4 border-t border-white/10 pt-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white/72">
                Session direction
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 pb-1 pt-2">
                <div>
                  <div className="label-hw">Beat pocket</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beatIntel.beatBrief}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {beatIntel.beatTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-gold/20 bg-gold/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-gold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="label-hw">Section cue</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beatIntel.sectionCue}</p>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="label-hw">Room direction</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">{studioDnaCue(studioDna, studioPack)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">{environmentIntel.missionCue}</p>
                </div>
              </div>
            </details>
          </div>
        </MobileDrawer>
        <MobileDrawer title="Producer Notes">
          <ProducerPassPanel
            sectionName={section.name}
            sectionText={sectionContent[section.name] ?? ""}
            beat={selectedBeat}
            studioDna={studioDna}
            environmentIntel={environmentIntel}
          />
        </MobileDrawer>
        <MobileDrawer title="Record Readiness">
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
              onContinue();
            }}
          />
        </MobileDrawer>
      </section>
      <StudioPackSheet
        open={studioPackSheetOpen}
        active={studioPack.id}
        packs={studioPacks}
        getStudioPackAccess={getStudioPackAccess}
        onClose={() => setStudioPackSheetOpen(false)}
        onPreview={onPreviewStudioPack}
        onOpenMembership={() => {
          setStudioPackSheetOpen(false);
          onOpenMembership();
        }}
        onStudioDna={() => {
          setStudioPackSheetOpen(false);
          onStudioDna();
        }}
        onSelect={(id) => {
          onStudioPack(id);
          setStudioPackSheetOpen(false);
        }}
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
