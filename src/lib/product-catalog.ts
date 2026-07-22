export type ProductType =
  | "studio_room"
  | "ai_style"
  | "vocal_chain"
  | "writing_pack"
  | "ambient_pack"
  | "theme"
  | "bundle"
  | "producer_profile"
  | "beat_license";

export type CatalogProduct = {
  id: string;
  type: ProductType;
  title: string;
  detail: string;
  price: string;
  priceCents: number;
  tags: string[];
};

export type CatalogBundle = CatalogProduct & {
  type: "bundle";
  image: string;
  savings: string;
  includes: string[];
};

export const vocalChainProducts: CatalogProduct[] = [
  {
    id: "vocal-booth-polish",
    type: "vocal_chain",
    title: "Booth Polish",
    detail: "Clean lead vocal chain with controlled presence and a finished top end.",
    price: "$19",
    priceCents: 1900,
    tags: ["Hooks", "Melodies", "Polished demos"],
  },
];

export const writingPackProducts: CatalogProduct[] = [
  {
    id: "writing-hook-builder",
    type: "writing_pack",
    title: "Finish Better Hooks",
    detail: "Turn one strong idea into repeatable lines that carry replay value.",
    price: "$9",
    priceCents: 900,
    tags: ["Hooks", "Melody"],
  },
  {
    id: "writing-16-bar-pressure",
    type: "writing_pack",
    title: "Write Stronger Verses",
    detail: "Build momentum, tighten setups, and make each fourth line land harder.",
    price: "$9",
    priceCents: 900,
    tags: ["Verses", "Cadence"],
  },
  {
    id: "writing-story-mode",
    type: "writing_pack",
    title: "Build Better Stories",
    detail: "Shape real details into scenes, tension, and a payoff listeners remember.",
    price: "$14",
    priceCents: 1400,
    tags: ["Story", "Detail"],
  },
];

export const studioRoomProducts: CatalogProduct[] = [
  {
    id: "studio-room-trap-house",
    type: "studio_room",
    title: "Trap House Studio",
    detail: "Raw walls, pressure, darker bounce, and street-ready room energy.",
    price: "$19",
    priceCents: 1900,
    tags: ["Trap", "Street", "Raw"],
  },
  {
    id: "studio-room-bedroom",
    type: "studio_room",
    title: "Bedroom Dreams",
    detail: "After-hours creative room for emotional hooks, lo-fi focus, and honest demos.",
    price: "$15",
    priceCents: 1500,
    tags: ["Lo-fi", "Storytelling", "Personal"],
  },
  {
    id: "studio-room-penthouse",
    type: "studio_room",
    title: "Penthouse Sessions",
    detail: "Luxury skyline writing room for commercial hooks and elevated records.",
    price: "$29",
    priceCents: 2900,
    tags: ["Luxury", "Hooks", "Commercial"],
  },
  {
    id: "studio-room-cypher",
    type: "studio_room",
    title: "Cypher Room",
    detail: "Pure pen room for punchlines, freestyle pressure, and bar-heavy sessions.",
    price: "$15",
    priceCents: 1500,
    tags: ["Bars", "Freestyle", "Lyricism"],
  },
];

export const producerStyleProducts: CatalogProduct[] = [
  {
    id: "ai-style-hook-doctor",
    type: "ai_style",
    title: "Billboard Writer",
    detail: "A hook-first writing personality that favors clear ideas, repeatable phrasing, and commercial lift.",
    price: "$15",
    priceCents: 1500,
    tags: ["Hook strength", "Replay", "Commercial"],
  },
  {
    id: "ai-style-battle-coach",
    type: "ai_style",
    title: "Street Legend",
    detail: "A direct writing personality built around hard setups, quotable punches, and pocket discipline.",
    price: "$15",
    priceCents: 1500,
    tags: ["Punchlines", "Cadence", "Street"],
  },
  {
    id: "ai-style-story-coach",
    type: "ai_style",
    title: "Pain Architect",
    detail: "An emotional writing personality that turns lived detail into scenes, tension, and memorable payoff lines.",
    price: "$15",
    priceCents: 1500,
    tags: ["Pain records", "Story", "Detail"],
  },
  {
    id: "ai-style-southern-storyteller",
    type: "ai_style",
    title: "Southern Storyteller",
    detail: "A patient narrative pen with regional detail, conversational rhythm, and vivid scene building.",
    price: "$15",
    priceCents: 1500,
    tags: ["Southern", "Storytelling", "Soul"],
  },
  {
    id: "ai-style-trap-scientist",
    type: "ai_style",
    title: "Trap Scientist",
    detail: "A precision writing personality for pocket changes, concise flexes, and modern trap cadence.",
    price: "$19",
    priceCents: 1900,
    tags: ["Trap", "Cadence", "Technical"],
  },
];

export const ambientPackProducts: CatalogProduct[] = [
  {
    id: "ambient-rain-on-glass",
    type: "ambient_pack",
    title: "Rain On Glass",
    detail: "Soft rain bed, window texture, and darker room motion for late-night writing.",
    price: "$7",
    priceCents: 700,
    tags: ["Rain", "Focus", "Pain"],
  },
  {
    id: "ambient-atlanta-midnight",
    type: "ambient_pack",
    title: "Atlanta Midnight",
    detail: "Low city movement, luxury room tone, and trap-night atmosphere.",
    price: "$9",
    priceCents: 900,
    tags: ["Atlanta", "Trap", "Night"],
  },
  {
    id: "ambient-vinyl-room",
    type: "ambient_pack",
    title: "Vinyl Room",
    detail: "Warm crackle and analog hush for melodic demos and reflective records.",
    price: "$7",
    priceCents: 700,
    tags: ["Vinyl", "Warm", "Melodic"],
  },
];

export const themeProducts: CatalogProduct[] = [
  {
    id: "theme-neon-tokyo",
    type: "theme",
    title: "Neon Tokyo Studio",
    detail: "A cinematic neon room skin built for club records, future bounce, and night sessions.",
    price: "$19",
    priceCents: 1900,
    tags: ["Neon", "Club", "Premium"],
  },
  {
    id: "theme-memphis-soul",
    type: "theme",
    title: "Memphis Soul",
    detail: "Warm tungsten lighting, analog character, and vintage studio mood.",
    price: "$19",
    priceCents: 1900,
    tags: ["Memphis", "Soul", "Vintage"],
  },
  {
    id: "theme-gold-executive",
    type: "theme",
    title: "Gold Executive",
    detail: "Sharper gold accents, restrained motion, and a luxury-black control surface.",
    price: "$15",
    priceCents: 1500,
    tags: ["Gold", "Luxury", "Minimal"],
  },
  {
    id: "theme-purple-dreams",
    type: "theme",
    title: "Purple Dreams",
    detail: "A low-light violet visual pack for melodic records and after-hours sessions.",
    price: "$15",
    priceCents: 1500,
    tags: ["Violet", "Melodic", "Night"],
  },
  {
    id: "theme-cypher-noir",
    type: "theme",
    title: "Cypher Noir",
    detail: "Monochrome controls, raw waveform treatment, and a lyric-first visual hierarchy.",
    price: "$12",
    priceCents: 1200,
    tags: ["Noir", "Bars", "Focused"],
  },
];

export const bundleProducts: CatalogBundle[] = [
  {
    id: "bundle-penthouse-drop",
    type: "bundle",
    title: "Penthouse Sessions Drop",
    detail: "The complete commercial writing room: skyline atmosphere, an executive visual finish, and a hook-building pack you own.",
    price: "$59",
    priceCents: 5900,
    tags: ["Commercial", "Hooks", "Luxury"],
    image: "/studio/penthouse-sessions.webp",
    savings: "Save 35%",
    includes: ["Penthouse Sessions", "Gold Executive", "Finish Better Hooks"],
  },
  {
    id: "bundle-late-night",
    type: "bundle",
    title: "Late Night Studio",
    detail: "A darker owned-asset stack for honest hooks, reflective verses, and headphones-on writing.",
    price: "$45",
    priceCents: 4500,
    tags: ["Pain", "Night", "Melodic"],
    image: "/studio/bedroom-dreams.webp",
    savings: "Save 30%",
    includes: ["Bedroom Dreams", "Rain On Glass", "Purple Dreams", "Build Better Stories"],
  },
];

// Capability products remain resolvable for historical purchases, but they are
// no longer offered for sale. New access comes from Prep Studio membership.
export const legacyCapabilityProducts = [
  ...producerStyleProducts,
  ...vocalChainProducts,
];

export const marketplaceProducts = [
  ...studioRoomProducts,
  ...writingPackProducts,
  ...ambientPackProducts,
  ...themeProducts,
  ...bundleProducts,
];

export function getCatalogProduct(productId: string) {
  return marketplaceProducts.find((product) => product.id === productId) ?? null;
}

export function getAnyCatalogProduct(productId: string) {
  return getCatalogProduct(productId)
    ?? legacyCapabilityProducts.find((product) => product.id === productId)
    ?? null;
}
