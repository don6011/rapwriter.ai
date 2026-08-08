export type StarterBeatReleaseInput = {
  title?: string | null;
  producer_name?: string | null;
  rights_holder?: string | null;
  audio_path?: string | null;
  duration_seconds?: number | null;
  bpm?: number | null;
  genre?: string | null;
  mood?: string | null;
  tags?: string[] | null;
  collection_slug?: string | null;
  writing_fit?: string[] | null;
  attribution?: string | null;
};

export function getStarterBeatPublishBlockers(beat: StarterBeatReleaseInput) {
  const blockers: string[] = [];
  if (!beat.title?.trim()) blockers.push("Add a beat title");
  if (!beat.producer_name?.trim()) blockers.push("Add a producer credit");
  if (!beat.rights_holder?.trim()) blockers.push("Confirm the rights holder");
  if (!beat.audio_path?.trim()) blockers.push("Upload beat audio");
  if (!beat.duration_seconds || beat.duration_seconds < 1) blockers.push("Confirm the audio duration");
  if (!beat.bpm) blockers.push("Add the BPM");
  if (!beat.genre?.trim()) blockers.push("Choose a genre");
  if (!beat.mood?.trim()) blockers.push("Choose a mood");
  if (!beat.collection_slug?.trim()) blockers.push("Assign a collection");
  if ((beat.tags?.length ?? 0) < 2) blockers.push("Add at least two discovery tags");
  if ((beat.writing_fit?.length ?? 0) < 1) blockers.push("Add at least one writing fit");
  if (!beat.attribution?.trim()) blockers.push("Add rights attribution");
  return blockers;
}

export function isStarterBeatPublishReady(beat: StarterBeatReleaseInput) {
  return getStarterBeatPublishBlockers(beat).length === 0;
}
