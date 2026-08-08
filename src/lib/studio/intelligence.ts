import { countBars, countTotalBars } from "@/lib/studio/bars";
import type { BeatIntelligence, BoothReadyResult, EnvironmentIntelligence, SelectedBeat, StudioDna, StudioPack, StudioPackId } from "@/lib/studio/types";

export function buildBeatIntelligence({
  beat,
  sectionName,
  sectionText,
  sections,
  completionPct,
  boothReady,
  roughTakeSaved,
}: {
  beat: SelectedBeat;
  sectionName: string;
  sectionText: string;
  sections: Record<string, string>;
  completionPct: number;
  boothReady: BoothReadyResult;
  roughTakeSaved: boolean;
}): BeatIntelligence {
  const bpm = typeof beat.bpm === "number" ? beat.bpm : null;
  const key = typeof beat.key === "string" ? beat.key : null;
  const mood = typeof beat.mood === "string" ? beat.mood : null;
  const region = typeof beat.region === "string" ? beat.region : null;
  const genre = typeof beat.genre === "string" ? beat.genre : typeof beat.tag === "string" ? beat.tag : null;
  const sectionBars = countBars(sectionText);
  const hookBars = countBars(sections.Hook);
  const verse1Bars = countBars(sections["Verse 1"]);
  const totalBars = countTotalBars(sections);
  const tempoWord = bpm ? (bpm < 78 ? "slow pocket" : bpm > 96 ? "high-energy bounce" : "mid-tempo pocket") : "open pocket";
  const moodWord = mood ?? "late-night";
  const regionWord = region ? `${region} edge` : "cinematic edge";

  const beatTags = [
    bpm ? `${bpm} BPM` : null,
    key,
    mood,
    region,
    genre,
  ].filter((tag): tag is string => Boolean(tag)).slice(0, 4);

  const beatBrief = `${beat.title} wants a ${tempoWord}: keep the delivery controlled, leave space after strong lines, and lean into the ${moodWord.toLowerCase()} tone${region ? ` with a ${regionWord}` : ""}.`;
  const sectionCue = getSectionCue(sectionName, sectionBars, beat, tempoWord);
  const titleSeed = getSmartTitleSeed(beat);

  if (hookBars < 4) {
    return {
      beatBrief,
      beatTags: beatTags.length ? beatTags : ["Writing pocket"],
      nextMoveTitle: "Lock the hook idea",
      nextMoveBody: `Write ${4 - hookBars} more strong hook bars around one central image before expanding the verses.`,
      sectionCue,
      titleSeed,
    };
  }

  if (verse1Bars < 12) {
    return {
      beatBrief,
      beatTags: beatTags.length ? beatTags : ["Writing pocket"],
      nextMoveTitle: "Build Verse 1 momentum",
      nextMoveBody: `Add ${12 - verse1Bars} more bars to Verse 1. Keep the rhyme pocket steady and make every fourth line land harder.`,
      sectionCue,
      titleSeed,
    };
  }

  if (completionPct >= 45 && !roughTakeSaved) {
    return {
      beatBrief,
      beatTags: beatTags.length ? beatTags : ["Writing pocket"],
      nextMoveTitle: "Record a rough take",
      nextMoveBody: `The draft has ${totalBars} bars. Record ${sectionName} over ${beat.title} to hear what is actually Booth Ready.`,
      sectionCue,
      titleSeed,
    };
  }

  if (!boothReady.locked && boothReady.score >= 70) {
    return {
      beatBrief,
      beatTags: beatTags.length ? beatTags : ["Writing pocket"],
      nextMoveTitle: "Run Booth Ready pass",
      nextMoveBody: "You are close. Tighten the weakest section, then save a full rough take before moving to rehearsal.",
      sectionCue,
      titleSeed,
    };
  }

  return {
    beatBrief,
    beatTags: beatTags.length ? beatTags : ["Writing pocket"],
    nextMoveTitle: "Keep the session moving",
    nextMoveBody: "Stay in the pocket: finish the active section, then listen back before adding more ideas.",
    sectionCue,
    titleSeed,
  };
}

export function buildEnvironmentIntelligence(pack: StudioPack, dna: StudioDna, sectionName: string): EnvironmentIntelligence {
  const environmentNotes: Record<StudioPackId, EnvironmentIntelligence> = {
    midnight: {
      passTitle: "Late-Night Producer Pass",
      missionCue: "Keep the writing cinematic: one scene, one emotion, and a hook line that feels like the room went quiet.",
      producerNotes: [
        "Use fewer words on the strongest lines so the pocket feels expensive.",
        "Add one visual detail that places the listener inside the room.",
        "Let the last line of the section point back to the title idea.",
      ],
      boothFocusTitle: "Tonight's Booth Focus",
      boothFocusBody: "Prioritize control, mood, and clean breath points before chasing extra bars.",
      focusMetrics: ["Control", "Mood", "Replay"],
    },
    "trap-house": {
      passTitle: "Trap Pressure Pass",
      missionCue: "Shorten the setup and make every fourth bar hit harder. This room rewards pressure, cadence, and direct language.",
      producerNotes: [
        "Start the section with action, not explanation.",
        "Keep punch lines close together so the bounce never drops.",
        "Use sharper verbs and leave a breath before the flex lands.",
      ],
      boothFocusTitle: "Street-Ready Focus",
      boothFocusBody: "The draft needs pocket discipline: cadence first, then aggression, then replay value.",
      focusMetrics: ["Cadence", "Punch", "Energy"],
    },
    bedroom: {
      passTitle: "Honesty Pass",
      missionCue: "Write like the door is closed and the headphones are loud. Specific details matter more than polish here.",
      producerNotes: [
        "Keep one imperfect line if it sounds emotionally true.",
        "Name a real object, place, or memory instead of summarizing the feeling.",
        "Let melody guide the hook before tightening the rhyme.",
      ],
      boothFocusTitle: "First-Take Focus",
      boothFocusBody: "Protect the feeling. Get the section complete, then record a rough take before over-editing.",
      focusMetrics: ["Emotion", "Detail", "Take"],
    },
    penthouse: {
      passTitle: "Commercial Producer Pass",
      missionCue: "Make the hook feel inevitable. Every section should support the title, replay value, and clean transitions.",
      producerNotes: [
        "Trim any line that does not make the record feel bigger.",
        "Repeat the strongest phrase with intention instead of adding more ideas.",
        "Check whether the first listen already tells people what to remember.",
      ],
      boothFocusTitle: "Record-Ready Focus",
      boothFocusBody: "Polish the song shape: hook payoff, section movement, and a saved rough take.",
      focusMetrics: ["Hook", "Replay", "Structure"],
    },
    cypher: {
      passTitle: "Pure Pen Pass",
      missionCue: "No filler. Set up, turn the phrase, then land clean. The room is judging breath control and bars.",
      producerNotes: [
        "Add internal rhyme before adding more lines.",
        "Cut any bar that only explains the previous bar.",
        "Make the strongest punchline easy to hear on the first take.",
      ],
      boothFocusTitle: "Mic Check Focus",
      boothFocusBody: "Make the writing performable: breath points, punchline spacing, and originality.",
      focusMetrics: ["Bars", "Breath", "Originality"],
    },
    afterglow: {
      passTitle: "After-Hours Pass",
      missionCue: "Keep the ambition visible without over-writing it. The room rewards finish lines, polish, and controlled energy.",
      producerNotes: [
        "Trim the setup until the strongest image arrives sooner.",
        "Let one ambitious line carry the section instead of stacking flexes.",
        "Finish the thought cleanly before opening a new idea.",
      ],
      boothFocusTitle: "After-Hours Focus",
      boothFocusBody: "Finish with control: remove filler, protect the mood, and save a polished rough take.",
      focusMetrics: ["Focus", "Polish", "Finish"],
    },
    "bedroom-diaries": {
      passTitle: "Private Page Pass",
      missionCue: "Specific memories matter more than perfect lines. Let the section sound private, melodic, and emotionally exact.",
      producerNotes: [
        "Replace one general feeling with a real object or memory.",
        "Keep the melody natural before tightening every rhyme.",
        "Protect the line that feels hardest to say out loud.",
      ],
      boothFocusTitle: "Diary-Take Focus",
      boothFocusBody: "Prioritize emotional truth, concrete details, and a first take that still feels close to the original idea.",
      focusMetrics: ["Truth", "Detail", "Melody"],
    },
    "red-light": {
      passTitle: "Performance Pass",
      missionCue: "Write for delivery. Every line needs a breath plan, a clear landing, and enough conviction to survive the booth.",
      producerNotes: [
        "Mark the breath before the longest line.",
        "Strengthen the last word so the bar lands in the room.",
        "Read the section aloud and cut anything the mouth fights.",
      ],
      boothFocusTitle: "Take-Ready Focus",
      boothFocusBody: "Commit to the delivery: clean breath points, controlled volume, and endings that sound intentional.",
      focusMetrics: ["Delivery", "Breath", "Conviction"],
    },
    "main-room": {
      passTitle: "Club Record Pass",
      missionCue: "Make the hook register through movement. This room rewards immediate titles, physical rhythm, and repeatable crowd moments.",
      producerNotes: [
        "Move the title phrase closer to the first strong downbeat.",
        "Leave a clean response pocket after the line people should repeat.",
        "Cut any setup that lowers the energy before the hook lands.",
      ],
      boothFocusTitle: "Main-Room Focus",
      boothFocusBody: "Prioritize hook recognition, energy control, and a delivery that stays clear over a loud system.",
      focusMetrics: ["Energy", "Replay", "Response"],
    },
    "skyline-loft": {
      passTitle: "Big Record Pass",
      missionCue: "Open the record up. This room favors a clear title, commercial lift, and sections that move without extra explanation.",
      producerNotes: [
        "Make the title phrase easier to recognize on the first listen.",
        "Give the chorus more open vowels and fewer competing ideas.",
        "Let the verse build upward instead of resetting every four bars.",
      ],
      boothFocusTitle: "Skyline Focus",
      boothFocusBody: "Prioritize lift, hook clarity, and a structure that makes the record feel larger without making it busier.",
      focusMetrics: ["Lift", "Hook", "Clarity"],
    },
    "soft-life": {
      passTitle: "Open-Air Melody Pass",
      missionCue: "Let the lines breathe. The room rewards warm melody, simple language, and confident space between ideas.",
      producerNotes: [
        "Open the vowels where the melody wants to stretch.",
        "Remove one line so the strongest phrase has more space.",
        "Keep the emotion light without making the writing vague.",
      ],
      boothFocusTitle: "Easy-Take Focus",
      boothFocusBody: "Aim for melody, space, and a relaxed delivery that still keeps every word easy to understand.",
      focusMetrics: ["Melody", "Space", "Ease"],
    },
    "desert-sessions": {
      passTitle: "Story Horizon Pass",
      missionCue: "Slow the scene down and let the detail do the work. This room rewards patience, place, and a clear emotional payoff.",
      producerNotes: [
        "Name the place before explaining what it meant.",
        "Carry one image through the section instead of changing scenes early.",
        "Make the final line reveal what the scene cost you.",
      ],
      boothFocusTitle: "Story-Take Focus",
      boothFocusBody: "Prioritize scene clarity, patient delivery, and a payoff the listener can see before they fully understand it.",
      focusMetrics: ["Scene", "Patience", "Payoff"],
    },
    "rooftop-sessions": {
      passTitle: "City Anthem Pass",
      missionCue: "Write for scale. The hook should be easy to shout back while the verse keeps the ambition specific.",
      producerNotes: [
        "Turn the strongest line into a repeatable chorus phrase.",
        "Keep the city image concrete instead of using generic success language.",
        "Raise the cadence energy before the section changes.",
      ],
      boothFocusTitle: "Anthem Focus",
      boothFocusBody: "Build energy without crowding the record: strong chorus scale, clean cadence, and immediate replay value.",
      focusMetrics: ["Energy", "Scale", "Replay"],
    },
    "radio-room": {
      passTitle: "First-Listen Pass",
      missionCue: "Make the record easy to understand without making it predictable. The title and hook should register immediately.",
      producerNotes: [
        "Put the title idea closer to the start of the hook.",
        "Replace one clever phrase with a cleaner emotional statement.",
        "Repeat the best line before introducing another concept.",
      ],
      boothFocusTitle: "Broadcast Focus",
      boothFocusBody: "Prioritize first-listen clarity, hook recognition, and a take that sounds confident at low volume.",
      focusMetrics: ["Clarity", "Hook", "Replay"],
    },
    "bando-sessions": {
      passTitle: "Survival Pass",
      missionCue: "Keep the truth hard and concise. This room rewards pressure, lived detail, and a voice that does not ask permission.",
      producerNotes: [
        "Use the real consequence instead of summarizing the struggle.",
        "Cut the line that softens the strongest moment.",
        "Let the delivery stay conversational until the punch lands.",
      ],
      boothFocusTitle: "Raw-Take Focus",
      boothFocusBody: "Prioritize truth, pressure, and a distinct voice. The section should feel lived in before it feels polished.",
      focusMetrics: ["Truth", "Pressure", "Voice"],
    },
  };

  const base = environmentNotes[pack.id];
  const producerCue =
    dna.producer === "Hook Doctor"
      ? "Hook Doctor note: make the hook simpler, stickier, and easier to repeat."
      : dna.producer === "Battle Coach"
        ? "Battle Coach note: raise the threat level and make every setup earn the punchline."
        : dna.producer === "Story Coach"
          ? "Story Coach note: connect the scene, pressure, and consequence before adding new ideas."
          : dna.producer === "Southern Producer"
            ? "Southern Producer note: keep the pocket loose, conversational, and heavy on bounce."
            : dna.producer === "Ghostwriter"
              ? "Ghostwriter note: protect the artist voice and make the strongest line sound effortless."
              : "Commercial Producer note: keep only what improves replay value.";

  const goalCue =
    dna.goal === "Battle" || dna.goal === "Freestyle"
      ? "Aim for fast recognition: clear setups, clean turns, and lines that survive without explanation."
      : dna.goal === "Album" || dna.goal === "Mixtape"
        ? "Think sequence: make this section deepen the world instead of only chasing a single moment."
        : "Aim for a record people can remember after one listen.";

  const styleCue =
    dna.style === "Storytelling" || dna.style === "Conscious"
      ? "Push one concrete detail into the next four bars."
      : dna.style === "Melodic" || dna.style === "Mainstream"
        ? "Leave vowel space for melody and repeat the cleanest phrase."
        : dna.style === "Southern" || dna.style === "Street"
          ? "Let the cadence talk first, then make the image hit."
          : "Keep the pen sharp and avoid over-explaining the bar.";

  return {
    ...base,
    missionCue: `${base.missionCue} ${styleCue}`,
    producerNotes: [producerCue, goalCue, ...base.producerNotes.slice(0, sectionName === "Hook" ? 2 : 3)],
    boothFocusBody: `${base.boothFocusBody} ${goalCue}`,
  };
}

export function getSectionCue(sectionName: string, bars: number, beat: SelectedBeat, tempoWord: string) {
  const mood = typeof beat.mood === "string" ? beat.mood.toLowerCase() : "the beat";
  if (sectionName === "Hook") {
    return bars < 4
      ? `Make the hook simple enough to repeat: one image, one emotion, one phrase that fits the ${tempoWord}.`
      : `Now sharpen the hook payoff. The last line should feel like the title belongs there.`;
  }
  if (sectionName.startsWith("Verse")) {
    return `Use the verse for detail: scene, pressure, flex, consequence. Keep line lengths close so the ${mood} pocket stays clean.`;
  }
  if (sectionName === "Bridge") {
    return "Change the angle here. Pull back the drums in your head and write the line that reveals what the song is really about.";
  }
  return "Close with a clean landing. Repeat the core image or leave one memorable final bar.";
}

export function getSmartTitleSeed(beat: SelectedBeat) {
  const mood = typeof beat.mood === "string" ? beat.mood : "";
  const region = typeof beat.region === "string" ? beat.region : "";
  const genre = typeof beat.genre === "string" ? beat.genre : "";
  const source = [region, mood, genre].filter(Boolean).join(" ").trim() || beat.title;
  const words = source
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  return words.length ? `${words.join(" ")} Draft` : "Untitled Draft";
}

export function studioDnaCue(dna: StudioDna, pack: StudioPack) {
  return `${pack.label} will bias the session toward ${dna.mood.toLowerCase()} energy, ${dna.style.toLowerCase()} writing, and ${dna.producer} feedback for a ${dna.goal.toLowerCase()}.`;
}

export function getWritingMomentum(sectionName: string, sectionBars: number, target: number, boothReady: BoothReadyResult) {
  const analysis = boothReady.lyricAnalysis;

  if (sectionBars >= target) {
    return { label: "Section locked", detail: `${sectionBars} bars drafted. Run it against the beat.` };
  }
  if (sectionName === "Hook" && analysis.hookReplay >= 55 && sectionBars >= 4) {
    return { label: "Replay value increased", detail: "The hook has a repeatable anchor." };
  }
  if (analysis.cadenceConsistency >= 65 && analysis.totalLines >= 4) {
    return { label: "Cadence is holding", detail: "Your line lengths are landing in one pocket." };
  }
  if (analysis.endRhymePct >= 40 && analysis.totalLines >= 4) {
    return { label: "Rhyme pocket connected", detail: "Your line endings are reinforcing each other." };
  }
  if (analysis.uniqueWordPct >= 72 && analysis.totalWords >= 20) {
    return { label: "Original voice showing", detail: "The vocabulary is staying distinct." };
  }
  if (sectionBars >= 4) {
    return { label: "Momentum building", detail: `${sectionBars} of ${target} bars are in place.` };
  }

  const checkpoint = Math.min(target, 4);
  return {
    label: sectionBars ? "Idea forming" : "Pocket ready",
    detail: sectionBars
      ? `${Math.max(1, checkpoint - sectionBars)} ${checkpoint - sectionBars === 1 ? "bar" : "bars"} to the first checkpoint.`
      : "Start with one image and let the beat set the pace.",
  };
}

export function findAnchorWord(text: string) {
  const ignored = new Set(["that", "this", "with", "from", "your", "have", "they", "been", "when", "what", "just", "into", "like", "yeah", "i'm", "you", "the", "and", "for"]);
  const counts = text.toLowerCase().match(/[a-z0-9']{3,}/g)?.reduce<Record<string, number>>((acc, word) => {
    if (!ignored.has(word)) acc[word] = (acc[word] ?? 0) + 1;
    return acc;
  }, {}) ?? {};
  const [word, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return count >= 2 ? word : null;
}
