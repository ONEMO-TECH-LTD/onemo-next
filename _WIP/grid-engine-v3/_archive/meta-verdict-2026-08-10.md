# META VERDICT — grid engine v3 · 2026-08-10
### @s62-meta · reviewed the tree, ran it, and looked at it at 402px

**Target:** `s62-grid-canvas` (branch `session62-task/KAI-10261-grid-canvas`, base `501a30e1`), all work untracked.
**Reviewed:** `src/lib/grid-engine/` (276 lines + 77 test), `src/app/(dev)/grid-engine/` (824 lines), `_WIP/grid-engine-v3/` (305 lines).
**Authority:** Dan's directive set 08-09 → 08-10, from the s62/lead day-file read end to end; v1 law book inherited per Dan 08-10.

---

## VERDICT — **NOT CLEAR**

- **Necessity:** shrink — three elements exist that nothing needs (F5, F6, F7).
- **Sufficiency:** **partial** — the engine sub is not built. The unit Dan specified as "1 unit 2 subs" has one sub.

Nothing found here is wrong *architecture*. The separation Dan asked for is real and is now enforced by a test. What is missing is the half that computes, and one guard that says it is sealed while a second writer walks around it.

---

## BLOCKING

### B1 — The engine sub does not exist
The unit is `spec.ts` (values) and `lattice.ts` (where lattice points are). Neither answers the question Dan has asked since 08-09:

> "i need small module computing the grid based on my law specifically for the cutoutlab shapes"
> "i need simple math engine that takes grid and scales the shape to wrap the grid"

No code takes a shape and returns a layout or a size. **Law §3.1 — the balance ruling, the one that closes v1's O3 — has zero implementation.** It is written down correctly and obeyed by nothing.

The 300-line solver written on the night of 08-09 is in a **different worktree** (`s62-grid-lab/_WIP-magnet-grid/magnet-grid.ts`), untracked, unreferenced from here. The deliverable is currently split across two scratch directories in two worktrees, and the bridge Dan named as a separate part does not exist either.

### B2 — Nothing is committed
1,482 lines across code, law and briefs, all untracked in a worktree. `git clean`, a bad `git worktree remove`, or a stray reset ends the day's work — including the law book and Dan's verbatim briefs, which exist nowhere else. Local commits on a working branch are the standing default and need no permission.

---

## DEFECTS

### F3 — The seal is not sealed *(highest of these)*
`pitchMM` is listed in `SEALED_IN_CODE` and `applyGridValue` refuses it. `selectPitch()` writes it anyway, bypassing the guard entirely. Measured:

```
applyGridValue(pitchMM, 72)   → sealed-in-code
selectPitch(96)               → ACCEPTED → pitchMM=96      [sealed? true]
```

`spec.ts:18` claims *"applyGridValue is the ONLY way to write a value."* It is not. Two consequences:

- **On screen at 402px:** the panel row reads `Spacing … SEALED … 🔒` with a dead padlock, while the `96mm` chip 12mm above it changes that exact value. Both are true at once. The guard's story contradicts itself on the surface Dan tests.
- **The test does not catch it.** `separation.test.ts` greps *UI files* for `grid: { ...x.grid,` — `selectPitch` does precisely that pattern but lives in the unit, so it is out of scope. The test enforces the letter and misses the invariant it exists to protect.

If selecting between released pitches is legitimately different from writing a value — and it is — then it is not "sealed", it is **released-options-only**, and the panel must say that instead.

### F4 — 402 is 368
Measured at a true 402px viewport (Playwright, iPhone 402×874, real touch): **canvas renders 368 × 368.** `.screen` keeps 16px gutters, `.canvas` is `width:100%`, and the CSS comment states the intent plainly: *"It grows with the column rather than being pinned to 402."*

Reported to Dan as *"402 × 402, locked square"* and later *"on the phone it's 402 × 402."* Dan asked for 402 twice, the second time as *"also did you see 402x402 viewport for the canvas message - focus ffs!"*

Whether the gutter or the 402 wins is Dan's call — the defect is that the number reported was not the number rendered.

### F5 — `toleranceMM` is dead and still dressed as law
Zero consumers in `src/` other than the panel row that displays it. It is sealed, on screen, presented as canon, and used by nothing. Dan asked *"who invented this?"*; it was traced to an unattributed literal in `geometry-truth.ts` and removal was offered twice without an answer. **Nothing depends on it — deleting it costs nothing and is not blocked on Dan's ruling about factory tolerance.**

### F6 — Dead interface in the canvas
`_Unused_ViewReport`, `GridCanvas.tsx:42–51`, carrying its own tombstone comment `// (report shape now lives with the lattice maths)`.

### F7 — The canvas asserts a magnet choice the engine has not made
`spec.ts:42` — *"which magnet goes where is the engine's call (law 5.7)."* `GridCanvas.tsx:165–171` draws the 8mm **and** the 6mm on every cell, unconditionally. Cosmetic today; the moment the engine chooses per cell, this is policy living in the renderer — the exact leak §5.3 forbids.

---

## VERIFIED GOOD — stated so it is not re-litigated

Run on the current tree, server provenance confirmed (`lsof` → PID 31689 → `s62-grid-canvas`):

- **Mutation law 4.2 holds** on the lattice layer. Padding drives cell and field floor, pitch drives stride, and they compose:
  ```
  48 / pad 10   cell 20mm   floor 404mm   stride 1   9x9 · 384mm
       pad 14   cell 28mm   floor 412mm   stride 1   9x9 · 384mm
       pad 20   cell 40mm   floor 424mm   stride 1   9x9 · 384mm
  96 / pad 10   cell 20mm   floor 404mm   stride 2   5x5 · 384mm
  96 / pad 14   cell 28mm   floor 412mm   stride 2   5x5 · 384mm
  ```
  No millimetre constant anywhere in the derivation.
- **48/96 is one lattice thinned, not two grids** — Dan's exact requirement. `9×9 · 384mm` → `5×5 · 384mm`, `viewBox` unchanged at `-242 -242 484 484`. The camera does not move.
- **The guard refuses rather than clamps**, with a reason, on all four paths: sealed-in-code · out-of-range · not-a-number · accept.
- **The phone surface works** — this is the gate the builder flagged as unverified. At a real 402px viewport with real touch events: `Grid law` opens on tap (native `<details>`, no hydration wait), the `96mm` chip responds on first tap, `bodyScrollW` = 402 (no horizontal overflow), **zero console errors, zero page errors.**
- **Cell geometry matches the Figma source exactly** — 20mm grey · 8mm blue · 6mm white, centres sitting on the 48mm rule intersections. Verified by zoom.
- **The 40mm margin reads.** The field visibly ends, which is what Dan asked for.
- Typecheck: **0 errors.** Separation suite: **7/7 pass.**

**The law book and briefs are the strongest artifact in the tree.** Dan's balance ruling is captured verbatim and split into four independently-live bindings; provenance is marked DAN vs DERIVED on every entry; v1 is inherited rather than replaced; the 130mm-vs-162mm star is recorded as a measured instance so the failure class is recognisable; and three genuinely-open items are left open instead of guessed. §3.1 correctly closes v1's O3 by Dan's own words.

---

## SMALLEST PATH TO CLEAR

1. Commit what exists. Nothing else matters until the day's work has a rollback point.
2. Delete F5, F6, F7 — three deletions, no ruling needed for any of them.
3. Resolve F3 by naming it honestly: `pitchMM` is *released-options-only*, not *sealed*. One writer, or two writers both documented and both tested.
4. Report F4 to Dan as a question — 402 hard, or gutter — rather than as a number that was not measured.
5. Then the engine sub, against §3.1, in the same worktree as the unit it belongs to.

Items 1–4 are engineering and carry no Dan gate. Item 5 is the deliverable.

---

# ADDENDUM · 14:15 — the camera is driving the grid

**Dan, 14:1x:** *"i feel like the ui logic of zooming is influencing the math and grid itself"* — correct, and it is the root cause of the 9↔10 field flip.

## Root cause

`GridCanvas.tsx:107`
```ts
const registration = registrationOffsetMM(spec.grid, positions)
```
`positions` is documented on line 74 as **the camera stop**. Line 128 feeds that registration into `magnetsInRegion`. So **the camera decides where the magnets sit in the world.** Zoom one step → parity flips → the whole lattice shifts 24mm under the shape → the count of positions inside the field changes with it.

That is why 48mm showed 9×9 at odd stops and 10×10 at even, and why `MIN_LATTICE_POSITIONS_PER_AXIS` was then raised 9 → 10 to absorb it.

## The 10th row was never needed

Measured at `MIN=9` (404mm field) with registration `= pitchMM/2`, **before** the constant changed:

```
96mm even   reg 48   4x4   [-144, -48, 48, 144]   CENTRED
```

The registration term was the entire fix for the 96mm defect. The floor change bought nothing and cost a stable field size.

## Fix — Dan's call, 9×9, cause not symptom

1. `MIN_LATTICE_POSITIONS_PER_AXIS` back to **9**. Its own docstring still reads *"nine lattice positions across / 9x9 is enough"* — code and doc already disagree.
2. **Registration follows the population the shape takes, never the camera stop.** Law §3.1 makes the target layout even — *"perfect shape x grid match is 4 points balanced and symmetrically centred on the shape"* — so registration is a property of the chosen layout, resolved once.
3. The camera then only chooses how much of the world to show. It moves nothing. Zoom becomes pure framing, the field count stops flipping, and 9×9 holds at every stop.

## Why this is a separation break too

Registration is **compute** (engine); the stop is **UI**. A UI concept is currently an **input to engine math**. The gate did not catch it because the UI is not doing the arithmetic — it is *feeding* it. New clause **S12** added: the camera stop must not reach lattice registration.

## Keep

`grid.pitchMM / 2` is correct and verified at both spacings. One accuracy defect in its comment: it claims the offset *"is still a whole base step"* — true at 96mm (48 = one base step), **false at 48mm** (24 = half a base step), where magnets then sit off the base lattice. Law 1.1 says every magnet sits on the one lattice, so that needs restating.

---

# QA · restructure review — /o-necessity + /o-deslop
### against Dan's restated separation · @s62-meta

## VERDICT — **NOT CLEAR**
- **Necessity:** shrink — `toleranceMM`, the two new checks, over-exported internals.
- **Sufficiency:** **partial** — Sub 1 does not yet do what Dan defines Sub 1 as doing.

The restructure itself is **accepted**: engine/spec/bridge is the right shape, registration is a released value, the camera moves nothing. What follows is what still fails.

---

## 1 — THE TWO NEW CHECKS ARE THEATRE. Confirmed, not suspected.

Attacked with the check logic copied verbatim out of `separation.test.ts`.

**"the spec is the feed, not the calculator" — 7 of 9 evade**, including **the real prior violation verbatim**:

```
EVADES  return 2 * grid.paddingMM              ← this WAS spec.ts:142
EVADES  const { paddingMM } = grid; 2 * paddingMM
EVADES  const g = grid; g.paddingMM * 2
EVADES  operator on the next line
EVADES  Math.max(grid.paddingMM, grid.pitchMM)
EVADES  const PAD = 10; return 2 * PAD
EVADES  [grid.pitchMM, grid.paddingMM].reduce((a,b) => a*b)
CAUGHT  grid.pitchMM / grid.basePitchMM
```
The regex only fires when the operator comes **after** the property. Half of all arithmetic is invisible to it — and the half it misses is the half that was actually there.

**"the engine holds no values of its own" — 8 of 9 evade.** It knows exactly one shape (`export const SCREAMING = <digit>`). A camelCase name, a module-local const, an object literal, a default parameter, an inline literal, or an array all walk straight past.

## 2 — THE REPLACEMENT. Two line-greps out, one AST walk in.

Not more regexes — **fewer checks, strictly stronger.** Read the tree, not the text; formatting, destructuring, aliasing, multi-line and naming become invisible.

- **Sub 2 does no arithmetic** — any `BinaryExpression` with `* / % + - **` anywhere in `spec.ts`, plus any `Math.*` call.
- **Sub 1 holds no values** — any numeric literal in `engine.ts` outside the structural `{0, 1, 2}` (identity, off-by-one, halving), plus any string literal that parses as a number.

Measured: **18 of 18 evasions caught, 0 false positives on the current `spec.ts` and `engine.ts`.** Working implementation sits with this review; it needs `typescript`, already a dependency.

## 3 — SUFFICIENCY GAP: Sub 1 is not the engine Dan described

> "Sub 1 — the ENGINE. Pure computing. **Takes a shape and the values, works out the layout and the size.**"

`engine.ts` takes a **region** and returns a **field**. No shape ever enters the unit — there is no shape type, no outline, no layout, no size solve. What exists is a lattice generator, which is a prerequisite for the engine, not the engine.

This is the same gap as before the restructure and the lead names it openly. Recording it as the deliverable, not a criticism of the move.

## 4 — THE GUARD IS STILL BYPASSED *(unchanged, 2 clauses)*

`selectPitch()` writes `pitchMM` without `applyGridValue`, and `pitchMM` is declared in `SEALED_IN_CODE`. `spec.ts:18` still claims *"applyGridValue is the ONLY way to write a value."* On the phone the panel reads `Spacing … SEALED 🔒` while the chip above it changes that value. Name it **released-options-only**, not sealed, or route it through the guard.

## 5 — THE BRIDGE CONTRACT DISAGREES WITH ITSELF

`bridge.ts:6`: *"the shell imports this file and nothing else from the unit."* Measured:

```
GridCanvas.tsx:17  import type { GridSystemSpec } from '@/lib/grid-engine/spec'
page.tsx:25        import { ... } from '@/lib/grid-engine/spec'
```
and `separation.test.ts:87` explicitly permits `/(bridge|spec)/`. So the doc states a stricter invariant than the test enforces and than the code obeys. Either the panel legitimately talks to Sub 2 — in which case say so and drop the "nothing else" claim — or it goes through the bridge. Same defect class as the 402 report: the words and the measurement disagree.

## 6 — DESLOP

- **`toleranceMM` — genuinely dead.** Still exactly one consumer in the whole tree: the panel row that displays it. Zero engine consumers. It is sealed and presented as law. Deleting it needs no ruling from Dan and is not blocked on the factory question.
- **Over-exported internals** — `populationStride`, `fieldMarginMM`, `minimumFieldSpanMM`, `SEALED_IN_CODE`, `WriteResult`, `MagnetSpec`, `FieldSpec`, `FieldLayout` are each used only inside their own file. Not dead code — needless public surface. Drop `export` where nothing outside reads them, so the bridge's door stays the only door.

## 7 — VERIFIED GOOD

- **Registration is a released spec value**, not a camera stop. `zoom` reaches no lattice call. Confirmed by import graph and by the gate.
- **All four rows centred**, through the bridge, at both spacings and both registrations:
  `gap` → 48mm 8×8 `[-168…168]`, 96mm 4×4 `[-144,-48,48,144]` · `point` → 9×9, 5×5. All centre 0.
- **`grid.pitchMM / 2` is correct**, and the reworded comment is now **TRUE** — it no longer claims the offset is a whole base step. Checked as asked.
- **`camera.ts` is legitimate** under "own logic file by necessity only" — pure screen maths, no pitch, no padding, no lattice.
- **Sub 2 holds no arithmetic and Sub 1 holds no values** — verified by AST, which is stronger than the tests that assert it.
- **Unit has no DOM dependency** — full unit exercised in bare node with `window`/`document`/`navigator` booby-trapped.
- Typecheck 0 errors. Independent gate 11/13.
