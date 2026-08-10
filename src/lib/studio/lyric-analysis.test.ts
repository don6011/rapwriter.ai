import { describe, expect, test } from "bun:test";
import { analyzeLyrics } from "@/lib/booth-ready-v2";
import { scoreBoothReady } from "@/lib/studio/booth-ready";
import { findAnchorWord } from "@/lib/studio/intelligence";

const noTake = {
  activeSection: "Hook",
  roughTakeDuration: 0,
  roughTakeSaved: false,
  roughTakeSection: null,
  roughTakeExists: false,
  roughTakeAnalyzing: false,
  roughTakeAnalysis: null,
};

describe("Lyric intelligence credibility", () => {
  test("never promotes common function words as memory phrases", () => {
    expect(findAnchorWord("Every night I move\nEvery time I prove\nEvery road bends\nEvery story ends")).toBeNull();
  });

  test("prefers repeated line-ending language for the anchor", () => {
    const lyrics = "Every night I chase the skyline\nThey know my name by the skyline\nPressure turns to gold at midnight\nI bring the whole team to the skyline";
    expect(findAnchorWord(lyrics)).toBe("skyline");
  });

  test("withholds detailed scores and rejects perfect nonsense", () => {
    const sections = { Hook: "rfedfred\nerfefre\nreferf\nreferferf\nqazplm\nwexcvb\ntgbnhy\nujmkiol", "Verse 1": "", "Verse 2": "", Bridge: "", Outro: "" };
    const analysis = analyzeLyrics(sections);
    const result = scoreBoothReady(sections, 15, analysis, noTake);

    expect(analysis.detailedScoresReady).toBe(false);
    expect(result.metrics.originality).toBeLessThan(60);
    expect(result.metrics.hook).toBeLessThan(60);
    expect(result.metrics.replay).toBeLessThan(60);
  });

  test("recognizes competent writing without pretending a two-line idea is fully scored", () => {
    const realHook = {
      Hook: "Glass roof, still I see the sky\nEvery ceiling that they built, I broke the light",
      "Verse 1": "",
      "Verse 2": "",
      Bridge: "",
      Outro: "",
    };
    const nonsense = analyzeLyrics({ Hook: "rfedfred\nerfefre", "Verse 1": "", "Verse 2": "", Bridge: "", Outro: "" });
    const analysis = analyzeLyrics(realHook);

    expect(analysis.detailedScoresReady).toBe(false);
    expect(analysis.analysisConfidence).toBeGreaterThan(nonsense.analysisConfidence);
    expect(analysis.averageWordsPerLine).toBeGreaterThanOrEqual(7);
  });

  test("rewards deliberate title-phrase repetition without cratering originality", () => {
    const sections = {
      Hook: [
        "Glass roof, I can still see the stars tonight",
        "Glass roof, every scar turned into city light",
        "Glass roof, let the whole room sing it twice",
        "Glass roof, broke the ceiling and changed my life",
      ].join("\n"),
      "Verse 1": "",
      "Verse 2": "",
      Bridge: "",
      Outro: "",
    };
    const analysis = analyzeLyrics(sections);
    const result = scoreBoothReady(sections, 15, analysis, noTake);

    expect(findAnchorWord(sections.Hook)).toBe("glass roof");
    expect(result.metrics.originality).toBeGreaterThanOrEqual(65);
    expect(result.metrics.replay).toBeGreaterThanOrEqual(50);
  });

  test("opens detailed scores after four substantive lines and caps originality", () => {
    const sections = {
      Hook: [
        "Glass roof and I still see the skyline",
        "Broke through every ceiling for the skyline",
        "City knows my name beneath the skyline",
        "Bring the whole team home into the skyline",
      ].join("\n"),
      "Verse 1": "",
      "Verse 2": "",
      Bridge: "",
      Outro: "",
    };
    const analysis = analyzeLyrics(sections);
    const result = scoreBoothReady(sections, 15, analysis, noTake);

    expect(analysis.detailedScoresReady).toBe(true);
    expect(result.metrics.originality).toBeLessThanOrEqual(85);
    expect(result.metrics.replay).toBeGreaterThan(0);
  });
});
