# Assembly plan — the three GPT modules into the scaffold

**Third draft.** Drafts 1 and 2 were blocked by QA (@s62-pixel-grid-pixel); every finding is applied
below, including two that overturned my own decisions. Read in full before writing: the scaffold
(`spec.ts` 210, `engine.ts` 227, `bridge.ts` 116, `ui/camera.ts` 73, `ui/trace-cutout.ts` 46,
`GridCanvas.tsx` 175, `page.tsx` 654) and all three deliveries (kernel src 1,927 + contract 590;
enumerator src 1,229 + contract; product logic src + contract + tests).

**Bound by:** clone the delivered modules **verbatim** — rebuilding or approximating is forbidden;
keep the scaffold's compute / logic / shell separation; the **shell holds nothing but shell**.

---

## 1. The scaffold as it is

| module | file | owns | may never |
|---|---|---|---|
| **Sub 2 — spec** | `spec.ts` | law VALUES + the one write guard. No arithmetic. | compute |
| **Sub 1 — engine** | `engine.ts` | pure mm compute: lattice, spans, registration offset, scaling | know a screen, hold a value |
| **Bridge** | `bridge.ts` | the ONLY door shell→unit | hold values, do geometry |
| **Shell** | `page.tsx`, `GridCanvas.tsx` | presentation state, drawing | compute, decide policy, import compute/ |
| **Shell logic, by necessity** | `ui/camera.ts`, `ui/trace-cutout.ts` | screen maths; browser IO + tracing | touch mm law |

## 2. Placement — all three, verbatim. Placement is not activation. ✅ LANDED

```
src/lib/grid-engine/
  spec.ts / engine.ts / ui/            UNCHANGED
  bridge.ts                            + ONE door (§4)
  compute/
    magnetic-grid-measurement-kernel/  VERBATIM, complete package   ← ACTIVATED
    enumerator/                        VERBATIM, complete package   ← ACTIVATED
    candidates.ts                      the seam — the only file written here (§3)
  logic/
    magnetic-grid-product-logic/       VERBATIM, complete package   ← PLACED, NOT WIRED (§6)
```

Committed at `52c91380`: 138 files, all three `diff -r` byte-identical to their accepted deliveries,
nothing edited, all three import at runtime, own suites 18/18 · 13/13 · 15/15.

**Why the names are forced:** `enumerator/dist/types.d.ts` imports
`"../../magnetic-grid-measurement-kernel/dist/index.js"` — the packages must stay siblings under
their delivered names with `dist/` depth intact, or delivered code would need editing.

**Isolation, measured not assumed.** The app targets ES2017; the deliveries use BigInt literals
(ES2020). Each package's `src/`, `test/`, `scripts/` are excluded from the app's TypeScript project
(with `_WIP`); each package keeps building itself under its own tsconfig; the seam imports only
`dist/`, whose `.d.ts` is covered by `skipLibCheck`. Removing those exclusions produces **101
TS2737 errors** — measured, not inferred. The app's target is **not** raised and no delivered file
is touched. `npx tsc --noEmit`: clean.

*(Recorded: landing the deliveries in `_WIP` had put 51 delivery `.ts` files in the typechecked tree
and left the repo typecheck red. Mine; fixed by the same exclusion.)*

## 3. The seam — `compute/candidates.ts`, the only code written in compute

### 3.1 The canonical polygon is the tracer's own integer ring — no invented precision

Two of my earlier attempts were wrong and are struck:

- **1e6-per-UV quantisation** claimed sub-millimetre authority that **L19** explicitly refuses:
  *"a traced outline carries no sub-millimetre authority, so pixel-resolution stair-steps are noise,
  not geometry."*
- **Whole-millimetre quantisation of the contour** was worse: L19 binds *product decisions and
  published sizes* to whole millimetres; it does not authorise a topology-changing contour
  simplifier. And a ring quantised in physical millimetres is **size-dependent**, which destroys the
  one-canonical-polygon model.

`traceContourRaw` already yields an authoritative discrete contour: **integer source-image pixel
coordinates**, with the image width and height. That native ring is the canonical kernel polygon.
UV is derived from it for drawing only — the same ring, two views, so the shell and the kernel can
never be measuring different shapes.

`ui/trace-cutout.ts` therefore returns the native ring and the image dimensions alongside the UV it
already produces. It discards nothing it computes today and gains no new maths.

If contour simplification is ever wanted, it is a separately ruled input-preparation module with its
own QA — never smuggled into this seam.

### 3.2 The transform, stated once

| kernel input | value |
|---|---|
| `polygon.vertices` | the native integer pixel ring, deduped for `preparePolygon`'s strictness |
| `sizeTransform.sourceSize` | that ring's integer longest bbox span, in pixels |
| `sizeTransform.sourceAnchor` | that ring's exact rational bbox centre, in pixels |
| `sizeTransform.targetAnchor` | the centre construction under test (§3.3) — **must be supplied**, or the kernel translates the shape out from under the drawing |
| `sizes` | the whole-millimetre sizes wanted — **many in one call**, one `preparePolygon` for all |

`scale = size / sourceSize` is the kernel's own exact rational, so nothing rescales twice and no
float enters. The seam's test asserts the returned centres coincide with the drawn outline.

### 3.3 The placement domain — 3 centre constructions × 4 axis registrations

Drafts 1–2 conflated two separate laws:

- **O-1 — the centre construction** decides `targetAnchor`: bbox centre, material centroid,
  maximum-clearance. Settled *by switch, not ruling* — Dan: *"why not add all options and test?"*
- **L6 — registration** decides the lattice origin and is **per axis**: an even span registers in
  the gap, an odd on a magnet. The lawful set is four origins — point/point, gap/point, point/gap,
  gap/gap — not the single scalar `registrationOffsetMM` returns.

**12 solves per size.** Each candidate is tagged with its centre construction and its x/y
registration. Free pan is not a lawful placement domain under L6, so excluding it costs no lawful
candidate; omitting the 3×4 domain would.

### 3.4 Everything read, nothing written

| kernel input | source |
|---|---|
| `lattice.pitch` | `spec.grid.basePitchMM` |
| `lattice.origin` | the L6 registration under test, from `spec` via `registrationOffsetMM` |
| `lattice.fieldExtent` | `minIndex = −floor(N/2)`, `maxIndex = minIndex + N − 1`, `N = positionsPerAxis` — integer for every permitted value (9 → [−4,4], 8 → [−4,3]) |
| `discDiameter` | `layout.cellMM` |
| population `indexStep` | `spec.grid.pitchMM / spec.grid.basePitchMM` |

**A literal 48, 24, 12 or 9 in this file is a defect.** Grammar: `run.stepDomain =
any-positive-whole-population-step`, `full-window.oneByOne = include`, populations base (step 1) and
sparse (step 2) at origin 0,0 — complete on a 9×9 field, so no `MissingKernelFactError`.

**Cache key**: outline identity, `basePitchMM`, `pitchMM`, `paddingMM`, `positionsPerAxis`, centre
construction, registration, requested sizes, grammar. Anything outside the key clears it.

## 4. The bridge gains one door

```ts
candidatesForField(spec, tracedRing, sizesMM, opts) → RawCandidate[]
```
`RawCandidate` carries positions in mm, family, population, per-axis steps, kernel fact references,
**the size occurrence, the centre construction, and the x/y registration** — the last three because
selecting a candidate must realign the drawn lattice to the placement it was measured under.

## 5. The shell — and the pan contradiction, resolved honestly

**"Pan is presentation only" was false as written.** `GridCanvas` passes `panMM` into `layoutField`,
which adds it to `anchorMM` and `magnetsInRegion` — dragging physically moves the lattice today.
Leaving that while candidates stay frozen would let the drawn magnets drift off the candidate
coordinates.

**For this build the lattice-pan interaction is disabled**, and selecting a candidate sets the drawn
lattice from that candidate's recorded registration and centre construction. It cannot reuse the
free-pan state. A camera-only pan may return later; it is not needed for this gate and is not in
this plan.

Otherwise the shell gains only: the index of the candidate being viewed, controls to step it, and
highlight elements passed as `children` to `GridCanvas` from bridge-returned coordinates. No compute,
no lattice number, no notion of "better".

## 6. Product logic — placed, deliberately not wired

Cloned verbatim under `logic/`. It requires a gravity boolean, a wrap value and a regional value
**per candidate**; those are ruled but not implemented. Placement and activation are separate, and
this plan's authorised deliverable ends at the raw-candidate surface.

## 7. Order of work

1. ✅ All three packages placed verbatim, committed, isolated, typecheck clean.
2. `ui/trace-cutout.ts` returns the native ring + image dimensions (no new maths).
3. `compute/candidates.ts` + unit test on a real trace: returned centres coincide with the drawn
   ring and sit on `layout.magnets`; the 3×4 domain is exercised; no literal law value in the file.
4. Bridge door; shell stepping control and highlight; lattice-pan disabled.
5. Chrome check on the running page; screenshot; no solve on interaction.
6. Dan tests the raw set. Only then: judgements, then product logic.

## 8. Out of scope

No rewrite of any delivered algorithm. No contour simplifier. No second lattice. No geometry or
policy in the shell. No ranking anywhere. No global compiler change. No new module beyond the seam.
