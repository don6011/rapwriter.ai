"use client";

import { useCallback, useState } from "react";
import type { BoothExportCreateInput, useRapWriterData } from "@/hooks/use-rapwriter-data";
import type { BoothExportRecord } from "@/lib/booth-export";

type CreateBoothExport = ReturnType<typeof useRapWriterData>["createBoothExport"];

export function useBoothExport(createBoothExport: CreateBoothExport) {
  const [draft, setDraft] = useState<BoothExportCreateInput | null>(null);
  const [record, setRecord] = useState<BoothExportRecord | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  /** Clear the previous export outcome before assembling a new package. */
  const beginPrepare = useCallback(() => {
    setStatus("idle");
    setError(null);
    setRecord(null);
  }, []);

  const stageDraft = useCallback((next: BoothExportCreateInput) => {
    setDraft(next);
  }, []);

  const freeze = useCallback(async () => {
    if (!draft) return;
    setStatus("saving");
    setError(null);
    try {
      const created = await createBoothExport(draft);
      if (!created) throw new Error("Sign in to create a Booth Ready export.");
      setRecord(created);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not freeze this Booth Ready version.");
    }
  }, [createBoothExport, draft]);

  return { draft, record, status, error, beginPrepare, stageDraft, freeze };
}
