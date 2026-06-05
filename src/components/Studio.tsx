import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Disc3, Music2, Mic2, FolderOpen, Sparkles, Award, Play, Pause,
  Heart, Volume2, Repeat, Wand2, Flame, Feather, MessageSquareQuote,
  ChevronRight, Plus, Headphones, Clock, Moon, Lightbulb, EyeOff
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
  { icon: Wand2, label: "Rewrite Cleanly" },
];

const modes = [
  { id: "midnight", label: "Midnight Session", icon: Moon, desc: "Black & gold" },
  { id: "producer", label: "Producer Room", icon: Lightbulb, desc: "Warm amber" },
  { id: "ghost", label: "Ghost Studio", icon: EyeOff, desc: "Silent focus" },
];

const states = ["Idea", "Draft", "Session Ready", "Booth Ready"];

export default function Studio() {
  const [playing, setPlaying] = useState(false);
  const [activeMode, setActiveMode] = useState("midnight");
  const [activeSection, setActiveSection] = useState(0);
  const [songState, setSongState] = useState(1);
  const [fav, setFav] = useState(true);

  return (
    <div className="min-h-screen w-full text-foreground">
      {/* Top brand bar */}
      <header className="sticky top-0 z-30 glass-panel">
        <div className="flex items-center justify-between px-6 py-4">
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
              The Prep Studio™ · Midnight Session
            </span>
          </div>

          <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-12 gap-4 p-4 lg:p-6">
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

            <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gold/30 text-gold hover:bg-gold/10 transition-colors text-sm">
              <Plus className="h-4 w-4" /> New Session
            </button>
          </div>
        </aside>

        {/* CENTER — Writing pad */}
        <main className="col-span-12 lg:col-span-9 xl:col-span-7 space-y-4">
          {/* Project / Track / Beat header */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Current Project · EP
                </div>
                <h1 className="font-display text-3xl md:text-4xl mt-1">
                  <span className="text-gold-gradient">Gold Chains, Cold Nights</span>
                </h1>
                <div className="text-sm text-muted-foreground mt-1">
                  Track 03 — <span className="text-foreground/90">Midnight on the Strip</span>
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
                  {/* mini waveform */}
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

            <div className="px-8 py-10 md:px-12 md:py-14 min-h-[440px] bg-gradient-to-b from-transparent to-onyx/40">
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
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Last session 12 min ago
                </div>
              </div>
              <div className="flex items-center gap-2">
                {states.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setSongState(i)}
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

          {/* Booth Ready preview certificate */}
          {songState === 3 && <BoothReadyCertificate />}
        </main>

        {/* RIGHT SIDEBAR — Pen Coach */}
        <aside className="col-span-12 xl:col-span-3">
          <div className="glass-panel rounded-2xl p-5 sticky top-24">
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
        </aside>
      </div>
    </div>
  );
}

function BoothReadyCertificate() {
  return (
    <div className="glass-panel rounded-2xl p-8 text-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle at center, var(--gold), transparent 60%)" }} />
      <div className="gold-seal h-20 w-20 rounded-full mx-auto flex items-center justify-center mb-4">
        <Award className="h-10 w-10 text-onyx" strokeWidth={2.2} />
      </div>
      <div className="text-[10px] uppercase tracking-[0.4em] text-gold mb-2">Certified</div>
      <h3 className="font-display text-4xl text-gold-gradient">Booth Ready™</h3>
      <div className="text-sm text-muted-foreground mt-3">Midnight on the Strip</div>
      <div className="text-xs text-muted-foreground mt-1">Prepared in RapWriter.ai · June 5, 2026</div>
    </div>
  );
}
