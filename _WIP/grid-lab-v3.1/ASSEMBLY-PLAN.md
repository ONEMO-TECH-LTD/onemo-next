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

**L8 governs the direction and my earlier drafts broke it.** Dan, verbatim: *"No size inputs may
exist"* · *"grid first logic — shape + grid = final proportion and dimensions"* · *"you keep
regressing into size led logic."* A seam taking a `sizesMM` ladder from its caller is exactly that
regression, however the ladder is spelled.

**A band ladder is standardised sizing, and Dan rejected it in the same breath as size inputs:**
*"I know that cap binds differently per shape I am not fixated on the standardised sizing — you
are."* So `bandSpanMM(...)` as the domain was still forward size-testing; QA was right twice.

**⛔ OPEN: THE SIZE DOMAIN HAS NO PROVED BOUND, AND I WILL NOT ASSERT ONE.** L9 caps the GRID COUNT,
never millimetres, so "the field's reach" is not a proved upper bound: a narrow locked-aspect shape
can need a manufactured size well beyond the field's span before a 24mm disc fits, and
non-monotonicity means truncating there can miss lawful answers while an impossible arrangement
never terminates. The canon defines the mechanism — `grid-spec` §4 binding scale per arrangement,
§5 centring, §6 safe publication upward to the first legal even millimetre. **Next action: read
those sections in full and specify that closure**, or state that the three delivered packages lack
it and an additive compute capability is required. No sweep ships until then.

**⛔ OPEN: CROSS-SIZE IDENTITY.** "The smallest size at which an arrangement holds" needs a grouping
key — family + population + steps + position set + construction + registration, **excluding the size
occurrence** — and every lawful size record must be preserved with the minimum marked, or L13's
required variations are silently deleted.

**The falsifying case, from the canon, and it is why the ladder had to go:** the same 2×2 grid gives
a square 72mm and a circle 91.88mm → published 92; the same 3×3 gives 120 and 159.76 → 160. A
`bandSpanMM` ladder returns 72 and 120 for both shapes and can never produce 92 or 160 — it omits
the shape from the dimension, which is precisely what L8 forbids. An even-millimetre sweep produces
them naturally, because each arrangement reports the first size at which *this shape* holds it.

**The lawful model is Dan's own sentence:** *"a shape is never too small; it scales until it
holds."* The output is therefore, **per arrangement, the first lawful whole EVEN millimetre at which
that arrangement holds** (L10 — publication rounds upward to an even value and the result is
re-checked for legality, because concave feasibility comes in windows and a rounded value can fall
outside one) — a value derived from this shape against this lattice, different for every
outline. That is the inverse L8 asks for, and it needs no solver: sizes publish in whole millimetres
(L19), so the domain is the **whole EVEN millimetres across the field's reach** (the brief: manufactured sizes publish as whole even mm), every one evaluated
**independently** in a single call. Every one is evaluated **independently**, which is exactly what
the kernel's own non-monotonicity theorem requires: *"do not binary-search scale… evaluate every
legal published size."* GPT's first answer says the same — *"there is no reason to solve for
continuous critical scales first."* So domain (the grid's own steps), termination (finite, ~9
values) and result (whichever hold) are all defined without any solver, and no monotonicity is
assumed anywhere.

**No size crosses into the unit, in either direction.** The bridge door takes no size parameter, and
nothing outside the unit names, caps or targets a size. Size is what comes back.

| kernel input | value |
|---|---|
| `polygon.vertices` | the native integer pixel ring, deduped for `preparePolygon`'s strictness |
| `sizeTransform.sourceSize` | that ring's integer longest bbox span, in pixels |
| `sizeTransform.sourceAnchor` | **the centre construction under test** (§3.3), as a point of the ring in pixel coordinates — bbox centre, area centroid or maximum-clearance point |
| `sizeTransform.targetAnchor` | the field point that anchor lands on — the shape's placement, not a construction. **Must be supplied**, or the kernel translates the shape out from under the drawing |
| `sizes` | **never supplied, never standardised** — every whole EVEN millimetre across the field's reach, in one call, so one `preparePolygon` serves all of them. Each is evaluated independently (non-monotonicity forbids search). The seam then reports, per arrangement, the smallest size at which it holds: **that derived value is the manufactured size, and it is an output** |

`scale = size / sourceSize` is the kernel's own exact rational, so nothing rescales twice and no
float enters.

**Fixed shape, moving lattice — the coordinate frame, stated.** Varying `sourceAnchor` against a
common `targetAnchor` *moves the transformed polygon*, which contradicts the scaffold's law that the
cut-out stays put and the grid realigns beneath it. Mapping each construction to its own displayed
point would fix the polygon but make all three transforms identical, so O-1 would change nothing —
the switch would be fake. Neither is acceptable.

**The resolution, and it is a constant — no solver needed.** With the fixed displayed outline
`D(x) = s(x − B) + C` (B = ring bbox centre, C = the shell's fixed shape centre) and the kernel frame
`K(x) = s(x − A) + P` for construction anchor A mapped to common field point P, the difference is
constant:

    delta = D(x) − K(x) = s(A − B) + C − P

So each kernel lattice centre and origin returns as `q_display = q_kernel + delta`. The cut-out never
moves, the grid realigns exactly, and bbox / centroid / maximum-clearance stay genuinely different
placements. Computed below the bridge from exact rationals and **carried on each `RawCandidate`**
(displayed origin and centres, or delta) — the shell never derives it. "Selecting by centre construction" was not
enough to implement it, and saying so was hand-waving.

**What the seam's test can and cannot assert.** The shape does not move between placements — the
LATTICE does — so "held centres sit on `layout.magnets`" is only true **per (centre construction,
registration) pair**, never across all twelve at once. The test therefore asserts, for each of the
twelve solves independently: the transformed ring coincides with the ring drawn under that same
centre construction, and every held position coincides with the lattice generated at that same
registration. A global assertion over the twelve would be unsatisfiable, and claiming it would be
the kind of test that can only pass by meaning nothing.

### 3.3 The placement domain — 3 centre constructions × 4 axis registrations

Drafts 1–2 conflated two separate laws:

- **O-1 — the centre construction** decides **`sourceAnchor`**: *which point of the shape* is
  anchored — bbox centre, material centroid, or maximum-clearance point. It is a property of the
  shape, so it varies the SOURCE point; it does not rename the target. (Draft 3 had this backwards,
  caught in QA.) `targetAnchor` is separately where that anchor sits on the field. Settled *by
  switch, not ruling* — Dan: *"why not add all options and test?"*
- **L6 — registration** decides the lattice origin and is **per axis**: an even span registers in
  the gap, an odd on a magnet. The lawful set is four origins — point/point, gap/point, point/gap,
  gap/gap — not the single scalar `registrationOffsetMM` returns.

**Two of the three constructions are computable from the ring exactly** — bbox centre and the
integer-shoelace area centroid are exact rationals. **The third, maximum clearance, has no
authoritative implementation in any accepted module**: the refined sample this lane wrote was
explicitly recorded as non-authoritative, and inventing a largest-inscribed-circle solver in the
seam is exactly the rebuilding the brief forbids. So it is **BLOCKED, not implemented**, and the complete
surface is **blocked** on it — this lane does not ship two and call it done.

**This has a consequence Dan must know:** the band-1 duck at 60mm was found *only* under
maximum-clearance anchoring. Without that construction the raw set may not contain it, and that
absence would be a missing input, not an engine fault.

**⛔ DEPENDENCY MISSING — THE COMPLETE SURFACE IS BLOCKED. THIS IS DAN'S TO AUTHORISE, NOT MINE.** O-1 says test all three
constructions, and the only known duck@60 answer exists under the missing one. Shipping two and
naming the third is *partial by construction*, and slicing a directive into a delivered part and a
deferred part is not a call this lane may make. Until Dan rules, the raw-candidate build is
**blocked at this dependency**, and a two-anchor surface must not be presented to him as "the
candidate set". His options are named in §9.

**Call shape once that is settled:** 4 measurement calls per construction (the four registrations),
each carrying the whole size ladder, so `preparePolygon` runs once per placement and never once per
size. Each candidate is tagged
with its centre construction and its x/y registration. Free pan is not a lawful placement domain under L6, so excluding it costs no lawful
candidate; omitting the 3×4 domain would.

### 3.4 Everything read, nothing written

| kernel input | source |
|---|---|
| `lattice.pitch` | `spec.grid.basePitchMM` |
| `lattice.origin` | the L6 registration under test, from `spec` via `registrationOffsetMM` |
| `lattice.fieldExtent` | `minIndex = −floor(N/2)`, `maxIndex = minIndex + N − 1`, `N = positionsPerAxis` — integer for every permitted value (9 → [−4,4], 8 → [−4,3]) |
| `discDiameter` | `cellDiameterMM(spec.grid)` — read from the spec through the scaffold engine. The seam takes no `layout`, so sourcing it from `layout.cellMM` was incoherent |
| population `indexStep` | **both populations, always**: base `1` and sparse `2`. L7 rules that at 96mm points hide and the lattice stays put, so the sparse set is a residue of the same lattice and the canon needs both. `spec.grid.pitchMM` selects what the shell DRAWS, never what is enumerated |

**A literal 48, 24, 12 or 9 in this file is a defect.** Grammar: `run.stepDomain =
any-positive-whole-population-step`, `full-window.oneByOne = include`, populations base (step 1) and
sparse (step 2) at origin 0,0 — complete on a 9×9 field, so no `MissingKernelFactError`.

**L6 has no owner in the cloned packages — that is a real hole, not a deferral.** The Part-3
package carries no registration or parity rule, so "L6 arrives with the logic module" was false.
Enforcement needs **one thin handwritten `logic/registration-law.ts`** — not compute, not shell — as
the named semantic owner, before anything may be called lawful. Until it exists, the unfiltered 2×4
measurement surface may exist **only as a diagnostic intermediate, never as the completed
assembly**. This lane writes that adapter — it is not Dan's framing call, and it was wrong to put it to him. Tagging is not enforcement.

**L6 is NOT applied in compute, and is not silently dropped.** Measuring four origins makes the
enumerator emit every family at every origin, and L6 says a candidate's per-axis parity must match
its registration. Applying that filter inside `compute/candidates.ts` would put product law in the
compute module — the separation Dan's brief exists to protect. So for this build the surface is
labelled honestly for what it is: **every candidate at every measured registration, each tagged with
the registration it came from**. Applying L6 is a logic-side step that arrives with the logic module;
it is named here so it cannot disappear, and the raw surface must never be described as "lawful".

**Cache key**: outline identity, `basePitchMM`, `pitchMM`, `paddingMM`, `positionsPerAxis`, centre
construction, registration, requested sizes, grammar. Anything outside the key clears it.

## 4. The bridge gains one door

```ts
candidatesForField(spec, tracedRing, opts) → RawCandidate[]   // NO size parameter
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
**per candidate**; those are ruled (L11 gravity, the flap equation for wrap, corridor-connected
components for mass) but not yet implemented as producers. **Activation stays in this plan** —
Dan's directive was to assemble all three and test with him, and this lane does not authorise its
own slice. The judgement producers, the trusted-enumerator seam and the route by which ranked tiers
reach the bridge without logic entering the shell are the remaining design work, sequenced after the
measurement surface exists but not removed from it.

## 7. Order of work

1. ✅ All three packages placed verbatim, committed, isolated, typecheck clean.
2. `ui/trace-cutout.ts` returns the native ring + image dimensions (no new maths).
3. `compute/candidates.ts` + unit test on a real trace: for each (construction, registration) pair
   independently, the transformed ring coincides with the ring drawn under that construction and
   every held position coincides with the lattice generated at that registration — never against a
   single `layout.magnets`. The domain exercised is whatever §3.3 is authorised to be. No literal
   law value in the file. **Goldens locked from the canon: square 2×2 → 72, circle 2×2 → 92,
   square 3×3 → 120, circle 3×3 → 160, plus a concave case whose first fit is odd, proving the
   published value is even AND re-checked rather than merely rounded.**
4. Bridge door; shell stepping control and highlight; lattice-pan disabled.
5. Chrome check on the running page; screenshot; no solve on interaction.
6. Judgement producers, then Part 3 activated through the bridge; Dan tests the assembled three.

## 8. Out of scope

No rewrite of any delivered algorithm. No contour simplifier. No second lattice. No geometry or
policy in the shell. No global compiler change. Ranking exists only inside Part 3, never in compute or shell.


## 9. The two decisions that are Dan's, not this lane's

**D1 — the missing third anchor.** O-1 names three centre constructions; two are exactly computable
from the ring, and **maximum clearance has no accepted implementation anywhere**. The duck at 60mm
was found only under it.
- *(a)* Authorise a **two-construction diagnostic surface now**, knowing band-1 duck may be absent
  for that reason and not because the engine failed; add the third when a source exists.
- *(b)* **Hold the build** until an accepted exact maximum-clearance source exists — an additive
  request to the kernel's author, since building one here is the rebuilding the brief forbids.

**D2 — WITHDRAWN. Never Dan's.** L6 decides the behaviour; this lane writes `logic/registration-law.ts`. Recorded only because putting it to Dan was a manufactured question.


D1 is the only genuine decision here, and it is scope: authorise a two-anchor diagnostic knowing the consequence, or hold for the missing fact.
