# v3.3.1 audit — better than resurrecting v3.2, or a donor for parts?

**Author:** s62-kai-meta · 2026-08-17
**Ask:** Dan — "we tried to build it in the other track fixing gpt pro v3.3 build to the v3.3.1 state —
find this final build, read the code and audit it to see if it is better than trying the v3.2
resurrection or if it can be a donor as well for parts."

**Read in full:** `codex/s62/grid-builder/2026-08-17/_day.md` (561) · `codex/s62/grid-qa/2026-08-17/_day.md`
(335).
**Build audited:** `onemo-next/.codex/worktrees/s62-grid-engine-v331-repair`, HEAD `dbf31370`, plus **12
modified tracked files uncommitted** (+287 / −134). Preserved exactly as the lane left it; I read only,
ran nothing in their tree.
**Engine:** `_WIP/v3.3/GPT PRO/ENGINE/onemo-magnetic-engine-v1.0.0/packages/` —
geometry-compute 2,099 lines · magnetic-logic 1,305 · magnetic-next 88 = **~3,492 lines**.

---

## THE ONE-LINE ANSWER

**v3.3.1 is the better engine and the worse product. v3.2 is the better product and the worse engine.**
They fail in opposite directions, and the reason is the same in both cases: **neither was ever tested
against Dan's canon table.**

---

## WHAT v3.3.1 HAS THAT v3.2 DOES NOT — and it is most of the gap I reported this afternoon

Every item below is the thing the v3.2 contract states in words and R3 states as a formula. v3.3.1 has
the formula, implemented.

### 1. The complete ten-criterion mechanics registry — `magnetic-logic/src/mechanics.ts` (59 lines)
`M01_MAJOR_COVERAGE` · `M02_UPPER_REGION` · `M03_UPPER_MOMENT` · `M04_MAX_OVERHANG` ·
`M05_PATTERN_RANK` · `M06_REGION_LOAD` · `M07_BALANCE` · `M08_ANCHOR_COUNT` · `M09_DISCRETE_ID` ·
`M10_REGISTRATION_ID` — each mapped to its exact `geometry-criteria-v1` descriptor, with the tolerance
rules R3 §11.2 specifies (`Q_TIMES_AREA`, `Q`, `Q_AND_CENTROID_SQUARED`).
**Including M09 and M10 — the two determinism tie-breaks the v3.2 contract does not have at all.**

### 2. The exact pattern library — `reference-profile.ts`
`single` · `pair.vertical` · `pair.horizontal` · `row.3` · `column.3` · `square.4` · the four L
variants · **`t.top1-bottom3`** — with the precise relative cell coordinates R3 §10.2 gives, stable
variant IDs, and a per-pattern permission record carrying bands, axis-class pairs, population,
marginal-node policy, required major regions, orientation and fallback flags.

### 3. **CAPACITY, NEVER COMPULSORY — IMPLEMENTED CORRECTLY. This is the big one.**
`permission('pair.vertical', ['B2'…], minimumX=1, minimumY=2, rank 0)` expands to every axis-class pair
from (1,2) up to (5,5) — **so a square-ish B2 box (2,2) admits the vertical pair.**
That is precisely the bat case shipped v3.2 gets wrong. v3.2's `templatesForCell` filters on exact frame
equality and can never offer a 1×2 inside a 2×2; v3.3.1's permission is a capacity bound and can.
**v3.3.1 got right the single defect that silenced five of seven shapes in v3.2.**

### 4. Four region classes with interval-bounded uncertainty — `region-policy.ts`
`MAJOR` / `MARGINAL` / `UNCLASSIFIED_NEAR_TOLERANCE`, decided on *interval* area-and-persistence bounds
(`areaBoundsMm2.lower/upper`, `persistenceLevelInterval.lower/upper`), with an explicit
"unresolved-could-be-major blocks certification" rule. Emits `COMPONENT_TOPOLOGY_UNCERTAIN` /
`REGION_CLASSIFICATION_UNCERTAIN` rather than guessing.

### 5. Honest handling of every open canon item
From `engineeringAssumptions` verbatim: 96 mm population **disabled** because "PD-04/PD-34 has no
verified product approval in the source files" · thresholds and permissions marked conservative
defaults because PD-17/PD-19 carry no values · `b1Guarantee: 'ONLY_WHEN_LAWFUL_IN_B1'` · sub-quantum →
`DECISION_INDETERMINATE` · `productionReady: false` until real tolerances (PD-38) · Batwoman fixture not
bundled because the approved vector was never supplied.
**Compare v3.2, which asserted 96 mm, asserted a B1 answer, and shipped a 12 mm veto on a dead ledger.**

### 6. Determinism and manufacturing identity
Reproducible Compute/Logic artifact hashes, canonical `ManufacturingSpec`, a server-side verifier that
rejects a tampered spec, half-open bands with `maxInclusive` on B5, `primaryOffer:
'SMALLEST_ACCEPTED_PER_BAND'` (PD-09), and a `provenance` block mapping values to PD IDs.

### 7. Clean module separation
Three packages against R3 §4's ownership split. v3.2's equivalent surface is ~4,600 lines with
geometry inside the judge and values inside compute — the wrong-column errors in
`three-module-definition.md`.

---

## WHAT v3.3.1 DOES NOT HAVE — and one of these is fatal on its own

### F1. IT WAS NEVER TESTED AGAINST DAN'S ANSWERS. Same blindness as v3.2.
`authority-boundaries.test.ts` asserts, for each saved shape:
```
const offer = solve.offers.find(candidate => candidate.status === 'OFFERED')
expect(offer).toBeDefined()
expect(bound.solution.centres.length).toBeGreaterThan(0)
await expect(verifyManufacturingSpecAction(...)).resolves.toEqual({valid:true})
```
**It checks that AN offer exists. It never checks WHICH pattern, WHICH family, or against the canon
table.** So "7/7 OFFERED" means seven shapes produced *a* certified placement — not that the bat gets a
vertical pair or the duck a skip-middle rectangle. The families are **unknown and unmeasured**.
This is the identical gate defect that let shipped v3.2 pass eight tasks green while answering 2 of 14.

### F2. Performance never cleared, and the official benchmark has never completed
- Seven shapes: **294.22 s total**, per-shape 21.7–70.3 s.
- The unchanged official benchmark was CPU-bound at ~100 % and killed at **15 min**, then again at
  **5:02**, with no completed fixture either time.
- One bounded repair (stop enumerating witnesses across every INSIDE box; drop two sort/allocation
  costs) took **cold PILL 20.62 s → 1.473 s** with 84/84 green — genuinely promising.
- **But the seven-shape run was never repeated on the optimised code, and the benchmark was never
  spent.** The 1.473 s figure is one shape, uncommitted.

### F3. The input seam is unresolved and currently depends on v3.2
Saved shapes are raster traces: **9,084 / 8,352 / 10,094 / 10,836 / 3,796 / 6,478 / 7,296 vertices**
against a 4,096 limit — six of seven rejected outright. The working path reuses **v3.2's
`engineOutline`** plus a derived minimum inward offset (0.24–0.36 mm) proved an exact subset of the raw
contour. Dan challenged this as cross-version scope creep; the lane conceded it, then the retraction was
itself retracted. **Unsettled — and without it v3.3.1 cannot accept the product's own shapes.**

### F4. One invented profile value
`structural.forceLargestComponentMajor: true` — no PD backs it. It is guarded (the component must be
certified-largest and persistent, and its unresolved remainder must not itself qualify), so it is not a
blanket override, but it is the switch that makes real shapes classify MAJOR at all. Not in R3's
register.

### F5. Built against R3, whose authority Dan has not settled — and R3's own hard hold never cleared
R3 `00 §1.2`: no implementation until all 27 non-locked decisions are resolved; "silence is not
approval." This engine is that implementation.

### F6. Not a release
12 modified tracked files uncommitted, 3 untracked screenshots, no benchmark, no package, no live route
proof (the Playwright/Chrome attach failed all day).

---

## THE THING BOTH TRACKS MISSED, AND IT IS A PRODUCT FACT

**The saved library shapes are raster traces, not vector outlines.** 6,000–11,000 pixel-jagged vertices,
each tiny reflex a real geometric feature to exact erosion. That is why v3.3.1's certified geometry
choked: it was handed the raw trace and its contract forbids silently simplifying it.

**v3.2 never had this problem because it never sees the raw trace** — it has always run through
`engineOutline`, which reduces the same shapes to 33–201 vertices. That is not v3.2 being faster; it is
v3.2 solving a different, smaller problem.

So the honest framing of the whole "which engine" question: **the raster-to-canonical-input seam is a
product decision neither engine owns, and it has never been ruled.** R3 §5.3 and PB §15 both begin from
*"one validated simple closed outline"* — the trace-reduction step is upstream of both, and nobody has
decided who owns it or what error it may introduce.

---

## VERDICT

**Not better as a replacement. Strongly better as a donor — and the donation is exactly the gap I
reported at 16:45.**

**Do not switch tracks to v3.3.1.** It cannot demonstrate a single one of Dan's ruled families, its
performance gate has never once completed, its input path currently depends on the version it was meant
to replace, and it carries an uncleared contractual hold. Its "7/7" is the same certified-but-unchecked
claim that hid v3.2's regression.

**Do take these parts,** each of which closes a named gap in the v3.2 contract:

| Take | Closes |
|---|---|
| `mechanics.ts` — the ten criteria as descriptors + tolerance rules | S1: the contract states nine rules in words; canon states ten formulas |
| `M09_DISCRETE_ID` + `M10_REGISTRATION_ID` | S3: no determinism, ties undefined |
| The pattern library with exact coordinates incl. `t.top1-bottom3` | The library gap and PB §21.4 |
| **The capacity-based permission expansion** | The frame lock — the defect that silenced five of seven shapes |
| Four region classes on interval bounds | S5: two classes, no uncertainty propagation |
| Artifact hashes + ManufacturingSpec + server verifier | S3/S12: no manufacturing identity |
| `engineeringAssumptions` + `provenance` as a profile convention | Every "shipped a proposal as law" failure today |

**And take one measurement, not code:** the witness-enumeration fix (one exact witness per certified
INSIDE box; search boundary boxes only when no INSIDE box exists) produced a **14× speedup on a real
shape with identical certified output**. v3.2's contract has a performance gate in canon (PD-31) and no
mechanism; this is the mechanism, already profiled and proven.

**The blocker to settle before either track proceeds:** who owns raster-to-canonical preparation, and
what error it may introduce. Both engines are currently answering that question by accident — v3.2 by
silently using `engineOutline`, v3.3.1 by borrowing it.

— s62-kai-meta
