"use client";

import { useCallback, useState } from "react";
import { sectionKeyFromTitle } from "@/lib/studio/bars";
import type { SectionVersion, VersionHistoryStatus } from "@/lib/studio/types";

export function useVersionHistory() {
  const [versions, setVersions] = useState<SectionVersion[]>([]);
  const [status, setStatus] = useState<VersionHistoryStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  /** Called after the sheet opens: resets, then loads the active section's history. */
  const load = useCallback(async (songId: string | undefined, sectionName: string) => {
    setStatus("loading");
    setError(null);
    setVersions([]);

    if (!songId) {
      setStatus("ready");
      setError("History begins after this song completes its first sync.");
      return;
    }

    try {
      const params = new URLSearchParams({
        song_id: songId,
        section_key: sectionKeyFromTitle(sectionName),
      });
      const response = await fetch(`/api/song-sections/versions?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Revision history could not be loaded.");
      setVersions(Array.isArray(data.versions) ? data.versions : []);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revision history could not be loaded.");
      setStatus("error");
    }
  }, []);

  /**
   * Restores a version and hands the payload back so the caller can apply it.
   *
   * `sections` stays possibly-undefined on purpose: the API can answer without a
   * section_content body, and in that case the caller must leave the pad alone rather than
   * merge an empty object over blankSections() and wipe the lyrics.
   */
  const restore = useCallback(async (
    versionId: string,
  ): Promise<{ ok: true; sections: Record<string, string> | undefined } | { ok: false }> => {
    setStatus("restoring");
    setError(null);
    try {
      const response = await fetch("/api/song-sections/versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "This version could not be restored.");
      return { ok: true, sections: data.section_content as Record<string, string> | undefined };
    } catch (err) {
      setError(err instanceof Error ? err.message : "This version could not be restored.");
      setStatus("error");
      return { ok: false };
    }
  }, []);

  const markRestored = useCallback(() => setStatus("ready"), []);

  return { versions, status, error, load, restore, markRestored };
}
