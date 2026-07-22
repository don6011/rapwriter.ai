// Shared catalog for RapWriter Marketplace.
// Used by Marketplace component + Studio for "Write To This Beat" handoff.

export type License = "Lease" | "Premium Lease" | "Exclusive" | "Stems + Exclusive";

export type EmotionalTag =
  | "Pain" | "Victory" | "Motivation" | "Heartbreak"
  | "Late Night Drive" | "Strip Club" | "Storytelling"
  | "Hustle" | "Love" | "Soul" | "Street" | "Club";

export type Beat = {
  id: string;
  title: string;
  producer: string;
  producerId: string;
  verified?: boolean;
  bpm: number;
  key: string;
  mood: string;
  region: string;
  tags: string[];
  duration: string;
  art: string;          // CSS gradient
  glyph: string;        // 2-3 char monogram
  prices: { license: License; price: number }[];
  plays: number;
  tag?: string;         // RW tag
  // ---- Booth Ready metrics ---------------------------------------------
  boothReadyScore: number;     // 0-100 — how often songs written to this beat reach Booth Ready
  completionRate: number;      // 0-100 — % of sessions that finish a full song
  tracksFinished: number;      // raw count of finished tracks
  writingNow: number;          // active rappers writing in the last hour
  emotionalTags: EmotionalTag[];
};


export type Producer = {
  id: string;
  name: string;
  handle: string;
  city: string;
  bio: string;
  verified: boolean;
  sales: number;        // beats sold
  followers: number;
  rating: number;       // 0-5
  avatar: string;       // gradient
  banner: string;       // gradient
  glyph: string;
};

export type BeatPack = {
  id: string;
  title: string;
  curator: string;
  count: number;
  price: number;
  art: string;
  glyph: string;
  vibe: string;
  bpmRange: string;
};

export type Region = {
  id: string;
  name: string;
  glyph: string;
  art: string;
  count: number;
  signature: string;
};

export type Mood = {
  id: string;
  name: string;
  glyph: string;
  art: string;
  count: number;
};

// ---- PRODUCERS ----------------------------------------------------------

export const producers: Producer[] = [
  {
    id: "nightowl",
    name: "NightOwl",
    handle: "@nightowl808",
    city: "Memphis, TN",
    bio: "Slow, smoke-thick beats for after-midnight pens. Pianos that feel like neon on wet pavement.",
    verified: true,
    sales: 14820,
    followers: 92400,
    rating: 4.9,
    avatar: "linear-gradient(135deg, #0a0a1a 0%, #1a1438 60%, #c9a84c 130%)",
    banner: "linear-gradient(120deg, #050510 0%, #1a0f2e 35%, #3d1a4a 65%, #c9a84c 130%)",
    glyph: "NO",
  },
  {
    id: "808baron",
    name: "808 Baron",
    handle: "@808baron",
    city: "Atlanta, GA",
    bio: "Subs that move stadiums. Trap chapel anthems.",
    verified: true,
    sales: 21340,
    followers: 138900,
    rating: 4.8,
    avatar: "linear-gradient(135deg, #1a0f08 0%, #3d2410 50%, #d4842a 130%)",
    banner: "linear-gradient(120deg, #0a0604 0%, #2a1810 40%, #6b3a1c 70%, #d4842a 130%)",
    glyph: "8B",
  },
  {
    id: "sundayhouse",
    name: "Sunday House",
    handle: "@sundayhouse",
    city: "Houston, TX",
    bio: "Soul samples, slowed strings, gospel chops. Pen church.",
    verified: true,
    sales: 9430,
    followers: 54100,
    rating: 4.9,
    avatar: "linear-gradient(135deg, #2d0a1f 0%, #5c1840 50%, #d4842a 130%)",
    banner: "linear-gradient(120deg, #1a0512 0%, #3d0f2a 35%, #7a2050 65%, #e8b84a 130%)",
    glyph: "SH",
  },
  {
    id: "vinylvictor",
    name: "Vinyl Victor",
    handle: "@vinylvictor",
    city: "Detroit, MI",
    bio: "Crate-dug loops, dusty drums, lo-fi with weight.",
    verified: true,
    sales: 6720,
    followers: 38200,
    rating: 4.7,
    avatar: "linear-gradient(135deg, #051a1a 0%, #0d3838 50%, #5cbdb9 130%)",
    banner: "linear-gradient(120deg, #020c0c 0%, #0a2424 40%, #1e5a5a 70%, #5cbdb9 130%)",
    glyph: "VV",
  },
];

// ---- BEATS --------------------------------------------------------------

export const beats: Beat[] = [
  {
    id: "smoke-velvet",
    title: "Smoke & Velvet",
    producer: "NightOwl", producerId: "nightowl", verified: true,
    bpm: 84, key: "F# Minor", mood: "Late-Night · Sultry", region: "Memphis",
    tags: ["Pain", "Soul"], duration: "3:42",
    art: "linear-gradient(160deg, #0a0a1a 0%, #1a1438 50%, #c9a84c 130%)", glyph: "SV",
    prices: [{ license: "Lease", price: 49 }, { license: "Premium Lease", price: 149 }, { license: "Exclusive", price: 899 }],
    plays: 184230, tag: "RW-0421",
    boothReadyScore: 94, completionRate: 71, tracksFinished: 1284, writingNow: 47,
    emotionalTags: ["Pain", "Late Night Drive", "Heartbreak", "Storytelling"],
  },
  {
    id: "cathedral-88",
    title: "Cathedral 88",
    producer: "Sunday House", producerId: "sundayhouse", verified: true,
    bpm: 76, key: "Eb Minor", mood: "Sacred · Heavy", region: "Houston",
    tags: ["Soul", "Pain"], duration: "4:18",
    art: "linear-gradient(200deg, #2d0a1f 0%, #5c1840 50%, #d4842a 110%)", glyph: "C8",
    prices: [{ license: "Lease", price: 59 }, { license: "Exclusive", price: 1200 }],
    plays: 96420, tag: "RW-0388",
    boothReadyScore: 91, completionRate: 68, tracksFinished: 842, writingNow: 22,
    emotionalTags: ["Pain", "Victory", "Motivation", "Storytelling"],
  },
  {
    id: "lowlight",
    title: "Lowlight",
    producer: "NightOwl", producerId: "nightowl", verified: true,
    bpm: 92, key: "C# Minor", mood: "Pensive · Cinematic", region: "Memphis",
    tags: ["Love", "Pain"], duration: "3:24",
    art: "linear-gradient(180deg, #051a1a 0%, #0d3838 50%, #5cbdb9 130%)", glyph: "LL",
    prices: [{ license: "Lease", price: 49 }, { license: "Exclusive", price: 850 }],
    plays: 73910, tag: "RW-0402",
    boothReadyScore: 88, completionRate: 64, tracksFinished: 612, writingNow: 18,
    emotionalTags: ["Heartbreak", "Late Night Drive", "Love"],
  },
  {
    id: "trunk-rattle",
    title: "Trunk Rattle",
    producer: "808 Baron", producerId: "808baron", verified: true,
    bpm: 140, key: "G Minor", mood: "Aggressive · Trap", region: "Atlanta",
    tags: ["Street", "Hustle"], duration: "3:01",
    art: "linear-gradient(135deg, #1a0f08 0%, #3d2410 50%, #d4842a 130%)", glyph: "TR",
    prices: [{ license: "Lease", price: 49 }, { license: "Exclusive", price: 999 }],
    plays: 245100, tag: "RW-0455",
    boothReadyScore: 96, completionRate: 78, tracksFinished: 2104, writingNow: 86,
    emotionalTags: ["Street", "Hustle", "Victory"],
  },
  {
    id: "gold-grill",
    title: "Gold Grill",
    producer: "808 Baron", producerId: "808baron", verified: true,
    bpm: 132, key: "A Minor", mood: "Flex · Club", region: "Atlanta",
    tags: ["Club", "Victory"], duration: "2:48",
    art: "linear-gradient(135deg, #0a0604 0%, #2a1810 50%, #e8b84a 130%)", glyph: "GG",
    prices: [{ license: "Lease", price: 59 }, { license: "Exclusive", price: 1500 }],
    plays: 312700, tag: "RW-0461",
    boothReadyScore: 92, completionRate: 74, tracksFinished: 1872, writingNow: 64,
    emotionalTags: ["Strip Club", "Club", "Victory", "Hustle"],
  },
  {
    id: "back-porch",
    title: "Back Porch Gospel",
    producer: "Sunday House", producerId: "sundayhouse", verified: true,
    bpm: 72, key: "D Minor", mood: "Soul · Warm", region: "Louisiana",
    tags: ["Soul", "Motivation"], duration: "3:56",
    art: "linear-gradient(160deg, #1a0512 0%, #3d0f2a 50%, #e8b84a 130%)", glyph: "BP",
    prices: [{ license: "Lease", price: 49 }, { license: "Exclusive", price: 950 }],
    plays: 54200, tag: "RW-0377",
    boothReadyScore: 86, completionRate: 62, tracksFinished: 438, writingNow: 11,
    emotionalTags: ["Motivation", "Storytelling", "Soul"],
  },
  {
    id: "dusty-loop",
    title: "Dusty Loop No. 7",
    producer: "Vinyl Victor", producerId: "vinylvictor", verified: true,
    bpm: 88, key: "F Minor", mood: "Lo-Fi · Nostalgic", region: "Detroit",
    tags: ["Pain", "Love"], duration: "3:12",
    art: "linear-gradient(180deg, #020c0c 0%, #0a2424 50%, #5cbdb9 130%)", glyph: "D7",
    prices: [{ license: "Lease", price: 39 }, { license: "Exclusive", price: 700 }],
    plays: 41800, tag: "RW-0339",
    boothReadyScore: 84, completionRate: 59, tracksFinished: 326, writingNow: 9,
    emotionalTags: ["Heartbreak", "Late Night Drive", "Storytelling"],
  },
  {
    id: "neon-strip",
    title: "Neon Strip",
    producer: "NightOwl", producerId: "nightowl", verified: true,
    bpm: 96, key: "G# Minor", mood: "Cruise · Night", region: "Memphis",
    tags: ["Club", "Hustle"], duration: "3:35",
    art: "linear-gradient(135deg, #050510 0%, #1a0f2e 50%, #c9a84c 130%)", glyph: "NS",
    prices: [{ license: "Lease", price: 59 }, { license: "Exclusive", price: 1100 }],
    plays: 128400, tag: "RW-0444",
    boothReadyScore: 90, completionRate: 69, tracksFinished: 974, writingNow: 38,
    emotionalTags: ["Strip Club", "Late Night Drive", "Club", "Hustle"],
  },
];


// ---- BEAT PACKS ---------------------------------------------------------

export const beatPacks: BeatPack[] = [
  {
    id: "memphis-heat-1",
    title: "Memphis Heat Vol. 1",
    curator: "NightOwl",
    count: 12, price: 199, vibe: "Slow & sinister", bpmRange: "70–96",
    art: "linear-gradient(135deg, #1a0512 0%, #3d0f2a 40%, #1a1438 70%, #c9a84c 130%)", glyph: "MH",
  },
  {
    id: "late-night-sessions",
    title: "Late Night Sessions",
    curator: "NightOwl",
    count: 10, price: 179, vibe: "After-midnight pens", bpmRange: "76–92",
    art: "linear-gradient(160deg, #050510 0%, #1a1438 50%, #c9a84c 130%)", glyph: "LN",
  },
  {
    id: "street-gospel",
    title: "Street Gospel Collection",
    curator: "Sunday House",
    count: 14, price: 229, vibe: "Pulpit meets pavement", bpmRange: "68–88",
    art: "linear-gradient(200deg, #2d0a1f 0%, #5c1840 50%, #d4842a 130%)", glyph: "SG",
  },
  {
    id: "southern-soul",
    title: "Southern Soul Essentials",
    curator: "Sunday House",
    count: 16, price: 249, vibe: "Warm, gospel-touched soul", bpmRange: "70–90",
    art: "linear-gradient(135deg, #1a0f08 0%, #3d2410 50%, #e8b84a 130%)", glyph: "SS",
  },
];

// ---- REGIONS ------------------------------------------------------------

export const regions: Region[] = [
  { id: "memphis",   name: "Memphis",    glyph: "MEM", count: 142, signature: "Slow, sinister, organ-led", art: "linear-gradient(135deg, #050510 0%, #1a1438 60%, #c9a84c 130%)" },
  { id: "atlanta",   name: "Atlanta",    glyph: "ATL", count: 287, signature: "Trap. 808s. Hi-hat science.", art: "linear-gradient(135deg, #1a0f08 0%, #3d2410 60%, #d4842a 130%)" },
  { id: "houston",   name: "Houston",    glyph: "HTX", count: 168, signature: "Chopped, screwed, soul-soaked", art: "linear-gradient(135deg, #2d0a1f 0%, #5c1840 60%, #d4842a 130%)" },
  { id: "louisiana", name: "Louisiana",  glyph: "LA",  count:  94, signature: "Bounce, brass, swamp funk",   art: "linear-gradient(135deg, #1a0512 0%, #3d0f2a 60%, #e8b84a 130%)" },
  { id: "chicago",   name: "Chicago",    glyph: "CHI", count: 121, signature: "Drill, melodic edge, cold air", art: "linear-gradient(135deg, #020c0c 0%, #0a2424 60%, #5cbdb9 130%)" },
  { id: "detroit",   name: "Detroit",    glyph: "DET", count: 108, signature: "Off-grid drums, jazz dust",   art: "linear-gradient(135deg, #051a1a 0%, #0d3838 60%, #5cbdb9 130%)" },
  { id: "westcoast", name: "West Coast", glyph: "WC",  count: 196, signature: "G-funk synths, low-end roll",  art: "linear-gradient(135deg, #0a0a1a 0%, #1a1438 60%, #ff6b35 130%)" },
  { id: "newyork",   name: "New York",   glyph: "NYC", count: 173, signature: "Boom-bap, lyric-first energy", art: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 60%, #c9a84c 130%)" },
];

// ---- MOODS --------------------------------------------------------------

export const moods: Mood[] = [
  { id: "pain",       name: "Pain",       glyph: "✦", count: 312, art: "linear-gradient(135deg, #1a0512 0%, #3d0f2a 70%, #7a2050 130%)" },
  { id: "victory",    name: "Victory",    glyph: "✦", count: 218, art: "linear-gradient(135deg, #1a0f08 0%, #3d2410 70%, #e8b84a 130%)" },
  { id: "street",     name: "Street",     glyph: "✦", count: 401, art: "linear-gradient(135deg, #050510 0%, #1a1a1a 70%, #4a4a4a 130%)" },
  { id: "club",       name: "Club",       glyph: "✦", count: 274, art: "linear-gradient(135deg, #2d0a1f 0%, #5c1840 70%, #e84393 130%)" },
  { id: "hustle",     name: "Hustle",     glyph: "✦", count: 246, art: "linear-gradient(135deg, #0a0604 0%, #2a1810 70%, #d4842a 130%)" },
  { id: "love",       name: "Love",       glyph: "✦", count: 189, art: "linear-gradient(135deg, #1a0512 0%, #3d0f2a 70%, #c9a0dc 130%)" },
  { id: "motivation", name: "Motivation", glyph: "✦", count: 167, art: "linear-gradient(135deg, #050510 0%, #1a1438 70%, #c9a84c 130%)" },
  { id: "soul",       name: "Soul",       glyph: "✦", count: 198, art: "linear-gradient(135deg, #2d0a1f 0%, #5c1840 70%, #e8b84a 130%)" },
];

// ---- HANDOFF helpers ----------------------------------------------------

export const HANDOFF_KEY = "rapwriter:pending-beat";
export const PURCHASES_KEY = "rapwriter:purchases";

export type PurchasedBeat = {
  beatId: string;
  license: License;
  price: number;
  purchasedAt: number;
};

export function getPurchases(): PurchasedBeat[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PURCHASES_KEY) || "[]"); }
  catch { return []; }
}

export function addPurchase(p: PurchasedBeat) {
  if (typeof window === "undefined") return;
  const arr = getPurchases();
  arr.unshift(p);
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(arr));
}

export function setPendingBeat(beatId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(HANDOFF_KEY, beatId);
}

export function consumePendingBeat(): Beat | null {
  if (typeof window === "undefined") return null;
  const id = sessionStorage.getItem(HANDOFF_KEY);
  if (!id) return null;
  sessionStorage.removeItem(HANDOFF_KEY);
  return beats.find(b => b.id === id) ?? null;
}

// ---- Licensing event bus + hook ----------------------------------------

export const LICENSE_EVENT = "rapwriter:license-change";

export function emitLicenseChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LICENSE_EVENT));
}

// Patch addPurchase to emit. We keep the original export name above; consumers
// should call purchaseBeat() for the side-effected version going forward.
export function purchaseBeat(p: PurchasedBeat) {
  addPurchase(p);
  emitLicenseChange();
}

export function isBeatLicensed(beatId: string): boolean {
  return getPurchases().some(p => p.beatId === beatId);
}

export function getBeatLicense(beatId: string): PurchasedBeat | null {
  return getPurchases().find(p => p.beatId === beatId) ?? null;
}

// ---- Producer storefront extras + recent activity ----------------------

export type ProducerExtras = {
  tagline: string;
  story: string;
  bestSellerIds: string[];
  collections: { id: string; name: string; vibe: string; count: number }[];
  social: { instagram: string; youtubeSubs: number; pressQuote: string; pressSource: string };
};

export const producerExtras: Record<string, ProducerExtras> = {
  nightowl: {
    tagline: "After-midnight pens. Neon on wet pavement.",
    story:
      "Started flipping soul samples in a Memphis basement at 14. Eight years later his beats have moved more silver chains than the city's pawn shops. NightOwl produces for the hour everyone else is asleep.",
    bestSellerIds: ["smoke-velvet", "neon-strip", "lowlight"],
    collections: [
      { id: "no-late",  name: "Late Sessions",   vibe: "Slow, smoke-thick, organ-led",    count: 14 },
      { id: "no-neon",  name: "Neon Strip",      vibe: "After-midnight cruise music",     count: 11 },
      { id: "no-pain",  name: "Pen Therapy",     vibe: "For when the room gets quiet",    count:  9 },
    ],
    social: {
      instagram: "@nightowl808",
      youtubeSubs: 142000,
      pressQuote: "The most cinematic pen in Memphis right now.",
      pressSource: "Pigeons & Planes",
    },
  },
  "808baron": {
    tagline: "Subs that move stadiums.",
    story:
      "808 Baron engineered low-end for three Atlanta charters before going solo. His drums are studied in Houston, copied in Chicago, and shaken in every trunk from Decatur to Dubai.",
    bestSellerIds: ["trunk-rattle", "gold-grill"],
    collections: [
      { id: "8b-trap",   name: "Trap Cathedral",   vibe: "Stadium 808s. Hi-hat science.",  count: 18 },
      { id: "8b-flex",   name: "Flex Hour",        vibe: "Club anthems. Chains optional.", count: 12 },
      { id: "8b-street", name: "Street Code",      vibe: "Gritty, mean, undeniable.",      count: 10 },
    ],
    social: {
      instagram: "@808baron",
      youtubeSubs: 268000,
      pressQuote: "If a stadium shakes in 2026, Baron probably mixed the 808.",
      pressSource: "Complex",
    },
  },
  sundayhouse: {
    tagline: "Pen church. Pulpit meets pavement.",
    story:
      "Raised on Houston choir stands and Mannie Fresh tapes. Sunday House's chops sound like a stained-glass window cracked open over a low-rider. Pain, praise, and patience — same chord.",
    bestSellerIds: ["cathedral-88", "back-porch"],
    collections: [
      { id: "sh-gospel", name: "Street Gospel",    vibe: "Soul-soaked, gospel-touched",    count: 16 },
      { id: "sh-soul",   name: "Sunday Soul",      vibe: "Warm chords, slow strings",      count: 13 },
    ],
    social: {
      instagram: "@sundayhouse",
      youtubeSubs: 81000,
      pressQuote: "The most spiritual catalog on the platform.",
      pressSource: "DJBooth",
    },
  },
  vinylvictor: {
    tagline: "Crate-dug loops. Dusty drums. Lo-fi with weight.",
    story:
      "Victor digs Detroit basements every Saturday morning. What comes back is jazz dust, off-grid drums, and chops that breathe. Beats that feel like a memory you're not sure is yours.",
    bestSellerIds: ["dusty-loop"],
    collections: [
      { id: "vv-dust", name: "Crate No. 7",   vibe: "Lo-fi, nostalgic, off-grid",  count:  9 },
      { id: "vv-jazz", name: "Jazz Cellar",   vibe: "Smoke-room jazz chops",       count:  7 },
    ],
    social: {
      instagram: "@vinylvictor",
      youtubeSubs: 36000,
      pressQuote: "Detroit's quietest, dustiest, most dangerous catalog.",
      pressSource: "Passion of the Weiss",
    },
  },
};

// ---- Recently Written To activity feed ----------------------------------

export type WriteActivity = {
  id: string;
  artistHandle: string;
  artistGlyph: string;       // 1-2 char monogram
  artistColor: string;       // gradient
  beatId: string;
  action: "started" | "hit Booth Ready" | "finished a hook" | "wrote verse 2" | "locked a bridge";
  minutesAgo: number;
};

export const recentlyWrittenTo: WriteActivity[] = [
  { id: "a1", artistHandle: "@kingsoutheast", artistGlyph: "KS", artistColor: "linear-gradient(135deg,#1a0512,#c9a84c)", beatId: "smoke-velvet", action: "hit Booth Ready",  minutesAgo:  4 },
  { id: "a2", artistHandle: "@yvnnglex",      artistGlyph: "YL", artistColor: "linear-gradient(135deg,#1a0f08,#d4842a)", beatId: "trunk-rattle",  action: "wrote verse 2",      minutesAgo:  7 },
  { id: "a3", artistHandle: "@maritheprince", artistGlyph: "MP", artistColor: "linear-gradient(135deg,#2d0a1f,#e8b84a)", beatId: "cathedral-88",  action: "finished a hook",    minutesAgo: 11 },
  { id: "a4", artistHandle: "@nightcrowne",   artistGlyph: "NC", artistColor: "linear-gradient(135deg,#050510,#5cbdb9)", beatId: "lowlight",      action: "started",            minutesAgo: 13 },
  { id: "a5", artistHandle: "@808selene",     artistGlyph: "8S", artistColor: "linear-gradient(135deg,#0a0604,#e8b84a)", beatId: "gold-grill",    action: "locked a bridge",    minutesAgo: 18 },
  { id: "a6", artistHandle: "@dustyverse",    artistGlyph: "DV", artistColor: "linear-gradient(135deg,#020c0c,#5cbdb9)", beatId: "dusty-loop",    action: "started",            minutesAgo: 22 },
  { id: "a7", artistHandle: "@neonpastor",    artistGlyph: "NP", artistColor: "linear-gradient(135deg,#050510,#c9a84c)", beatId: "neon-strip",    action: "hit Booth Ready",   minutesAgo: 27 },
  { id: "a8", artistHandle: "@bayoubaron",    artistGlyph: "BB", artistColor: "linear-gradient(135deg,#1a0512,#d4842a)", beatId: "back-porch",    action: "wrote verse 2",      minutesAgo: 34 },
];

// All emotional tags surfaced as filter chips
export const emotionalTagList = [
  "Pain", "Victory", "Motivation", "Heartbreak",
  "Late Night Drive", "Strip Club", "Storytelling",
] as const;
