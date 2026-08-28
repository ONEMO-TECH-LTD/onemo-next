# MAGNETIC GRID ENGINE — ARCHITECTURE AND REFACTOR PLAN

**Scope.** The v3.5.6 cluster: `src/lib/effect/grid-magnet*`, `src/lib/effect/library/`, and the
`grid-centre` bench. **Out of scope, retained:** the Session 59 engine (`src/lib/effect/grid.ts`,
`grid-core.ts`, the `grid-lab` route) — a separate public door. Naming both "Grid Lab" is how the
studio integrates the wrong one.

Target structure and the staged plan to reach it. Not yet true of the code. Written after a full
read of the engine, then revised against an independent architecture review (findings F1–F10, all
reproduced at source before acceptance).

**Goal.** The engine exports headless into the studio backend to define sizes and manufacturing
layouts. One callable pipeline, no browser, no cross-dependencies, UI a shell.

---

## 1 · Laws

1. **Shared foundation is used, never rebuilt.** A unit that re-implements a primitive is a defect.
2. **A unit never imports another unit.** The pipeline passes outputs between them.
3. **The pipeline holds sequence, never rules.** No threshold, no measurement, no ranking in it.
4. **One home per fact.** Physical constants in spec; each derived fact has one producer.
5. **The shell renders.** Page and panel reach the engine only through adapters.

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

  RETIRED AT CUTOVER (stage 5, not before)
    grid-magnet.ts         the door: centre-rules body → units/layout, voting branch deleted
    grid-magnet-compute.ts split: primitives → foundation, safeSegments → units/segment
    grid-magnet-logic.ts   split: centring → units/centring, applyCoverage → units/layout,
                           assignSizes → adapters (it shapes output, it does not judge)

src/app/(dev)/effect-creator/
  grid-centre/             THE BENCH — shell
    page.tsx               KEEP; loses its direct engine imports at stage 3
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
`normGeneratedRing` all return `holes: []`, and the seat predicate takes only the outer ring. The
brief requires every supplied boundary to stay material; the ledger parked it as blocked upstream
(the tracer emits one ring). Named here as a real gap — see unknown 4.

**The separation gate cannot see the live bench.** Proven by my own mutation: a raw
`grid-magnet-compute` import injected into `grid-centre/page.tsx` leaves it **12/12 green**, because
the test reads the obsolete `grid-magnet/page.tsx` and five hand-listed files.

**Consumers checked:**

- `bandSnapPoints` — **zero consumers.** Dead export.
- `fitSizeInBand` / `bandWalk` / `maxPressMM` — **LIVE.** `grid-centre/solve.worker.ts` calls them
  through `bandFit` for the empty-band fallback and the non-positioning path. Not deletable yet.
- voting scorer + weights, `centeringRef`, `pointInMass` — reachable only via `positioning !== 1`.
- `wrap()`, `wrapFlap`, `unheldOf` — only the two benches being deleted.
- **Survive:** `pressExcessMM` (centre-rules tie-break), `makeCircleSeatPredicate` (circle preset),
  `splitPerimeter` (feeds `applyCoverage`).

**Already clean:** no React/Next/DOM in `lib/effect` or the library; nothing in `lib/` imports
`app/`; the library's 30 files are under their own law with 28 gates.

---

## 4 · Plan

**Stage 1 · Characterise, then delete only what is provably dead.**
Freeze current live results first: four classes, every band, manual phase and size, the empty-band
fallback. Then delete the `grid-magnet/` and `grid-wrap/` routes, re-run a re-export-aware consumer
trace, and delete only symbols whose last production caller went with them — the voting scorer and
its weights, `centeringRef`, the `wrap`/`wrapFlap`/`unheldOf` chain, `bandSnapPoints`.
**Keep `fitSizeInBand`, `bandWalk`, `maxPressMM`** until the pipeline replaces their live behaviour.
No behaviour change inside a structural deletion.
*Done when:* the frozen results reproduce exactly.

**Stage 2 · Move bodies to owners.** Foundation, segment, centring, layout, wrap, judge — existing
bodies moved, not rewritten. `applyCoverage` → layout (it changes the population). `assignSizes` →
adapters (it shapes output). The wrap module drops its six rebuilt primitives and its false header.
Land the derived-zone import matrix in the same commit.
*Done when:* the frozen results still reproduce, and a unit→unit import fails the suite.

**Stage 3 · One pipeline, one shell seam.** One serialisable call whose search envelope —
`manual | band | automatic` — changes *candidate enumeration only*; segment, class, centre, layout,
wrap and judge are the same calls in every mode. The worker becomes transport and cache. The shell
gets an adapter surface (`createGridRequest`, `gridViewModel`, `libraryViewModel`) and loses its
direct engine imports.
*Done when:* the pipeline runs from a Node test with no worker, the oracle calls it instead of
rebuilding the composition, and the mutation proof runs against the **real** page and worker.

**Stage 4 · Complete the product logic.** Catalogue-backed classifier (below), the generic layout
fallback for shapes the catalogue does not enumerate, the y-flip repair, the 96mm arc as judge
evidence, the decision trace and the standing audit.

**Stage 5 · Cut over and delete.** Once every production caller has moved: delete `grid-magnet.ts`,
the generic compute/logic buckets and the obsolete bridge exports. Run the whole catalogue at
24/48/96, real cutouts, every centre mode, every band, manual, then verify the live surface.

### The classifier method

Exact ruled facts filter — the axis pair both sides carry. Then remove only candidates **dominated
on every continuous fact** (fill *and* aspect): a Pareto frontier, not a priority order. One
surviving class → decided; several → **ambiguous, every tied class named in the trace**.

*Why not "fill, then aspect":* a lexicographic order is a ranking policy I would be inventing, and
it was never ruled. Honest cost: a frontier leaves more candidates standing than an invented
priority would, so expect more ambiguity — which the audit is there to show rather than hide.

**The standing audit, per entry, at 24/48/96:** its own id stays a candidate · its own class stays
in the result · no wrong decided class · no miss · ambiguity explicit and complete.
*123-of-163 is a baseline, not the acceptance contract.*

---

## 5 · Open — Dan's calls

1. **Class source split.** Family from the silhouette while frame/kind come from the legal-area
   segments — or everything from the segments? (Erosion at the current size is already universal
   eligibility; only this split is open.)
2. **Class → centring-mode table.** Unfilled by design.
3. **Which catalogue entries ship** as product. 45 shapes / 163 records are a review corpus.
4. **Holes.** The brief requires them as material boundaries; the ledger parked them as blocked at
   the tracer. In scope now, or still parked?
5. **The studio wire format.** `LayoutOffer` stays an internal typed record until the studio caller
   is read — id/source, class result, nodesMM, size, centre deviation, coverage evidence, verdict.
6. Band boundaries / whether B6 exists / when interior magnets are ever allowed / control wording.

**Settled, removed from this list:** current-size erosion (already universal) · the 96mm arc (a law
in judge, eligibility and repair evidence, not an optional ranker) · solver-to-catalogue wiring
(authorised: *"finish properly wiring and completing the classifier the pipeline and run it"*) ·
the y-flip (a technical defect I fix before whole-catalogue activation, not a sequencing question
for Dan) · the empty-band fallback (preserved until a product ruling changes it).

---

## 6 · Not doing, and why

- **Relocating `geometry-truth.ts` / `offset.ts`** — repo-wide, not engine-owned.
- **Relocating `library/`** — 28 gates reference its paths; the move buys nothing.
- **Freezing the studio wire format** — see open 5.
- **Pinning active function bodies by hash** — the library's owner-file pin was the end of a
  specific attack; it is not a general structural tool.
- **A full gate suite up front** — the derived-zone matrix lands in stage 2; the rest follow their
  structure.
