# v1 engine read — what the v3.4 contract omits

**Author:** s62-kai-meta · 2026-08-17 · **Read:** `s59-grid-lab-main` @ `a2385323`,
`src/lib/effect/grid-core.ts` — header laws, the engine (`computePreparedGridForExtent`), the sizing
algorithm (`deriveGridFirstLadder`), the shape recipes, the ladder and selection paths. Read-only.
**Indexed against:** `plans/v3.4 ---plan-and-contract.md` @ `54638fef`.

**v1 is code, not canon.** Its laws cite Dan by date in comments. Nothing below enters the contract
without his word — the rule that voided my R3 findings, applied to myself first.

---

## THE HEADLINE

**v1 is not an early draft of what we are planning. It is a complete, different, working answer**, and
its architecture is closer to canon's stated intent than ours is.

Canon §1.3: *"Given ONEMO's predefined magnetic architecture, determine how this shape must be sized so
that it legitimately participates in that architecture."* **The grid is fixed; the shape scales to
conform.**

- **Our contract scans sizes.** Step 4: *"Scale through the band. Every size is a fresh look."* Then it
  tests each one. That is size-first: pick a size, ask what seats.
- **v1 derives the size from the grid.** Header: *"Grid-first sizes: induce the complete
  two-dimensional lattice population, then solve the minimum lawful geometry transform enclosing every
  magnet's padding envelope. Physical millimetres are output; **no physical-size scan** … exists."*

`deriveGridFirstLadder` walks **spans** (1, 2, 3 … magnet lines), seats each population, then calls
`wrapConstructionInGeometry` to solve the smallest geometry that encloses it. **The population comes
first and the size falls out.** One distinct population = one rung, deduped by construction identity.

Two consequences:
1. **It is canon's intent implemented literally**, where ours implements the test rather than the
   derivation.
2. **It cannot be slow the way v3.3.1 was.** No scan means no 21 rungs × 870 ms. v3.3.1's entire
   performance failure was scanning sizes and certifying placement at each one.

Also note `seenPopulations` — one rung per distinct construction. **That is LS §1.2's *"the same
arrangement re-listed looser is never a second optimal"*, already implemented as a dedupe.**

---

## DAN-RULED MECHANISMS THE CONTRACT DOES NOT HAVE

### 1. EDGE REGISTRATION — a ranked criterion, quoted to Dan 2026-07-28
> *"the size is optimal when we follow square logic pretty much everywhere — magnets side to side along
> the edges, with margins encoded between magnet and edge of the effect."*

`fullyRegisteredOnBBox` — every side's outermost anchor sits exactly at the padding floor.
**ALL-OR-NOTHING, with the failure mode it prevents documented in the source:** summed
distance-to-floor *"is WRONG for shapes whose material does not reach the bbox: on a circle it rewards a
phase that buys edge contact on two sides by dropping anchors and going asymmetric (166 fell 8 → 6 …
absurd on a disc)."*

A layout registers on **every** side or earns nothing. And the ordering is explicit — ranked **after**
conformance and **before** count, *"which is what previously let an inset 8-anchor phase beat the
edge-registered 6-anchor one."*

The contract has no registration-quality criterion at all. Its step 7 decides *where* the frame sits;
this decides *whether the layout reaches the edges*, which is a different question and a ruled one.

### 2. THE MAGNETIC BELT — interior magnets are redundant
`perimeterOnly` defaults **true**. `splitPopulationBoundary` splits a seated population into rim and
interior; the interior is dropped and returned as `candidates` for faint display only.
*"A node is interior only when its exact construction population surrounds it on both basis axes"* —
lattice topology, not distance.

**This is canon's ruled families, as a general rule rather than per-shape:** duck B3 *"rect 48×96, four
corners, **mid row SKIPPED**"* · butterfly *"four-in-wings corner square"* · poke *"corner square"* ·
bat B3 *"3 points, utmost corners"*. Every one is a rim with the interior dropped.
**The contract has no belt concept**, so it must rediscover per shape what v1 states once.

### 3. PER-NODE VALIDITY, NO EROSION — and the reason matters
Header: *"PER-SPOT padding: a node is valid = inside the silhouette AND ≥ pad from the REAL outline —
**per-node, no erosion (pinched shapes keep all regions)**."*

```ts
if (!pointInPreparedContour(p, prepared)) return false
return distanceToPreparedContour(p, prepared) + EPSILON >= pad
```

Exact, pointwise, no materialised safe region. Canon PB §7.2 defines the safe core *as* the erosion —
and per-node testing computes the identical predicate without building it.

**This is the defect that destroyed v3.3.1.** Its sampled component hierarchy left all seven shapes
`STRUCTURAL_EVIDENCE_UNCERTAIN` for most of a day, and two attempts to certify topology from it were
rejected. v1 never has the problem because it never materialises the region. Worth knowing before
Phase 4 builds the mass map: **the map is needed for coverage and distribution, not for legality.**

### 4. THE ≥1 GUARANTEE — the B1 question, answered
```
GUARANTEE ≥1: if the sparse grid seated nothing but the shape can still hold a magnet, drop one at the
deepest interior point
```
`deepestPoint` = pole of inaccessibility, sampled. Canon's B1 row rules *"one disc, geometry admits
nothing more"*; R3 recorded *"is B1 always possible"* as unresolved; **v1 has a working mechanism.**

### 5. MINIMUM SPACING — application rings may never overlap
`thinBySpacing`: no two centres closer than `2 × pad`, keeping *"deepest in material first, then most
central."* The contract has the 48 mm lattice but no overlap rule; on the 48 lattice with a 12 mm
radius it is slack, but it becomes load-bearing the moment a non-lattice or diagonal seat is considered.

### 6. CONFORMANCE IS A HARD LAW, not a preference
*"STANDARD and DIAMOND are HARD conformance laws (Dan): standard shows straight pitch-spaced rows or
nothing; diamond shows 68-atom (pitch·√2) links or nothing — neither may quietly resolve into the
other's arrangement (the honest outcome is margin growth, or switching mode)."*

**And this settles the diagonal question properly.** `latticeAt` for `diamond` keeps the checkerboard
half of the *same* 48 lattice — *"(ix+iy) parity … nearest neighbours at pitch·√2"*. Exactly what Dan
said: points on the square grid taken diagonally. The 48/68 system is **one lattice, two atoms**:
straight 48, diagonal 68 = 48√2. Nothing new is needed for canon's diagonal pair or 3-chain, and my
earlier claim that it needed a new grid was wrong.

### 7. THE SELECTION ORDER IS FOUR CRITERIA, AND COVERAGE IS DELIBERATELY EXCLUDED
```
CONFORMANCE → EDGE REGISTRATION → COMPLETE POPULATION → BALANCE. Coverage never participates.
```
*"Neither coverage (S22) nor magnet count (3.24) is a criterion"*, and
`exactPerimeterCoverage` is *"a pure calibration measurement"* — measured, never ranked.

Canon has nine criteria and puts **coverage of major support regions at P2**. v1 excludes coverage by
name. **These are genuinely different products** — v1 seats standard geometries, canon seats free
cutouts whose masses are the point — but the divergence should be a decision, not a surprise. And note
**balance is in v1's ranking**, fourth, computed as the seated centroid against the shape centre — the
quantity canon's L14a forbids and Dan deferred this afternoon.

### 8. POPULATION IS NOT A SIZE OBJECTIVE
*"Population is not a size objective: it only prevents a phase from winning by omitting lawful lattice
points at the same geometry state."* And law 3.24: *"growing to fit more magnets is the maximality rule
3.24 forbids."*

Three distinct prohibitions — never invent a subset to raise count (canon PB §10), fewer magnets at
equal support (canon P9), never grow the size to gain magnets (v1 3.24). **The contract has two.**

---

## PRODUCT DIMENSIONS ENTIRELY ABSENT FROM THE CONTRACT

| Missing | v1 |
|---|---|
| **Attachment** | `magnetic` \| `twinfix` (two mirror grids clamp any fabric — the twin ships as part of the product) \| `velcro` (**no grid at all** — any shape, any size, engine returns immediately) |
| **Magnet diameter** | §10.7 law: size-driven, never a knob. ≤100 mm → all 6 mm; above → **focal anchors (radial extremes, "where peel starts") take 8 mm**; from 200 mm the focal window widens |
| **Density** | Dan 08-03: *"standard and light must be switch between perimeter only and full grid"* — three independent inputs, none derives another |
| **Light thinning** | Dan: *"keep central 3-4, remove 2 and 5"* → 1·3·4·6, ends plus alternate inward, corners always stay. Standard-rows only |
| **Semantic sizes** | `ONE`, then `S`/`M`/`L`… — one label per distinct population |
| **Format families** | `rectFormat` → strip ≥2.5 · panoramic ≥1.6 · block |
| **Margin model** | *"the design never resizes; an outward margin band grows (capped) until the layout reaches its anchor target"* |
| **Testing caps** | `maxTestedMM = 214` (above ships hidden) · `RANDOM_SHAPE_MAX_MM = 180` (**free/AI-cut capped until physically tested** — our bands run to 264) |

**"Where peel starts" is worth isolating.** Canon marks the peel definition open (PB §21.3) and our
contract carries it as an open number. v1 has a working answer: peel starts at the **radial extremes**,
and those anchors get the larger magnet.

---

## ASSETS — do not rebuild these

- **`stdShapeContour()`** — square, rect, circle, equilateral triangle, diamond, drawn in mm, *"app +
  bench share these."* Every Phase 1 and Phase 3 fixture except the four LS §7 counterexamples.
- **`circleTessellationPoints()`** — the exact inverse of the sagitta bound against manufacturing
  tolerance. Phase 3's circle exam is not meaningful without it: a circle is a polygon and its answer
  depends on its point count.

## CONFLICT

**Padding: v1 `PADDING_FLOOR_MM = 10`, canon PB §2 says 12.** Same defined quantity — *"mag-safe radius
from magnet centre."* It decides legality. Settle before Phase 2 writes `spec.ts`.

---

## WHAT I WOULD PUT TO DAN, IN ORDER

1. **Grid-first or size-scan?** The largest question here. v1 derives size from population; our contract
   scans. Canon's §1.3 intent reads grid-first. This is architecture, not a tweak.
2. **Edge registration** — a ruled criterion with a documented failure mode, absent from our nine.
3. **The belt** — is "drop the redundant interior" a general rule? Four ruled canon families are rims.
4. **Padding 10 or 12.**
5. **Attachment, magnet diameter, density, the 180 mm cap** — product dimensions the contract does not
   model at all.

**And one caution on all of it.** v1 seats standard geometries on a fixed lattice; canon seats free
cutouts whose material masses are the whole point. v1 excludes coverage *by name* where canon ranks it
second. **Do not port v1's selection order.** Port the mechanisms canon also implies — the belt, the
guarantee, edge registration, per-node legality — and leave its ranking where it is.

— s62-kai-meta
