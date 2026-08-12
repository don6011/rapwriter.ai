"use client";

import type { ProjectRow, SongRow } from "@/hooks/use-rapwriter-data";
import type { StudioPack } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { ChevronRight, FolderPlus, Plus, X } from "lucide-react";
import { useState } from "react";

export function MobileProjectRail({
  projects,
  songs,
  activeProjectId,
  studioPacks,
  onLoadSong,
  onNewSong,
}: {
  projects: ProjectRow[];
  songs: SongRow[];
  activeProjectId?: string;
  studioPacks: StudioPack[];
  onLoadSong: (song: SongRow) => void;
  onNewSong: (projectId?: string) => void;
}) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const openProject = projects.find((project) => project.id === openProjectId) ?? null;
  const openProjectSongs = openProject
    ? songs
        .filter((song) => song.project_id === openProject.id)
        .sort((a, b) => a.track_number - b.track_number || (b.last_saved_at ?? "").localeCompare(a.last_saved_at ?? ""))
    : [];

  return (
    <section className="pt-6" aria-labelledby="studio-projects-title">
      <div className="flex items-center justify-between px-5">
        <div>
          <div className="label-hw">Projects</div>
          <h2 id="studio-projects-title" className="mt-1 text-lg font-semibold">Keep the work moving</h2>
        </div>
        <button type="button" onClick={() => onNewSong()} className="flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-gold">
          <FolderPlus className="h-4 w-4" />
          New
        </button>
      </div>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {projects.map((project, index) => {
          const projectSongs = songs
            .filter((song) => song.project_id === project.id)
            .sort((a, b) => (b.last_saved_at ?? "").localeCompare(a.last_saved_at ?? ""));
          const resumeSong = projectSongs[0];
          const completion = projectSongs.length
            ? Math.round(projectSongs.reduce((total, song) => total + (song.completion_pct ?? 0), 0) / projectSongs.length)
            : 0;
          const artworkValue = project.artwork.url ?? project.artwork.image_url;
          const artwork = typeof artworkValue === "string" && artworkValue ? artworkValue : studioPacks[index % studioPacks.length].image;
          const active = project.id === activeProjectId;
          const isSingle = project.project_type.toLowerCase() === "single";

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                if (isSingle) {
                  if (resumeSong) onLoadSong(resumeSong);
                  else onNewSong(project.id);
                  return;
                }
                setOpenProjectId(project.id);
              }}
              className={cn(
                "w-[210px] shrink-0 snap-start overflow-hidden rounded-xl border bg-[#111113] text-left transition-[border-color,transform] active:scale-[0.99]",
                active ? "border-gold/55" : "border-white/10",
              )}
              aria-label={isSingle ? `${resumeSong ? "Resume" : "Start"} ${project.title}` : `Open ${project.title} track list`}
            >
              <div className="relative h-24 overflow-hidden">
                <img src={artwork} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-black/15 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/58 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
                  {project.project_type || "Project"}
                </span>
              </div>
              <div className="p-3 pt-1">
                <div className="truncate text-sm font-semibold text-white">{project.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {projectSongs.length} {projectSongs.length === 1 ? "draft" : "drafts"} in motion
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${completion}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold tabular-nums text-gold">{completion}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {openProject && (
        <div className="fixed inset-0 z-[72] flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
          <div className="w-full max-w-[430px] rounded-3xl border border-white/10 bg-[#111113] p-5 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="label-hw text-gold/85">{openProject.project_type || "Project"}</div>
                <h2 className="mt-2 truncate text-2xl font-semibold">{openProject.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose a track to continue, or start the next one.</p>
              </div>
              <button type="button" onClick={() => setOpenProjectId(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close project">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 max-h-[46svh] space-y-2 overflow-y-auto pr-1">
              {openProjectSongs.map((song, index) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => {
                    setOpenProjectId(null);
                    onLoadSong(song);
                  }}
                  className="flex min-h-[68px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/24 px-4 text-left transition-colors hover:border-gold/30 hover:bg-gold/[0.04]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/25 bg-gold/8 text-xs font-semibold text-gold">{song.track_number || index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{song.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{song.total_bars || 0} bars · {song.completion_pct || 0}% complete</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gold" />
                </button>
              ))}
              {openProjectSongs.length === 0 && <div className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm text-muted-foreground">This project is ready for its first song.</div>}
            </div>

            <button
              type="button"
              onClick={() => {
                const projectId = openProject.id;
                setOpenProjectId(null);
                onNewSong(projectId);
              }}
              className="gold-seal mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add song to {openProject.title}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
