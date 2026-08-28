# GRID LAB — ENGINE ARCHITECTURE

> **Status: target structure + refactor scope. Not yet true of the code.** It lands in
> `src/lib/effect/` with its gates as step 1 of the refactor, the way the library's law did.
> The library's own law (`library/shape-layout-lib-architecture.md`) stays authoritative inside
> the library and is not restated here.
>
> **Why this exists.** The engine is going headless into the studio backend to define sizes and
> manufacturing layouts. That makes it an exportable unit, not a page's helper: no browser, no
> React, no route, no cross-dependencies. Today the code is portable but the **pipeline has no
> home** — its assembly lives in a browser Worker, which is why the catalogue-vs-solver oracle had
> to rebuild the composition by hand before it could test it.

---

## 1 · The five laws

**L1 · Shared foundation is used, never rebuilt.** Spec, types and kernel are components every
unit consumes. A unit that re-implements a primitive is a defect, not a style choice. Evidence
this is real: the y-flip was written three times and the size maths three times, and they
disagreed on screen (a 120×120 label on a 135×135 shape).

**L2 · A unit never imports another unit.** If wrap needs the centre, the **pipeline** hands it
the centre. This is the rule that keeps the export free of cross-dependencies, and it is checked
on the AST.

**L3 · The pipeline holds sequence, never rules.** It names the steps, passes the data, caches
and stops. A threshold, a measurement or a ranking inside it means logic has leaked in disguise.
Evidence: on 08-25 six rulings were bolted one at a time into the offer stack until their
*interactions* were the bug factory — rules and sequence sharing a home.

**L4 · One home per fact.** Every physical constant lives in spec; every derived fact has exactly
one producer. The 12mm padding is built into the magnet, so it is stated once and consumed
everywhere.

**L5 · The shell renders.** Page and panel hold React state and draw. They reach the engine only
through adapters. No solver call, no geometry, no policy.

**The kernel test (what stops the bucket re-forming):** a primitive belongs in the kernel only
when **two or more units consume it**. One consumer means it moves into that unit. Without this
rule, "kernel" becomes the new "compute" — the generic bucket the prefilter once hid inside.

---

## 2 · The tree

Status per node: **KEEP** already true · **SPLIT** one file becomes several · **MOVE** relocates ·
**NEW** does not exist · **DELETE** goes.

```
src/lib/effect/
├── spec/                                   values only — no logic, no geometry
│   └── grid-magnet-spec.ts                 KEEP (80)   pitch, padding, bands, modes
│
├── types/                                  the vocabulary — type-only, no runtime
│   ├── types.ts                            KEEP (76)   Contour, Pt, GridResult…
│   └── layout-offer.ts                     NEW         THE OUTPUT CONTRACT (§4)
│
├── kernel/                                 primitives with ≥2 unit consumers
│   ├── geometry.ts                         SPLIT ← grid-magnet-compute.ts
│   │                                       bbox, area, centroid, point-in-polygon
│   ├── lattice.ts                          SPLIT ← grid-magnet-compute.ts + grid-magnet.ts
│   │                                       lattice generation, seat predicate, registration
│   ├── erosion.ts                          SPLIT ← grid-magnet-compute.ts
│   │                                       12mm erode → legal area (the safe-area primitive)
│   ├── offset.ts                           KEEP (56)   Clipper wrapper, join modes
│   └── tolerance.ts                        MOVE ← geometry-truth.ts (106)
│
├── units/                                  self-sufficient. NEVER import each other (L2)
│   ├── segment/                            NEW folder ← grid-magnet-compute.ts
│   │                                       safeSegments: islands, masses, deep points, seg box
│   ├── classifier/                         SPLIT ← grid-magnet-class.ts (144) + the adapter
│   │   ├── measure.ts                      axis pair, kind, frame, fill  (classifyShape)
│   │   ├── match.ts                        NEW  answer FROM THE CATALOGUE — no hardcoded family
│   │   ├── trace.ts                        NEW  why it decided: candidates, discriminator, margin
│   │   └── audit.ts                        NEW  every record classifies to itself; ambiguity
│   │                                            reported, never silently resolved
│   ├── centring/                           SPLIT ← grid-magnet-logic.ts (208)
│   │                                       anchor bake, six modes, governors, scale-free centre
│   ├── wrap/                               SPLIT ← grid-magnet-wrap-compute.ts (684)
│   │                                       seat region → valid origins → bisect. Clipper-exact.
│   ├── judge/                              NEW ← extracted from wrapBandLadder
│   │                                       96mm perimeter law, 1–2 exception, coverage
│   │                                       dominance, class match, landing order
│   └── library/                            KEEP IN PLACE (30 files, its own law + 28 gates)
│                                           the catalogue: 163 records, the certified set
│
├── pipeline/                               THE ORCHESTRATOR — sequence only (L3)
│   ├── pipeline.ts                         NEW  the five steps, in order, by name
│   └── cache.ts                            NEW ← the bake/walk caches now in solve.worker.ts
│
├── adapters/                               conversion and transport only
│   ├── ui-bridge.ts                        MOVE ← grid-magnet-bridge.ts (112)
│   ├── library-bridge.ts                   MOVE ← grid-magnet-library-bridge.ts (42)
│   └── worker-dispatch.ts                  NEW  what solve.worker.ts shrinks to
│
└── (deleted)
    ├── grid-magnet.ts                      DELETE (349)  voting-era door: computeGrid,
    │                                       bandSnapPoints, fitSizeInBand — the band walk,
    │                                       the rigid gate, the max-count landing
    └── grid-magnet-logic.ts                SPLIT then DELETE: centring → units/centring,
                                            applyCoverage/assignSizes → units/judge

src/app/(dev)/effect-creator/
├── grid-centre/                            THE BENCH — admin UI, shell only
│   ├── page.tsx                            KEEP (1147) render + state; already imports only
│   │                                       bridge/spec — verified, not a violation
│   ├── LibraryPanel.tsx                    KEEP (100)
│   └── solve.worker.ts                     SHRINK (226 → ~40) dispatch only; its pipeline
│                                           assembly (bakeOf, anchorFnFor, recog) moves out
├── grid-magnet/                            DELETE — the voting reference
└── grid-wrap/                              DELETE — the superseded count-first bench
```

---

## 3 · What each unit owns — and what it must never hold

| unit | owns | must never hold |
|---|---|---|
| **segment** | erosion → legal area, islands, masses, deep points, segment box | any notion of class, centre or layout |
| **classifier** | what the shape IS, answered from the catalogue, with a trace and a standing audit | a hardcoded family list; an invented threshold; a placement decision |
| **centring** | the anchor: six modes, governors, measured once per shape and scaled | geometry it could take from the kernel; any judgement of a layout |
| **wrap** | the exact contact size for a fixed magnet set — deflate, intersect, bisect | which layout to try; which offer wins; building a render result |
| **judge** | the 96mm law, the 1–2 exception, coverage dominance, class match, landing | geometry; the order it is called in |
| **library** | the catalogue of buildable layouts + the certified set | anything about a specific customer shape |

---

## 4 · The output contract (NEW — the reason this is exportable)

The studio backend does not want a `GridResult` — that is the voting era's render payload. It
wants the offer list. One frozen record per lawful layout, the way `CatalogueEntry` is frozen:

```
LayoutOffer {
  shapeClass        what the classifier decided, and whether it was decided or ambiguous
  catalogueId       the entry this layout came from — traceable to the library
  nodesMM[]         magnet centres, millimetres
  sizeMM            the exact wrapped size
  centreOffMM       how far the group sits from the shape centre, and why
  pinnedRunsMM      the perimeter evidence the 96mm law judged
  verdict           lawful / repaired / rejected + the reason
}
```

Frozen by gates and an identity manifest, exactly as the catalogue is. Changing its shape is a
ruling, not a refactor.

---

## 5 · Refactor scope

| # | move | size | why |
|---|---|---|---|
| 1 | **Delete the two old benches** (`grid-magnet/`, `grid-wrap/` routes) | −2 routes | removes the only consumers of `wrap()`, `wrapFlap`, `unheldOf` — the 684-line file shrinks by subtraction *before* it is split |
| 2 | Split `grid-magnet-wrap-compute.ts` | 684 → wrap unit + judge unit + adapter | it holds three roles today: Clipper geometry, the band ladder's judgement, and `wrapGrid` building a GridResult |
| 3 | Split `grid-magnet-compute.ts` | 562 → kernel/geometry + kernel/lattice + kernel/erosion + units/segment | the generic bucket, unpicked by consumer count |
| 4 | Split `grid-magnet-logic.ts` | 208 → units/centring + units/judge | centring is a unit; `applyCoverage`/`assignSizes` are judgement |
| 5 | Complete `units/classifier` | 144 + new | answer from the catalogue, trace, audit (§6) |
| 6 | Write `pipeline/pipeline.ts` | NEW | the five steps; the worker drops to dispatch |
| 7 | Delete `grid-magnet.ts` | −349 | the voting-era door dies with the benches |
| 8 | The law + its AST gates | NEW | L1–L5 machine-checked, same machinery as the library's |

**Order matters: 1 first.** Deletion before construction — subtraction is the cheapest part of
this and it makes every later split smaller.

---

## 6 · The part we finish now — classifier + pipeline, and run it

1. **Classifier answers from the catalogue.** Delete the hardcoded three-family enum and its
   invented numbers (`fill < 0.68`, a `0.08` corner inset, `minor <= 2`). The class of the
   matching catalogue entries **is** the answer. Add a shape to the library and it is in the
   candidate set with no classifier edit.
2. **Discrimination without invented thresholds.** Exact facts filter (the axis pair both sides
   carry). Continuous facts (fill, then aspect) *order* the survivors — they never cut, so no
   number is invented. Decided = the survivors tied at the top share one class. Otherwise the
   verdict says **ambiguous** and names them.
3. **The trace.** Candidates considered, what discriminated, the margin — on the admin surface,
   not in a log.
4. **The standing audit.** Every catalogue record must classify to its own class; ambiguity is
   reported, never resolved quietly. This is what catches the 4-of-38 rectangle records currently
   reporting a square's axis pair.
5. **The pipeline module**, calling: segment → classifier → centring → library → wrap → judge.
6. **Run it** on the whole catalogue at all three pitches and on the real cutouts, and report the
   measured decided/ambiguous/missed counts — not a claim.

**Baseline to beat, measured 08-28:** answering from the catalogue decides **123 of 163** uniquely
and correctly with **zero misses**, where the hardcoded family can never separate square from
rectangle or diamond from triangle. The 40 ambiguous are the ones the coarse key leaves tied.

---

## 7 · Gates — each law, machine-checked

| law | gate |
|---|---|
| L1 foundation not rebuilt | AST: forbidden duplicate producers; a fact has one exported implementation |
| L2 unit never imports unit | AST import matrix over `units/**` — any unit→unit edge fails |
| L3 pipeline holds no rules | AST: no numeric literals beyond indices, no comparison operators against constants in `pipeline/**` |
| L4 one home per fact | literal scan: released spec values never restated |
| L5 shell renders | import scan: page/panel reach only `adapters/**`; no React/DOM below the shell |
| kernel discipline | consumer count: a kernel export with one consumer fails |
| output contract | frozen shape + identity manifest, as the catalogue's is |

Gates derive their file sets **from the zone map, never a hand-list** — the hand-listed version is
what let six sabotage mutations survive on 08-27.

---

## 8 · Open — Dan's calls

1. **Delete the two old benches?** Recoverable from history. Confirmed in principle; naming it
   here as the first commit.
2. **Step-1 physics:** the legal area is measured at the current size (the 12mm rim is physical
   and does not scale); only the outline's identity is scale-free — confirm.
3. **The classifier's source:** class read from the segments, with the catalogue supplying the
   answer — confirm.
4. Whether `LayoutOffer` is the right shape for what the studio backend actually needs.
