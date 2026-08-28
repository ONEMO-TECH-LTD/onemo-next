# MOVE MATRIX — every declaration, its owner, and how the move is proved

The execution instrument for S2. Built from a full read of the six source files at `3caa09b8`,
then reworked against an independent AST audit (F1–F8) — every falsifiable claim in it reproduced
at source before acceptance.

**Inventory basis.** TypeScript-AST enumeration at `3caa09b8` finds **95 top-level declarations
and assignments**: compute 28 · logic 17 · class 11 · door 9 · wrap 14 · worker 16. A composite
declaration may have several ownership fragments below, but **fragments are never counted as
additional source symbols.** The verifier derives this inventory from the six files and requires
every declaration to be covered exactly once; fragment coverage is a separate ledger. No
hand-maintained totals appear here — the first version carried some and they were wrong.

**Why it exists.** The blueprint named destinations at file level. That stops the wrong *file*
being edited; it does not stop a body landing in the wrong *unit*, being quietly retyped, or — as
the audit proved — a **live** symbol being deleted while a **dead** one is carried forward.

## Move classes

`VERBATIM` — identical after the move; only export modifiers and import paths may change.
`AMEND` — moves with **one exact S2-authorised behaviour delta named in its row**. Every
unaffected AST subtree must compare equal; only the named change is permitted. Not a general
rewrite class.
`SPLIT` — the body divides between owners; destinations cite AST statement spans that together
cover the original exactly once, minus spans marked DELETE.
`DELETE` — no owner, with the reason and any replacement prerequisite.

**Foundation rule (L1).** A primitive enters `foundation/` only with **two or more consuming UNIT
packages in the landed import graph** — not files, not adapters, not re-exports, not intentions.
Where the audit found one, the symbol moves into that unit instead.

---

## 1 · `grid-magnet-compute.ts` (28 declarations)

| symbol | → owner | class | why |
|---|---|---|---|
| `KEY_QUANTUM_MM` | `units/segment` | VERBATIM | private; only `safeSegments` reads it |
| `BBox` | `types.ts` | VERBATIM | shared vocabulary |
| `bbox` | `foundation` | VERBATIM | segment · classifier · layout |
| `dist` | **DELETE** | — | **zero production importers.** My earlier count matched the substring inside `paper/dist/` and `.../dist/index.js` paths — path fragments, not consumers |
| `spotRadiusOf` | `foundation` | VERBATIM | segment · layout · wrap |
| `fieldSpanMM` | `adapters` | VERBATIM | once `snapRange` dies its only consumer is the bridge — an adapter, not a unit |
| `axisFrom` · `latticeAt` · `latticeOver` | `units/layout` | VERBATIM | one unit consumer: registration and the generic fallback. Wrap receives fixed nodes and never generates a lattice |
| `EDGE_IDX` | `foundation` | VERBATIM | the edge-index cache |
| `EdgeIdx` · `edgeIdxOf` · `segDist2` · `edgeDistMM` · `pointInOuter` | `foundation` | VERBATIM | the indexed edge kernel — **the primitive the wrap module rebuilt as a brute scan** |
| `makeSeatPredicate` | `units/layout` | **AMEND** | one unit consumer. Delta: eligibility rejects a centre inside an inflated supplied hole |
| `makeCircleSeatPredicate` | `units/layout` | VERBATIM | one unit consumer (the circle preset) |
| `pressExcessMM` | `units/layout` | VERBATIM | the centre-rules parity tie-break |
| `maxPressMM` | **DELETE** | — | sole caller `bandWalk`. The rigid gate is deferred judge policy; carrying the body would pre-author it |
| `contactPointsMM` | `adapters` | VERBATIM | display: "drawn so tangency is visible" |
| `SafeMass` · `SafeSegment` | `types.ts` | VERBATIM | segment's output vocabulary |
| `MS_CASES` | `units/segment` | VERBATIM | private marching-squares table |
| `safeSegments` | `units/segment` | **AMEND** | Delta: the legal-area measurement retains hole boundaries |
| `centroidOf` | `foundation` | VERBATIM | segment · centring · layout |
| `pointInMass` | **DELETE** | — | reachable only through `centeringRef`, which goes with voting |
| `splitPerimeter` | `units/layout` | VERBATIM | one consumer, `applyCoverage`, also layout |
| `scaleContour` | `adapters` | **AMEND** | Delta: holes scale with the outer ring instead of being dropped |

## 2 · `grid-magnet-logic.ts` (17 declarations)

| symbol | → owner | class | why |
|---|---|---|---|
| `bandOf` | `foundation` | VERBATIM | layout and judge both consume it |
| `MagnetPlan` · `MagnetDia` · `Anchor` | `types.ts` | VERBATIM | shared vocabulary |
| `VotingOrder` · `ORDERS` · `registrationScore` | **DELETE** | — | the scoring layer Dan removed; recoverable from history |
| `CentreMode` · `Governor` | `types.ts` | VERBATIM | shared vocabulary |
| `governMass` | `units/centring` | VERBATIM | the governor switch |
| `centeringAnchors` | `units/centring` | VERBATIM | the six modes |
| `centeringRef` | **DELETE** | — | voting-only |
| `AnchorBake` | `types.ts` | VERBATIM | crosses centring → pipeline → adapters |
| `anchorBakeOf` · `anchorFromBake` | `units/centring` | VERBATIM | the bake, and the governed anchor at a size |
| `applyCoverage` | `units/layout` | VERBATIM | **it changes the population — layout, never judge** |
| `assignSizes` | `adapters` | VERBATIM | it shapes output; it decides nothing |

## 3 · `grid-magnet-class.ts` (11 declarations)

| symbol | → owner | class | why |
|---|---|---|---|
| `AxisClass` · `FrameKind` · `ShapeClass` | `types.ts` | VERBATIM | the classifier's output vocabulary |
| `axisClassOf` · `areaOf` · `classifyShape` · `classFloorMM` · `frameNodes` · `classFrameNodes` | `units/classifier` | VERBATIM | one unit each — they stay inside the classifier |
| `ShapeFamily` · `shapeFamilyOf` | **DELETE (S4, not S2)** | — | the hardcoded families with `fill < 0.68`, the `0.08` inset and `minor <= 2`. **Prerequisite: the worker and the catalogue matcher must be re-pointed at the catalogue first** |

## 4 · `grid-magnet.ts` (9 declarations) — the old door

| symbol | → owner | class | why |
|---|---|---|---|
| `GridConfig` · `GridResult` | `types.ts` | VERBATIM | **retained legacy-door vocabulary until the cutover — not the S3 public contract.** `GridConfig` permits a `Map` cache and is not serialisable |
| `QUANTUM_KEY_MM` · `mod` | `units/layout` | VERBATIM | private to registration |
| `computeGrid` | **SPLIT** | SPLIT | request/default plumbing → adapters · contour measurement and legal area → segment · centre derivation → centring · forced-phase and centre-rules registration → layout (**AMEND**: hole-aware eligibility) · voting branch → DELETE · coverage → layout · contact and result shaping → adapters. **The verifier derives exact statement spans from the AST; no hand-entered line range is authority.** The first version of this row cited 146–156 where the branch starts at 150, and assigned nothing at all to 117–149 — the config resolution, bbox, seat predicate, segmentation and centring that precede every branch |
| `BandSnapPoint` | **DELETE (S3, after the adapter seam)** | — | **still live**: the page imports it and its `Model` type uses it |
| `snapRange` · `bandWalk` | **DELETE** | — | replaced by layout's generic candidate generation |
| `fitSizeInBand` | **DELETE** | — | same. **Deleted only once the replacement is live on the bench** |

## 5 · `grid-magnet-wrap-compute.ts` (14 declarations)

| symbol | → owner | class | why |
|---|---|---|---|
| `S` | `units/wrap` | VERBATIM | private micron scale, not vocabulary |
| `WrapConfig` | `units/wrap` | **AMEND** | Delta: the anchor function leaves the config and becomes a required parameter |
| `WrapAt` | `types.ts` | VERBATIM | domain result shared by wrap, pipeline and adapters |
| `box` · `inside` · `nearestDist` | **DELETE** | — | duplicates of `bbox`, `pointInOuter`, `edgeDistMM` (L1). `nearestDist` is additionally a brute scan where the original is bucketed and indexed |
| `seatRegion` | `units/wrap` | **AMEND** | Delta: valid-origin construction subtracts inflated holes |
| `validOrigins` | `units/wrap` | VERBATIM | Clipper intersect of translated regions |
| `governedCentre` | **DELETE** | — | orphaned once wrap receives the anchor query; its only caller is `wrapGroup` |
| `pickOrigin` | `units/wrap` | VERBATIM | nearest lawful origin to a target |
| `wrapGroup` | `units/wrap` | **AMEND** | Delta: a required `anchorAtMM: (mm) => Pt` **query** replaces the internal centring call. The body needs an anchor at every size it bisects, not one fetched point — so this is a named amendment, **not the signature-only move I first claimed** |
| `wrapGrid` | `adapters` | VERBATIM | builds a `GridResult` — a render payload |
| `BandRung` | `types.ts` | VERBATIM | offer vocabulary |
| `wrapBandLadder` | **SPLIT** | SPLIT | candidate scan, layout identity and local offsets → `units/layout` (**layout rules, not sequence**; `SCAN_MM` comes from the typed request/Spec path and may never be hardcoded into the pipeline) · fixed candidate → wrap → verdict sequencing → `pipeline` · band membership → `units/judge` |

## 6 · `solve.worker.ts` (16 declarations)

| symbol | → owner | class | why |
|---|---|---|---|
| `SolveRequest` | `adapters` | VERBATIM | **the worker transport envelope, not the pipeline request** — it carries an id and UI fields |
| `ctx` | `adapters` | VERBATIM | the transport endpoint |
| `shapeSig` · `rungCache` · `bakeCache` | `adapters` | VERBATIM | retained caches |
| `FITS_CAP` | `adapters` | VERBATIM | **still live** — it bounds the retained `rungCache`; delete only with that cache |
| `walkCaches` · `walkFits` · `sizeCacheOf` | **DELETE** | — | orphaned when `bandFit` and the prefetcher go. Moving them would preserve a dead subsystem |
| `WALK_CAP` · `gen` · `bandFit` · `schedulePrefetch` | **DELETE** | — | the brief rejects "worker prefetch that computes work the current request did not ask for" |
| `bakeOf` | **SPLIT** | SPLIT | cache lookup/store → adapters · segment-box union loop → `units/segment` · the family/class call → `units/classifier` · the calls connecting segment → centring → classifier → `pipeline` |
| `anchorFnFor` | **SPLIT** | SPLIT | **it implements centring rules** — Core's live exception, governor selection, clearance qualification, once-only reference selection, linear scaling. Anchor selection → `units/centring`; obtaining the bake → `pipeline` |
| `ctx.onmessage` | **SPLIT** | SPLIT | transport, hashing and `postMessage` → adapters · rule-4 landing → `units/judge` · the three branches collapse into one request → `pipeline` · `recog` → `units/classifier` produces the facts, adapters only package them |

---

## 7 · Proof contract

The verifier implements exactly this and nothing more:

1. **Baseline.** Derive the 95-declaration inventory from the AST at `3caa09b8`. Every source
   declaration is covered exactly once. Composite fragments are a separate ledger.
2. **VERBATIM.** Function — exact parameters and body. Type or interface — exact members. Const —
   exact initializer. Assignment — exact right-hand side. Only export modifiers and import paths
   may differ.
3. **SPLIT.** Baseline statement spans are disjoint, cover the original body exactly once minus
   named DELETE spans, and each span occurs exactly once in a named destination. Wrapper and
   import plumbing is enumerated separately and may not contain rules.
4. **AMEND.** Every unaffected AST subtree compares equal; only the delta named in the row is
   permitted.
5. **DELETE.** A re-export-aware zero-production-consumer trace at the moment of deletion, plus
   the row's named prerequisite where one exists.
6. **Foundation.** Count direct consuming unit packages from the landed import graph — never
   files, adapters, re-exports or intentions.

## 8 · What this matrix does not do

It assigns owners. It does not authorise the deferred stages, does not settle OQ1, and adds no
behaviour. The only behaviour changes permitted in S2 are the ones already authorised, and every
`AMEND` row names its own: holes scale with the outer ring · eligibility rejects a centre inside
an inflated hole · the legal-area measurement retains hole boundaries · wrap's valid-origin
construction subtracts inflated holes · the required anchor query replaces wrap's internal
centring call.
