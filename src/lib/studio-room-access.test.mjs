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

  test("Pro includes the five-room core library", () => {
    for (const room of ["skyline-loft", "midnight", "bedroom", "trap-house", "cypher"]) {
      expect(membershipIncludesStudioRoom("artist_pro", room)).toBe(true);
    }
    expect(membershipIncludesStudioRoom("artist_pro", "penthouse")).toBe(false);
  });

  test("Elite includes Pro rooms and the professional library", () => {
    for (const room of ["midnight", "bedroom", "trap-house", "cypher", "penthouse", "skyline-loft", "red-light", "main-room", "radio-room"]) {
      expect(membershipIncludesStudioRoom("artist_studio", room)).toBe(true);
    }
  });

  test("specialty rooms remain Store-only", () => {
    expect(resolveStudioRoomAccess("afterglow", "artist_studio", false)).toEqual({
      available: false,
      source: "locked",
      badge: "Store",
      requiredPlan: null,
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
