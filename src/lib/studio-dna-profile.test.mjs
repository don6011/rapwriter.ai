import { describe, expect, test } from "bun:test";
import { mergeStudioDnaTraits } from "./studio-dna-profile.ts";

describe("Studio DNA profile", () => {
  test("extracts compact creative traits without retaining lyrics", () => {
    const traits = mergeStudioDnaTraits({}, {
      sessionId: "session-1",
      sections: { Hook: "Night ride\nNight ride", "Verse 1": "I move through the city\nMy story in the lights" },
      studioDna: { mood: "Late Night", producer: "Story Coach" },
      beat: { bpm: 92 },
    });
    expect(traits.dominant_moods).toEqual(["Late Night"]);
    expect(traits.preferred_bpm_range).toEqual([92, 92]);
    expect(traits.hook_style).toBe("repetitive");
    expect(traits.perspective).toBe("first_person");
    expect(JSON.stringify(traits)).not.toContain("Night ride");
  });

  test("does not count the same completed session twice", () => {
    const current = { recent_session_ids: ["session-1"], average_line_length: 8 };
    expect(mergeStudioDnaTraits(current, { sessionId: "session-1", sections: { Hook: "changed" }, studioDna: {}, beat: {} })).toBe(current);
  });
});
