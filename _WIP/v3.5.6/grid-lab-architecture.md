# GRID LAB — ENGINE ARCHITECTURE AND REFACTOR PLAN

Target structure and the staged plan to reach it. Not yet true of the code.
Written after a full read of the engine: spec, types, compute, logic, the door, the bridges, the
wrap module, the classifier, the library (30 files), the worker and the page.

**Goal.** The engine exports headless into the studio backend to define sizes and manufacturing
layouts. So: one callable pipeline, no browser, no cross-dependencies, UI a shell.

---

## 1 · Laws

1. **Shared foundation is used, never rebuilt.** Spec, types and kernel are components. A unit that
   re-implements a primitive is a defect. *Gate: duplicate-producer scan.*
2. **A unit never imports another unit.** If wrap needs the centre, the pipeline hands it over.
   *Gate: AST import matrix over `units/**` — the first gate to build.*
3. **The pipeline holds sequence, never rules.** No threshold, no measurement, no ranking in it.
   *Gate: not yet — after the module exists.*
4. **One home per fact.** Physical constants in spec; each derived fact has one producer.
   *Gate: exists (literal scan, library law).*
5. **The shell renders.** Page and panel reach the engine only through adapters.
   *Gate: exists for the library; extend to the engine.*

**Kernel rule:** a primitive belongs in the kernel only when **two or more units** use it. One
consumer means it moves into that unit. Without this, "kernel" becomes the next "compute".

---

## 2 · Target tree

Files stay where they are unless marked. New folders only where new units are born.

```
src/lib/effect/
  grid-magnet-spec.ts        KEEP   values only (80 lines, already clean)
  types.ts                   KEEP   vocabulary
  kernel/                    NEW    primitives with ≥2 unit consumers
    geometry.ts              ← bbox, area, centroid, point-in-polygon, nearest-edge
    lattice.ts               ← latticeAt/latticeOver, seat predicate
    erosion.ts               ← the 12mm legal-area primitive
    offset.ts                KEEP in place (Clipper wrapper)
  units/                     NEW    self-sufficient; NEVER import each other
    segment/                 ← safeSegments (islands, masses, segment box)
    classifier/              ← grid-magnet-class.ts + the catalogue matcher, completed
    centring/                ← anchor bake, six modes, governors
    wrap/                    ← the Clipper solve only
    judge/                   ← band membership, landing, the 96mm law when it lands
  library/                   KEEP IN PLACE — its own law + 28 gates; registered as a unit
  pipeline/                  NEW    the five steps in order; no rules
  adapters/                  NEW    ui-bridge, library-bridge, worker dispatch, catalogue adapter

  DELETED
    grid-magnet.ts           the voting-era door (349) — computeGrid's centre-rules branch moves
                             to units/wrap; the voting branch and the band walk die
    grid-magnet-logic.ts     split: centring → units/centring, coverage/plan → units/judge

src/app/(dev)/effect-creator/
  grid-centre/               THE BENCH — shell
    page.tsx                 KEEP (1147) render + state; only sanctioned imports — verified clean
    LibraryPanel.tsx         KEEP
    solve.worker.ts          SHRINK 226 → ~40: dispatch only
  grid-magnet/               DELETE — voting reference
  grid-wrap/                 DELETE — superseded count-first bench
```

---

## 3 · What the read found

**The pipeline is assembled in the worker.** `bakeOf` (step 1), `anchorFnFor` (step 2),
`wrapBandLadder` (steps 3–4), the rule-4 landing (step 5) — all in `solve.worker.ts`. No module in
`lib/` composes them. The catalogue-vs-solver oracle had to rebuild the composition by hand.

**Step 3 does not exist.** The layout comes from `computeGrid`'s centre-rules reveal, not from the
library. `catalogueCandidates` has no caller.

**The wrap module's header is false.** It says *"deliberately disconnected… no centring modes, no
governing mass, no safe-area islands, no voting, no coverage"* — it imports `computeGrid`,
`safeSegments`, `centeringAnchors`, `governMass`, `applyCoverage`.

**Foundation rebuilt inside the wrap module** (law 1 violations, measured):

| in `grid-magnet-wrap-compute.ts` | already exists in |
|---|---|
| `box()` | `bbox()` — compute |
| `inside()` | `pointInOuter` — compute (private) |
| `nearestDist()` | `edgeDistMM` — compute (private, **indexed**; the copy is a brute scan) |
| `areaOfRing()` | shoelace in `centroidOf` / `areaOf` |
| `heldAt`, `anchorAt`, `midOf` | written twice — in `wrap` and in `wrapGroup` |
| `mod()` | defined again inside `wrapGrid` |

**Dead or dying, with consumers checked:**

- `bandSnapPoints` — **zero consumers today.** Dead export.
- `registrationScore` + `ORDERS` + `SEAT_WEIGHT`/`FLAP_WEIGHT`/`BALANCE_WEIGHT`/`VOTING_ORDER`,
  `centeringRef`, `pointInMass` — reachable only when `positioning !== 1`, i.e. the voting route.
- `maxPressMM` — only the band walk's rigid gate. Dies with the walk.
- `wrap()`, `wrapFlap`, `unheldOf` — only the two benches being deleted.
- **Survives, do not cut:** `pressExcessMM` (the centre-rules parity tie-break is live),
  `makeCircleSeatPredicate` (the circle preset), `splitPerimeter` (feeds `applyCoverage`).

**Already clean, leave alone:** no React/Next/DOM anywhere in `lib/effect` or the library; nothing
in `lib/` imports `app/`; the page's maths is all view maths and its engine imports are the
sanctioned ones only — the door for constants and types, spec, the two bridges, the library barrel;
the library's 30 files are under their own law with 28 gates.

---

## 4 · Plan

Deletion first — it shrinks everything after it.

**Stage 1 · Delete.** The two benches (`grid-magnet/`, `grid-wrap/` routes), then what loses its
last consumer: `wrap()`, `wrapFlap`, `unheldOf`, the voting scorer and its weights, `centeringRef`,
the band walk (`bandWalk`, `fitSizeInBand`, `bandSnapPoints`, `maxPressMM`).
*Done when:* the bench solves identically on all four classes and every band, tests green.

> **Consequence to decide before this lands.** The band walk is also the bench's **fallback**: when
> a band reveals no layout that wraps inside it, the worker falls back to `fitSizeInBand` and shows
> *"nothing fully fits in this band — best seated shown"*. Delete the walk and that path goes with
> it — the band would honestly offer nothing instead. Keep the fallback, or drop it? (unknown 8)

**Stage 2 · Stop rebuilding the foundation.** The wrap module uses compute's primitives instead of
its own copies; `heldAt`/`anchorAt`/`midOf` written once. Correct the false header.
*Done when:* the six duplicates above are gone and the wrap answers are unchanged, size for size.

**Stage 3 · Split what's left of wrap.** `units/wrap` (the Clipper solve), `units/judge` (band
membership + landing), `adapters/` (`wrapGrid`).
*Done when:* each file has one job and the bench is byte-identical on screen.

**Stage 4 · The pipeline module.** `bakeOf`, `anchorFnFor`, the ladder call and the landing move out
of the worker into `pipeline/`. The worker becomes dispatch.
*Done when:* the pipeline is callable from a Node test with no worker, and the oracle uses it
instead of hand-rebuilding the composition.

**Stage 5 · Complete the classifier.** Delete the hardcoded family (`fill < 0.68`, the `0.08` corner
inset, `minor <= 2`); the matching catalogue entry's class is the answer. Exact facts (the axis
pair) filter; continuous facts (fill, then aspect) order — so no threshold is invented. Ties are
reported as ambiguous, never resolved silently. Add the decision trace and the standing audit
(every record classifies to its own class).
*Done when:* measured over all 163 records at 24/48/96 and the real cutouts, reported as
decided / ambiguous / missed. Baseline to beat: **123 of 163 decided, 0 missed.**

**Stage 6 · Law and gates.** Land the law with **one** gate — unit-never-imports-unit. The rest as
their structure appears.
*Done when:* a probe file importing one unit from another fails the suite.

---

## 5 · Open unknowns

Each is separately answerable; none blocks stage 1.

1. **Legal area at size.** The 12mm rim is physical and does not scale, so the legal area genuinely
   differs at each size while the outline's identity is scale-free. Confirm the split.
2. **Classifier source.** Class read from the segments, with the catalogue supplying the answer —
   or family from the silhouette and frame/kind from the segments?
3. **The output contract.** What the studio backend needs from a layout (magnets, size, class,
   evidence?) is unknown, so the pipeline returns a typed result and freezing it waits.
4. **The 96mm perimeter law.** Ruled, never built. It belongs in `units/judge` — but whether it
   filters offers or only orders them is unsettled.
5. **Which catalogue entries ship** as product. 45 shapes / 163 records are a review corpus.
6. **Solver → catalogue wiring.** Stage 5 makes the classifier answer from the catalogue; the
   solver taking its candidates from it is a separate authorisation.
7. **The y-flip defect** — 68 records / 204 pitch-cases where the engine registers a flipped view
   wrongly. Fix before or after stage 6?
8. **The empty-band fallback.** Keep "best seated shown" when a band reveals nothing, or let the
   band offer nothing? Deleting the walk removes it either way — this decides whether it is
   rebuilt small inside `units/judge`.

---

## 6 · Not doing, and why

- **Moving spec/types into folders** — churn with no gain; they are already single-purpose.
- **Moving `geometry-truth.ts`** — shared with the whole app, not engine-owned.
- **Relocating `library/`** — 28 gates reference its paths; the move buys nothing.
- **A full gate suite up front** — gates for structure that does not exist yet are theatre. One
  now, the rest when their structure lands.
- **Freezing the output contract now** — see unknown 3.
