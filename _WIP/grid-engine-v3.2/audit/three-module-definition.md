# THE ENGINE, DEFINED — what must be present, and which module owns it

**Author:** s62-kai-meta · 2026-08-17 · derived from canon only.
**Sources:** `canon/ONEMO Magnetic Grid Compute System — Product Base and Logic Architecture.md` (PB) ·
`canon/logic-spec-optimum.md` (LS) · `ChatGPT-Grid and Band Logic-20260816-1022.md` (GPT) ·
`grid-engine-v3/grid-laws.md` (L, third in LS §5's authority order — cited only where the higher
documents are silent).

**The rule this document exists to enforce (PB §20):** *"Logic specifies what must be tested and what
constitutes a good product result. Math proves what is geometrically true."* Every entry below is
owned by exactly one module. An item in two columns is an undefined boundary. An item with no canon
citation does not belong in the engine.

**The governing intent (GPT, and LS §1.3 carries it as RULED):** *"Given ONEMO's predefined magnetic
architecture, determine how this shape must be sized so that it legitimately participates in that
architecture."* The grid is fixed; the shape scales to conform. Arrangements are **revealed by
material occupancy**, never invented by an optimiser.

---

## COMPUTE — neutral geometry. Zero product knowledge. Returns evidence, decides nothing.

| # | Must be present | Canon |
|---|---|---|
| C1 | Exact contour preparation from the supplied polygon. Never traces, never alters the silhouette. | PB §1, §7.1 |
| C2 | Uniform scaling, aspect locked, per candidate size. Recomputes everything at each size. | PB §12 |
| C3 | Bounding box and per-axis dimensions. | PB §17 |
| C4 | **Safe core** — exact 12 mm disc erosion, **every component preserved**. Not bbox approximation, not raster, not vertex-only distance. | PB §7.2 |
| C5 | **Exact legality** — the complete closed 24 mm disc inside the material; boundary tangency legal. | PB §2 |
| C6 | **Structural support graph** — major safe regions, marginal regions, **terminal branches**, **material corridors**, area, centroid, local clearance, local width, vertical position, **persistence across nearby sizes**. | PB §7.3, §8 |
| C7 | Registration transforms and the parity frame; the **continuous feasible translation set** as intersected shifted safe cores. Never a millimetre sweep. | LS §7, PB §6 |
| C8 | Neutral measures: clearances, directional extents, hanging-mass areas, moments, wraps — **per side**. | LS §7, LS §2 P3/P4 |
| C9 | Pattern instantiation from lawful nodes. | PB §14 |
| C10 | Per-node legality, clearance, and region assignment. | PB §9, §17 |
| C11 | **Exact failure reasons** — machine-readable, per size, per pattern. | PB §17, §19 |
| C12 | Determinism: identical input → identical bytes. | LS §7 |

**Efficiency duties (they are requirements, not preferences).** No scan or bisection over size
(L grid-spec §8). Computed once per frozen outline, cached by outline fingerprint, never during
pinch/resize/pan/drag/browse (L16 — measured: 163.7 ms against a 16.7 ms frame).

**Compute must NOT contain:** thresholds, bands, template lists, the selection order, the limb
exemption, refusals on policy grounds. *"The Math Engine returns evidence. It does not choose product
policy."* (PB §14)

---

## LOGIC — enforces behaviour, makes the decisions. No geometry. No numbers.

| # | Must be present | Canon |
|---|---|---|
| L1 | Axis classification per axis, band = dominant axis class. | PB §4, LS §4 step 2 |
| L2 | **Structural class refinement** — the general class refined by what the material *is*: tapered / waisted / standing / blob / winged / diagonal. | LS §4 step 6, §5.2 |
| L3 | **Frame hypothesis from class — CAPACITY, NEVER COMPULSORY.** The material reduces it; an L drops to 1+2 by itself. | LS §4 step 3, §5.2, L5 |
| L4 | Candidate size generation across the band range; every size evaluated independently. | PB §12, LS §4 step 4 |
| L5 | Registration policy: canonical origin = bbox centre + parity; controlled search within one 48 mm period; **mechanics choose, canonical breaks ties only**. | PB §6, LS §2 |
| L6 | Pattern permissions — which approved templates a cell may *hypothesise*. | PB §14, LS §4 step 3 |
| L7 | Node classification applied: illegal / marginal / strong, from Compute's evidence against Spec's thresholds. | PB §9, LS §4 step 8 |
| L8 | **The nine-rule lexicographic order**, in order, no weights, no opaque score. Legality → coverage of major regions → upper gravity-critical mass → unsupported extent → peel leverage → coherent approved pattern → distribution across distinct masses → balance → fewer magnets at equivalent support. | PB §11, LS §2 |
| L9 | **Balance = flap evened on ALL SIDES SIMULTANEOUSLY.** Not a centroid distance, not a displacement bound. | LS §2 P8, L14a |
| L10 | Trivial-limb exemption **applied AND reported** with side and reach. A silent exemption is a violation. | LS §2 P4, L14 |
| L11 | **Escalation** — when a band cannot cover the major regions, the answer is the NEXT band with the fuller arrangement, not silence. | LS §3, LS §5.2 |
| L12 | **Cross-band laws** — each band's answer ≥24 mm above the previous · never re-offers a lower band's arrangement identity · out-counts the band below. | LS §3 |
| L13 | **Offer assembly** — the SET of distinct optimals the band's range unlocks, with **one marked as the guaranteed bulls-eye**. | LS §1.2, L17 |
| L14 | Presentation cap applied **only after** the complete certified offer set exists. | LS §1.2 |
| L15 | **Honest refusal, no fallback** — stable machine-readable rejection reasons; never invents an answer. | PB §19, LS §3 |
| L16 | The complete PB §19 result: exact dimensions, scale, axis classes, band, frame, registration, pattern ID, ordered node addresses, magnet centres, minimum clearance, structural/extent/gravity evidence, validation status, deterministic decision reasons. | PB §19 |

**Logic must NOT contain:** geometry, approximation, a cutout-shape name (bat/duck/butterfly), or a
number that is not read from Spec. *"The Logic Engine chooses policy. It does not approximate
geometry."* (PB §14)

---

## SPEC — values only. No maths. No policy. Consumed by both.

| # | Must be present | Canon |
|---|---|---|
| S1 | Physical constants: 24 mm cell, 24 mm disc, 12 mm safe radius, 48 mm node pitch, 12 mm scale increment. | PB §2 |
| S2 | Axis-class table: 24 / 72 / 120 / 168 / 216 / 264. | PB §4 |
| S3 | Band definitions, and which bands are released for sale. | LS §3, L8a |
| S4 | The **versioned approved template library** — patterns as relative node coordinates, with IDs. | PB §10 |
| S5 | Frame permission cells per class × band — **as data only**, consumed as hypotheses. | LS §5.1, §5.2 |
| S6 | Size step and even-millimetre publication rule. | PB §15, L10 |
| S7 | `pattern_policy_version` and `selection_policy_version`. | PB §15 |
| S8 | **Guarded writers: refuse, never clamp.** Versioned and hashed when released. | LS §7 |

### The OPEN register — Spec-held switches, never hardcoded

Canon marks these undecided. Dan's ruled method governs them (captured turn, meta 2026-08-11):
*"why do i need to rule if i never tested the difference in the real life - why noit add all options
and test?"* — **an unruled definition becomes a switch to test, not a number to rule.**

| # | Open value | Canon |
|---|---|---|
| O1 | **Numerical definition of unsupported extent** (and therefore what counts as *excessive*). | GPT Pro :2601, PB §522 — *"Numerical definition of unsupported extent and peel leverage"* |
| O2 | Strong/marginal structural thresholds. | PB §21.2 |
| O3 | Peel-leverage numerical definition and tolerance. | GPT Pro :2601, PB §522 |
| O4 | Registration search resolution — continuous or fixed. | PB §6, §21.1 |

**None of these may act as a silent veto while open.** They are exposed, defaulted transparently, and
calibrated against real shapes.

> **CORRECTION, 2026-08-17 — O1 was framed wrongly here, and I propagated that framing.**
> I originally wrote O1 as *"the overhang allowance / the 12–24 switch"*, citing `LS §8`. Dan
> challenged it; I searched both higher-authority sources and he is right.
>
> **In the GPT Pro transcript and the Product Base there is no allowance, no switch, no 12, no 24,
> and no per-side leftover budget — zero occurrences.** What both documents contain is:
> - *"Reduction of peel or flap leverage"* — a **ranking criterion** (GPT Pro :2362, PB §283)
> - *"excessive unsupported extent"* — a **refusal reason** (GPT Pro :2586, PB §507)
> - *"Numerical definition of unsupported extent and peel leverage"* — listed as **an open decision**
>   (GPT Pro :2601, PB §522)
> - the physics it protects: *"a magnet below a large unsupported upper region does not adequately
>   prevent that region from falling, peeling or flapping"* (GPT Pro :1557), and *"upper unsupported
>   extent has priority over centroid balance"* (:3246)
>
> The `12 | 24` switch exists **only** in `logic-spec-optimum.md`, which ranks BELOW Dan's rulings and
> the Product Base in the authority order that document itself states (§5). Dan's own framing:
> *"the fit is 0 flap ideally like square — but free shapes are not perfect so we can allow to
> approximate the max possible fit, not base the engine on [an allowance]."*
>
> **So the correct reading is:** unsupported extent is a **quantity to minimise**, weighted to the top
> where gravity peels; it enters the ranking at L8; *excessive* extent may refuse — but its threshold
> is undefined, and **an undefined threshold cannot refuse at any value: not 12, not 24, not 0.**
>
> Recorded rather than silently edited. This is the third instance today of the same failure — the
> lead cited the v3 law book as governing, I cited grid-laws, then I cited the logic spec — and mine
> was the one that reached a build contract. A derived document restating canon is not canon.

---

## THE ACCEPTANCE GATE — not optional, and it does not live in any module

**LS §7:** *"The canon table IS the regression gate: every row an executable fixture through the real
solve door, plus the counterexample suite (wide/tall/circle/spike/notch/mushroom/dumbbell) so no rule
is bat-shaped. A ranking change that moves a ✅ row is a defect."*

**And the shapes are exams, not targets** (Dan, 2026-08-17): *"the shapes in the library there for
tests not to dictate hardcoded behavior."* A miss is a defect in the general rule. Matching the table
by construction proves nothing.

**Plus L17's harder bar:** the marked bulls-eye must be the layout a person would have chosen by eye.
*"If anyone has to nudge the placement after purchase, the engine has failed."*

---

## THE NO-INVENTION TEST — how this document is used

Before any line of engine code is written or kept, it answers three questions:

1. **Which canon clause requires it?** No citation → it does not exist.
2. **Which single module owns it?** Two columns → the boundary is undefined; define it before building.
3. **Is it a value, a measurement, or a decision?** Value → Spec. Measurement → Compute.
   Decision → Logic. A measurement that refuses, or a value that vetoes, is in the wrong module.

**Every defect found in v3.2 is a failure of question 3**, which is why the list is worth having:

| v3.2 defect | What it actually is |
|---|---|
| The bounding box selecting which layouts may be tried | Logic consuming L3 as a filter instead of a hypothesis |
| The overhang number refusing layouts | A **ranking quantity** (L8) turned into a Logic veto, on a threshold canon leaves undefined (O1) |
| Balance measured as centroid distance | Compute computing the wrong quantity (L9) |
| Coverage and distribution fed one list | C6 never built; two Logic inputs collapsed onto one |
| No anatomy step | L2 absent — the funnel jumps from safe core to templates |
| Bands going silent | L11 absent |
| One offer, no bulls-eye | L13 absent |
| Nothing checking Dan's answers | The acceptance gate never built |

Eight defects, eight entries in the wrong column. None of them was a hard problem; each was a piece
nobody had written down the home for.

---

## MEASURED — THE CURRENT BUILD BREAKS THE RULE IN TWO OF THREE DIRECTIONS

The three-module separation is not a new idea. It is the driver brief behind the v3 scaffold —
`grid-laws §B`: *"Engine holds all compute and no values; logic holds values and the bridging, and no
maths. Every write to a law value passes ONE GUARD."* Dan, 2026-08-17: **if the current build does not
honour it, that is slop.** Audited at `7ab17b83`.

### VIOLATION A — Compute defines VALUES that belong in Spec

Six numbers are declared inside the geometry layer instead of read from Spec, so none is versioned,
guarded, or visible:

| Value | Where | Why it matters |
|---|---|---|
| `CONSERVATIVE_GUARD_MM = MANUFACTURING_TOLERANCE_MM / 2` | `continuous-feasibility.ts:33` | **A tolerance that decides legality.** This is the value that refused PILL's anchors by 1–2 µm and cost several diagnostic rounds. Unversioned, unguarded, invisible. |
| `ARC_ERROR_MM = MANUFACTURING_TOLERANCE_MM / 10` | `continuous-feasibility.ts:32` | Feeds the certified envelope. |
| `PROJECTION_ERROR_MM` | `continuous-feasibility.ts:30` | Feeds the certified envelope. |
| `SCALE = 1 / CONTINUOUS_REGISTRATION_QUANTUM_MM` · `LATTICE` (duplicate) | `continuous-feasibility.ts:29`, `structure.ts:246` | Same quantum derived twice in two files. |
| `GRID_ARITHMETIC_EPSILON_MM`, `GRID_CONSTRUCTION_QUANTUM_MM` | `grid-core.ts:48,52` | Legality-adjacent epsilons in the geometry core. |
| `SCALE = 1000` · `MICRO_PER_PX = 1000` | `offset.ts:14`, `geometry-truth.ts:43` | Raw literals, no provenance. |

**The guard is the load-bearing case.** A number that governs whether a placement is legal must be a
Spec value behind the guarded writer (S8), or it is exactly the "invented value" this definition
exists to forbid.

### VIOLATION B — Logic performs GEOMETRY that belongs in Compute

| What | Where |
|---|---|
| Canonical origin computed in millimetres — bbox centre minus half the frame span | `judgement.ts:223–224` |
| Template steps converted to millimetre offsets | `judgement.ts:246` |
| Euclidean distances (`Math.hypot`) for canonical proximity | `judgement.ts:655–656`, `:1041` |
| A private lattice-rounding function | `judgement.ts:1095` |
| Size-step arithmetic over the band range | `judgement.ts:679` |

Each is a measurement. Under PB §14 the Math Engine owns *"registration transforms"* and
*"grid-coordinate conversion"*; Logic *"does not approximate geometry."*

### VIOLATION C — the entries these lists mark ABSENT are absent at source

Verified at `a5c13b63` in the serving tree, so the "missing" claims above are evidence, not assertion:

| Entry | Probe | Result |
|---|---|---|
| **C6 structural graph** — terminal branches, material corridors, persistence *across sizes* | `grep terminal\|corridor\|branch\|limb\|lobe` in `compute/structure.ts` | Only prose about the trivial-limb exemption. No structural element. `persistenceLevels` exists, but its own docblock reads *"component and persistence evidence at CALLER-CALIBRATED clearance levels"* — persistence across **erosion depth**, not across sizes. Same word, different question. |
| **L11 escalation** — answer with the next band up rather than going silent | `grep escalat\|nextBand\|bandUp` in `logic/` + `spec.ts` | **0 hits.** |
| **L12 cross-band laws** — growth, band separation, echo suppression | `grep offeredBelow\|sizeFloor\|prevCount\|previousBand` | **0 hits.** The band loop at `judgement.ts:1292` is a bare `for (const band of calibration.bands)` carrying no state between iterations — the laws are not merely deleted, they cannot be *expressed* in the current shape of the code. |
| **L13 offer set + marked bulls-eye** | `grep bullsEye\|primary\|isPrimary` in `judgement.ts` | **0 hits in the engine.** The primary marker lives in the page, not in Logic — a presentation rule standing in for a ruled decision. |

### VIOLATION D — Spec holds a DERIVED table that decides, and the class that keys it never sees the shape

The one place all three modules meet is the permission table, and every side of it is wrong. Verified
at `a5c13b63`.

**D1 — the table cannot express the rule it exists to serve.** 25 cells; cells naming more than one
frame: **zero**. Each is `(band, axisClassX, axisClassY) → exactly one frame` (`spec.ts:490`:
`{band: 2, axisClassX: 2, axisClassY: 2, frames: ['2x2']}`), and `judgement.ts:233-242` filters
templates to exact-frame equality. So *"capacity, never compulsory"* is not misimplemented — it is
**unrepresentable in this data shape**. Canon's rule (§5.2, verbatim): *"the material may REDUCE it
… NEVER INFLATE IT."* The cell is a **ceiling**, and the code made it an equality.

**D2 — canon's own alternations were flattened into determinism.** §5.1 lists tall B3 as
*"1×3 / 2×3"*, B4 *"2×4 / 3×4"*, wide B3 *"3×1 / 3×2"*. `spec.ts:497-498` split each **or** into two
cells keyed on a different `axisClassX` — so a choice Dan ruled became a lookup decided by box
arithmetic. A second, independent loss of the reduce property.

**D3 — a ruled row is simply absent.** §5.1 rules **circle / oval** with exact sizes (single ~40,
2×2 **92**, 3×3 **160**, 4×4 **228**). Zero cells, zero code. Distinct from `free`, which is §5.2's
step-6 refinement (= C6's missing structural map). Two different gaps; do not merge them.

**D4 — the classifier consults no material at all.** `judgement.ts:193-197`
`axisClassOf(calibration, sideMM)` maps a **side length** to an integer 1–5; `:689-691` calls it on
width and height. That is the entire classifier — "square / tall / wide" are two integers compared.
Canon funnel step 2 [RULED] names **five** classes; only the three arithmetic ones exist. This is the
same root as C6: *the engine never looks at the shape, only at its box.*

**D5 — the table is self-labelled as engineering's own invention, then used as law.** Status across
the 25 cells: **19 `engineering-derived` · 6 `deferred` · 1 `traced`**. Same shape as the 12 mm
limit — a derived value doing a ruled value's job. Restoring canon here is therefore not "undo a
misreading"; it is **replace a derived table with the ruled rule**.

**Wrong-column reading:** *which layouts may be tried* is a **Logic** decision the material must be
able to reduce (L6). It was encoded as a **Spec** table that no material can influence, keyed by a
**Compute** measurement that never touches the silhouette. One entry, wrong in all three columns.

### VIOLATION E — a RULED requirement is half-built, and Spec asserts the missing half as fact

Canon §2 row 4 [RULED, L14/O-2a]: *"trivial limb exempt **AND REPORTED**."*

- **Exempt: built.** `spec.ts:409 flapLimbMM: 40`; `judgement.ts:156-161` stamps every variant
  `tight` | `allowed` | `limb`; `:172` returns it on `SizeVariant`. This allowance is why duck,
  butterfly, bot and both pokes can answer at all.
- **Reported: not built.** `tier` outside `logic/`: **0 hits**. In `src/app/(dev)/grid-engine/`
  (`page.tsx`, `GridCanvas.tsx`): **0 hits**. Carried in the payload, rendered nowhere.
- **And Spec states the missing half as true** — `spec.ts:333` *"the trivial-limb exemption is
  REPORTED, never silent"*, repeated verbatim in the slider's `because` at `:527`, written
  2026-08-17.

A layout can win **because** 40 mm of hang was excused, and no surface distinguishes it from a tight
wrap. A policy that changes the answer while its own documentation certifies it visible is the
sprint's failure mode in miniature — and the reason to treat a spec sentence as a claim to verify,
never as evidence.

### PARTLY CLEAN — Spec

**Clean on the axis first checked:** zero computation (`grep` for `Math.` or inline arithmetic in
`spec.ts`: **0 hits**). Spec never measures.

**Not clean on the axis that matters more:** Spec *decides*. The permission table (D) is a decision
encoded as data that no material can reduce, and `spec.ts` asserts a behavioural guarantee that is
false on the surface (E). "Holds no maths" is only half the rule — the other half is **holds no
policy**, and the table breaks it.

*(Supersedes the earlier line in this document calling Spec "correct as built". That verdict was
issued after checking for computation only. Recorded rather than deleted — a verdict narrower than
its claim is exactly what this audit exists to catch, including when it is mine.)*

### The pattern, restated

None of A–E is a new failure. Each is the **same wrong-column error in another form**: a
legality-deciding tolerance hidden in the geometry layer; the geometry that registers the grid hidden
in the decision layer; ruled duties assigned to no layer at all; a Logic decision frozen into a Spec
table keyed by a measurement that never touches the silhouette; and a ruled requirement half-built
with the missing half certified as present in its own documentation.

Not one of them was a hard problem. Every one was a piece whose home nobody had written down —
which is the entire reason this document exists, and the reason it is worth nothing unless the
next change is checked against it.

— s62-kai-meta
