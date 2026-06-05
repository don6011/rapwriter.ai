import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Disc3, Music2, Mic2, FolderOpen, Sparkles, Award, Play, Pause,
  Heart, Volume2, Repeat, Wand2, Flame, Feather, MessageSquareQuote,
  ChevronRight, Plus, Headphones, Clock, Moon, Lightbulb, EyeOff,
  Coffee, CloudRain, Wind, Camera, ArrowUpRight, Disc, CheckCircle2, X,
  SkipBack, SkipForward, Shield, Share2, Download, FileText,
  Mail, Copy, Music
} from "lucide-react";

const lockerItems = [
  { icon: Disc3, label: "Beat Locker", count: 24, accent: true },
  { icon: Music2, label: "Song Locker", count: 18 },
  { icon: Mic2, label: "Hook Locker", count: 47 },
  { icon: FolderOpen, label: "Projects", count: 6 },
  { icon: Award, label: "Booth Ready", count: 9, certified: true },
];

const sections = [
  { name: "Hook", lines: ["Diamonds dancin' on my neck, midnight on the strip,", "Engine purrin' soft and low, gold up on the grip —"] },
  { name: "Verse 1", lines: ["Started from the back porch, momma prayin' loud,", "Now they call my name in rooms I wasn't 'llowed,", "Every bar a brick, built this house from doubt,", "Pen game heavy, that's the only way I move about."] },
  { name: "Verse 2", lines: [""] },
  { name: "Bridge", lines: [""] },
  { name: "Outro", lines: [""] },
];

const penCoachActions = [
  { icon: Wand2, label: "Improve Bar" },
  { icon: Sparkles, label: "Improve Hook" },
  { icon: Flame, label: "Add Emotion" },
  { icon: MessageSquareQuote, label: "More Commercial" },
  { icon: Feather, label: "More Southern" },
  { icon: Headphones, label: "Suggest Adlibs" },
];

const modes = [
  { id: "midnight", label: "Midnight Session", icon: Moon },
  { id: "producer", label: "Producer Room", icon: Lightbulb },
  { id: "ghost", label: "Ghost Studio", icon: EyeOff },
];

const ambiance = [
  { id: "none", label: "Silent", icon: X },
  { id: "vinyl", label: "Vinyl Crackle", icon: Disc },
  { id: "rain", label: "Rain on Glass", icon: CloudRain },
  { id: "lounge", label: "Lounge Air", icon: Wind },
  { id: "coffee", label: "Late-Night Café", icon: Coffee },
];

const states = ["Idea", "Draft", "Session Ready", "Booth Ready"];

// Procedural artwork: each project gets a unique gradient + glyph
const projects = [
  {
    id: "gcn", type: "EP", title: "Gold Chains, Cold Nights", tracks: 6,
    art: "linear-gradient(135deg, #1a0f08 0%, #3d2410 45%, #8b6914 100%)",
    glyph: "GCN",
  },
  {
    id: "ms", type: "Single", title: "Midnight on the Strip", tracks: 1,
    art: "linear-gradient(160deg, #0a0a1a 0%, #1a1438 50%, #c9a84c 130%)",
    glyph: "MS",
  },
  {
    id: "fl", type: "Album", title: "Fluorescent Lullabies", tracks: 12,
    art: "linear-gradient(200deg, #2d0a1f 0%, #5c1840 50%, #d4842a 110%)",
    glyph: "FL",
  },
  {
    id: "vp", type: "Single", title: "Velvet Pressure", tracks: 1,
    art: "linear-gradient(180deg, #051a1a 0%, #0d3838 50%, #5cbdb9 130%)",
    glyph: "VP",
  },
];

const snapshots = [
  { day: "Today",     time: "12 min ago", title: "Midnight on the Strip", note: "Hook locked. Verse 1 polished. Coach approved cadence shift.", bars: 16, state: 2 },
  { day: "Yesterday", time: "11:42 PM",   title: "Midnight on the Strip", note: "Pulled hook from Hook Locker™. Tried two cadences.",                bars: 8,  state: 1 },
  { day: "Tuesday",   time: "1:18 AM",    title: "Velvet Pressure",       note: "Bridge rewrite. Loaded NightOwl beat pack.",                       bars: 24, state: 2 },
  { day: "Sunday",    time: "9:04 PM",    title: "Backseat Cathedral",    note: "Booth Ready™ certified. Sent to engineer.",                       bars: 32, state: 3 },
];

export default function Studio() {
  const [playing, setPlaying] = useState(false);
  const [activeMode, setActiveMode] = useState("midnight");
  const [activeAmbiance, setActiveAmbiance] = useState("vinyl");
  const [activeSection, setActiveSection] = useState(0);
  const [songState, setSongState] = useState(2);
  const [fav, setFav] = useState(true);
  const [activeProject, setActiveProject] = useState(projects[0]);
  const [boothModalOpen, setBoothModalOpen] = useState(false);

  return (
    <div className="min-h-screen w-full text-foreground relative">
      {/* Ambient layer — subtle, never noisy */}
      <AmbientLayer mode={activeMode} ambiance={activeAmbiance} />

      {/* Top brand bar */}
      <header className="sticky top-0 z-30 glass-panel">
        <div className="flex items-center justify-between px-6 py-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="gold-seal h-9 w-9 rounded-full flex items-center justify-center">
              <span className="font-display text-onyx text-lg font-bold">R</span>
            </div>
            <div>
              <div className="font-display text-lg leading-none">
                RapWriter<span className="text-gold">.ai</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">
                Sharpen Your Pen
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-onyx-elev/60">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              The Prep Studio™ · {modes.find(m => m.id === activeMode)?.label}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {modes.map((m) => {
              const Icon = m.icon;
              const active = activeMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMode(m.id)}
                  className={cn(
                    "p-2 rounded-lg transition-all border",
                    active
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-transparent text-muted-foreground hover:text-gold hover:border-border"
                  )}
                  title={m.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main 3-column studio */}
      <div className="grid grid-cols-12 gap-4 p-4 lg:p-6 relative z-10">
        {/* LEFT SIDEBAR — Lockers */}
        <aside className="hidden lg:block col-span-3 xl:col-span-2">
          <div className="glass-panel rounded-2xl p-4 sticky top-24">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3 px-2">
              The Locker™
            </div>
            <nav className="space-y-1">
              {lockerItems.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.label}
                    className={cn(
                      "w-full group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all",
                      it.accent
                        ? "bg-gold/8 border border-gold/20 text-foreground"
                        : "hover:bg-onyx-elev text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className={cn("h-4 w-4", (it.accent || it.certified) && "text-gold")} />
                      <span className="text-sm">{it.label}™</span>
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md tabular-nums",
                      it.certified ? "gold-seal text-onyx font-semibold" : "bg-onyx text-muted-foreground"
                    )}>
                      {it.count}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="hairline my-5" />

            {/* Project shelf — artwork tiles */}
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3 px-2">
              The Shelf
            </div>
            <div className="grid grid-cols-2 gap-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProject(p)}
                  className={cn(
                    "group relative aspect-square rounded-lg overflow-hidden border transition-all",
                    activeProject.id === p.id ? "border-gold ring-1 ring-gold/40" : "border-border hover:border-gold/40"
                  )}
                  title={`${p.title} · ${p.type}`}
                >
                  <ProjectArtwork project={p} />
                </button>
              ))}
            </div>

            <button className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gold/30 text-gold hover:bg-gold/10 transition-colors text-sm">
              <Plus className="h-4 w-4" /> New Session
            </button>
          </div>
        </aside>

        {/* CENTER */}
        <main className="col-span-12 lg:col-span-9 xl:col-span-7 space-y-4">
          {/* RESUME SESSION CARD */}
          <ResumeSessionCard
            project={activeProject}
            onResume={() => setPlaying(true)}
          />

          {/* Project / Track header */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl overflow-hidden border border-gold/30 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] shrink-0">
                  <ProjectArtwork project={activeProject} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <span>Current {activeProject.type}</span>
                    <span className="h-1 w-1 rounded-full bg-gold/60" />
                    <span>{activeProject.tracks} track{activeProject.tracks > 1 ? "s" : ""}</span>
                  </div>
                  <h1 className="font-display text-3xl md:text-4xl mt-1">
                    <span className="text-gold-gradient">{activeProject.title}</span>
                  </h1>
                  <div className="text-sm text-muted-foreground mt-1">
                    Track 03 — <span className="text-foreground/90">Midnight on the Strip</span>
                  </div>
                </div>
              </div>

              {/* Beat player */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-onyx/70 border border-border min-w-[280px]">
                <button
                  onClick={() => setPlaying(!playing)}
                  className="gold-seal h-11 w-11 rounded-full flex items-center justify-center text-onyx shrink-0"
                >
                  {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">Smoke & Velvet</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>prod. NightOwl</span>
                    <span className="h-1 w-1 rounded-full bg-gold/60" />
                    <span>84 BPM</span>
                  </div>
                  <div className="flex items-end gap-[2px] h-5 mt-1.5">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-[3px] bg-gold/70 rounded-full"
                        style={{
                          height: `${20 + Math.sin(i * 0.7) * 50 + (playing ? Math.random() * 30 : 0)}%`,
                          animation: playing ? `vu-pulse ${0.6 + (i % 5) * 0.15}s ease-in-out infinite` : "none",
                          transformOrigin: "bottom",
                          opacity: i < 14 ? 1 : 0.35,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => setFav(!fav)} className="text-muted-foreground hover:text-gold transition">
                    <Heart className={cn("h-4 w-4", fav && "fill-gold text-gold")} />
                  </button>
                  <button className="text-muted-foreground hover:text-gold transition">
                    <Repeat className="h-4 w-4" />
                  </button>
                  <button className="text-muted-foreground hover:text-gold transition">
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section tabs + writing pad */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-1 px-4 pt-4 overflow-x-auto">
              {sections.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => setActiveSection(i)}
                  className={cn(
                    "px-4 py-2 rounded-t-lg text-sm transition-all whitespace-nowrap border-b-2",
                    activeSection === i
                      ? "text-gold border-gold bg-gold/5"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  )}
                >
                  {s.name}
                </button>
              ))}
              <button className="ml-auto p-2 text-muted-foreground hover:text-gold">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="px-8 py-10 md:px-12 md:py-14 min-h-[420px] bg-gradient-to-b from-transparent to-onyx/40">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mb-6">
                {sections[activeSection].name}
              </div>
              <div
                className="font-display text-2xl md:text-[28px] leading-[1.7] text-foreground/95 outline-none whitespace-pre-wrap"
                contentEditable
                suppressContentEditableWarning
              >
                {sections[activeSection].lines.join("\n") || "Tap to start writing…"}
              </div>
            </div>

            {/* Progress tracker */}
            <div className="border-t border-border px-5 py-4 bg-onyx/60">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Song Status
                </div>
                <button
                  onClick={() => setBoothModalOpen(true)}
                  className="text-[10px] uppercase tracking-[0.25em] text-gold hover:underline flex items-center gap-1"
                >
                  Preview Booth Ready™ <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {states.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => { setSongState(i); if (i === 3) setBoothModalOpen(true); }}
                    className="flex-1 group"
                  >
                    <div className={cn(
                      "h-1.5 rounded-full transition-all",
                      i <= songState ? "bg-gradient-to-r from-gold-deep to-gold" : "bg-border"
                    )} />
                    <div className={cn(
                      "text-[10px] uppercase tracking-[0.2em] mt-2 transition-colors",
                      i === songState ? "text-gold" : "text-muted-foreground"
                    )}>
                      {s}{i === 3 && "™"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STUDIO SNAPSHOT HISTORY */}
          <SnapshotHistory />
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="col-span-12 xl:col-span-3 space-y-4">
          {/* Pen Coach */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Pen Coach™
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Your assistant. The pen stays in <span className="text-foreground">your</span> hand.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {penCoachActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    className="group flex flex-col items-start gap-2 p-3 rounded-xl bg-onyx-elev border border-border hover:border-gold/40 hover:bg-gold/5 transition-all text-left"
                  >
                    <Icon className="h-4 w-4 text-gold" />
                    <span className="text-xs leading-tight text-foreground/90 group-hover:text-foreground">
                      {a.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="hairline my-5" />

            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Coach Suggestion
              </div>
              <div className="text-sm text-foreground/90 italic leading-relaxed border-l-2 border-gold/60 pl-3">
                "Diamonds dancin'" lands soft — try a harder consonant to match the
                beat's 808. Consider <span className="text-gold not-italic">"flashin'"</span> or
                <span className="text-gold not-italic"> "bangin'"</span>.
              </div>
              <button className="text-xs text-gold flex items-center gap-1 hover:gap-2 transition-all">
                Apply suggestion <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Ambiance panel */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Headphones className="h-4 w-4 text-gold" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Studio Air™
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Set the room. Sound under everything.
            </p>
            <div className="space-y-1.5">
              {ambiance.map((a) => {
                const Icon = a.icon;
                const active = activeAmbiance === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setActiveAmbiance(a.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border",
                      active
                        ? "border-gold/40 bg-gold/10 text-gold"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-onyx-elev"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{a.label}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* BOOTH READY MILESTONE — modal */}
      {boothModalOpen && (
        <BoothReadyMilestone
          project={activeProject}
          onClose={() => setBoothModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function ProjectArtwork({ project }: { project: typeof projects[number] }) {
  return (
    <div className="absolute inset-0" style={{ background: project.art }}>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 50%)"
      }} />
      <div className="absolute inset-0 flex items-end justify-between p-2">
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-white/80">
          {project.type}
        </span>
        <span className="font-display text-xl text-white/90 leading-none drop-shadow">
          {project.glyph}
        </span>
      </div>
      {/* subtle vinyl ring */}
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full border border-white/15" />
      <div className="absolute -right-3 -top-3 h-10 w-10 rounded-full border border-white/10" />
    </div>
  );
}

function ResumeSessionCard({ project, onResume }: { project: typeof projects[number]; onResume: () => void }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-gold/20 glass-panel">
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, var(--gold), transparent 55%)` }} />
      <div className="relative flex flex-wrap items-center gap-5 p-5">
        <div className="h-20 w-20 rounded-xl overflow-hidden border border-gold/40 shadow-[0_10px_40px_-12px_rgba(201,168,76,0.5)] shrink-0 relative">
          <ProjectArtwork project={project} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Continue Where You Left Off · 12 min ago</span>
          </div>
          <div className="font-display text-2xl mt-1">
            Midnight on the Strip
          </div>
          <div className="text-sm text-muted-foreground">
            Verse 1 · 16 bars in · cadence approved by Pen Coach™
          </div>
        </div>
        <button
          onClick={onResume}
          className="gold-seal text-onyx px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-100 transition-transform"
        >
          <Play className="h-4 w-4" fill="currentColor" /> Resume Session
        </button>
      </div>
    </div>
  );
}

function SnapshotHistory() {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-gold" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Studio Snapshots™
          </span>
        </div>
        <button className="text-xs text-muted-foreground hover:text-gold flex items-center gap-1">
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-5 max-w-md">
        Every session leaves a mark. Look back and feel the pen sharpen.
      </p>

      <div className="relative pl-5">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-gold/40 via-gold/15 to-transparent" />
        <div className="space-y-4">
          {snapshots.map((s, i) => (
            <div key={i} className="relative group">
              <div className={cn(
                "absolute -left-[18px] top-1.5 h-3 w-3 rounded-full border-2",
                s.state === 3
                  ? "bg-gold border-gold shadow-[0_0_12px_var(--gold)]"
                  : "bg-onyx border-gold/60"
              )} />
              <div className="rounded-xl bg-onyx-elev/60 border border-border p-4 hover:border-gold/30 transition-all">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-gold">{s.day}</span>
                    <span className="text-[11px] text-muted-foreground">{s.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground tabular-nums">{s.bars} bars</span>
                    {s.state === 3 && (
                      <span className="gold-seal text-onyx text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Award className="h-2.5 w-2.5" /> Booth Ready™
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-display text-lg mt-1">{s.title}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AmbientLayer({ mode, ambiance }: { mode: string; ambiance: string }) {
  const modeTint = mode === "producer"
    ? "radial-gradient(ellipse at 50% 0%, rgba(232, 180, 74, 0.10), transparent 55%)"
    : mode === "ghost"
    ? "radial-gradient(ellipse at 50% 100%, rgba(180, 200, 220, 0.04), transparent 60%)"
    : "radial-gradient(ellipse at 20% 0%, rgba(201, 168, 76, 0.06), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(125, 90, 200, 0.05), transparent 55%)";

  return (
    <>
      {/* Mode tint */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
        style={{ background: modeTint }}
      />
      {/* Vinyl grain */}
      {ambiance === "vinyl" && (
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      )}
      {/* Rain streaks */}
      {ambiance === "rain" && (
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(110deg, transparent 0 4px, rgba(255,255,255,0.6) 4px 4.4px, transparent 4.4px 9px)",
            animation: "rain-drift 2.4s linear infinite",
          }}
        />
      )}
      {/* Lounge / coffee — soft warm vignette */}
      {(ambiance === "lounge" || ambiance === "coffee") && (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: ambiance === "coffee"
              ? "radial-gradient(ellipse at 70% 80%, rgba(220, 140, 60, 0.08), transparent 50%), radial-gradient(ellipse at 20% 30%, rgba(180, 100, 60, 0.05), transparent 50%)"
              : "radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.04), transparent 60%)",
          }}
        />
      )}
      {/* Now-playing pulse glow at edges (always on, very subtle) */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          boxShadow: "inset 0 0 200px rgba(0,0,0,0.5)",
        }}
      />
    </>
  );
}

function BoothReadyMilestone({ project, onClose }: { project: typeof projects[number]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-onyx/85 backdrop-blur-xl" onClick={onClose} />
      <div className="relative max-w-xl w-full glass-panel rounded-3xl p-10 text-center overflow-hidden animate-scale-in border border-gold/40">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-gold">
          <X className="h-5 w-5" />
        </button>

        {/* Aura */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle at center, var(--gold), transparent 60%)" }} />
        {/* Light rays */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background:
              "conic-gradient(from 90deg at 50% 40%, transparent, rgba(201,168,76,0.6), transparent, rgba(201,168,76,0.4), transparent)",
            animation: "spin-slow 14s linear infinite",
          }}
        />

        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.4em] text-gold mb-4">
            A Moment to Mark
          </div>
          <div className="gold-seal h-28 w-28 rounded-full mx-auto flex items-center justify-center mb-5 shadow-[0_0_60px_-8px_var(--gold)]">
            <Award className="h-14 w-14 text-onyx" strokeWidth={2.2} />
          </div>
          <h3 className="font-display text-5xl md:text-6xl text-gold-gradient leading-tight">
            Booth Ready™
          </h3>
          <div className="hairline my-5 max-w-[200px] mx-auto" />
          <div className="text-base text-foreground/90 mt-2">
            <span className="font-display text-2xl">Midnight on the Strip</span>
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-1">
            from {project.title} · {project.type}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-7 text-left">
            {[
              { label: "Cadence", v: "Locked" },
              { label: "Hook",    v: "Sealed" },
              { label: "Bars",    v: "32 / 32" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-onyx-elev/70 border border-gold/15 p-3">
                <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{s.label}</div>
                <div className="text-sm text-gold flex items-center gap-1 mt-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {s.v}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-7">
            <button className="gold-seal text-onyx px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
              Send to Engineer <ArrowUpRight className="h-4 w-4" />
            </button>
            <button className="px-5 py-2.5 rounded-xl text-sm border border-gold/40 text-gold hover:bg-gold/10">
              Save Snapshot
            </button>
          </div>

          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-6">
            Certified in RapWriter.ai · The Prep Studio™
          </div>
        </div>
      </div>
    </div>
  );
}
