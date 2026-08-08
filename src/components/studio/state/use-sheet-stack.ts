"use client";

import { useCallback, useState } from "react";

export type SheetId =
  | "studioAccess"
  | "newSong"
  | "beatSwitcher"
  | "boothExport"
  | "studioDna"
  | "versionHistory";

const allClosed: Record<SheetId, boolean> = {
  studioAccess: false,
  newSong: false,
  beatSwitcher: false,
  boothExport: false,
  studioDna: false,
  versionHistory: false,
};

/**
 * Independent visibility flags, one per sheet — deliberately NOT a single
 * `activeSheet: SheetId | null`.
 *
 * Two sheets really can be open at once today. Unlocking a room from inside
 * StudioPackSheet opens the auth drawer over it without closing the pack sheet, and the
 * membership effect can raise the Studio Access hub over whatever is already open once
 * membership resolves. Collapsing these into one slot would silently close the sheet
 * underneath, which is a behavior change. See REFACTOR_NOTES.md.
 */
export function useSheetStack() {
  const [sheets, setSheets] = useState<Record<SheetId, boolean>>(allClosed);

  const setSheet = useCallback((id: SheetId, next: boolean) => {
    // Bail out when the flag is unchanged, matching the no-op re-render behavior of the
    // individual useState<boolean> calls this replaced.
    setSheets((current) => (current[id] === next ? current : { ...current, [id]: next }));
  }, []);

  const openSheet = useCallback((id: SheetId) => setSheet(id, true), [setSheet]);
  const closeSheet = useCallback((id: SheetId) => setSheet(id, false), [setSheet]);

  return { sheets, openSheet, closeSheet, setSheet };
}
