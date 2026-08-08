export const mobileSections = [
  { name: "Hook", target: 8 },
  { name: "Verse 1", target: 16 },
  { name: "Verse 2", target: 16 },
  { name: "Bridge", target: 8 },
  { name: "Outro", target: 4 },
] as const;

export const blankStarterLyrics: Record<string, string> = {
  Hook: "",
  "Verse 1": "",
  "Verse 2": "",
  Bridge: "",
  Outro: "",
};
