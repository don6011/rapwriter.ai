import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { roughTakeReducer, type RoughTakeState } from "@/components/studio/state/use-rough-take";
import { readMobileDraftRecord, writeMobileDraftRecord } from "@/lib/studio/draft-storage";
import { defaultStudioDna } from "@/lib/studio/dna";
import { EMPTY_BEAT } from "@/lib/studio/beat-snapshot";

describe("mobile studio shell refactor contracts", () => {
  test("keeps the saved take and Booth Ready analysis visible during a retake", () => {
    const analysis = {
      version: 2 as const,
      durationSeconds: 12,
      rms: 0.22,
      peak: 0.71,
      dynamicRange: 0.49,
      clippingRatio: 0,
      silenceRatio: 0.05,
      onsetCount: 18,
      wordsPerMinuteEstimate: 96,
      presenceScore: 78,
      controlScore: 74,
      energyScore: 81,
      timingScore: 77,
      notes: [],
    };
    const savedTake = {
      recording: false,
      recordStartedAt: null,
      recordingSeconds: 0,
      error: "old error",
      url: "blob:existing-take",
      blob: null,
      duration: 12,
      beat: EMPTY_BEAT,
      beatPosition: 34,
      recordingMode: "with_beat",
      saved: true,
      saving: false,
      analyzing: false,
      analysis,
    } satisfies RoughTakeState;

    const armed = roughTakeReducer(savedTake, { type: "record/arm" });
    const recording = roughTakeReducer(armed, { type: "record/started", startedAt: 1000 });

    expect(recording.recording).toBe(true);
    expect(recording.url).toBe(savedTake.url);
    expect(recording.duration).toBe(savedTake.duration);
    expect(recording.saved).toBe(true);
    expect(recording.analysis).toBe(analysis);
    expect(recording.error).toBeNull();
  });

  test("lets a saved take scrub and continue from its matching beat position", () => {
    const shell = readFileSync(new URL("../../components/MobileStudioShell.tsx", import.meta.url), "utf8");
    const strip = readFileSync(new URL("../../components/studio/panels/RoughTakeStrip.tsx", import.meta.url), "utf8");
    const waveform = readFileSync(new URL("../../components/studio/waveform/TakeWaveform.tsx", import.meta.url), "utf8");

    expect(waveform).toContain('aria-label="Seek rough take"');
    expect(waveform).toContain("onSeek(ratio * duration)");
    expect(strip).toContain("onSeek={seekReview}");
    expect(strip).toContain("Continue at {formatDuration(resumeBeatTime)}");
    expect(strip).toContain("onContinue(resumeOffset)");
    expect(shell).toContain("getTakeResumeBeatTime(");
    expect(shell).toContain('void startRecording({ beat: recordingBeat, beatPosition, recordingMode: "with_beat" })');
  });

  test("keeps beat preview separate from selecting a beat", () => {
    const locker = readFileSync(new URL("../../components/studio/screens/LockerScreen.tsx", import.meta.url), "utf8");
    const switcher = readFileSync(new URL("../../components/studio/sheets/BeatSwitcherSheet.tsx", import.meta.url), "utf8");

    expect(locker).toContain("resolveBeatPreviewUrl(snapshot)");
    expect(locker).toContain("onPreview={() => void togglePreview");
    expect(switcher).toContain("toggleSample(previewId, beatSnapshotFromStarterBeat(beat))");
    expect(switcher).toContain("stopSample(); onUseStarterBeat(beat);");
    expect(switcher).toContain("stopSample(); onUseBeat(beat);");
  });

  test("supports explicit vocal-only recording and a vocal Locker collection", () => {
    const shell = readFileSync(new URL("../../components/MobileStudioShell.tsx", import.meta.url), "utf8");
    const transport = readFileSync(new URL("../../components/studio/panels/PadTransport.tsx", import.meta.url), "utf8");
    const locker = readFileSync(new URL("../../components/studio/screens/LockerScreen.tsx", import.meta.url), "utf8");

    expect(shell).toContain('nextRecordingMode === "vocals_only"');
    expect(shell).toContain('take.state.recordingMode === "vocals_only" ? null');
    expect(transport).toContain('"Vocals only"');
    expect(transport).toContain('{recording ? "Stop" : "Start"}');
    expect(transport).toContain("setRecordFlowOpen(true)");
    expect(transport).toContain("onToggleRecording(mode)");
    expect(locker).toContain('{ id: "vocals", label: "Vocals"');
    expect(locker).toContain("<LockerVocalCard");
  });

  test("restores an owner-scoped draft and active section after storage reload", () => {
    const values = new Map<string, string>();
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
        },
      },
    });

    writeMobileDraftRecord({
      version: 3,
      ownerId: "artist-1",
      updatedAt: "2026-08-08T12:00:00.000Z",
      syncedAt: null,
      unsynced: true,
      projectId: "project-1",
      songId: "song-1",
      sessionId: "session-1",
      baseRevision: 4,
      sections: { Hook: "Keep this hook", "Verse 1": "Keep this verse", "Verse 2": "", Bridge: "", Outro: "" },
      activeSection: "Verse 1",
      beat: EMPTY_BEAT,
      studioPackId: "midnight",
      studioDna: defaultStudioDna,
      playbackPositionSeconds: 19,
    });

    const restored = readMobileDraftRecord("artist-1");
    expect(restored?.sections.Hook).toBe("Keep this hook");
    expect(restored?.sections["Verse 1"]).toBe("Keep this verse");
    expect(restored?.activeSection).toBe("Verse 1");
    expect(restored?.playbackPositionSeconds).toBe(19);
    expect(readMobileDraftRecord("artist-2")).toBeNull();

    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  test("keeps auth above Studio Pack and replaces coupled state when songs switch", () => {
    const authDrawer = readFileSync(new URL("../../components/studio/sheets/MobileAuthDrawer.tsx", import.meta.url), "utf8");
    const packSheet = readFileSync(new URL("../../components/studio/sheets/StudioPackSheet.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../../components/MobileStudioShell.tsx", import.meta.url), "utf8");

    expect(authDrawer).toContain("z-[60]");
    expect(packSheet).toContain("z-50");
    expect(packSheet).toContain("onClick={() => onUnlock(previewPack.id)}");
    expect(shell).toContain("setSectionContent(nextSections)");
    expect(shell).toContain("setActiveSection(nextSectionIndex >= 0 ? nextSectionIndex : 0)");
    expect(shell).toContain("take.resetForSongSwitch()");
    expect(shell).toContain("selectBeatKeepingPreview(nextBeat)");
    expect(shell).toContain("setActiveStudioPackId(nextPack)");
    expect(shell).toContain("setStudioDna({ ...nextDna, environment: nextPack })");
    expect(shell).toContain("seekTo(nextPlaybackPosition)");
    expect(shell).toContain("projectId: song.project_id");
    expect(shell).toContain("songId: song.id");
  });

  test("opens restored writing directly while empty studios remain on home", () => {
    const shell = readFileSync(new URL("../../components/MobileStudioShell.tsx", import.meta.url), "utf8");

    expect(shell).toContain('useState<"home" | "writer">("home")');
    expect(shell).toContain('if (activeNav !== "studio") return');
    expect(shell).toContain("if (countTotalBars(sectionContent) === 0) return");
    expect(shell).toContain('setScreen("writer")');
  });

  test("uses logical bar numbers instead of a visual-row rule grid", () => {
    const writer = readFileSync(new URL("../../components/studio/screens/WriterScreen.tsx", import.meta.url), "utf8");

    expect(writer).toContain('const editorRows = sectionText.split("\\n")');
    expect(writer).toContain("text.trim() ? ++logicalBarNumber : null");
    expect(writer).toContain("editorRows.map((row, index)");
    expect(writer).not.toContain("repeating-linear-gradient");
  });

  test("keeps Writer Flow focused by overlaying transient recording UI", () => {
    const writer = readFileSync(new URL("../../components/studio/screens/WriterScreen.tsx", import.meta.url), "utf8");
    const strip = readFileSync(new URL("../../components/studio/panels/RoughTakeStrip.tsx", import.meta.url), "utf8");
    const transport = readFileSync(new URL("../../components/studio/panels/PadTransport.tsx", import.meta.url), "utf8");

    expect(writer).not.toContain("Now writing");
    expect(writer).toContain("toast(momentum.label");
    expect(writer).toContain("<RoughTakeStrip\n            overlay");
    expect(writer).toContain('className="pointer-events-none absolute inset-0 z-0 overflow-hidden"');
    expect(writer).toContain('className="relative z-10 min-h-[54svh]');
    expect(strip).toContain('"fixed inset-0 z-[70] flex items-end justify-center"');
    expect(transport).not.toContain('className="mt-1.5 flex items-center justify-between gap-2 border-t');
  });

  test("makes the active Studio card a truthful Current Session resume surface", () => {
    const studioScreen = readFileSync(new URL("../../components/studio/screens/StudioScreen.tsx", import.meta.url), "utf8");

    expect(studioScreen).toContain("Current session");
    expect(studioScreen).toContain("Continue writing");
    expect(studioScreen).toContain("Saved to cloud");
    expect(studioScreen).not.toContain("Session status");
    expect(studioScreen).not.toContain("syncMessage");
  });

  test("previews locked rooms without activating them and makes DNA rails scrollable", () => {
    const dnaSheet = readFileSync(new URL("../../components/studio/sheets/StudioDnaSheet.tsx", import.meta.url), "utf8");
    const dnaChoice = readFileSync(new URL("../../components/studio/primitives/StudioDnaChoice.tsx", import.meta.url), "utf8");
    expect(dnaSheet).toContain("setPreviewEnvironment(nextEnvironment)");
    expect(dnaSheet).toContain("if (canUseStudioPack(nextEnvironment)) onChange");
    expect(dnaSheet).toContain("previewPack.image");
    expect(dnaChoice).toContain("rail.scrollBy");
    expect(dnaChoice).toContain("canScrollForward");
    expect(dnaChoice).not.toContain("pointer-events-none");
  });
});
