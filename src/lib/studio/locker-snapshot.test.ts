import { describe, expect, test } from "bun:test";
import type { SongLockerRow } from "@/hooks/use-rapwriter-data";
import { lockerSongBarCount, lockerSongProgress } from "@/lib/studio/locker-snapshot";

function song(snapshot: Record<string, unknown>): SongLockerRow {
  return {
    id: "locker-song",
    project_id: "project",
    song_id: "song",
    title: "Test record",
    status: "draft",
    booth_ready: false,
    snapshot,
    created_at: "2026-08-09T00:00:00.000Z",
    updated_at: "2026-08-09T00:00:00.000Z",
  };
}

describe("Locker song progress", () => {
  test("derives progress from saved sections instead of stale summary fields", () => {
    const lockerSong = song({
      completionPct: 8,
      totalBars: 4,
      sections: { Hook: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight" },
    });

    expect(lockerSongBarCount(lockerSong)).toBe(8);
    expect(lockerSongProgress(lockerSong)).toBe(15);
  });
});
