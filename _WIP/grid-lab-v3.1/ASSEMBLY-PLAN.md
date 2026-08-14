# Installation plan — GPT Pro's three modules into the scaffold

**Scope: installation only.** Install the accepted three-part stack into the scaffold's existing
modular structure without rewriting it, and run it. Parts 1 and 3 are verbatim GPT deliveries; part 2
is the Dan-authorised patched artifact copied verbatim. No rebuilding, no improving, no new
architecture, no solvers, no product policy. Everything else waits until we have looked at real
output.

## 0. State this plan starts from — measured, not remembered

The worktree was rolled back on Dan's instruction: **the scaffold is byte-identical to untouched**
(`git diff` against the pre-installation baseline is empty). `src/lib/grid-engine/` holds only
`spec.ts`, `engine.ts`, `bridge.ts`, `ui/`, `__tests__/`. Nothing is installed. Measured at HEAD
`7b84a719`: **scaffold suite 31/31, `tsc --noEmit` 0 errors.**

The archive is preserved at `_WIP/grid-lab-v3.1/gpt-pro/` — 245 files: each delivery as received,
the exact prompt Dan pasted, the fork transcript, the verification record and the acceptance gate.
`_WIP` is excluded from the app's TS project (archive hygiene — those files are not app source).

**Read in full before this plan** (Dan's requirement; all re-read at this HEAD):
scaffold 2,025 lines — `spec.ts` 210, `engine.ts` 227, `bridge.ts` 116, `ui/camera.ts` 73,
`ui/trace-cutout.ts` 46, `GridCanvas.tsx` 175, `page.tsx` 654, `separation.test.ts` 387,
`pinch.test.ts` 137. Deliveries 6,941 lines — kernel src 1,927 + CONTRACT 590; enumerator src 1,212
+ CONTRACT 294; product logic src 2,589 + CONTRACT 329.

## 1. Provenance — and the one thing the rollback changed

| package | provenance | where it is now |
|---|---|---|
| Part 1 kernel | verbatim GPT delivery | archive, on disk |
| Part 3 product logic | verbatim GPT delivery | archive, on disk |
| Part 2 enumerator | GPT delivery **+ the Dan-authorised `single`-family patch** | **git history only** — `52c91380` |

**The accepted part-2 artifact is no longer on disk.** Verified: the only enumerator in the tree is
GPT's original, and it contains zero occurrences of `single`. The patched artifact — the one Dan
authorised on 08-13, when the band-1 duck was reachable only as a 1×1 window — survives at commit
`52c91380` (identical to the earlier staging copy at `16ecd4f7`, verified by diff). The patch is
20 lines: an `enumerateSingles` pass emitting one candidate per held position, `"single"` added to
the family union, and the required-key list going from four families to five.

So installation **sources part 2 from `52c91380`**. No second archive copy is made: the installed
tree plus that immutable git object already make provenance checkable, and duplicating a package
into the archive is not installation work.

Dan's instruction not to rebuild what is already done and his authorisation of that patch agree:
the accepted artifact is what installs. No new ruling is needed.

## 2. Where each module goes — and why it is not a matter of taste

```
src/lib/grid-engine/
  engine.ts                           UNCHANGED  (pure mm compute)
  spec.ts                             + the released arrangement grammar (policy data)
  ui/trace-cutout.ts                  + returns the native ring it already produced
  bridge.ts                           + ONE door
  __tests__/separation.test.ts        + direction guards for the new modules
  compute/
    magnetic-grid-measurement-kernel/  VERBATIM GPT DELIVERY (Part 1)
    enumerator/                        VERBATIM ACCEPTED PATCHED ARTIFACT (Part 2)
    candidates.ts                      the seam — the only NEW file
  logic/
    magnetic-grid-product-logic/       VERBATIM GPT DELIVERY (Part 3)
```

**The two compute folder names are forced by the delivered code.** `enumerator/dist/types.d.ts:1`
imports the kernel at `"../../magnetic-grid-measurement-kernel/dist/index.js"` — a relative sibling
path, with the delivered directory name and the `dist/` level intact. Renaming either folder or
flattening `dist/` breaks the delivered package and would force an edit to it, which is forbidden.
**Part 3 imports nothing across packages** (verified: zero `../../` imports in its src and dist — it
redeclares the upstream types locally), so it is free to sit in `logic/`, which is where the
scaffold's separation puts product judgement.

**What the part-2 archive actually contains.** Its wrapper `enumerator-v1.0.0/` holds two sibling
folders — `enumerator/` and a carried copy of `magnetic-grid-measurement-kernel/`. The carried kernel
is a sibling of the enumerator, not nested inside it, and it is how GPT satisfied that forced
relative import when shipping. The installation tree already places the accepted part-1 kernel at
exactly that sibling path, so nothing extra is copied from the part-2 wrapper.

## 3. The seam — calls the packages as they were built to be called

`compute/candidates.ts`, one new file. Its shape follows from what the contracts actually demand:

1. **Encode the traced ring exactly — no cleaning, no repair.** `traceContourRaw` emits
   marching-squares **edge midpoints**, so every coordinate is a half-integer
   (`contour.ts:34-37`), and it already runs `dedup`, which removes consecutive duplicates *and* the
   wrap (`contour.ts:130,150`). The earlier claim that this ring is integral, and the claim that it
   arrives with duplicates needing repair, were both **false**. The kernel takes only exact integers,
   so the seam **multiplies every coordinate by 2** — a lossless change of unit that turns every
   half-integer into an integer and alters no geometry. Nothing else is done to the ring. If the
   kernel then rejects a real trace — a non-consecutive duplicate at a pinch point, a self-touch —
   that **fails loudly and is reported**, because part 1's contract forbids silent repair and a
   rejected trace is a finding, not something to paper over.
2. **`measureLattice(...)` once, carrying every size.** Polygon validation is O(n²) in edges and runs
   **once per call, not per size** (contract §7), so one call with the whole size list is both the
   cheap shape and the one the contract describes.
3. **`enumerateCandidates(...)` on that measurement**, with the released grammar read from `spec.ts`.
   The enumerator ships **no** default grammar and rejects a missing family key, so the grammar is
   mandatory caller data.
4. **Return both delivered documents verbatim**, plus an additive millimetre projection for drawing.

**What the seam owns:** the transform and field arithmetic needed to drive the packages — that is
calculation, and calculation belongs in compute. **What it does not own:** the grammar (released
policy, in `spec.ts`) and every product judgement. Zero law literals; law values reach it from the
spec two ways, both legitimate — derived ones through the scaffold's engine helpers
(`cellDiameterMM`, `registrationOffsetMM`) and released ones read from `spec.grid` directly
(`basePitchMM`, `positionsPerAxis`).

**The transform is a real pixel→millimetre conversion, and it must reproduce the shell's own drawing
exactly.** The kernel applies `T_s(p) = targetAnchor + (s/sourceSize)·(p − sourceAnchor)`. Calling
that "identity" was wrong and dimensionally false: the ring is in pixels while the lattice is in
millimetres, so scale 1 would have measured a pixel-sized shape against a millimetre grid. The
correct inputs, in the ×2 encoded source space, for an image of `W × H` pixels at size `sizeMM`:

| kernel input | value | why |
|---|---|---|
| polygon | ring × 2 | exact integers, no rounding |
| `sourceSize` | `2 · max(W, H)` | the longest source dimension, in the polygon's own units |
| `sourceAnchor` | `(W, H)` | the image centre `(W/2, H/2)`, ×2 — integers |
| `targetAnchor` | `(0, 0)` | where the shell centres the box |
| requested size | `sizeMM` | the millimetre size already on screen |

This is not asserted — it is **checked against the shell's own drawing expression**. The shell draws
`box.x + (px/W)·box.w` with `box.w = W·k`, `box.x = −box.w/2`, `k = sizeMM/max(W,H)`
(`page.tsx:215-218`, `page.tsx:508`). Both reduce to `sizeMM·(px − W/2)/max(W,H)`; evaluated over
sample coordinates they agree to 7e-15 in floating point, and the kernel computes it exactly in
BigInt rationals. **So the engine measures precisely the shape the shell draws** — the same class of
error as measuring the silhouette bbox while the shell drew the image box, caught before it shipped
rather than after.

**Files this installation touches, in full.** Two kinds, stated separately because they are not the
same act:

*Integration / scaffold files — written or modified:* `compute/candidates.ts` (new — the seam) ·
`spec.ts` (the released grammar) · `ui/trace-cutout.ts` (keep the ring it already produced) ·
`bridge.ts` (one door) · `page.tsx` (state + control) · `__tests__/separation.test.ts` (direction
guards) · `tsconfig.json` (exclude each package's `src`/`test`/`scripts` so the app never compiles
delivery sources — they use BigInt literals and the app targets ES2017).

*Accepted package trees — ADDED, never edited:* `compute/magnetic-grid-measurement-kernel/`,
`compute/enumerator/`, `logic/magnetic-grid-product-logic/`. Not one delivered byte is modified.

### 3a. The grammar — the exact accepted object, not a fresh one

Current `spec.ts` declares no grammar (verified: zero matches). The enumerator refuses to choose two
ambiguities, so re-authoring the grammar would silently pick them. The accepted object survives at
`a9b1f793` and is **copied exactly**, not rewritten:

```ts
export const RELEASED_ARRANGEMENT_GRAMMAR = Object.freeze({
  schema: 'magnetic-grid-candidate-enumerator/grammar/v1',
  populations: Object.freeze([
    Object.freeze({ id: 'base',   origin: Object.freeze({ column: '0', row: '0' }), indexStep: '1' }),
    Object.freeze({ id: 'sparse', origin: Object.freeze({ column: '0', row: '0' }), indexStep: '2' }),
  ]),
  families: Object.freeze({
    single: Object.freeze({}),
    run: Object.freeze({ stepDomain: 'any-positive-whole-population-step' }),
    'rectangle-corners': Object.freeze({}),
    'corner-triangle': Object.freeze({}),
    'full-window': Object.freeze({ oneByOne: 'include' }),
  }),
})
```

The two settled ambiguities are `run.stepDomain` and `full-window.oneByOne`; the sparse population is
declared as the rule it is — every second base point from a shared 0,0 origin — never inferred from
whichever pitch the screen happens to be showing.

## 4. Two scaffold repairs the installation forces

**The tracer must keep what it already produced.** `traceCutout` computes the outline in exact
half-integer pixel coordinates and then discards them, returning only the UV projection
(`trace-cutout.ts:43-45`). The seam needs those exact values plus the image dimensions the UV
division used, and multiplying UV back up is a lossy round trip through data we already had. It
returns `{ outlineUV, ring: { points, width, height } }` — nothing computed, only kept. That is
browser-IO preparation, not geometry. Drawing still uses UV; the ×2 encoding happens in the seam,
because changing units for the kernel is compute work.

**The separation guard will go red, and it must be fixed rather than excused.** Its "ui submodule"
test classifies **every** nested directory under the unit as `ui/` (`separation.test.ts:242`) and
forbids law-value names there — so installing `compute/` makes the seam fail for reading law values,
which is exactly what compute is supposed to do. Fix: target `ui/` specifically, and add the
direction checks the guard never had.

**The bridge is bounded, not unconstrained — and an earlier draft of this plan got that wrong.**
Saying "the bridge is deliberately unconstrained" would have licensed it to reach outward into
`ui/`, the app, or a framework. It travels with the portable unit (`PORTABLE` already lists
`bridge.ts`), so its freedom is to cross the unit's **internal** semantic layers, never to erase the
unit's outer boundary:

| module | may import | may not import |
|---|---|---|
| `bridge.ts` | spec · engine · `compute/*` · `logic/*` | `ui/*` · app · React/Next/CSS · browser globals |
| `compute/*` | spec · engine · its own delivered packages | `logic/*` · `ui/*` · app |
| `logic/*` | its own delivered package | `compute/*` · `ui/*` · app |
| `ui/*` | outward adapters only (see `ui/README`) | `compute/*` · `logic/*` |
| shell | bridge · spec · `ui/*` | everything else in the unit |

**And the existing guard has a hole here that this installation must close rather than inherit.**
Measured: the test named *"the three files that travel import nothing outward — not even from ui/"*
matches only `@/…` and `../…` specifiers (`separation.test.ts:154`). A bridge importing
`./ui/trace-cutout` — a plain relative path, the spelling a builder would actually reach for —
**passes it today**. It passes because `bridge.ts` happens not to do that, not because the rule
holds. (A bare `react` import is caught, but by a different test — the whole-tree framework check.)
The repaired guard checks the direction table above on resolved specifiers, so `./ui/…` from the
bridge fails.

**One consequence to state now, because it is where a builder would be tempted to weaken the guard:**
the bridge may not import the ring's type from `ui/trace-cutout.ts`. So that type is declared in
`compute/` (with the seam that consumes it) and the tracer's return value satisfies it structurally.
The shell passes the ring through the bridge as data; no type crosses inward from `ui/`.

## 5. Part 3 — installed and callable, not faked

Part 3 requires **exactly four** top-level inputs — `candidateDocument`, `measurementDocument`,
`rules`, `judgements` — and a complete judgement per candidate (gravity boolean, tight-wrap value,
regional-support value). It has **no partial mode**: an unknown or missing key throws
`INVALID_INPUT`. Its family set already accepts our `single` family (`validate.ts:51-57`), so the
patched enumerator's output is valid input to it as delivered.

The scaffold supplies none of those judgements today. So **the bridge reports those inputs as
unavailable by name; part 3 is not called, and we never claim it was.** The seam therefore preserves
the kernel and enumerator documents **verbatim** — they are two of part 3's four mandatory inputs the
moment judgements exist. Part 3 stays integration-testable against its own delivered fixtures.

## 6. Ownership — one bridge door, then the shell

**Compute** holds the two measurement packages and the seam. **Logic** holds part 3. **The shell
imports neither** — `page.tsx` and `GridCanvas.tsx` import only `spec`, `bridge` and `ui/*`, exactly
as they do today. One bridge result carries measurement, raw candidates, and part 3's output or its
named missing inputs. The shell browses and draws that result; it computes nothing and orders
nothing.

## 7. Run it and look

Real traces on the running page, verified in profiled Chrome with a screenshot. **This is a
diagnostic of the delivered engine, not production output** — it is size-first because that is how
the modules were built, and Dan sees exactly what GPT Pro's work does before anyone proposes
changing it.

## 8. Order of work

1. Copy the three packages in (part 2 from `52c91380`); add the tsconfig exclusions. Gate: three
   suites green, `tsc` 0 errors.
2. Copy the accepted grammar into `spec.ts` from `a9b1f793`; the tracer keeps its ring; repair +
   extend the separation guard.
3. The seam.
4. The one bridge door, then the shell control.
5. Run on real traces; screenshot; Dan looks.
