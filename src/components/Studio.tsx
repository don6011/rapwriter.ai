import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { consumePendingBeat, type License } from "@/lib/marketplace-data";
import { useLicensing } from "@/hooks/use-licensing";
import {
  Disc3, Music2, Mic2, FolderOpen, Sparkles, Award, Play, Pause,
  Heart, Volume2, Repeat, Wand2, Flame, Feather, MessageSquareQuote,
  ChevronRight, Plus, Headphones, Clock, Moon, Lightbulb, EyeOff,
  Coffee, CloudRain, Wind, Camera, ArrowUpRight, Disc, CheckCircle2, X,
  SkipBack, SkipForward, Shield, Share2, Download, FileText,
  Mail, Copy, Music, Store, BadgeCheck, Maximize2, Minimize2, Save, Mic, BookOpen
} from "lucide-react";

const lockerItems = [
  { icon: Disc3, label: "Beat Locker", count: 24, accent: true },
  { icon: Music2, label: "Song Locker", count: 18 },
  { icon: Mic2, label: "Hook Locker", count: 47 },
  { icon: FolderOpen, label: "Projects", count: 6 },
  { icon: Award, label: "Booth Ready", count: 9, certified: true },
];

// Song section blueprint — order matters; target bars used for Completion %
const SECTION_BLUEPRINT = [
  { name: "Hook",    target: 8,  weight: 1.5 },
  { name: "Verse 1", target: 16, weight: 1.2 },
  { name: "Verse 2", target: 16, weight: 1.2 },
  { name: "Bridge",  target: 8,  weight: 0.8 },
  { name: "Outro",   target: 4,  weight: 0.6 },
] as const;

const SEED_CONTENT: Record<string, string> = {
  "Hook":    "Diamonds dancin' on my neck, midnight on the strip,\nEngine purrin' soft and low, gold up on the grip —",
  "Verse 1": "Started from the back porch, momma prayin' loud,\nNow they call my name in rooms I wasn't 'llowed,\nEvery bar a brick, built this house from doubt,\nPen game heavy, that's the only way I move about.",
  "Verse 2": "",
  "Bridge":  "",
  "Outro":   "",
};

// Producer Notes™ replaces the old Pen Coach action grid — see ProducerNotesPanel


// Three studio environments
const modes = [
  { id: "midnight", label: "Midnight Session™", icon: Moon,     blurb: "After-hours pen. Low light. Smoke-thick." },
  { id: "booth",    label: "Booth Mode™",       icon: Mic,      blurb: "Performance lens. Cadence-first. Mic warm." },
  { id: "writers",  label: "Writer's Room™",    icon: BookOpen, blurb: "Daylight focus. Clean page. Collab energy." },
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
  { day: "Today",     time: "12 min ago", title: "Midnight on the Strip", note: "Hook locked. Verse 1 polished. Coach approved cadence shift.", bars: 16, state: 2, duration: "1h 14m", linesAdded: 22, sections: ["Hook", "Verse 1"], beat: "Smoke & Velvet", glyph: "MS", art: "linear-gradient(160deg, #0a0a1a 0%, #1a1438 50%, #c9a84c 130%)" },
  { day: "Yesterday", time: "11:42 PM",   title: "Midnight on the Strip", note: "Pulled hook from Hook Locker™. Tried two cadences.",                bars: 8,  state: 1, duration: "42m",    linesAdded: 14, sections: ["Hook"],           beat: "Smoke & Velvet", glyph: "MS", art: "linear-gradient(160deg, #0a0a1a 0%, #1a1438 50%, #c9a84c 130%)" },
  { day: "Tuesday",   time: "1:18 AM",    title: "Velvet Pressure",       note: "Bridge rewrite. Loaded NightOwl beat pack.",                       bars: 24, state: 2, duration: "2h 03m", linesAdded: 31, sections: ["Bridge", "Verse 2"], beat: "Lowlight",     glyph: "VP", art: "linear-gradient(180deg, #051a1a 0%, #0d3838 50%, #5cbdb9 130%)" },
  { day: "Sunday",    time: "9:04 PM",    title: "Backseat Cathedral",    note: "Booth Ready™ certified. Sent to engineer.",                       bars: 32, state: 3, duration: "3h 21m", linesAdded: 48, sections: ["Hook", "V1", "V2", "Bridge", "Outro"], beat: "Cathedral 88", glyph: "BC", art: "linear-gradient(200deg, #2d0a1f 0%, #5c1840 50%, #d4842a 110%)" },
];

const currentBeat = {
  id: "smoke-velvet",
  title: "Smoke & Velvet",
  producer: "NightOwl",
  bpm: 84,
  key: "F# Minor",
  mood: "Late-Night · Sultry",
  genre: "Trap Soul",
  region: "Atlanta · Southside",
  tags: ["Late Night Drive", "Heartbreak", "Storytelling"],
  duration: "3:42",
  position: "1:18",
  license: "Exclusive · Cleared",
  tag: "RW-0421",
  prices: [
    { license: "Lease", price: 49 },
    { license: "Premium Lease", price: 149 },
    { license: "Exclusive", price: 899 },
  ] as { license: License; price: number }[],
};




export default function Studio() {
  const [playing, setPlaying] = useState(false);
  const [activeMode, setActiveMode] = useState("midnight");
  const [activeAmbiance, setActiveAmbiance] = useState("vinyl");
  const [activeSection, setActiveSection] = useState(0);
  const [songState, setSongState] = useState(2);
  const [fav, setFav] = useState(true);
  const [activeProject, setActiveProject] = useState(projects[0]);
  const [boothModalOpen, setBoothModalOpen] = useState(false);
  const [loadedBeat, setLoadedBeat] = useState<typeof currentBeat | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // -------- Draft / Autosave --------
  const [sectionContent, setSectionContent] = useState<Record<string, string>>(SEED_CONTENT);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [savingFlash, setSavingFlash] = useState(false);
  const draftKey = `rapwriter:draft:${activeProject.id}`;

  // Load draft when project switches
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { sections: Record<string, string>; savedAt: number };
        setSectionContent({ ...SEED_CONTENT, ...parsed.sections });
        setLastSaved(parsed.savedAt);
      } else {
        setSectionContent(SEED_CONTENT);
        setLastSaved(null);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject.id]);

  // Debounced autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const savedAt = Date.now();
      localStorage.setItem(draftKey, JSON.stringify({ sections: sectionContent, savedAt }));
      setLastSaved(savedAt);
      setSavingFlash(true);
      const t = setTimeout(() => setSavingFlash(false), 900);
      return () => clearTimeout(t);
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [sectionContent, draftKey]);

  // -------- Live Completion % + Booth Ready Score™ --------
  const { completionPct, boothScore, totalBars } = useMemo(() => {
    let weightedDone = 0;
    let weightedTotal = 0;
    let bars = 0;
    let hookLines = 0;
    let densitySum = 0;
    let densityCount = 0;
    for (const s of SECTION_BLUEPRINT) {
      const text = (sectionContent[s.name] ?? "").trim();
      const lines = text ? text.split("\n").filter(l => l.trim().length > 0) : [];
      const bar = lines.length;
      bars += bar;
      if (s.name === "Hook") hookLines = bar;
      const done = Math.min(bar, s.target);
      weightedDone += (done / s.target) * s.weight;
      weightedTotal += s.weight;
      const avgLen = lines.length ? lines.reduce((a, l) => a + l.length, 0) / lines.length : 0;
      if (lines.length) { densitySum += Math.min(avgLen / 48, 1); densityCount++; }
    }
    const pct = Math.round((weightedDone / weightedTotal) * 100);
    const density = densityCount ? densitySum / densityCount : 0;
    const hookBonus = hookLines >= 4 ? 1 : hookLines / 4;
    const score = Math.max(0, Math.min(100, Math.round(pct * 0.7 + density * 100 * 0.2 + hookBonus * 100 * 0.1)));
    return { completionPct: pct, boothScore: score, totalBars: bars };
  }, [sectionContent]);

  // Auto-bump song state based on completion
  useEffect(() => {
    if (completionPct >= 95 && songState < 3) setSongState(3);
    else if (completionPct >= 65 && songState < 2) setSongState(2);
    else if (completionPct >= 20 && songState < 1) setSongState(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionPct]);


  // Marketplace → Ghost Studio handoff
  useEffect(() => {
    const b = consumePendingBeat();
    if (b) {
      setLoadedBeat({
        id: b.id,
        title: b.title,
        producer: b.producer,
        bpm: b.bpm,
        key: b.key,
        mood: b.mood,
        genre: (b as { genre?: string }).genre ?? "Trap",
        region: (b as { region?: string }).region ?? "—",
        tags: (b as { emotionalTags?: string[] }).emotionalTags ?? [b.mood],
        duration: b.duration,
        position: "0:00",
        license: `${b.prices[0].license} · Loaded from Marketplace`,
        tag: b.tag ?? "RW-MKT",
        prices: b.prices,
      });

      setSongState(0);
      setActiveSection(0);
      setPlaying(true);
      setHandoffNotice(`New session started · writing to "${b.title}" by ${b.producer}`);
      const t = setTimeout(() => setHandoffNotice(null), 4500);
      return () => clearTimeout(t);
    }
  }, []);

  const beat = loadedBeat ?? currentBeat;

  // -------- Licensing state machine --------
  // states: 'licensed' | 'unlicensed' | 'prompting' | 'purchasing'
  const { licensed, license, purchase, purchases } = useLicensing(beat.id);
  const [licenseState, setLicenseState] = useState<"licensed" | "unlicensed" | "prompting" | "purchasing">(
    "unlicensed",
  );
  const [licenseFlash, setLicenseFlash] = useState<string | null>(null);

  // Sync state machine with reactive licensed status (event-driven from marketplace too)
  useEffect(() => {
    if (licensed && licenseState !== "purchasing") {
      setLicenseState("licensed");
    } else if (!licensed && licenseState === "licensed") {
      setLicenseState("unlicensed");
    } else if (!licensed && licenseState !== "prompting" && licenseState !== "purchasing") {
      setLicenseState("unlicensed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licensed, beat.id]);

  const requestLicense = () => {
    if (licenseState === "licensed") return;
    setLicenseState("prompting");
    setPlaying(false);
  };

  const confirmLicense = (tier: { license: License; price: number }) => {
    setLicenseState("purchasing");
    // Brief simulated processing for tactile feedback
    setTimeout(() => {
      purchase(beat.id, tier.license, tier.price);
      setLicenseState("licensed");
      setLicenseFlash(`${tier.license} license cleared · added to Beat Locker™ + My Licenses`);
      setTimeout(() => setLicenseFlash(null), 4000);
    }, 650);
  };

  // Reactive locker counts — Beat Locker, Projects, My Licenses
  const dynamicLockerItems = lockerItems.map((it) => {
    if (it.label === "Beat Locker") return { ...it, count: it.count + purchases.length };
    return it;
  });



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
            <Link
              to="/marketplace"
              className="ml-2 px-3 py-2 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 transition-all text-xs uppercase tracking-[0.2em] flex items-center gap-1.5"
              title="Marketplace"
            >
              <Store className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Marketplace</span>
            </Link>
          </div>
        </div>
        {handoffNotice && (
          <div className="px-6 pb-3 -mt-1 animate-fade-in">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/30 bg-gold/8 text-xs">
              <BadgeCheck className="h-3.5 w-3.5 text-gold shrink-0" />
              <span className="text-foreground/90">{handoffNotice}</span>
            </div>
          </div>
        )}
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
              {dynamicLockerItems.map((it) => {
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl overflow-hidden border border-gold/30 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] shrink-0 relative">
                  <ProjectArtwork project={activeProject} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <span>Current {activeProject.type}</span>
                    <span className="h-1 w-1 rounded-full bg-gold/60" />
                    <span>{activeProject.tracks} track{activeProject.tracks > 1 ? "s" : ""}</span>
                  </div>
                  <h1 className="font-display text-2xl md:text-3xl mt-0.5">
                    <span className="text-gold-gradient">{activeProject.title}</span>
                  </h1>
                  <div className="text-sm text-muted-foreground">
                    Track 03 — <span className="text-foreground/90">Midnight on the Strip</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-gold hover:border-gold/40 flex items-center gap-2">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                <button className="px-3 py-2 rounded-lg border border-gold/30 text-gold text-xs hover:bg-gold/10 flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" /> Add Track
                </button>
              </div>
            </div>
          </div>

          {/* HERO BEAT PLAYER — pinned just under the brand bar */}
          <div className="sticky top-[88px] z-20">
            <HeroBeatPlayer
              beat={beat}
              playing={playing}
              onToggle={() => {
                if (!licensed && licenseState !== "licensed") {
                  requestLicense();
                  return;
                }
                setPlaying(!playing);
              }}
              fav={fav}
              onFav={() => setFav(!fav)}
              projects={projects}
              activeProjectId={activeProject.id}
              onAddToProject={(p) => setActiveProject(p)}
              licenseState={licenseState}
              licenseLabel={license ? `${license.license} · Cleared` : beat.license}
              onRequestLicense={requestLicense}
              licenseFlash={licenseFlash}
            />
          </div>

          {/* SONG MISSION — directly beneath the beat */}
          <SongMission
            sectionContent={sectionContent}
            completionPct={completionPct}
            onJumpTo={(i) => setActiveSection(i)}
            onFlowMode={() => setFullscreen(true)}
          />



          {/* Section tabs + writing pad */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-1 px-4 pt-4 overflow-x-auto">
              {SECTION_BLUEPRINT.map((s, i) => {
                const content = (sectionContent[s.name] ?? "").trim();
                const bars = content ? content.split("\n").filter(l => l.trim()).length : 0;
                const full = bars >= s.target;
                return (
                  <button
                    key={s.name}
                    onClick={() => setActiveSection(i)}
                    className={cn(
                      "px-4 py-2 rounded-t-lg text-sm transition-all whitespace-nowrap border-b-2 flex items-center gap-2",
                      activeSection === i
                        ? "text-gold border-gold bg-gold/5"
                        : "text-muted-foreground border-transparent hover:text-foreground"
                    )}
                  >
                    <span>{s.name}</span>
                    <span className={cn(
                      "text-[9px] tabular-nums px-1.5 rounded-full",
                      full ? "gold-seal text-onyx font-semibold" : "bg-onyx-elev text-muted-foreground"
                    )}>{bars}/{s.target}</span>
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-1">
                <span className="hidden md:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-2">
                  <Save className={cn("h-3 w-3", savingFlash ? "text-gold animate-pulse" : "text-gold/60")} />
                  {savingFlash ? "Saving…" : lastSaved ? `Saved ${formatAgo(lastSaved)}` : "Draft"}
                </span>
                <button
                  onClick={() => setFullscreen(true)}
                  title="Full Screen Writing"
                  className="p-2 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/5"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-8 py-10 md:px-12 md:py-14 min-h-[420px] bg-gradient-to-b from-transparent to-onyx/40">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70">
                  {SECTION_BLUEPRINT[activeSection].name}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Target {SECTION_BLUEPRINT[activeSection].target} bars
                </div>
              </div>
              <textarea
                value={sectionContent[SECTION_BLUEPRINT[activeSection].name] ?? ""}
                onChange={(e) => setSectionContent(prev => ({
                  ...prev,
                  [SECTION_BLUEPRINT[activeSection].name]: e.target.value,
                }))}
                placeholder="Tap to start writing…"
                rows={10}
                className="w-full bg-transparent resize-none font-display text-2xl md:text-[28px] leading-[1.7] text-foreground/95 outline-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Progress tracker */}
            <div className="border-t border-border px-5 py-4 bg-onyx/60 space-y-4">
              {/* Live metrics row */}
              <div className="grid grid-cols-3 gap-3">
                <MetricTile label="Song Completion" value={`${completionPct}%`} highlight />
                <MetricTile label="Booth Ready Score™" value={`${boothScore}`} suffix="/100" gold />
                <MetricTile label="Total Bars" value={`${totalBars}`} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
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
          </div>


          {/* STUDIO SNAPSHOT HISTORY */}
          <SnapshotHistory />
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="col-span-12 xl:col-span-3 space-y-4">
          {/* Producer Notes™ — replaces generic Pen Coach actions */}
          <ProducerNotesPanel
            sectionContent={sectionContent}
            completionPct={completionPct}
            boothScore={boothScore}
          />

          {/* Booth Ready Engine™ */}
          <BoothReadyEngine
            sectionContent={sectionContent}
            completionPct={completionPct}
            boothScore={boothScore}
            onCertify={() => setBoothModalOpen(true)}
          />


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

      {/* LICENSE DIALOG */}
      <LicenseDialog
        open={licenseState === "prompting" || licenseState === "purchasing"}
        beat={beat}
        state={licenseState}
        onConfirm={confirmLicense}
        onClose={() => licenseState !== "purchasing" && setLicenseState(licensed ? "licensed" : "unlicensed")}
      />

      {/* FULL SCREEN WRITING MODE */}
      {fullscreen && (
        <FullScreenWriter
          beat={beat}
          sectionContent={sectionContent}
          onChange={(name, val) => setSectionContent(prev => ({ ...prev, [name]: val }))}
          activeIndex={activeSection}
          setActiveIndex={setActiveSection}
          completionPct={completionPct}
          boothScore={boothScore}
          savingFlash={savingFlash}
          lastSaved={lastSaved}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}

/* ---------- Helpers ---------- */

function formatAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MetricTile({ label, value, suffix, highlight, gold }: {
  label: string; value: string; suffix?: string; highlight?: boolean; gold?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border px-3 py-2.5",
      gold ? "border-gold/40 bg-gold/8"
        : highlight ? "border-gold/25 bg-gold/5"
        : "border-border bg-onyx-elev/60"
    )}>
      <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={cn(
          "font-display text-2xl leading-none",
          gold || highlight ? "text-gold-gradient" : "text-foreground"
        )}>{value}</span>
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function FullScreenWriter({
  beat, sectionContent, onChange, activeIndex, setActiveIndex,
  completionPct, boothScore, savingFlash, lastSaved, onClose,
}: {
  beat: typeof currentBeat;
  sectionContent: Record<string, string>;
  onChange: (name: string, val: string) => void;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  completionPct: number;
  boothScore: number;
  savingFlash: boolean;
  lastSaved: number | null;
  onClose: () => void;
}) {
  const section = SECTION_BLUEPRINT[activeIndex];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-onyx animate-fade-in">
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(201,168,76,0.18), transparent 60%)" }} />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }} />

      <div className="relative h-full flex flex-col max-w-3xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.35em] text-gold/80 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            Writing to <span className="text-foreground/90">{beat.title}</span>
            <span className="text-muted-foreground"> · {beat.bpm} BPM · {beat.key}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Save className={cn("h-3 w-3", savingFlash ? "text-gold animate-pulse" : "text-gold/60")} />
              {savingFlash ? "Saving…" : lastSaved ? `Saved ${formatAgo(lastSaved)}` : "Draft"}
            </span>
            <button
              onClick={onClose}
              title="Exit Full Screen (Esc)"
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-gold hover:border-gold/40"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 mt-6 overflow-x-auto">
          {SECTION_BLUEPRINT.map((s, i) => {
            const text = (sectionContent[s.name] ?? "").trim();
            const bars = text ? text.split("\n").filter(l => l.trim()).length : 0;
            return (
              <button
                key={s.name}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "px-4 py-2 rounded-t-lg text-sm transition-all whitespace-nowrap border-b-2 flex items-center gap-2",
                  activeIndex === i
                    ? "text-gold border-gold bg-gold/5"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                {s.name}
                <span className="text-[9px] tabular-nums text-muted-foreground/80">{bars}/{s.target}</span>
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-h-0 mt-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mb-4">{section.name}</div>
          <textarea
            autoFocus
            value={sectionContent[section.name] ?? ""}
            onChange={(e) => onChange(section.name, e.target.value)}
            placeholder="The page is yours…"
            className="flex-1 w-full bg-transparent resize-none font-display text-2xl md:text-3xl leading-[1.7] text-foreground/95 outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Footer metrics */}
        <div className="border-t border-border pt-4 mt-4 grid grid-cols-3 gap-3">
          <MetricTile label="Song Completion" value={`${completionPct}%`} highlight />
          <MetricTile label="Booth Ready Score™" value={`${boothScore}`} suffix="/100" gold />
          <MetricTile label="Section Bars" value={String((sectionContent[section.name] ?? "").split("\n").filter(l => l.trim()).length)} />
        </div>
      </div>
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
            Writing Session Timeline™
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
              <div className="rounded-xl bg-onyx-elev/60 border border-border p-4 hover:border-gold/30 transition-all group-hover:-translate-y-px">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-lg overflow-hidden border border-gold/20 shrink-0 relative">
                    <div className="absolute inset-0" style={{ background: s.art }} />
                    <div className="absolute inset-0 flex items-end justify-end p-1">
                      <span className="font-display text-[10px] text-white/90 drop-shadow">{s.glyph}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div className="flex items-baseline gap-3">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-gold">{s.day}</span>
                        <span className="text-[11px] text-muted-foreground">{s.time}</span>
                      </div>
                      {s.state === 3 && (
                        <span className="gold-seal text-onyx text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Award className="h-2.5 w-2.5" /> Booth Ready™
                        </span>
                      )}
                    </div>
                    <div className="font-display text-lg mt-0.5 truncate">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.note}</div>

                    {/* progress strip */}
                    <div className="flex items-center gap-1.5 mt-3">
                      {states.map((_, idx) => (
                        <div key={idx} className={cn(
                          "h-1 flex-1 rounded-full",
                          idx <= s.state ? "bg-gradient-to-r from-gold-deep to-gold" : "bg-border"
                        )} />
                      ))}
                    </div>

                    {/* stat chips */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-gold/70" /> {s.duration}</span>
                      <span className="flex items-center gap-1.5"><Feather className="h-3 w-3 text-gold/70" /> +{s.linesAdded} lines</span>
                      <span className="flex items-center gap-1.5 tabular-nums"><Music2 className="h-3 w-3 text-gold/70" /> {s.bars} bars</span>
                      <span className="flex items-center gap-1.5"><Disc3 className="h-3 w-3 text-gold/70" /> {s.beat}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.sections.map((sec) => (
                        <span key={sec} className="text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-md bg-gold/10 text-gold/90 border border-gold/15">
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AmbientLayer({ mode, ambiance }: { mode: string; ambiance: string }) {
  const modeTint = mode === "booth"
    ? "radial-gradient(ellipse at 50% 0%, rgba(232, 180, 74, 0.14), transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(232,180,74,0.06), transparent 60%)"
    : mode === "writers"
    ? "radial-gradient(ellipse at 50% 0%, rgba(220, 220, 235, 0.06), transparent 65%)"
    : "radial-gradient(ellipse at 20% 0%, rgba(201, 168, 76, 0.07), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(125, 90, 200, 0.06), transparent 55%)";

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

type ProjectT = typeof projects[number];

function HeroBeatPlayer({
  beat, playing, onToggle, fav, onFav, projects: projectList, activeProjectId, onAddToProject,
  licenseState, licenseLabel, onRequestLicense, licenseFlash,
}: {
  beat: typeof currentBeat;
  playing: boolean;
  onToggle: () => void;
  fav: boolean;
  onFav: () => void;
  projects: ProjectT[];
  activeProjectId: string;
  onAddToProject: (p: ProjectT) => void;
  licenseState: "licensed" | "unlicensed" | "prompting" | "purchasing";
  licenseLabel: string;
  onRequestLicense: () => void;
  licenseFlash: string | null;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-gold/25 glass-panel">
      {/* moody backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 10% 0%, rgba(201,168,76,0.18), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(125,90,200,0.12), transparent 55%)",
        }}
      />
      <div className="relative p-6 md:p-7">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-gold/90">
              {playing ? "Now Playing" : "On Deck"} · The Booth
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <LicenseBadge state={licenseState} label={licenseLabel} onRequest={onRequestLicense} />
          </div>
        </div>

        {licenseFlash && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/40 bg-gold/8 text-xs animate-fade-in">
            <CheckCircle2 className="h-3.5 w-3.5 text-gold shrink-0" />
            <span className="text-foreground/90">{licenseFlash}</span>
          </div>
        )}


        <div className="flex flex-wrap items-center gap-5">
          {/* Rotating disc / cover */}
          <div className="relative shrink-0">
            <div className={cn(
              "h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden border border-gold/40 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] relative",
              playing && "[animation:spin-slow_8s_linear_infinite]"
            )}
              style={{
                background: "radial-gradient(circle at 30% 30%, #2a1a08, #0a0a0a 70%)",
              }}
            >
              <div className="absolute inset-3 rounded-full border border-gold/20" />
              <div className="absolute inset-6 rounded-full border border-gold/15" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="gold-seal h-6 w-6 rounded-full" />
              </div>
            </div>
            <button
              onClick={onToggle}
              className="absolute -bottom-1 -right-1 gold-seal h-10 w-10 rounded-full flex items-center justify-center text-onyx shadow-[0_10px_30px_-8px_var(--gold)]"
            >
              {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
            </button>
          </div>

          {/* Meta */}
          <div className="flex-1 min-w-[240px]">
            <div className="font-display text-3xl md:text-4xl leading-tight">
              <span className="text-gold-gradient">{beat.title}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              produced by <span className="text-foreground/90">{beat.producer}</span> · {beat.mood}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
              <Stat label="BPM" value={beat.bpm.toString()} />
              <Stat label="Key" value={beat.key} />
              <Stat label="Length" value={beat.duration} />
              <Stat label="Tag" value={beat.tag} mono />
            </div>
          </div>

          {/* Right actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={onFav} className={cn(
              "p-2.5 rounded-xl border transition-all",
              fav ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-muted-foreground hover:text-gold hover:border-gold/30"
            )} title="Favorite">
              <Heart className={cn("h-4 w-4", fav && "fill-gold")} />
            </button>
            <button className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-gold hover:border-gold/30" title="Loop">
              <Repeat className="h-4 w-4" />
            </button>
            <button className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-gold hover:border-gold/30" title="Volume">
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Waveform */}
        <div className="mt-6 px-1">
          <div className="flex items-end gap-[3px] h-16">
            {Array.from({ length: 96 }).map((_, i) => {
              const base = 25 + Math.abs(Math.sin(i * 0.32) * 55) + Math.abs(Math.cos(i * 0.11) * 18);
              const progressIdx = 32; // ~ 1:18 of 3:42
              const played = i <= progressIdx;
              return (
                <span
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-colors",
                    played ? "bg-gradient-to-t from-gold-deep to-gold" : "bg-gold/15"
                  )}
                  style={{
                    height: `${Math.min(100, base)}%`,
                    animation: playing && played ? `vu-pulse ${0.7 + (i % 7) * 0.12}s ease-in-out infinite` : "none",
                    transformOrigin: "bottom",
                    animationDelay: `${(i % 9) * 0.05}s`,
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground tabular-nums">
            <span>{beat.position}</span>
            <div className="flex items-center gap-3">
              <button className="hover:text-gold"><SkipBack className="h-4 w-4" /></button>
              <button className="hover:text-gold"><SkipForward className="h-4 w-4" /></button>
            </div>
            <span>{beat.duration}</span>
          </div>
        </div>

        {/* Quick add to project */}
        <div className="hairline my-5" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Quick Add To Project
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {projectList.map((p) => (
              <button
                key={p.id}
                onClick={() => onAddToProject(p)}
                className={cn(
                  "group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all",
                  activeProjectId === p.id
                    ? "border-gold/60 bg-gold/10"
                    : "border-border hover:border-gold/40 hover:bg-onyx-elev"
                )}
                title={`Add to ${p.title}`}
              >
                <span className="h-6 w-6 rounded-full overflow-hidden relative shrink-0">
                  <span className="absolute inset-0" style={{ background: p.art }} />
                </span>
                <span className="text-xs text-foreground/90 max-w-[110px] truncate">{p.title}</span>
                <Plus className="h-3 w-3 text-gold" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-foreground/95 mt-0.5", mono && "font-mono text-xs text-gold")}>{value}</span>
    </div>
  );
}

function BoothReadyMilestone({ project, onClose }: { project: typeof projects[number]; onClose: () => void }) {
  const stats = [
    { label: "Bars",     v: "32 / 32" },
    { label: "Hook",     v: "Sealed" },
    { label: "Cadence",  v: "Locked" },
    { label: "Sessions", v: "7" },
    { label: "Hours",    v: "9h 42m" },
    { label: "Coach Score", v: "94 / 100" },
  ];

  const exports = [
    { icon: Mail,     label: "Send to Engineer",   primary: true },
    { icon: FileText, label: "Export Lyric Sheet PDF" },
    { icon: Music,    label: "Export Reference MP3" },
    { icon: Copy,     label: "Copy Lyrics" },
    { icon: Share2,   label: "Share Snapshot" },
    { icon: Download, label: "Download Stems Folder" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="absolute inset-0 bg-onyx/90 backdrop-blur-xl" onClick={onClose} />

      <div className="relative max-w-3xl w-full my-8 rounded-3xl overflow-hidden border border-gold/40 animate-scale-in"
        style={{ background: "linear-gradient(180deg, #14100a 0%, #0a0806 100%)" }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-20 text-muted-foreground hover:text-gold p-2 rounded-full hover:bg-onyx-elev">
          <X className="h-5 w-5" />
        </button>

        {/* CINEMATIC HEADER */}
        <div className="relative px-10 pt-14 pb-10 text-center overflow-hidden">
          {/* Aura */}
          <div className="absolute inset-0 opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle at center top, var(--gold), transparent 55%)" }} />
          {/* Light rays */}
          <div className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              background:
                "conic-gradient(from 90deg at 50% 30%, transparent, rgba(201,168,76,0.7), transparent, rgba(201,168,76,0.5), transparent, rgba(201,168,76,0.6), transparent)",
              animation: "spin-slow 18s linear infinite",
            }}
          />
          {/* Grain */}
          <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />

          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.5em] text-gold mb-5">
              A Moment to Mark
            </div>

            {/* Artwork + seal */}
            <div className="relative mx-auto mb-6 w-fit">
              <div className="h-36 w-36 rounded-2xl overflow-hidden border border-gold/40 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] relative">
                <ProjectArtwork project={project} />
              </div>
              <div className="gold-seal h-16 w-16 rounded-full absolute -bottom-4 -right-4 flex items-center justify-center shadow-[0_0_40px_-6px_var(--gold)] border-2 border-onyx">
                <Award className="h-8 w-8 text-onyx" strokeWidth={2.4} />
              </div>
            </div>

            <h3 className="font-display text-5xl md:text-6xl text-gold-gradient leading-[1.05]">
              Booth Ready™
            </h3>
            <div className="hairline my-5 max-w-[220px] mx-auto" />
            <div className="font-display text-2xl md:text-3xl text-foreground/95">
              Midnight on the Strip
            </div>
            <div className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground mt-2">
              from {project.title} · {project.type}
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mt-3">
              Certificate № RW-{Math.floor(Math.random() * 9000) + 1000} · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="relative px-8 md:px-10 pb-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-onyx-elev/80 border border-gold/15 p-4">
                <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">{s.label}</div>
                <div className="text-base text-gold flex items-center gap-1.5 mt-1 font-display">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EXPORTS */}
        <div className="relative px-8 md:px-10 py-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">
            Export & Send
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {exports.map((e) => {
              const Icon = e.icon;
              return (
                <button
                  key={e.label}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm transition-all border text-left",
                    e.primary
                      ? "gold-seal text-onyx font-semibold border-transparent hover:scale-[1.02]"
                      : "bg-onyx-elev/60 border-border text-foreground/90 hover:border-gold/40 hover:bg-gold/5"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{e.label}</span>
                  {e.primary && <ArrowUpRight className="h-4 w-4 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative text-center text-[10px] uppercase tracking-[0.35em] text-muted-foreground pb-7">
          Certified in RapWriter.ai · The Prep Studio™
        </div>
      </div>
    </div>
  );
}


// ============================================================
// License Badge — state machine surface
// ============================================================
function LicenseBadge({
  state, label, onRequest,
}: {
  state: "licensed" | "unlicensed" | "prompting" | "purchasing";
  label: string;
  onRequest: () => void;
}) {
  if (state === "licensed") {
    return (
      <span className="gold-seal text-onyx text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" /> {label}
      </span>
    );
  }
  if (state === "purchasing") {
    return (
      <span className="border border-gold/40 bg-gold/10 text-gold text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
        Clearing License…
      </span>
    );
  }
  if (state === "prompting") {
    return (
      <span className="border border-gold/40 bg-gold/10 text-gold text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
        <Shield className="h-2.5 w-2.5" /> Awaiting License
      </span>
    );
  }
  // unlicensed
  return (
    <button
      onClick={onRequest}
      className="border border-destructive/50 bg-destructive/15 text-destructive-foreground text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 hover:bg-destructive/25 transition-colors"
      title="License Required"
    >
      <Shield className="h-2.5 w-2.5" /> License Required · Tap to Clear
    </button>
  );
}

// ============================================================
// License Dialog — choose a tier
// ============================================================
function LicenseDialog({
  open, beat, state, onConfirm, onClose,
}: {
  open: boolean;
  beat: typeof currentBeat;
  state: "licensed" | "unlicensed" | "prompting" | "purchasing";
  onConfirm: (tier: { license: License; price: number }) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 animate-fade-in">
      <div className="absolute inset-0 bg-onyx/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-panel rounded-2xl w-full max-w-lg p-6 animate-scale-in border border-gold/30">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full border border-border text-muted-foreground hover:text-gold flex items-center justify-center"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold/90 mb-3">
          <Shield className="h-3 w-3" /> Clear This Beat
        </div>

        <h2 className="font-display text-2xl">
          <span className="text-gold-gradient">{beat.title}</span>
        </h2>
        <div className="text-sm text-muted-foreground mt-1">
          by {beat.producer} · {beat.bpm} BPM · {beat.key}
        </div>

        <div className="mt-5 text-xs text-foreground/80 leading-relaxed">
          Writing is free in The Prep Studio™. To export, send to engineer, or mark
          <span className="text-gold"> Booth Ready™</span>, this beat must be licensed.
        </div>

        <div className="mt-5 space-y-2">
          {beat.prices.map((tier) => (
            <button
              key={tier.license}
              disabled={state === "purchasing"}
              onClick={() => onConfirm(tier)}
              className="w-full group flex items-center justify-between p-4 rounded-xl border border-border hover:border-gold/50 hover:bg-gold/5 transition-all text-left disabled:opacity-60"
            >
              <div>
                <div className="font-display text-base flex items-center gap-2">
                  {tier.license}
                  {tier.license === "Exclusive" && (
                    <span className="text-[9px] uppercase tracking-[0.25em] gold-seal text-onyx px-1.5 py-0.5 rounded-full font-semibold">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {tier.license === "Lease" && "Streaming + distribution rights"}
                  {tier.license === "Premium Lease" && "Stems + commercial rights"}
                  {tier.license === "Exclusive" && "Full ownership · pulled from market"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl text-gold-gradient">${tier.price}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
              </div>
            </button>
          ))}
        </div>

        {state === "purchasing" && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gold">
            <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
            Clearing license · syncing Beat Locker™…
          </div>
        )}

        <div className="hairline my-5" />
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground text-center">
          Instant sync · Beat Locker · My Licenses · Recent Beats
        </div>
      </div>
    </div>
  );
}
