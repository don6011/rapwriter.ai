"use client";

import { useEffect, useState } from "react";
import { blankStarterLyrics, mobileSections } from "@/lib/studio/sections";
import type { PadActionStatus } from "@/lib/studio/types";

const idleStatus: PadActionStatus = { state: "idle", message: "" };

/**
 * The writing pad's own state: what is on the page, which section is active, and the
 * three transient status lines the pad shows while work is in flight.
 *
 * `activeSongTitle` drives the title field whenever the user is not editing it.
 */
export function useWritingPad(activeSongTitle: string | undefined) {
  const [activeSection, setActiveSection] = useState(0);
  const [sectionContent, setSectionContent] = useState<Record<string, string>>(blankStarterLyrics);
  const [padActionStatus, setPadActionStatus] = useState<PadActionStatus>(idleStatus);
  const [songSwitchStatus, setSongSwitchStatus] = useState<PadActionStatus>(idleStatus);
  const [titleDraft, setTitleDraft] = useState("Untitled Song");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleStatus, setTitleStatus] = useState<PadActionStatus>(idleStatus);

  const section = mobileSections[activeSection];

  useEffect(() => {
    if (!titleEditing) setTitleDraft(activeSongTitle ?? "Untitled Song");
  }, [activeSongTitle, titleEditing]);

  return {
    activeSection,
    setActiveSection,
    sectionContent,
    setSectionContent,
    section,
    padActionStatus,
    setPadActionStatus,
    songSwitchStatus,
    setSongSwitchStatus,
    titleDraft,
    setTitleDraft,
    titleEditing,
    setTitleEditing,
    titleStatus,
    setTitleStatus,
  };
}
