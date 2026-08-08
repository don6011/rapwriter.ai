"use client";

import { useState } from "react";
import type { SessionRow } from "@/hooks/use-rapwriter-data";
import { notifyMembershipAccess } from "@/lib/client/membership-access";
import type { ProducerActionProposal, ProducerActionType } from "@/lib/producer-actions";
import { blankSections, countBars } from "@/lib/studio/bars";
import type { ProducerActionStatus, SelectedBeat, StudioDna } from "@/lib/studio/types";

export type ProducerPassOptions = {
  signedIn: boolean;
  requestAuth: (message?: string) => void;
  sectionName: string;
  sectionContent: Record<string, string>;
  setSectionContent: (update: React.SetStateAction<Record<string, string>>) => void;
  selectedBeat: SelectedBeat;
  studioDna: StudioDna;
  onNotice: (message: string) => void;
  onSaved: () => void;
  /** Clears the sync conflict latch when the artist edits the pad. */
  onEdit: () => void;
  /** Ensures a project/song/session exist and returns their ids for the pass request. */
  prepareSession: () => Promise<{ projectId: string; songId: string; sessionId: string | undefined } | null>;
  saveBeforePass: (ids: { projectId: string; songId: string; sessionId: string | undefined }) => Promise<SessionRow | null | undefined>;
};

export function useProducerPass({
  signedIn,
  requestAuth,
  sectionName,
  sectionContent,
  setSectionContent,
  selectedBeat,
  studioDna,
  onNotice,
  onSaved,
  onEdit,
  prepareSession,
  saveBeforePass,
}: ProducerPassOptions) {
  const [proposal, setProposal] = useState<ProducerActionProposal | null>(null);
  const [status, setStatus] = useState<ProducerActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const generate = async (actionType: ProducerActionType, attempt = 0) => {
    if (!signedIn) {
      requestAuth("Sign in to run a Producer Pass and save its history.");
      return;
    }

    const currentContent = sectionContent[sectionName]?.trim() ?? "";
    if (countBars(currentContent) < 2) {
      setError(`Write at least two lines in ${sectionName} before running this pass.`);
      setStatus("error");
      return;
    }

    setStatus("generating");
    setError(null);
    try {
      const ids = await prepareSession();
      if (!ids) throw new Error("Could not prepare this writing session.");

      const syncedSession = await saveBeforePass(ids);
      const sessionId = syncedSession?.id ?? ids.sessionId;

      const response = await fetch("/api/producer-actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          project_id: ids.projectId,
          song_id: ids.songId,
          session_id: sessionId ?? null,
          action_type: actionType,
          section_name: sectionName,
          section_content: currentContent,
          attempt,
          beat: selectedBeat,
          studio_dna: studioDna,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notifyMembershipAccess(data, response.status);
        throw new Error(data.error ?? "Producer Pass could not create a revision.");
      }

      setProposal(data.proposal as ProducerActionProposal);
      setStatus("preview");
      onNotice("Revision ready to preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Producer Pass could not create a revision.");
      setStatus("error");
    }
  };

  const resolve = async (decision: "accept" | "reject" | "revert") => {
    if (!proposal) return;
    setStatus("applying");
    setError(null);
    try {
      const response = await fetch(`/api/producer-actions/${proposal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Producer revision could not be updated.");

      if (decision === "reject") {
        setProposal(null);
        setStatus("idle");
        onNotice("Revision rejected");
        return;
      }

      const nextSections = data.section_content as Record<string, string> | undefined;
      if (nextSections) setSectionContent({ ...blankSections(), ...nextSections });
      onSaved();
      setProposal((current) => current ? { ...current, status: decision === "accept" ? "accepted" : "reverted" } : current);
      setStatus(decision === "accept" ? "accepted" : "reverted");
      onNotice(decision === "accept" ? "Producer revision saved" : "Original lyrics restored");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Producer revision could not be updated.");
      setStatus("error");
    }
  };

  const retry = async () => {
    const current = proposal;
    if (!current) return;
    try {
      await fetch(`/api/producer-actions/${current.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "reject" }),
      });
    } catch {
      // A fresh preview can still be generated if retiring the old preview fails.
    }
    setProposal(null);
    void generate(current.actionType, current.attempt + 1);
  };

  /** Typing in the pad discards any pending preview before applying the edit. */
  const changeActiveSectionContent = (value: string) => {
    if (proposal) {
      setProposal(null);
      setStatus("idle");
      setError(null);
    }
    onEdit();
    setSectionContent((previous) => ({ ...previous, [sectionName]: value }));
  };

  /** Clears a pending preview without touching the pad — used after a history restore. */
  const discardProposal = () => {
    setProposal(null);
    setStatus("idle");
  };

  return { proposal, status, error, generate, resolve, retry, changeActiveSectionContent, discardProposal };
}
