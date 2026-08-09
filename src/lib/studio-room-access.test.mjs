import { describe, expect, test } from "bun:test";
import {
  membershipIncludesStudioRoom,
  resolveStudioRoomAccess,
} from "./studio-room-access.ts";

describe("studio room access", () => {
  test("free starts in Skyline Loft and also includes Midnight Session", () => {
    expect(membershipIncludesStudioRoom("artist_free", "skyline-loft")).toBe(true);
    expect(membershipIncludesStudioRoom("artist_free", "midnight")).toBe(true);
    expect(membershipIncludesStudioRoom("artist_free", "bedroom")).toBe(false);
    expect(resolveStudioRoomAccess("skyline-loft", "artist_free", false).badge).toBe("Default");
  });

  test("Pro includes all fifteen rooms", () => {
    for (const room of ["skyline-loft", "midnight", "bedroom", "trap-house", "cypher", "penthouse", "afterglow", "bedroom-diaries", "red-light", "main-room", "soft-life", "desert-sessions", "rooftop-sessions", "radio-room", "bando-sessions"]) {
      expect(membershipIncludesStudioRoom("artist_pro", room)).toBe(true);
    }
  });

  test("retired Elite subscribers retain every room", () => {
    for (const room of ["midnight", "bedroom", "trap-house", "cypher", "penthouse", "skyline-loft", "red-light", "main-room", "radio-room", "afterglow", "soft-life"]) {
      expect(membershipIncludesStudioRoom("artist_studio", room)).toBe(true);
    }
  });

  test("free sees RapWriter Pro as the room upgrade", () => {
    expect(resolveStudioRoomAccess("afterglow", "artist_free", false)).toEqual({
      available: false,
      source: "locked",
      badge: "Pro",
      requiredPlan: "pro",
    });
  });

  test("All Access includes every environment", () => {
    for (const room of ["afterglow", "bedroom-diaries", "soft-life", "desert-sessions", "rooftop-sessions", "bando-sessions"]) {
      expect(membershipIncludesStudioRoom("creator_all_access", room)).toBe(true);
      expect(resolveStudioRoomAccess(room, "creator_all_access", false).badge).toBe("All Access");
    }
  });

  test("permanent ownership overrides membership requirements", () => {
    expect(resolveStudioRoomAccess("penthouse", "artist_free", true).source).toBe("owned");
    expect(resolveStudioRoomAccess("penthouse", "artist_free", true).available).toBe(true);
  });
});
