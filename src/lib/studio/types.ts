import type { LyricAnalysis, RoughTakeAnalysis } from "@/lib/booth-ready-v2";
import type { ProducerActionProposal, ProducerActionType } from "@/lib/producer-actions";
import type { ProfileRow } from "@/hooks/use-rapwriter-data";
import type { Beat, Producer } from "@/lib/marketplace";
import type { StudioRoomId } from "@/lib/studio-room-access";

export type { StudioRoomId };

export type MobileNavView = "studio" | "locker" | "market" | "profile";

export type StudioPackId = StudioRoomId;

export type StudioPack = {
  id: StudioPackId;
  label: string;
  eyebrow: string;
  headline: string;
  line: string;
  image: string;
  position: string;
  overlay: string;
  chip: string;
  bestFor: string[];
  ambience: Array<{
    title: string;
    detail: string;
  }>;
  writingCue: string;
};

export type SelectedBeat = {
  id: string;
  title: string;
  producer?: string;
  bpm?: number;
  key?: string;
  mood?: string;
  duration?: string | number;
  previewUrl?: string;
  audioUrl?: string;
  [key: string]: unknown;
};

export type PadActionStatus = {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
};

export type PadActions = {
  status: PadActionStatus;
  onSaveHook: () => void;
  onSaveSong: () => void;
  onFavoriteBeat: () => void;
  onAddBeatToProject: () => void;
};

export type ProducerActionStatus = "idle" | "generating" | "preview" | "applying" | "accepted" | "reverted" | "error";

export type ProducerActionControls = {
  proposal: ProducerActionProposal | null;
  status: ProducerActionStatus;
  error: string | null;
  onGenerate: (actionType: ProducerActionType, attempt?: number) => void;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
  onUndo: () => void;
};

export type ProducerPassId = "hook" | "rewrite" | "commercial" | "pocket";

export type SectionVersion = {
  id: string;
  version_number: number;
  content: string;
  bar_count: number;
  word_count: number;
  source: "autosave" | "manual" | "recovery" | "import" | "producer_action";
  created_at: string;
};

export type VersionHistoryStatus = "idle" | "loading" | "ready" | "restoring" | "error";

export type BoothReadyResult = {
  score: number;
  lyricScore: number;
  performanceScore: number;
  locked: boolean;
  nextAction: string;
  primaryAction: "write" | "record" | "save_take" | "review";
  primaryActionLabel: string;
  lockedReason: string;
  checklist: Array<{
    label: string;
    detail: string;
    complete: boolean;
  }>;
  improvements: string[];
  metrics: {
    structure: number;
    completion: number;
    cadence: number;
    hook: number;
    originality: number;
    replay: number;
  };
  performance: {
    takeExists: boolean;
    takeSaved: boolean;
    duration: number;
    sectionMatched: boolean;
    analyzing: boolean;
    analysis: RoughTakeAnalysis | null;
  };
  lyricAnalysis: LyricAnalysis;
  blockers: string[];
};

export type RecordReadinessStage = {
  id: "draft" | "session_ready" | "producer_pass" | "booth_ready";
  label: string;
};

export type RecordReadiness = {
  currentIndex: number;
  label: string;
  detail: string;
  stages: RecordReadinessStage[];
  certified: boolean;
};

export type BeatIntelligence = {
  beatBrief: string;
  beatTags: string[];
  nextMoveTitle: string;
  nextMoveBody: string;
  sectionCue: string;
  titleSeed: string;
};

export type EnvironmentIntelligence = {
  passTitle: string;
  missionCue: string;
  producerNotes: string[];
  boothFocusTitle: string;
  boothFocusBody: string;
  focusMetrics: string[];
};

export type ProductUnlock = {
  id: string;
  title: string;
  category: "Studio Room" | "Producer Style" | "Vocal Chain" | "Writing Pack" | "Ambient Pack" | "Theme" | "Bundle" | "Producer Profile" | "Beat License";
  detail: string;
  price: string;
  unlockedAt: string;
};

export type MarketplaceFeed = {
  beats: MarketplaceBeat[];
  producers: Producer[];
};

export type MarketplaceBeat = Beat & { previewUrl?: string; artworkUrl?: string; source?: "producer" };

export type StudioDna = {
  environment: StudioPackId;
  goal: string;
  style: string;
  mood: string;
  producer: string;
  studioAir: StudioAirPreference;
};

export type StudioAirPreference = {
  activeIndex: number;
  volume: number;
};

export type MobileDraftRecord = {
  version: 3;
  ownerId: string | null;
  updatedAt: string;
  syncedAt: string | null;
  unsynced: boolean;
  projectId: string | null;
  songId: string | null;
  sessionId: string | null;
  baseRevision: number | null;
  sections: Record<string, string>;
  activeSection: string;
  beat: SelectedBeat;
  studioPackId: StudioPackId;
  studioDna: StudioDna;
  playbackPositionSeconds: number;
};

export type ArtistGoal = NonNullable<ProfileRow["artist_goal"]>;
