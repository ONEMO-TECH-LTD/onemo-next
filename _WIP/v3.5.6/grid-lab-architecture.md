# MAGNETIC GRID ENGINE — ARCHITECTURE AND REFACTOR PLAN

**Scope.** The v3.5.6 cluster: `src/lib/effect/grid-magnet*`, `src/lib/effect/library/`, and the
`grid-centre` bench. **Out of scope, retained:** the Session 59 engine (`src/lib/effect/grid.ts`,
`grid-core.ts`, the `grid-lab` route) — a separate public door. Naming both "Grid Lab" is how the
studio integrates the wrong one.

Target structure and the staged plan to reach it. Not yet true of the code.

**The product pipeline it serves** — what each step delivers and what the classifier owes — is
`v3.5.6-pipeline-brief.md`. This document is the code structure only.

**Goal.** The engine exports headless into the studio backend to define sizes and manufacturing
layouts. One callable pipeline, no browser, no cross-dependencies, UI a shell.

---

## 1 · Laws

**L1 · Shared foundation is used, never rebuilt.** A unit that re-implements a primitive is a defect.
**L2 · A unit never imports another unit.** The pipeline passes outputs between them.
**L3 · The pipeline holds sequence, never rules.** No threshold, no measurement, no ranking in it.
**L4 · One home per fact.** Physical constants in spec; each derived fact has one producer.
**L5 · The shell renders.** Page and panel reach the engine only through adapters.
**L6 · Proven bodies move; they are never retyped.** The tree is built new, the geometry carried
across unchanged, each move proven by an empty diff. Every regression this project has paid for came
from rewriting something that already worked; the one clean transfer succeeded because `wrapGroup`
moved byte-identical.

**Kernel rule:** a primitive enters the foundation only with **two or more unit consumers**. One
consumer means it moves into that unit. Otherwise "foundation" becomes the next "compute".

---

## 2 · Target tree

Files stay put unless marked. New folders only where new units are born.

```
src/lib/effect/
  grid-magnet-spec.ts      KEEP   values only
  types.ts                 KEEP   vocabulary
  geometry-truth.ts        KEEP   repo-wide, not engine-owned
  offset.ts                KEEP   repo-wide Clipper wrapper
  foundation/              NEW    primitives with ≥2 unit consumers
                                  bbox · area · centroid · point-in-contour · nearest-edge
                                  lattice · seat predicate · erosion
  units/                   NEW    self-sufficient; NEVER import each other
    segment/               ← safeSegments: legal contour, islands, masses, segment box
    classifier/            ← grid-magnet-class.ts + the catalogue matcher, completed
    centring/              ← anchor bake, six modes, governors
    layout/                ← registration, population (full/perimeter/custom), generic fallback
    wrap/                  ← fixed nodes → minimum lawful contact size + minimum shift
    judge/                 ← evidence, legality, ordered offers, default landing
  library/                 KEEP IN PLACE — its own law + 28 gates
  pipeline/                NEW    one serialisable call; sequences the units
  adapters/                NEW    ui-bridge · library-bridge · worker transport · catalogue adapter

  RETIRED AT CUTOVER (S5, not before)
    grid-magnet.ts         the door: centre-rules body → units/layout, voting branch deleted
    grid-magnet-compute.ts split: primitives → foundation, safeSegments → units/segment
    grid-magnet-logic.ts   split: centring → units/centring, applyCoverage → units/layout,
                           assignSizes → adapters (it shapes output, it does not judge)

src/app/(dev)/effect-creator/
  grid-centre/             THE BENCH — shell
    page.tsx               KEEP; loses its direct engine imports at S3
    LibraryPanel.tsx       KEEP
    solve.worker.ts        SHRINK 226 → transport/cache only
  grid-magnet/  grid-wrap/ DELETE — voting reference, superseded count-first bench
```

**Unit boundaries that matter:** `wrap` receives a fixed magnet set and solves only its contact
size — it never registers or populates a layout. `layout` never wraps, never ranks, never infers a
class. `judge` never mutates a population.

---

## 3 · What the read found

**The pipeline is assembled in the worker.** `bakeOf`, `anchorFnFor`, `wrapBandLadder`, the rule-4
landing — all in `solve.worker.ts`. No module in `lib/` composes them; the catalogue-vs-solver
oracle had to rebuild the composition by hand.

**Layout generation has no owner.** `computeGrid` registers the lattice and populates it; the wrap
module solves a fixed set. Today both live behind one door.

**The wrap module's header is false.** It claims to be disconnected from centring, masses, coverage
and the door; it imports `computeGrid`, `safeSegments`, `centeringAnchors`, `governMass`,
`applyCoverage`.

**Foundation rebuilt inside the wrap module:**

| in `grid-magnet-wrap-compute.ts` | already exists in |
|---|---|
| `box()` | `bbox()` |
| `inside()` | `pointInOuter` (private) |
| `nearestDist()` | `edgeDistMM` (private, **indexed**; the copy is a brute scan) |
| `areaOfRing()` | shoelace in `centroidOf` |
| `heldAt`, `anchorAt`, `midOf` | written twice — `wrap` and `wrapGroup` |
| `mod()` | again inside `wrapGrid` |

**Holes are structurally discarded.** `scaleContour`, `normBaseContour`, `normMaskContour`,
`normGeneratedRing` all return `holes: []`, and the seat predicate takes only the outer ring — while
`Contour.holes` exists in the type and the brief requires every supplied boundary to stay material.
Two different problems, and only one was parked: **the engine erasing holes a caller supplies is a
defect, in scope now**; teaching the raster tracer to discover multiple rings stays parked upstream.
A headless caller constructs a `Contour` directly, so the engine work needs no tracer.

**The separation gate cannot see the live bench.** Proven by my own mutation: a raw
`grid-magnet-compute` import injected into `grid-centre/page.tsx` leaves it **12/12 green**, because
the test reads the obsolete `grid-magnet/page.tsx` and five hand-listed files.

**Consumers checked:**

- `bandSnapPoints` — **zero consumers.** Dead export.
- `fitSizeInBand` / `bandWalk` / `maxPressMM` — live at exactly **two** touchpoints, both relics:
  the empty-band fallback, and the idle prefetcher warming caches for a path that never runs. The
  page hardcodes `positioning: 1` with no control to change it, so the worker's non-positioning
  branch is **unreachable**. Once the fallback is rebuilt (S2) the whole chain has no caller.
- voting scorer + weights, `centeringRef`, `pointInMass` — reachable only via `positioning !== 1`.
- `wrap()`, `wrapFlap`, `unheldOf` — only the two benches being deleted.
- **Survive:** `pressExcessMM` (centre-rules tie-break), `makeCircleSeatPredicate` (circle preset),
  `splitPerimeter` (feeds `applyCoverage`).

**Already clean, measured on the cluster:** no React, Next or DOM in `grid-magnet*.ts` or `library/`;
no `lib/` → `app/` import outside test files. The library's 29 modules are under their own law with 28
gates. *(The wider `lib/effect/` folder is not DOM-free — `composite.ts`, `mask.ts`, `segment-ml.ts`
and `prepare-effect.ts` call `document.createElement`. They are the older effect pipeline, out of this
scope, and they are why the headless claim is made about the cluster and not the folder.)*

**What survives, and what goes** — this is why the work is a re-layout, not a rewrite:

| moved unchanged (L6) | lines | deleted | lines |
|---|---|---|---|
| seat predicate + edge index | 165 | the two old routes | 2183 |
| `safeSegments` | 248 | `wrap`/`wrapFlap`/`unheldOf` chain | 375 |
| centring: anchors, governors, bake | 138 | band walk + `fitSizeInBand` + `bandSnapPoints` | 76 |
| centre-rules parity registration | 30 | `computeGrid` voting branch | 62 |
| Clipper wrap solve | 157 | voting scorer, weights, `centeringRef` | ~55 |
| spec · shape normalisation | 192 | | |
| `library/` — untouched, own law | 1693 | | |

Twelve destinations from four files: `grid-magnet-compute` splits four ways, `grid-magnet-logic`
three, the door two, the wrap module three. **What makes the moves checkable:** the catalogue oracle
already asserts 163 records × 3 pitches *equal* — an existing gate, not new machinery.

---

## 4 · Plan

**Only grid-lab internals that will be used.** No characterisation harness, no audit module, no
gate suite beyond the one import matrix. The engine's own tests are the classifier audit Dan ordered
and the catalogue oracle that already exists.

**Execution gates.** S1–S3 need no open product answer. OQ1–OQ2 gate S4. OQ3, OQ5 and OQ6 gate
product activation in S5. OQ4 is not a decision yet — it is resolved by reading the actual studio
caller before anything freezes or exports its wire contract.

**S1 · Delete only what is provably dead.**
Delete the `grid-magnet/` and `grid-wrap/` routes, re-run a re-export-aware consumer trace, and
delete only symbols whose last production caller went with them — the voting scorer and its weights,
`centeringRef`, the `wrap`/`wrapFlap`/`unheldOf` chain, `bandSnapPoints`.
**Keep `fitSizeInBand`, `bandWalk`, `maxPressMM` for this commit only** — a structural deletion must
not change what the bench does. Replaced and deleted in S2.
*Done when:* the bench still solves on all four classes and every band, the existing suite and the
catalogue oracle stay green.

> **No behaviour freeze.** The old engine never produced correct answers — the voting tab
> approximated. Freezing its output as a golden would make the defect the reference. Correctness is
> judged against the catalogue oracle, which already exists, and against the live surface.

**S2 · Move bodies to owners; fallback generation under layout, verdict under judge.**
Foundation, segment, centring, layout, wrap, judge — existing bodies moved, not rewritten. The legal-area contour becomes
contour-aware: outer eroded, every supplied hole inflated and subtracted by the same radius, and
`Contour.holes` preserved through scaling and sizing. `applyCoverage` → layout (it
changes the population). `assignSizes` → adapters (it shapes output). The wrap module drops its six
rebuilt primitives and its false header. The derived-zone import matrix lands in the same commit and
**`grid-magnet-separation.test.ts` is deleted with it** — it is a replacement for a gate proven blind,
not a second gate.

**The empty band is answered by the units, not by an escape hatch.** Today it falls back into the
old walk and shows the size that seats the most magnets, loose — the rigid gate and band-only wrap
the brief lists as "do not preserve", kept alive to avoid a blank screen. Capability preserved
explicitly, old path deleted:

- **`units/layout` owns fallback candidate generation.** When catalogue candidates yield no lawful
  offer it generates generically. It is not a new unit and not a second law.
- **Every candidate then passes the same `wrap` and the same `judge`.** No separate path, no
  separate rules.
- **If none passes:** `offers: []` plus `diagnostic: { reason: 'no-lawful-offer', bestSeated? }`.
  The UI may show that calibration witness; it may never present it as a lawful offer.
- **Where the nearest lawful offer lives** is not a special rule — it is the `automatic` search
  envelope, asked by the adapter, returning offers with their own band.

The pipeline decides none of this: it sequences layout → wrap → judge and passes the result on.

With that landed, `fitSizeInBand`, `bandWalk`, `bandFit`, `maxPressMM` and the idle prefetcher have
no caller and are deleted in S2.
*Done when:* the bench still solves and the oracle stays green · a supplied donut keeps its hole
through the pipeline · an `automatic` envelope reports the nearest lawful offer where one exists,
otherwise `offers` is empty and the `no-lawful-offer` diagnostic carries only a calibration witness ·
a unit→unit import fails the suite.

**S3 · One pipeline, one shell seam.** One serialisable call whose search envelope —
`manual | band | automatic` — changes *candidate enumeration only*; segment, class, centre, layout,
wrap and judge are the same calls in every mode. The worker becomes transport and cache. The shell
gets an adapter surface (`createGridRequest`, `gridViewModel`, `libraryViewModel`) and loses its
direct engine imports.
*Done when:* the pipeline runs from a Node test with no worker, the oracle calls it instead of
rebuilding the composition, and the mutation proof runs against the **real** page and worker.

**S4 · Complete the product logic.** Catalogue-backed classifier (below), the y-flip repair, the
96mm arc as judge evidence, the decision trace and the standing audit. *(The generic layout fallback
lands in S2, not here.)*
Two named defects close here or the stage is not done: **4 of 38 rectangle records report `cx = cy`**
— a rectangle carrying a square's axis pair, exactly the silent misclassification the audit exists to
catch — and the **`round` family reaches nothing** (a pill classifies as `square`), which the enum's
deletion resolves by making the catalogue's own classes the answer.

**S5 · Cut over and delete.** Once every production caller has moved: delete `grid-magnet.ts`,
the generic compute/logic buckets and the obsolete bridge exports. Run the whole catalogue at
24/48/96, real cutouts, every centre mode, every band, manual, then verify the live surface.

### The classifier method

Exact ruled facts filter — the axis pair both sides carry. Then remove only candidates **dominated
on every continuous fact** (fill *and* aspect): a Pareto frontier, not a priority order. One
surviving class → decided; several → **ambiguous, every tied class named in the trace**.

```ts
fillError   = |candidate.fill - query.fill|
aspectError = |candidate.widthMM / candidate.heightMM - query.widthMM / query.heightMM|
```

*Why not "fill, then aspect":* a lexicographic order is a ranking policy I would be inventing, and it
was never ruled.

**Measured over all 163 records, my own probe, matching QA's independently:**

| pitch | decided | ambiguous | missed |
|---|---|---|---|
| 24 mm | 139 | 24 | 0 |
| **48 mm** | **163** | **0** | **0** |
| 96 mm | 151 | 12 | 0 |

Every ambiguity is diamond↔triangle; no square/rectangle confusion, no misses at any pitch. These
numbers prove self-classification on the corpus only; they do not predict accuracy on an arbitrary
cutout.

**The standing audit, per entry, at 24/48/96:** its own id stays a candidate · its own class stays
in the result · no wrong decided class · no miss · ambiguity explicit and complete.
*123-of-163 is a baseline, not the acceptance contract.*

---

## 5 · Open — Dan's calls

Quote the ID to rule on one.

**OQ1 · Class source split.** Family from the silhouette while frame and kind come from the
legal-area segments — or everything from the segments? (Erosion at the current size is already
universal eligibility; only this split is open.)

**OQ2 · Class → centring-mode table.** Unfilled by design — the one mapping I will not guess.

**OQ3 · Which catalogue entries ship** as product. 45 shapes / 163 records are a review corpus.

**OQ4 · ~~The studio wire format~~ — reassigned, not a decision yet.** Nobody has read the studio
caller. It is a bounded read task in the plan; `LayoutOffer` stays an internal typed record until
then, and only a genuine product choice found by that read comes back to you.

**OQ5 · Band boundaries** — whether B6 exists (a 264mm axis), and when interior magnets are ever
allowed.

**OQ6 · Control wording** — degrees everywhere, or portrait/landscape stays on the rectangle.

**Settled, removed from this list:** current-size erosion (already universal) · the 96mm arc (a law
in judge, eligibility and repair evidence, not an optional ranker) · solver-to-catalogue wiring
(authorised: *"finish properly wiring and completing the classifier the pipeline and run it"*) ·
the y-flip (a technical defect I fix before whole-catalogue activation (S4), not a sequencing question
for Dan) · engine hole handling (a defect, not a Dan gate: the engine obeys supplied `Contour.holes`
in this refactor and adapters may not erase them; raster hole *extraction* stays parked upstream) ·
the empty-band fallback (layout generates candidates, judge alone decides legality — not inherited
from the walk).

---

## 6 · Not doing, and why

- **Relocating `geometry-truth.ts` / `offset.ts`** — repo-wide, not engine-owned.
- **Relocating `library/`** — 28 gates reference its paths; the move buys nothing.
- **Freezing the studio wire format** before reading its real caller — see OQ4.
- **Pinning active function bodies by hash** — the library's owner-file pin was the end of a
  specific attack; it is not a general structural tool.
- **A full gate suite up front** — the derived-zone matrix lands in S2; the rest follow their
  structure.
- **Characterisation goldens of the current engine** — it never produced correct answers, so its
  output is not a reference. Freezing it would bless the defect (Dan, this session).
- **Any test or audit module that is not the product** — only grid-lab internals that will be used.
