# MobileStudioShell decomposition — notes

Running log for the `claude/mobilestudioshell-decomposition-zlofhr` branch. Behavior,
copy, styling and visual output are unchanged throughout; everything below is either a
deviation from the spec's plan, a hazard found on the way, or something deliberately
left alone.

---

## Deviations from the spec

### Phase 2 runs before Phase 1

The spec orders utilities (Phase 1) ahead of types/constants (Phase 2). That ordering is
not achievable without a circular import:

- `readMobileDraftRecord` and `normalizeStudioDna` (Phase 1, `draft-storage.ts`) call
  `getStudioPack` and read `defaultStudioDna`.
- `getStudioPack` and the `studioPacks` table are Phase 2 material.

Extracting utilities first would mean `src/lib/studio/draft-storage.ts` importing back
from `src/components/MobileStudioShell.tsx`, which imports the utilities — a cycle, and
exactly the failure mode the "no barrel files" rule exists to prevent.

The two phases are independent in the other direction (nothing in `types.ts` / `packs.ts`
needs a utility), so they were swapped. Both commits typecheck and lint on their own, and
the end state is identical to the spec's.

### Two extra constant files in Phase 2

The spec names `types.ts` and `packs.ts`. Two more were needed to keep `packs.ts` about
packs and avoid a cycle back into the shell:

- `src/lib/studio/sections.ts` — `mobileSections`, `blankStarterLyrics`. `blankSections`
  and `countTotalBars` (Phase 1, `bars.ts`) are built from `mobileSections`.
- `src/lib/studio/dna.ts` — `defaultStudioDna` and the DNA option lists (`artistGoals`,
  `writingStyles`, `sessionMoods`, `producerModes`). `normalizeStudioDna` falls back to
  `defaultStudioDna` field by field.

Both are Phase 2's stated subject ("types and constants"), just in domain-shaped files
rather than one bucket.

---

## Components needing more than 8 props after extraction

_(filled in during Phase 3 / 4)_

## Circular imports broken

_(filled in as encountered)_

## Sheets that can be open simultaneously

_(checked in Phase 5e)_

## Wanted to fix, left alone

_(running list)_

---

## Phase 1 notes

### Extra files beyond the spec's list

- `src/lib/studio/ambient-audio.ts` — `createAmbientBuffer`. The spec mentions it twice:
  Phase 1 says to keep it in `src/lib/studio/`, Phase 3 says to move it alongside
  `StudioAirPanel.tsx`. Phase 1 wins, because the only caller is `toggleStudioAir` in the
  root component, not `StudioAirPanel`. Putting it in `waveform.ts` would have been
  semantically wrong, so it got its own module.

### Functions moved that the spec's list did not name

The spec describes "~50 pure utility functions" but enumerates fewer. These were moved to
the obvious neighbour rather than left stranded in the shell:

- `toBeatSnapshot` → `beat-snapshot.ts` (marketplace `Beat` → `SelectedBeat`)
- `buildTakeWaveBars` → `waveform.ts` (sibling of `buildSyntheticWaveBars`)
- `ProducerActionStatus` → `types.ts` in Phase 2 (`ProducerActionControls` needs it)

### `"use client"` on library modules

Rule 5 says every extracted file touching browser APIs starts with `"use client"`. Applied
to the five lib modules that reach for browser globals: `draft-storage.ts` (localStorage),
`waveform.ts` (`Audio`, `URL`), `export-snapshot.ts` (`document`), `telemetry.ts` (`fetch`
with `keepalive`), `ambient-audio.ts` (`AudioContext`). The rest are environment-agnostic
and were left without the directive.

### `intelligence.ts` is 394 lines

Just under the ~400 budget, and ~220 of those are the `environmentNotes` copy table inside
`buildEnvironmentIntelligence`. It is data, not logic, and could be split into its own
module later. Left alone here — splitting it is not required to meet the budget and every
extra file is another chance to get a move wrong.

---

## Phase 3 notes

### None of the leaf components closed over parent state

The spec warned that "several of these currently close over variables from the parent
scope rather than taking them as props." That turned out not to be the case: every
sub-component in `MobileStudioShell.tsx` is a top-level `function` declaration, so the only
scope it can close over is the module scope — imports and module-level constants, never the
root component's state. Everything module-level those components referenced had already
moved to `src/lib/studio/` in Phases 1 and 2, so the extraction needed no new props at all
and the diff is a pure move. Nothing was reached for context.

Verified mechanically: the shell lost 1572 lines and gained 29, all of them `import`
statements. Every removed non-blank line appears verbatim in an extracted file, or with an
`export ` prefix on the declaration line.

### Components needing more than 8 props

- `PadTransport` — 12 props (`beat`, `playing`, `recording`, `compact`, `currentTime`,
  `duration`, `error`, `onToggleBeat`, `onSeek`, `onSeekCommit`, `onChangeBeat`,
  `onToggleRecording`). Seven of those are beat-playback state and its handlers, which is
  precisely the `use-beat-playback` group in Phase 5c. Once that hook exists this is the
  first real candidate for a playback context — but it stays a prop drill for now, since
  introducing context here would change what Phase 5 has to reason about.

No other extracted component exceeds 8 props.

### Circular imports

None. Dependency flow is one-directional: `panels/` and `locker/cards/` import from
`primitives/` and `waveform/`, all of them import from `src/lib/studio/`, and nothing
imports back into `MobileStudioShell.tsx`.

### e2e in this sandbox

`bun run test:e2e` cannot pass here regardless of the refactor: the suite boots a real dev
server, which throws `Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase publishable key`, and
`playwright.config.ts` asks for branded Chrome (`channel: "chrome"`) which is not installed
— only bundled Chromium is. Results below come from a throwaway local config that points at
the bundled Chromium plus placeholder Supabase values, compared against a git worktree at
the pre-refactor commit so pre-existing failures are distinguishable from new ones. Neither
the throwaway config nor the placeholder env file is committed.
