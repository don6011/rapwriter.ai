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

---

## Phase 4 notes

All ten sheets moved to `src/components/studio/sheets/` unchanged, each keeping its exact
`open` / `onOpenChange` (or `open` / `onClose`) contract. No sheet manager was introduced —
that is a design change and belongs in its own commit after this spec is finished. The
largest, `BeatSwitcherSheet`, is 301 lines, so it did not need the sub-folder the spec
allowed for.

### Two sheets CAN be open at once — 5e must keep the booleans

Checked ahead of Phase 5e, and the answer is no: a single `activeSheet: SheetId | null`
would change behavior. Concrete reachable cases:

1. **Studio Pack sheet + auth drawer.** `StudioPackSheet`'s unlock button calls
   `onUnlock` → `unlockStudioPack` → `unlockProduct`, which for a signed-out user calls
   `requestAuth(...)` → `setAuthOpen(true)` without ever calling
   `setStudioPackSheetOpen(false)`. A signed-out user tapping "unlock" gets the auth drawer
   layered over the still-open pack sheet.
2. **Any sheet + Studio Access hub.** The membership effect keyed on
   `[membership?.artist, membership?.producer, user]` calls `setStudioAccessOpen(true)` as
   soon as membership resolves and the announcement key differs. `useRapWriterData` loads
   asynchronously, so if the user opens any sheet before that lands, the hub opens on top.

The codebase already knows this is a hazard and papers over it case by case: the
`MEMBERSHIP_ACCESS_EVENT` handler calls `setBeatSwitcherOpen(false)` before
`setStudioAccessOpen(true)`, and `BeatSwitcherSheet.onAuthRequired` closes itself before
calling `requestAuth`. Those are two hand-written exclusions, not an invariant — the sheets
are all mounted as siblings, each gated on its own independent boolean.

**Conclusion for 5e: keep the booleans.** Collapsing them to one `activeSheet` would
silently close the pack sheet in case 1 and suppress the access hub in case 2. Making
sheets genuinely mutually exclusive is a real improvement, but it is a behavior change and
needs to be its own decision, not a side effect of a state refactor.

### Dead imports removed from the shell

Moving components out left ~40 imports in `MobileStudioShell.tsx` with no remaining
references (`ActivityInbox`, `Link`, `Home`, `UserCircle`, `downloadBoothFile`,
`versionSourceLabel`, and so on). ESLint does not flag unused imports in this repo — the
config has no `no-unused-vars` rule for TypeScript — so they were pruned by hand here
rather than left to rot. This is bookkeeping for Phases 3 and 4 combined; no runtime
behavior depends on it.

### One extraction hazard worth recording

`VersionHistorySheet` renders lucide's `<History />` icon. Because `History` is also a DOM
global, TypeScript resolved it silently to `lib.dom`'s `History` interface after the move
instead of reporting an unresolved name, so the missing import surfaced as
`'History' cannot be used as a JSX component` rather than `Cannot find name`. Any future
extraction should watch for icon names that collide with DOM globals; `History` is the only
one in this file's import list.

---

## Phase 5b — the discriminated union the spec asked for is not achievable

The spec says the thirteen rough-take values are mutually exclusive
(`idle → recording → captured → analyzing → saved`) and that a discriminated union on
`status` would make illegal combinations unrepresentable. The first half of that is not
true of this code, and acting on it would change behavior.

`startRecording` does **not** clear the previous take. It clears `analysis` and
`analyzing`, sets `beat`/`beatPosition` for the new attempt, and starts the recorder — but
`url`, `blob`, `duration` and `saved` all survive until `recorder.onstop` replaces them.
So while a retake is in progress the app is genuinely both `recording` **and** holding a
`captured`/`saved` take, and that overlap is load-bearing in two places:

- `boothReady` scores off `roughTakeExists: Boolean(roughTakeUrl)` and `roughTakeSaved`, so
  the previous take keeps counting toward the score for the whole duration of the retake.
- `RoughTakeStrip` renders `recording ? … : roughTakeUrl ? …`, which only reads as a
  precedence choice because both can be true at once.

A union where the `recording` arm carries no take payload would drop the score mid-retake
and change what the strip shows. A union where every arm carries the same payload is not a
discriminated union — it is the current object with a redundant tag.

What was built instead: `useReducer` over a single state object with twenty named actions.
That removes the setter soup the spec was actually aiming at — transitions that were 8
separate `setState` calls are now one atomic dispatch — and makes illegal combinations
unreachable *through the action API*, without changing a single observable value. Rule 6
says not to invent an abstraction to get green, so the union was not forced.

Two reset paths that look like duplicates are deliberately kept as separate actions,
because they are not the same:

- `take/reset-for-song-switch` (from `loadMobileSong`) clears blob, url, duration, saved,
  analysis and analyzing.
- `take/reset-for-new-song` (from `createMobileSong`) clears only blob, url, duration and
  saved — it leaves `analysis` and `analyzing` alone.

Whether that asymmetry is intentional or a missed line in `createMobileSong` is a real
question, but answering it would change behavior, so both are preserved exactly.

Two more asymmetries preserved as-is: the server-hydration effect clears `analysis`,
`beat` and `beatPosition` when there is no server take but leaves `url`, `duration` and
`saved` standing; and `deleteRoughTake` leaves `recording`, `recordStartedAt` and `saving`
untouched.

---

## Phase 6 notes, and where this stops

### What landed

The four nav destinations, the rough-take strip and the three onboarding surfaces are out.
The screens are renamed to match their file names (`MobileHome` → `StudioScreen`, and so on);
`MobileStudioShell` keeps its name as the spec requires.

Two more orchestration groups followed the Phase 5 pattern out of the shell:
`useStudioCommerce` (checkout paths + the return banner) and `useProducerPass`.

### The shell is 1,879 lines, not under 300

Root state hit its target — **12 `useState` calls, down from 67**, under the ≤15 ceiling.
Line count did not, and the remaining distance is not more of the same work.

What is still in the shell is one thing wearing four hats: session orchestration.

| Block | Lines | Reads from | Writes to |
|---|---|---|---|
| `buildDraftRecord` + 6 sync effects | ~400 | writing pad, beat playback, environment, workspace, metrics | draft ref, save status, sync message, retry nonce |
| `loadMobileSong` / `createMobileSong` | ~185 | all of the above | all of the above |
| `saveRoughTake` + `runPadAction` + `padActions` | ~200 | rough take, writing pad, beat, environment, metrics | rough take, pad status |
| booth export prep | ~110 | writing pad, beat, metrics, profile, locker | booth export |
| JSX | ~520 | everything | — |

`loadMobileSong` alone touches `take`, `stopBeatPreview`, `stopStudioAir`, `setSectionContent`,
`setActiveSection`, `selectBeatKeepingPreview`, `setActiveStudioPackId`, `setStudioDna`,
`seekTo`, `positionSeconds`, `canUseStudioPack`, `saveNow`, `loadLatestRoughTake`,
`setHydratedSessionId`, `setSaveStatus`, `setSyncMessage`, `setSongSwitchStatus`, plus
`completionPct`, `boothReady`, `totalBars`, `section`, `selectedBeat`, `activeStudioPack`,
`sectionContent`, `activeProjectId`, `activeSongId` and `session`. Lifting it into a hook
means threading ~26 values through a parameter object. The coupling does not go away; it
becomes ceremony, and the call site gets harder to read, not easier. Rule 6 says not to
invent an abstraction to get green, so these were left in place.

**The decision this needs, which is yours to make:** the only way these orchestrators stop
needing 26 parameters is if they can read session state without being handed it — a
`StudioSessionContext` (or a store) that the hooks publish into and the orchestrators and
screens subscribe to. That is precisely the "reach for context" move the spec deferred out
of Phase 3, and Phase 5's brief never picked it back up. It is a real design change with a
real behavior surface (re-render boundaries change when props become context reads), so it
belongs in its own commit with its own review, not smuggled in under a line-count target.

Everything up to that boundary is done. Pick the shape and the rest is mechanical.

### Two screens over the ~400 budget

`StudioScreen.tsx` is 457 and `WriterScreen.tsx` is 404. In both, roughly 60 lines are the
props type and 240–300 are JSX. Splitting the JSX further means new sub-components that each
need most of the same props — the same ceremony problem in miniature, for a soft number.
Once the context decision above lands, both drop naturally. Left alone.

### Wanted to fix, left alone

- **`marketplaceFeedError` conflates empty and failed** (`use-marketplace-feed.ts`). Every
  producer-feed failure reports "Producer drops will appear when the live feed reconnects.",
  including a 500. Flagged in the spec as tracked separately; preserved verbatim with a
  comment at the site.
- **`createMobileSong` and `loadMobileSong` reset the take differently.** The former leaves
  `analysis` and `analyzing` set, the latter clears them. Looks like a missed line rather
  than intent, but changing it changes behavior. Kept as two distinct reducer actions so the
  difference is visible instead of buried in setter order.
- **`beatTimerRef` is dead.** It is cleared and nulled in `stopBeatPreview` and never
  assigned a timer. Moved as-is into `use-beat-playback.ts`.
- **Two sheets can be open at once.** Detailed under Phase 4. The two hand-written
  exclusions in the codebase should become one invariant.
- **`previewStudioPack` is gated on `process.env.NODE_ENV`** and silently no-ops in
  production. Left exactly as found.

### Verification

`bun run typecheck`, `bun run lint` and `bun run test:unit` (102 tests) pass on every commit.
`bun run test:e2e` cannot run in this sandbox as written — see the Phase 3 note for why and
what was run instead.
