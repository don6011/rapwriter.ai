import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { firstSessionActivationSchema } from "./schemas.ts";

const activationRoute = readFileSync(new URL("../../app/api/activation/route.ts", import.meta.url), "utf8");

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

  test("reuses the owner's active session instead of violating the one-active-session constraint", () => {
    expect(activationRoute).toContain('.eq("owner_id", user.id)');
    expect(activationRoute).not.toContain('.eq("song_id", song.id)');
    expect(activationRoute).toContain('.rpc("save_ghost_studio_session"');
    expect(activationRoute).toContain("for (let attempt = 0; attempt < 2; attempt += 1)");
    expect(activationRoute).toContain("currentSession = result.session ?? null");
  });
});
