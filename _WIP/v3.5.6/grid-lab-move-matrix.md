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
`NEW (S2-AUTHORISED)` — no baseline declaration exists. Permitted **only** where an
already-authorised S2 delta cannot be expressed by moving an existing body. The matrix pins the
exact declaration, the verifier compares it exactly, and the landed import graph must contain the
named consumers.
`DELETE` — no owner, with the reason and any replacement prerequisite.

**Foundation rule (L1).** A primitive enters `foundation/` only with **two or more consuming UNIT
packages in the landed import graph** — not files, not adapters, not re-exports, not intentions.
Where the audit found one, the symbol moves into that unit instead.

---

## 0 · Landing sequence

The map said where every declaration goes and never said in what order it could move. That gap is
what broke the first attempt: `foundation` may only hold a primitive with two or more unit
consumers, but no unit can exist before `foundation` does. Executing the map without an order, I
extracted a unit that then reached back into the file it had just left — a cycle, and the exact
contamination this refactor exists to remove.

**The rule is measured at the END of S2, not per commit.** It describes the landed architecture.
Applying it to every intermediate state is what makes it circular and unexecutable.

**Order, each step one commit, each proved before the next starts:**

| # | lands | why here |
|---|---|---|
| 1 | **`foundation`** | bbox · the indexed edge kernel · centroid · spot radius · band lookup · lattice · seat predicates. Nothing else moves. Old files re-export, so no caller changes. Every unit below stands on this, so it cannot come second |
| 2 | **`segment`** | the legal-area measurement — imports foundation, never a legacy file |
| 3 | **`classifier`** | the axis pair and class frame. `shapeFamilyOf` stays behind: two live callers to repoint first |
| 4 | **`layout`** | registration, population, the generic fallback. **The voting branch and the band walk die here**, so this is the one step with a behaviour change, and it carries its own before/after proof |
| 5 | **`wrap`** | the Clipper solve. The anchor becomes a parameter the caller supplies, so wrap stops reaching into centring |
| 6 | **`judge`** | band membership and the default landing — the rules currently buried in the ladder and the worker |

`centring` (step 0) is already landed. `pipeline` and `adapters` follow in S3; they receive their
first bodies from the worker and the ladder, and that is the commit that makes the engine callable.

**Every step proves the same four things before the next begins:** moved bodies byte-identical ·
the suite at its standing baseline · engine output identical before and after · the bench solving
on the live surface. Step 4 is the exception on the third: its behaviour change is the point, so it
states what changed and why instead of claiming equality.

---

## 1 · `grid-magnet-compute.ts` (28 declarations)

| symbol | → owner | class | why |
|---|---|---|---|
| `KEY_QUANTUM_MM` | `units/segment` | VERBATIM | private; only `safeSegments` reads it |
| `BBox` | `types.ts` | VERBATIM | shared vocabulary |
| `bbox` | `foundation` | VERBATIM | segment · classifier · layout |
| **`pointInContour`** | `foundation` | **NEW (S2-AUTHORISED)** | `pointInOuter(outer) && !holes.some(pointInOuter)`. Three landed unit consumers — segment, layout, wrap — all of which would otherwise rediscover "inside material" for themselves. Centralising it is the L1 seam this matrix exists to protect |
| **`edgeDistToContourMM`** | `foundation` | **NEW (S2-AUTHORISED)** | `min(edgeDistMM(outer), …edgeDistMM(each hole))`. Same three consumers; the second of the two facts every hole-aware path needs |
| **`contourCentroidOf`** | `units/centring` | **NEW (S2-AUTHORISED)** | outer signed area minus hole signed areas — `centroidOf(outer)` cannot give the material centroid of an asymmetric holed contour. **One consumer, Weight centring, so it lives in that unit** — a geometry helper does not earn foundation by being geometry. Same rule that moved the lattice helpers out |
| `dist` | **DELETE** | — | **zero production importers.** My earlier count matched the substring inside `paper/dist/` and `.../dist/index.js` paths — path fragments, not consumers |
| `spotRadiusOf` | `foundation` | VERBATIM | segment · layout · wrap |
| `fieldSpanMM` | `adapters` | VERBATIM | once `snapRange` dies its only consumer is the bridge — an adapter, not a unit |
| `axisFrom` · `latticeAt` · `latticeOver` | `units/layout` | VERBATIM | one unit consumer: registration and the generic fallback. Wrap receives fixed nodes and never generates a lattice |
| `EDGE_IDX` | `foundation` | VERBATIM | the edge-index cache |
| `EdgeIdx` · `edgeIdxOf` · `segDist2` · `edgeDistMM` · `pointInOuter` | `foundation` | VERBATIM | the indexed edge kernel — **the primitive the wrap module rebuilt as a brute scan** |
| `makeSeatPredicate` | `units/layout` | **AMEND** | one unit consumer. Delta: composes universal hole eligibility through `pointInContour` + `edgeDistToContourMM`; no local hole parity or distance copy |
| `makeCircleSeatPredicate` | `units/layout` | **AMEND** | one unit consumer (the circle preset). Delta: the analytic outer-circle test is kept and composed with hole eligibility — the analytic path currently accepts a centre sitting inside a supplied hole |
| `pressExcessMM` | `units/layout` | **AMEND** | the centre-rules parity tie-break. Delta: takes a `Contour` and measures through `edgeDistToContourMM` — it measures the outer ring only today, so a donut tie-breaks as if the hole were solid |
| `maxPressMM` | **DELETE** | — | sole caller `bandWalk`. The rigid gate is deferred judge policy; carrying the body would pre-author it |
| `contactPointsMM` | `adapters` | **AMEND** | display: "drawn so tangency is visible". Delta: takes a `Contour`, searches outer **and hole** rings, returns the nearest material-boundary contact — otherwise contact evidence is drawn as if the hole did not exist |
| `SafeMass` · `SafeSegment` | `types.ts` | VERBATIM | segment's output vocabulary |
| `MS_CASES` | `units/segment` | VERBATIM | private marching-squares table |
| `safeSegments` | `units/segment` | **AMEND** | Delta: the signed field uses the two contour primitives, so the legal area retains hole boundaries. No local hole parity or distance copy |
| `centroidOf` | `foundation` | VERBATIM | the ring primitive is unchanged; the holed case is `contourCentroidOf` above |
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
| `seatRegion` | `units/wrap` | **AMEND** | Delta: takes a `Contour`; the deflated region subtracts every hole inflated by the same radius |
| `validOrigins` | `units/wrap` | VERBATIM | Clipper intersect of translated regions |
| `governedCentre` | **DELETE** | — | orphaned once wrap receives the anchor query; its only caller is `wrapGroup` |
| `pickOrigin` | `units/wrap` | VERBATIM | nearest lawful origin to a target |
| `wrapGroup` | `units/wrap` | **AMEND** | **Exact deltas, and only these four:** (1) a required `anchorAtMM(mm)` **query** replaces `cfg.anchorAtMM` + `governedCentre` — the body needs an anchor at every size it bisects, not one fetched point; (2) `seatRegion` receives the full `Contour`; (3) fast legality uses `pointInContour` + `edgeDistToContourMM` in place of the deleted `inside`/`nearestDist`; (4) `gapsMM` uses `edgeDistToContourMM`. Bisection, valid-origin solve, rounding, placement and every returned field compare equal. *(Naming only the anchor delta, as the previous version did, would have made the required duplicate-removal and hole plumbing fail verification — or forced AMEND to be widened until it bounded nothing.)* |
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

## 7 · Fragment manifest — statement ownership for every SPLIT

Generated from the AST at `3caa09b8`, not hand-typed. Indices are positions in the declaration's
statement list; the leading text is the stable identifier that survives unrelated line movement.
**Every statement of every SPLIT declaration appears here exactly once with exactly one owner**,
DELETE and plumbing rows included, so ownership is decided here and not by whoever writes the
verifier. Nested blocks are expanded until that is true; **the verifier fails the matrix itself if
any row names more than one owner or leaves a nested block unexpanded.**

**Owner rules used throughout.** `pipeline` calls units and passes their outputs — nothing else.
`adapters` own request and default resolution, transport, caches and view-model packaging.
**`bbox` resolved explicitly:** `foundation` owns the primitive, the unit that needs the
measurement owns the call, and `pipeline` only receives and passes the result. `segment` owns the
legal-area measurement body and the segment-box producer. `centring`,
`layout`, `classifier` and `judge` own only their rule bodies.

### `computeGrid` — 27 statements

| # | starts with | owner | class |
|---|---|---|---|
| 0–5 | `const pitch` … `const perimeterOnly` | `adapters` | VERBATIM (config resolution) |
| 6 | `const outer = contourMM.outer.pts` | `adapters` | VERBATIM |
| 7–8 | `const bb = bbox(outer)` · `const cx =` | `units/layout` | VERBATIM |
| 9 | `const fits = cfg.circle` | `units/layout` | AMEND (hole-aware eligibility) |
| 10 | `const massDepth =` | `adapters` | VERBATIM |
| 11 | `const segments = safeSegments(` | `pipeline` | VERBATIM (**the call is sequencing; the measurement body is segment's**) |
| 12–14 | `const mode` · `const positioning` · `const governor` | `adapters` | VERBATIM |
| 15–18 | `const centres =` … `const ruleTarget:` | `units/centring` | VERBATIM |
| 19–21 | `let bestSeated` · `let bestOx` · `let mainCentre` | `units/layout` | VERBATIM |
| 22.0 | `if (fits && cfg.forcePhaseMM)` — 5 statements | `units/layout` | VERBATIM |
| 22.1 | `else if (fits && positioning === 1)` — 11 statements | `units/layout` | VERBATIM |
| 22.2 | `else if (fits)` — 10 statements, the voting sweep | **DELETE** | — |
| 23 | `const lattice = latticeAt(` | `units/layout` | VERBATIM |
| 24 | `const coverage = applyCoverage(` | `units/layout` | VERBATIM |
| 25 | `const anchors = assignSizes(` | `adapters` | VERBATIM |
| 26 | `return {` | `adapters` | VERBATIM (result shaping) |

### `wrapBandLadder` — 10 statements, loop body 14

| # | starts with | owner | class |
|---|---|---|---|
| 0 | `const pitch = cfg.pitchMM ??` | `adapters` | VERBATIM (config resolution) |
| 1 | `const scanCfg: GridConfig = { …positioning: 1, segmentsDetail: 'light' }` | `units/layout` | VERBATIM (**layout input construction — positioning and detail are policy, not sequence**) |
| 2 | `const wcfg: WrapConfig = {` | `units/wrap` | VERBATIM (wrap input construction) |
| 3 | `const anchorMemo = new Map<number, Pt>()` | `adapters` | VERBATIM (**a cache — never pipeline**) |
| 4 | `const seen = new Set<string>()` | `units/layout` | VERBATIM (identity dedupe) |
| 5 | `const rungs: BandRung[] = []` | `pipeline` | VERBATIM |
| 6 | `const SCAN_MM = 1` | **DELETE** | — the scan step comes from the typed request/Spec path; a hardcoded constant may not enter the pipeline |
| 7·loop 0–1 | `const pts = computeGrid(` · `if (!pts.length) continue` | `pipeline` | VERBATIM (sequencing a layout call) |
| 7·loop 2–6 | `let mx` … `seen.add(id)` | `units/layout` | VERBATIM (layout identity) |
| 7·loop 7–9 | `const xs` · `const cx` · `const group` | `units/layout` | VERBATIM (local offsets) |
| 7·loop 10–11 | `const at = wrapGroup(` · `if (!at) continue` | `pipeline` | VERBATIM |
| 7·loop 12 | `if (at.sizeMM < loMM - 0.005 …)` | `units/judge` | VERBATIM (**band membership is a rule**) |
| 7·loop 13 | `rungs.push({ at, revealMM: mm })` | `pipeline` | VERBATIM |
| 8 | `rungs.sort(` | `units/judge` | VERBATIM (ordering offers) |
| 9 | `return rungs` | `pipeline` | VERBATIM |

### `bakeOf` — 4 statements

| # | starts with | owner | class |
|---|---|---|---|
| 0–1 | `const key =` · `let hit = bakeCache.get(key)` | `adapters` | VERBATIM (cache lookup) |
| 2 | `if (!hit) {` — expanded below | SPLIT | — |
| 2.0 | `const refMM = sizeRange(` | `adapters` | VERBATIM (padding/size resolution) |
| 2.1 | `const outer = sized(refMM).outer.pts` | `adapters` | VERBATIM |
| 2.2 | `const bb = bbox(outer)` | `units/segment` | VERBATIM (segment needs it for the segment box; the primitive stays in foundation) |
| 2.3 | `const r = spotRadiusOf(` | `adapters` | VERBATIM |
| 2.4 | `const segs = safeSegments(` | `pipeline` | VERBATIM (a call into segment) |
| 2.5 | `const bake = anchorBakeOf(` | `pipeline` | VERBATIM (a call into centring) |
| 2.6–2.7 | `let sx0 = Infinity …` · the segment-box union loop | `units/segment` | VERBATIM (the segment-box producer) |
| 2.8 | `hit = { bake, segW, segH, family: shapeFamilyOf(outer) }` | SPLIT | `shapeFamilyOf(` call → `pipeline` (into classifier); the record assembly → `adapters` |
| 2.9–2.10 | `bakeCache.set(` · eviction | `adapters` | VERBATIM |
| 3 | `return hit` | `adapters` | VERBATIM |

### `anchorFnFor` — 8 statements

| # | starts with | owner | class |
|---|---|---|---|
| 0 | `const mode =` | `adapters` | VERBATIM |
| 1 | `const hit = bakeOf(` | `pipeline` | VERBATIM |
| 2 | `if (mode === 1) return undefined` | `units/centring` | VERBATIM (**Core's live exception is a centring rule**) |
| 3–6 | `const bake` · `const gov` · `const depth` · `const aRef = anchorFromBake(` | `units/centring` | VERBATIM |
| 7 | `return (mm: number) => [aRef[0] * mm / bake.refMM, …]` | `units/centring` | VERBATIM (linear scaling) |

### `ctx.onmessage` — 3 statements, try body 9

| # | starts with | owner | class |
|---|---|---|---|
| 0 | `const { id, base, offsetMM, … } = e.data` | `adapters` | VERBATIM |
| 1 | `gen++` | **DELETE** | — with the prefetcher |
| 2·try 0 | `const sized = makeSizer(` | `adapters` | VERBATIM |
| 2·try 1–4 | `const pts` · `let h = 0` · the hash loop · `const sig =` | `adapters` | VERBATIM |
| 2·try 5–6 | `if (sig !== shapeSig)` · `const cfgSig =` | `adapters` | AMEND (drops the deleted `walkCaches`/`walkFits` clears) |
| 2·try 7 | `if (manualBand && sizeMM > 0) {` — three branches, expanded below | SPLIT | — |
| …b0.0–0.2 | `const aFn = anchorFnFor(` · `const contour = sized(` · `const grid = computeGrid(` | `pipeline` | VERBATIM (calls only) |
| …b0.3 | `ctx.postMessage({ … })` | `adapters` | VERBATIM |
| …b1.0 | `const band = BANDS.find(` | `adapters` | VERBATIM (request resolution) |
| …b1.1–1.2 | `const key = JSON.stringify(` · `let rungs = rungCache.get(` | `adapters` | VERBATIM (cache) |
| …b1.3 | `if (!rungs) { … }` — `wrapBandLadder(` call → `pipeline`; `rungCache.set` + eviction → `adapters` | SPLIT | VERBATIM |
| …b1.4 | `if (rungs.length) {` — the rule-4 landing loop → `units/judge`; `wrapGrid(` and `assignSizes(` → `adapters`; `safeSegments(` → `pipeline`; `classFrameNodes(` + `recog` facts → `units/classifier`; ladder mapping and `postMessage` → `adapters` | SPLIT | VERBATIM |
| …b1.5–1.7 | the `bandFit` fallback and its post | **DELETE** | — with `bandFit` |
| …else 0–5 | the whole trailing `bandFit` branch | **DELETE** | — with `bandFit` |
| 2·try 8 | `schedulePrefetch(` | **DELETE** | — |
| 2·catch | `ctx.postMessage({ id, model: null, error: …})` | `adapters` | VERBATIM |

---

## 8 · Proof contract

The verifier implements exactly this and nothing more:

1. **Baseline.** Derive the 95-declaration inventory from the AST at `3caa09b8`. Every source
   declaration is covered exactly once. Composite fragments are a separate ledger.
2. **VERBATIM.** Function — exact parameters and body. Type or interface — exact members. Const —
   exact initializer. Assignment — exact right-hand side. Only export modifiers and import paths
   may differ.
3. **SPLIT.** Baseline statement spans are disjoint, cover the original body exactly once minus
   named DELETE spans, and each span occurs exactly once in a named destination. Wrapper and
   import plumbing is enumerated separately and may not contain rules.
4. **NEW.** The row's pinned declaration compares exactly, and the landed import graph contains
   every consumer the row names — no more and no fewer.
5. **AMEND.** Every unaffected AST subtree compares equal; only the delta named in the row is
   permitted.
6. **DELETE.** A re-export-aware zero-production-consumer trace at the moment of deletion, plus
   the row's named prerequisite where one exists.
7. **Foundation.** Count direct consuming unit packages from the landed import graph — never
   files, adapters, re-exports or intentions.

## 9 · What this matrix does not do

It assigns owners. It does not authorise the deferred stages, does not settle OQ1, and adds no
behaviour of its own.

**Every permitted S2 behaviour change is owned solely by its `AMEND` or `NEW` row and its
fragment-manifest entry. This section adds no second list** — the previous version repeated five
deltas here and had already fallen behind the rows, which would have left a verifier with two
authorities that disagree.
