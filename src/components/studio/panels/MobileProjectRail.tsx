"use client";

import type { ProjectRow, SongRow } from "@/hooks/use-rapwriter-data";
import type { StudioPack } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { FolderPlus } from "lucide-react";

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
  onNewSong: () => void;
}) {
  return (
    <section className="pt-6" aria-labelledby="studio-projects-title">
      <div className="flex items-center justify-between px-5">
        <div>
          <div className="label-hw">Projects</div>
          <h2 id="studio-projects-title" className="mt-1 text-lg font-semibold">Keep the work moving</h2>
        </div>
        <button type="button" onClick={onNewSong} className="flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-gold">
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

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => (resumeSong ? onLoadSong(resumeSong) : onNewSong())}
              className={cn(
                "w-[210px] shrink-0 snap-start overflow-hidden rounded-xl border bg-[#111113] text-left transition-[border-color,transform] active:scale-[0.99]",
                active ? "border-gold/55" : "border-white/10",
              )}
              aria-label={`${resumeSong ? "Open" : "Start a song in"} ${project.title}`}
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
                  {projectSongs.length} {projectSongs.length === 1 ? "song" : "songs"} in motion
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
    </section>
  );
}
