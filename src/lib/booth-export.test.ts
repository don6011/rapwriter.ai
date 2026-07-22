import { describe, expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { buildBoothLyricsText, buildBoothPdf, buildBoothZip, type BoothExportRecord } from "./booth-export";

const sample: BoothExportRecord = {
  id: "7a027280-0d96-4d44-a009-10278e66ab80",
  project_id: "0d9e829b-09af-43a8-90d9-f19f93d5548f",
  song_id: "a1128a85-9407-41c1-a38f-4555b85b0c16",
  session_id: null,
  rough_take_id: null,
  version_number: 2,
  title: "Glass Roof",
  booth_score: 78,
  completion_pct: 74,
  total_bars: 38,
  created_at: "2026-07-22T18:00:00.000Z",
  snapshot: {
    projectTitle: "New Testament",
    artistName: "Nova",
    activeSection: "Verse 1",
    sections: {
      Hook: "Glass roof, still I see the sky though\nEvery ceiling that they built, I broke the light through",
      "Verse 1": "Pressure made the pen move, every line got proof\nHad to build the room before I stepped into the booth",
      "Verse 2": "",
      Bridge: "",
      Outro: "",
    },
    beat: { title: "Gold Ceiling", producer: "NightOwl", bpm: 142, key: "F# Minor", license: "Lease" },
    boothReady: {
      score: 78,
      lyricScore: 82,
      performanceScore: 68,
      nextAction: "Run one full take without stopping.",
      checklist: [
        { label: "Hook foundation", detail: "8 hook bars drafted.", complete: true },
        { label: "Rough take", detail: "Record a take to judge delivery.", complete: false },
      ],
      improvements: ["The hook has a repeatable anchor."],
      metrics: { structure: 86, completion: 74, cadence: 79, hook: 84, originality: 77, replay: 81 },
    },
    completionPct: 74,
    totalBars: 38,
    roughTake: null,
  },
};

describe("Booth Ready export", () => {
  test("builds a readable lyric handoff", () => {
    const text = buildBoothLyricsText(sample);
    expect(text).toContain("Glass Roof");
    expect(text).toContain("Gold Ceiling");
    expect(text).toContain("VERSE 1");
  });

  test("builds a PDF and complete studio ZIP", async () => {
    const pdf = await buildBoothPdf(sample);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    const files = unzipSync(await buildBoothZip(sample));
    const names = Object.keys(files);
    expect(names.some((name) => name.endsWith(".pdf"))).toBe(true);
    expect(names.some((name) => name.endsWith("-lyrics.txt"))).toBe(true);
    expect(names.some((name) => name.endsWith("-credits.txt"))).toBe(true);
    expect(names.some((name) => name.endsWith("-session.json"))).toBe(true);
  });
});
