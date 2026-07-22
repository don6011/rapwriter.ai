export type StarterBeat = {
  id: string;
  slug: string;
  title: string;
  producer: string;
  producerProfileId: string | null;
  sourceType: "suno_licensed" | "producer_donated";
  rightsHolder: string;
  licenseScope: "rapwriter_starter_nonexclusive";
  duration: number;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  mood: string | null;
  tags: string[];
  attribution: string;
  previewUrl: string;
  artworkUrl: string | null;
};
