# MOVE MATRIX — every symbol, its owner, and how the move is proved

The execution instrument for S2. One row per top-level symbol in the five engine files and the
worker, from a full read of all six at `3caa09b8`. Nothing here is a plan: it is an inventory of
code that already exists plus the destination each piece is owed.

**Why it exists.** The blueprint names destinations at file level ("compute splits four ways").
That stops the wrong *file* being edited; it does not stop a body landing in the wrong *unit* or
being quietly retyped. 52 symbols needed an owner and the blueprint named about a dozen.

**Move classes.**
`VERBATIM` — the body is byte-identical after the move; only its import lines may change.
`SIGNATURE` — the body is byte-identical, but a parameter is added or removed to satisfy L2
(a unit may not reach into another unit; the pipeline passes the value instead).
`SPLIT` — one symbol's body divides between owners; each part must be traced to its source lines.
`DELETE` — no owner; it goes, with the reason.

**Foundation rule (L1).** A primitive enters `foundation/` only with **two or more UNIT
consumers after the split** — not two file consumers today. Counts below are measured, and a
symbol with one unit consumer lives inside that unit however widely it is imported now.

---

## 1 · `grid-magnet-compute.ts` (562 lines)

| symbol | → owner | class | why |
|---|---|---|---|
| `KEY_QUANTUM_MM` | `units/segment` | VERBATIM | private; only `safeSegments` reads it |
| `BBox` | `types.ts` | VERBATIM | shared vocabulary, 20 consumers repo-wide |
| `bbox` | `foundation` | VERBATIM | segment · classifier · layout · adapters |
| `dist` | `foundation` | VERBATIM | already shared beyond the engine |
| `spotRadiusOf` | `foundation` | VERBATIM | segment · layout · wrap · adapters |
| `fieldSpanMM` | `foundation` | VERBATIM | layout · adapters |
| `axisFrom` | `foundation` | VERBATIM | private to the lattice pair |
| `latticeAt` | `foundation` | VERBATIM | layout · wrap |
| `latticeOver` | `foundation` | VERBATIM | same generator, arbitrary region |
| `EdgeIdx` · `edgeIdxOf` · `segDist2` · `edgeDistMM` · `pointInOuter` | `foundation` | VERBATIM | the indexed edge kernel: seat predicate, press, segment all read it. **This is the primitive the wrap module rebuilt as a brute scan** |
| `makeSeatPredicate` | `foundation` | VERBATIM | layout · wrap · segment |
| `makeCircleSeatPredicate` | `foundation` | VERBATIM | layout (circle preset) · wrap |
| `pressExcessMM` | `units/layout` | VERBATIM | one consumer: the centre-rules parity tie-break |
| `maxPressMM` | **DELETE** | — | sole caller is `bandWalk`, deleted this stage. The rigid gate is re-expressed in judge when judge is authorised — not carried forward as a body |
| `contactPointsMM` | `adapters` | VERBATIM | display only: "drawn so tangency is visible" |
| `SafeMass` · `SafeSegment` | `types.ts` | VERBATIM | segment's output vocabulary, read by centring and adapters |
| `MS_CASES` | `units/segment` | VERBATIM | private marching-squares table |
| `safeSegments` | `units/segment` | VERBATIM | **the unit's whole reason to exist** |
| `centroidOf` | `foundation` | VERBATIM | segment · centring · layout · wrap |
| `pointInMass` | **DELETE** | — | reachable only through `centeringRef`, which goes with voting |
| `splitPerimeter` | `units/layout` | VERBATIM | one consumer: `applyCoverage`, also layout |
| `scaleContour` | `adapters` | VERBATIM | shape normalisation, not engine geometry |

## 2 · `grid-magnet-logic.ts` (208 lines)

| symbol | → owner | class | why |
|---|---|---|---|
| `bandOf` | `foundation` | VERBATIM | a spec lookup; layout and judge both need it |
| `MagnetPlan` · `MagnetDia` · `Anchor` | `types.ts` | VERBATIM | shared vocabulary |
| `VotingOrder` · `ORDERS` · `registrationScore` | **DELETE** | — | the scoring layer Dan removed; superseded, recoverable from history |
| `CentreMode` · `Governor` | `types.ts` | VERBATIM | shared vocabulary |
| `governMass` | `units/centring` | VERBATIM | centring's governor switch |
| `centeringAnchors` | `units/centring` | VERBATIM | the six modes |
| `centeringRef` | **DELETE** | — | voting-only; its rule is re-expressed by the bake |
| `AnchorBake` | `types.ts` | VERBATIM | crosses centring → pipeline → adapters |
| `anchorBakeOf` | `units/centring` | VERBATIM | the bake |
| `anchorFromBake` | `units/centring` | VERBATIM | the governed anchor at a size |
| `applyCoverage` | `units/layout` | VERBATIM | **it changes the population — layout, never judge** |
| `assignSizes` | `adapters` | VERBATIM | it shapes output; it decides nothing |

## 3 · `grid-magnet-class.ts` (144 lines)

| symbol | → owner | class | why |
|---|---|---|---|
| `AxisClass` · `FrameKind` · `ShapeClass` | `types.ts` | VERBATIM | the classifier's output vocabulary |
| `axisClassOf` | `units/classifier` | VERBATIM | 1 consumer — stays inside its unit (kernel rule) |
| `areaOf` | `units/classifier` | VERBATIM | private shoelace |
| `classifyShape` | `units/classifier` | VERBATIM | the axis pair |
| `classFloorMM` | `units/classifier` | VERBATIM | 1 consumer |
| `frameNodes` | `units/classifier` | VERBATIM | 1 consumer |
| `classFrameNodes` | `units/classifier` | VERBATIM | the class frame per band |
| `ShapeFamily` · `shapeFamilyOf` | **DELETE (S4, not S2)** | — | the hardcoded three-family enum with `fill < 0.68`, the `0.08` corner inset and `minor <= 2` — invented numbers, no ruling. It dies when the catalogue answers instead. **Two live callers (worker, catalogue matcher) must be re-pointed first**, so it is the one deletion this matrix defers past S2 |

## 4 · `grid-magnet.ts` (337 lines) — the old door

| symbol | → owner | class | why |
|---|---|---|---|
| `GridConfig` · `GridResult` | `types.ts` | VERBATIM | the engine's request/response vocabulary |
| `QUANTUM_KEY_MM` · `mod` | `units/layout` | VERBATIM | private to registration |
| `computeGrid` | **SPLIT** | SPLIT | forced-phase branch (lines 146–156) and centre-rules branch (157–187) → `units/layout` verbatim; the voting branch (188–249) → DELETE; the tail (250–268: coverage, sizes, result assembly) → `adapters`. **Every part traced to its source lines and byte-compared** |
| `BandSnapPoint` | **DELETE** | — | the walk's own type |
| `snapRange` | **DELETE** | — | private to `bandWalk` |
| `bandWalk` | **DELETE** | — | replaced by layout's generic candidate generation |
| `fitSizeInBand` | **DELETE** | — | replaced by the same. **Deleted only once the replacement is live on the bench**, never before |

## 5 · `grid-magnet-wrap-compute.ts` (356 lines)

| symbol | → owner | class | why |
|---|---|---|---|
| `S` · `WrapConfig` · `WrapAt` | `types.ts` | VERBATIM | wrap's vocabulary |
| `box` | **DELETE** | — | duplicate of `bbox` (L1) |
| `inside` | **DELETE** | — | duplicate of `pointInOuter` (L1) |
| `nearestDist` | **DELETE** | — | duplicate of `edgeDistMM` — **and a brute scan where the original is bucketed and indexed.** The measured cost of the duplication |
| `seatRegion` | `units/wrap` | VERBATIM | Clipper deflate |
| `validOrigins` | `units/wrap` | VERBATIM | Clipper intersect of translated regions |
| `governedCentre` | `units/centring` | VERBATIM | it *is* centring; wrap must not own it |
| `pickOrigin` | `units/wrap` | VERBATIM | nearest lawful origin to a target |
| `wrapGroup` | `units/wrap` | **SIGNATURE** | body byte-identical; `cfg.anchorAtMM`/`governedCentre` replaced by a **required anchor parameter**. L2: wrap may not call centring — the pipeline hands it the centre. The single most load-bearing change in the matrix |
| `wrapGrid` | `adapters` | VERBATIM | builds a `GridResult` — a render payload |
| `BandRung` | `types.ts` | VERBATIM | offer vocabulary |
| `wrapBandLadder` | **SPLIT** | SPLIT | the scan/dedupe/compose loop → `pipeline` (it is sequence); **band membership** — "a layout whose contact size falls outside the band is not offered here" → `units/judge` (it is a rule) |

## 6 · `solve.worker.ts` (226 lines)

| symbol | → owner | class | why |
|---|---|---|---|
| `SolveRequest` | `types.ts` | VERBATIM | becomes the pipeline's public input |
| `shapeSig` · `walkCaches` · `walkFits` · `rungCache` · `bakeCache` · `sizeCacheOf` | `adapters` | VERBATIM | transport and cache — the worker's only remaining job |
| `bakeOf` | **SPLIT** | SPLIT | the step-1 composition (segment → bake → class) → `pipeline`; the cache wrapper → `adapters` |
| `anchorFnFor` | `pipeline` | VERBATIM | step 2 composition |
| `bandFit` | **DELETE** | — | wrapper over `fitSizeInBand` |
| `schedulePrefetch` + `WALK_CAP`/`FITS_CAP`/`gen` | **DELETE** | — | the brief rejects "worker prefetch that computes work the current request did not ask for" |
| `onmessage` — rule-4 landing (lines 178–190) | `units/judge` | VERBATIM | "prefer the tight solution closest to the centroid" is a rule |
| `onmessage` — `recog` assembly | `adapters` | VERBATIM | view model |
| `onmessage` — the three branches | `pipeline` | SPLIT | they become the one search envelope |

---

## 7 · Totals

| | count |
|---|---|
| VERBATIM | 44 |
| SIGNATURE | 1 |
| SPLIT | 4 |
| DELETE | 16 |

Four destinations carry no symbol at all until S3: `pipeline` receives its first bodies from
`wrapBandLadder` and the worker, which is the point at which the engine becomes callable.

---

## 8 · How each move is proved

Per class, mechanically, in the commit that performs it:

- **VERBATIM** — extract the body from both revisions, strip import lines, compare bytes. A
  difference fails the move. This is L6 made checkable rather than promised.
- **SIGNATURE** — the same byte comparison over the body with the parameter list excluded, plus a
  named test that the caller now supplies what the body previously fetched for itself.
- **SPLIT** — every destination cites the source line range it took, and the concatenation of the
  parts byte-equals the original body minus any range explicitly marked DELETE.
- **DELETE** — a re-export-aware trace showing zero production consumers at the moment of
  deletion. `fitSizeInBand`, `bandWalk` and `shapeFamilyOf` may not be deleted until their
  replacements are live on the bench.

And two standing gates over the result: **no unit imports another unit**, and **nothing in
`foundation/` has fewer than two unit consumers**. Both are derived from the filesystem, not
hand-listed — the failure mode of the gate this replaces.

## 9 · What this matrix does not do

It assigns owners. It does not authorise the deferred stages, does not settle OQ1, and adds no
behaviour. The only behaviour changes in S2 remain the four already authorised: hole
preservation, the common fallback path, the y-flip and classifier corrections, and the
shell-to-adapter seam.
