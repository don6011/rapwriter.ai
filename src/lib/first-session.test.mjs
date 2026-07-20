import { describe, expect, test } from "bun:test";
import { firstSessionActivationSchema } from "./schemas.ts";

describe("first session activation", () => {
  test("accepts a focused starter workspace", () => {
    const result = firstSessionActivationSchema.safeParse({
      artist_goal: "write_hook",
      project_title: "Midnight Ideas",
      song_title: "First Draft",
      beat: { id: "beat-1", title: "Smoke & Velvet" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty projects and unsupported goals", () => {
    expect(firstSessionActivationSchema.safeParse({ artist_goal: "browse", project_title: "", song_title: "Draft" }).success).toBe(false);
  });

  test("supports writing without a beat", () => {
    const result = firstSessionActivationSchema.safeParse({
      artist_goal: "freestyle",
      project_title: "Open Session",
      song_title: "Untitled Song",
      beat: null,
    });
    expect(result.success).toBe(true);
  });
});
