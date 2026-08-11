"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { RoughTakeRow } from "@/hooks/use-rapwriter-data";
import { analyzeRoughTakeAudio, type RoughTakeAnalysis } from "@/lib/booth-ready-v2";
import { beatSnapshotFromRecord } from "@/lib/studio/beat-snapshot";
import { isRoughTakeAnalysis } from "@/lib/studio/booth-ready";
import type { SelectedBeat } from "@/lib/studio/types";

/**
 * The thirteen values that used to live as separate `useState` calls in the shell.
 *
 * `recording` and the take payload are deliberately independent: re-recording keeps the
 * previous take's url/duration/analysis until the new one lands, which is what makes the
 * old take keep counting toward Booth Ready mid-retake. See REFACTOR_NOTES.md.
 */
export type RoughTakeState = {
  recording: boolean;
  recordStartedAt: number | null;
  recordingSeconds: number;
  error: string | null;
  url: string | null;
  blob: Blob | null;
  duration: number;
  beat: SelectedBeat | null;
  beatPosition: number;
  recordingMode: RecordingMode;
  saved: boolean;
  saving: boolean;
  analyzing: boolean;
  analysis: RoughTakeAnalysis | null;
};

export type RecordingMode = "with_beat" | "vocals_only";

const initialState: RoughTakeState = {
  recording: false,
  recordStartedAt: null,
  recordingSeconds: 0,
  error: null,
  url: null,
  blob: null,
  duration: 0,
  beat: null,
  beatPosition: 0,
  recordingMode: "with_beat",
  saved: false,
  saving: false,
  analyzing: false,
  analysis: null,
};

type RoughTakeAction =
  | { type: "record/arm" }
  | { type: "record/armed"; beat: SelectedBeat | null; beatPosition: number; recordingMode: RecordingMode }
  | { type: "record/started"; startedAt: number }
  | { type: "record/tick"; seconds: number }
  | { type: "record/failed"; message: string }
  | { type: "record/unavailable"; message: string }
  | { type: "take/captured"; url: string; blob: Blob; duration: number }
  | { type: "take/analysis-ready"; analysis: RoughTakeAnalysis }
  | { type: "take/analysis-failed"; message: string }
  | { type: "take/analysis-settled" }
  | {
      type: "take/hydrated";
      url: string;
      duration: number;
      beat: SelectedBeat | null;
      beatPosition: number;
      recordingMode: RecordingMode;
      analysis: RoughTakeAnalysis | null;
    }
  | { type: "take/server-cleared" }
  | { type: "take/deleted" }
  | { type: "take/reset-for-song-switch" }
  | { type: "take/reset-for-new-song" }
  | { type: "save/blocked"; message: string }
  | { type: "save/started" }
  | { type: "save/succeeded" }
  | { type: "save/failed"; message: string }
  | { type: "save/settled" };

export function roughTakeReducer(state: RoughTakeState, action: RoughTakeAction): RoughTakeState {
  switch (action.type) {
    case "record/arm":
      return { ...state, error: null, analyzing: false };
    case "record/armed":
      return { ...state, beat: action.beat, beatPosition: action.beatPosition, recordingMode: action.recordingMode };
    case "record/started":
      return { ...state, recording: true, recordingSeconds: 0, recordStartedAt: action.startedAt };
    case "record/tick":
      return { ...state, recordingSeconds: action.seconds };
    case "record/failed":
      return { ...state, error: action.message, recording: false, recordStartedAt: null };
    case "record/unavailable":
      return { ...state, error: action.message };
    case "take/captured":
      return {
        ...state,
        blob: action.blob,
        url: action.url,
        duration: action.duration,
        saved: false,
        analyzing: true,
        recording: false,
        recordStartedAt: null,
        recordingSeconds: 0,
      };
    case "take/analysis-ready":
      return { ...state, analysis: action.analysis };
    case "take/analysis-failed":
      return { ...state, analysis: null, error: action.message };
    case "take/analysis-settled":
      return { ...state, analyzing: false };
    case "take/hydrated":
      return {
        ...state,
        url: action.url,
        duration: action.duration,
        beat: action.beat,
        beatPosition: action.beatPosition,
        recordingMode: action.recordingMode,
        saved: true,
        analysis: action.analysis,
      };
    case "take/server-cleared":
      return { ...state, analysis: null, beat: null, beatPosition: 0, recordingMode: "with_beat" };
    case "take/deleted":
      return {
        ...state,
        blob: null,
        url: null,
        duration: 0,
        beat: null,
        beatPosition: 0,
        recordingMode: "with_beat",
        saved: false,
        analysis: null,
        analyzing: false,
        error: null,
      };
    case "take/reset-for-song-switch":
      return { ...state, blob: null, url: null, duration: 0, saved: false, analysis: null, analyzing: false };
    case "take/reset-for-new-song":
      return { ...state, blob: null, url: null, duration: 0, saved: false };
    case "save/blocked":
      return { ...state, error: action.message };
    case "save/started":
      return { ...state, saving: true, error: null };
    case "save/succeeded":
      return { ...state, saved: true, blob: null };
    case "save/failed":
      return { ...state, error: action.message };
    case "save/settled":
      return { ...state, saving: false };
  }
}

export type StartRecordingOptions = {
  recordingMode: RecordingMode;
  /** Read after getUserMedia resolves, so the beat position matches the real take start. */
  captureBeat: () => { beat: SelectedBeat | null; beatPosition: number };
  /** Runs immediately before recorder.start(), for kicking off beat playback. */
  beforeStart: (beat: SelectedBeat | null) => Promise<void>;
};

export function useRoughTake(serverTake: RoughTakeRow | null) {
  const [state, dispatch] = useReducer(roughTakeReducer, initialState);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<BlobPart[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const analysisRunRef = useRef(0);
  const urlRef = useRef<string | null>(null);
  const recordBeatRef = useRef<SelectedBeat | null>(null);
  const recordBeatPositionRef = useRef(0);

  const { recording, recordStartedAt, blob } = state;

  useEffect(() => {
    if (!recording || !recordStartedAt) return;
    const timer = window.setInterval(() => {
      dispatch({ type: "record/tick", seconds: Math.max(0, Math.floor((Date.now() - recordStartedAt) / 1000)) });
    }, 250);
    return () => window.clearInterval(timer);
  }, [recordStartedAt, recording]);

  useEffect(() => {
    if (blob) return;
    if (!serverTake) {
      dispatch({ type: "take/server-cleared" });
      return;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    dispatch({
      type: "take/hydrated",
      url: serverTake.signed_url,
      duration: serverTake.duration_seconds,
      beat: beatSnapshotFromRecord(serverTake.beat_snapshot) ?? null,
      beatPosition: Math.max(0, Number(serverTake.beat_position_seconds) || 0),
      recordingMode: beatSnapshotFromRecord(serverTake.beat_snapshot) ? "with_beat" : "vocals_only",
      analysis: isRoughTakeAnalysis(serverTake.analysis) ? serverTake.analysis : null,
    });
  }, [serverTake, blob]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startRecording = useCallback(async ({ captureBeat, beforeStart, recordingMode }: StartRecordingOptions) => {
    dispatch({ type: "record/arm" });
    analysisRunRef.current += 1;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      dispatch({ type: "record/unavailable", message: "Recording is not available in this browser." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      recorderChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      const startedAt = Date.now();
      const { beat: beatAtStart, beatPosition: beatPositionAtStart } = captureBeat();
      recorderRef.current = recorder;
      recordBeatRef.current = beatAtStart;
      recordBeatPositionRef.current = beatPositionAtStart;
      dispatch({ type: "record/armed", beat: beatAtStart, beatPosition: beatPositionAtStart, recordingMode });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const analysisRunId = analysisRunRef.current;
        const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const captured = new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(captured);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        dispatch({ type: "take/captured", url, blob: captured, duration });
        recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        try {
          const analysis = await analyzeRoughTakeAudio(captured);
          if (analysisRunRef.current === analysisRunId) dispatch({ type: "take/analysis-ready", analysis });
        } catch {
          if (analysisRunRef.current === analysisRunId) {
            dispatch({
              type: "take/analysis-failed",
              message: "Take recorded. Performance analysis was unavailable in this browser.",
            });
          }
        } finally {
          if (analysisRunRef.current === analysisRunId) dispatch({ type: "take/analysis-settled" });
        }
      };

      await beforeStart(beatAtStart);
      recorder.start();
      dispatch({ type: "record/started", startedAt });
    } catch {
      dispatch({ type: "record/failed", message: "Microphone permission was blocked." });
    }
  }, []);

  const deleteTake = useCallback(() => {
    analysisRunRef.current += 1;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    recordBeatRef.current = null;
    recordBeatPositionRef.current = 0;
    dispatch({ type: "take/deleted" });
  }, []);

  return {
    state,
    /** Beat the take was recorded over, when state.beat has not been populated yet. */
    recordBeatRef,
    recordBeatPositionRef,
    startRecording,
    stopRecording,
    deleteTake,
    resetForSongSwitch: useCallback(() => dispatch({ type: "take/reset-for-song-switch" }), []),
    resetForNewSong: useCallback(() => dispatch({ type: "take/reset-for-new-song" }), []),
    blockSave: useCallback((message: string) => dispatch({ type: "save/blocked", message }), []),
    saveStarted: useCallback(() => dispatch({ type: "save/started" }), []),
    saveSucceeded: useCallback(() => dispatch({ type: "save/succeeded" }), []),
    saveFailed: useCallback((message: string) => dispatch({ type: "save/failed", message }), []),
    saveSettled: useCallback(() => dispatch({ type: "save/settled" }), []),
  };
}
