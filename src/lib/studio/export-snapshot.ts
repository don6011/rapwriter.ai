"use client";

import { Capacitor } from "@capacitor/core";
import type { RoughTakeRow } from "@/hooks/use-rapwriter-data";
import type { BoothExportSnapshot } from "@/lib/booth-export";
import type { BoothReadyResult } from "@/lib/studio/types";

export function buildBoothExportSnapshot({
  projectTitle,
  artistName,
  activeSection,
  sections,
  beat,
  boothReady,
  completionPct,
  totalBars,
  roughTake,
}: {
  projectTitle: string;
  artistName: string;
  activeSection: string;
  sections: Record<string, string>;
  beat: Record<string, unknown>;
  boothReady: BoothReadyResult;
  completionPct: number;
  totalBars: number;
  roughTake: RoughTakeRow | null;
}): BoothExportSnapshot {
  return {
    projectTitle,
    artistName,
    activeSection,
    sections: { ...sections },
    beat: { ...beat },
    boothReady: {
      score: boothReady.score,
      lyricScore: boothReady.lyricScore,
      performanceScore: boothReady.performanceScore,
      nextAction: boothReady.nextAction,
      checklist: boothReady.checklist.map((item) => ({ ...item })),
      improvements: [...boothReady.improvements],
      metrics: { ...boothReady.metrics },
    },
    completionPct,
    totalBars,
    roughTake: roughTake ? {
      id: roughTake.id,
      sectionName: roughTake.section_name,
      durationSeconds: roughTake.duration_seconds,
      analysis: roughTake.analysis,
    } : null,
  };
}

type BoothExportFormat = "txt" | "pdf" | "zip" | "rough-take";

export async function downloadBoothFile(id: string, format: BoothExportFormat) {
  const url = format === "rough-take" ? `/api/booth-exports/${encodeURIComponent(id)}/rough-take` : `/api/booth-exports/${encodeURIComponent(id)}?format=${format}`;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "RapWriter could not prepare this export.");
  }

  const blob = await response.blob();
  const fileName = responseFileName(response, format);

  if (Capacitor.isNativePlatform()) {
    await shareNativeFile(blob, fileName);
    return;
  }

  downloadBrowserFile(blob, fileName);
}

function responseFileName(response: Response, format: BoothExportFormat) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const resolvedName = encodedName ? decodeURIComponent(encodedName) : plainName;
  if (resolvedName) return resolvedName.replace(/[\\/]/g, "-");

  const extension = format === "rough-take" ? mimeExtension(response.headers.get("content-type")) : format;
  return `rapwriter-export.${extension}`;
}

function mimeExtension(contentType: string | null) {
  if (contentType?.includes("mp4")) return "mp4";
  if (contentType?.includes("mpeg")) return "mp3";
  if (contentType?.includes("wav")) return "wav";
  if (contentType?.includes("webm")) return "webm";
  return "m4a";
}

async function shareNativeFile(blob: Blob, fileName: string) {
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const path = `rapwriter-exports/${fileName}`;
  const data = await blobToBase64(blob);
  const saved = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
    recursive: true,
  });

  try {
    await Share.share({
      title: fileName,
      dialogTitle: "Save or share RapWriter export",
      url: saved.uri,
    });
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined);
  }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("The export could not be read."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) reject(new Error("The export could not be encoded."));
      else resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function downloadBrowserFile(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
