import { defaultStudioRoomId } from "@/lib/studio-room-access";
import type { StudioDna } from "@/lib/studio/types";

export const defaultStudioDna: StudioDna = {
  environment: defaultStudioRoomId,
  goal: "Hit Record",
  style: "Storytelling",
  mood: "Late Night",
  producer: "Commercial Producer",
  studioAir: {
    activeIndex: 0,
    volume: 16,
  },
};

export const artistGoals = ["Hit Record", "Freestyle", "Mixtape", "Album", "Battle"];
export const writingStyles = ["Street", "Mainstream", "Southern", "Underground", "Storytelling", "Melodic", "Conscious"];
export const sessionMoods = ["Pain", "Hustle", "Victory", "Love", "Club", "Late Night", "Reflection"];
export const producerModes = ["Ghostwriter", "Hook Doctor", "Battle Coach", "Story Coach", "Commercial Producer", "Southern Producer"];
