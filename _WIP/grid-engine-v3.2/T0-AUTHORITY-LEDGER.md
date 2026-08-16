# T0 — THE EXECUTABLE AUTHORITY LEDGER

**Task:** T0 of the governing proposal (`FINAL-CONSOLIDATED-PROPOSAL.md` @ `cf214601`, owner
s62-grid-meta-qa). **Scope:** compile the exact executable rule set from the two designated
briefs and later direct rulings. **Not** product discovery. No questionnaire. No code.

**Sources, in the authority order the briefs declare:**
1. **Dan's direct rulings** — vault- or pane-verified, cited inline.
2. **PB** = `ONEMO Magnetic Grid Compute System — Product Base and Logic Architecture.md`
   (Dan: *"latest, has more power"*).
   **LSO** = `logic-spec-optimum.md` (the focus brief).
3. **R3 contracts** — technical certification mechanics only, where compatible. **They cannot
   reopen a settled product decision.**
4. `grid-laws.md` (L-numbers) — only where non-conflicting with 1–2.

**Classification:**
- **RULED** — direct product requirement. Implement exactly.
- **CALIBRATED** — existing reversible value with provenance. Preserve unless execution disproves.
  Owner: **s62-kai** (builder) — reversible, replaced if execution disproves it.
- **ENGINEERING** — reversible implementation choice. Owner: **s62-kai**, who must verify it.

**PROVENANCE CONVENTION** *(meta's bar #1 — a RULED row must reach Dan's own words):*
Every RULED pointer resolves to one of three routes, and the route is stated so a reviewer can
re-walk it:
- **(V)** a captured Dan turn in the transcript vault — cite lane/date;
- **(B)** `grid-brief.md`, the verbatim record of Dan's directives with timestamps, built from
  the vault ("Dan's directives. VERBATIM. Nothing else.");
- **(D)** a designated brief — PB or LSO — which Dan named as authority.
**No row is RULED on my restatement or another lane's paraphrase.** Where a ruling exists only
as a lane relay (the collector drops mid-turn messages — `grid-laws.md` §F), it is marked
**(R)** and treated as CALIBRATED, not RULED. Rows the audits proved were my inference are in
§9 (displaced), never here.

---

## 1. PHYSICAL CONSTANTS

| # | Rule / value | Class | Source |
|---|---|---|---|
| 1.1 | Base cell **24 × 24 mm** | RULED | PB §2 |
| 1.2 | Protected disc **24 mm diameter / 12 mm radius** around every magnet centre | RULED | (D) PB §2 + (B) Dan 08-10 17:31 *"decided for 12mm padding — locked decision"* |
| 1.3 | Magnet-node pitch **48 mm**, one rigid lattice | RULED | PB §2–3 |
| 1.4 | **96 mm is the same lattice populated sparsely** — never a second grid | RULED | (B) Dan 08-11 14:35:07 *"96mm is lawfull sparse pair and actually prefered and proven sufficient"*; PB §3 |
| 1.5 | Sparse population **hides points; nothing is re-centred** | RULED | (V) Dan 08-11 08:35, meta lane day-file *"no need force centering — the view remains same just some points are hidden"* → **resolves R3 PD-04/PD-34 (96 mm origin parity): there is no separate origin choice** |
| 1.6 | **Legality = the complete closed 24 mm disc lies inside the cutout. Boundary tangency is legal.** | RULED | PB §2 |
| 1.7 | Actual magnet may be 6 / 8 / 10 mm inside the protected area | RULED | PB §2 |
| 1.8 | Units millimetres; operating floor **1 mm** — nothing below it exists | RULED | (V) Dan 08-11 evening, lead lane (L19 records it first-hand) |
| 1.9 | **Scale only, aspect locked.** No rotation, mirroring, deformation, independent region scaling | RULED | (B) Dan 08-10 18:39 / 08-09 23:25 + (D) PB §13 *"locked proportions only scaling was repeated 100 times"*; PB §13 |
| 1.10 | Published size rounds **up** to the next even millimetre | RULED | (B) Dan 08-10 17:04 |
| 1.11 | Candidate size step | **CALIBRATED = 2 mm** (owner s62-kai) | Source: `src/lib/grid-engine/spec.ts:331` (`sizeStepMM: 2`), guarded at `:416` (`{min:2,max:48}`). PB §2's "scale increment 12 mm" is an unadopted proposal — GPT's own review flagged it as never approved, and Dan asked its rationale rather than ruling it. Preserve 2 mm unless execution disproves. |

---

## 2. BANDS AND AXIS CLASSES

| # | Rule / value | Class | Source |
|---|---|---|---|
| 2.1 | **B1 24–72 · B2 72–120 · B3 120–168 · B4 168–216 · B5 216–264** | RULED | (D) PB §4 + (D) `gpt-pro/ChatGPT-Grid and Band Logic-20260816-1022.md` — Dan's band list at **line 178**, his correction at **line 349**: *"I made a mistake with bands missed the 168 we must return it to rightful place"* |
| 2.2 | **B5 exists** (216–264) **and participates in the certified offer domain** | RULED | Same source. **Resolved from the hierarchy, not asked:** PB §4 lists B5 as a band without qualification and PB §12 requires every candidate size be evaluated; no designated brief withholds it. `grid-laws.md` L4a's 168 mm cap binds the **twin-fix fixing type**, not the band, and is authority level 4 — it cannot narrow a level-2 band. Therefore the engine computes and offers B5; any commercial restriction is a presentation policy applied outside the engine. |
| 2.3 | Boundaries lower-inclusive, upper-exclusive; final maximum inclusive | RULED | PB §4 table (`24 ≤ side < 72` … `216 ≤ side ≤ 264`) |
| 2.4 | **Each axis classified independently**; overall band = the larger axis class | RULED | PB §4 |
| 2.5 | **Axis class is CAPACITY, never a compulsory layout** | RULED | PB §4 examples; Dan 08-16 band-count correction |
| 2.6 | **There is no band-count rule** — count comes from the class × band frame, reduced by material | RULED | (V) Dan 08-16, this lane's day-file: *"we do not have rule of band 1 = 1 magnet or band 2 having only pair — wrong as square in band 2 is 4 magnets — only narrow shapes that represent rectangular shape class produce pairs in band 2"* |
| 2.7 | B1 = one magnet is a **geometric consequence** (under 72 mm one node line fits per axis), not a law | RULED | 2.6 + 1.3 arithmetic |

---

## 3. CLASS TAXONOMY AND FRAME HYPOTHESES

| # | Rule / value | Class | Source |
|---|---|---|---|
| 3.1 | **The square is the standard; banding is defined by it. Rectangle is its per-axis derivative; everything else walks from there.** | RULED | (V) Dan 08-16, this lane's day-file: *"we have banding based on square as standard — rectangle is derivative and anything else walks from there"* |
| 3.2 | A frame of `n` magnet lines on an axis spans **2n − 1 base cells** | RULED | PB §5 |
| 3.3 | Square standards **24 · 72 · 120 · 168 · 216**; span = (n−1)·48 + 2·12 | RULED | Dan's own list; arithmetic from 1.2–1.3 |
| 3.4 | Frame vocabulary 1×1, 1×2, 2×1, 2×2, 2×3, 3×3, 4×4, 5×5 (and mixed) | RULED | PB §5 |
| 3.5 | Rectangle standards = the square standard applied per axis | RULED | 3.1 + PB §4 |
| 3.6 | Circle/oval standards **92 / 160 / 228** | CALIBRATED (owner s62-kai) | measured under disc-containment legality; preserve unless execution disproves |
| 3.7 | Free classes (tapered · waisted · standing · blob · winged · diagonal) inherit the frame of their nearest geometric ancestor; **material may reduce it, never inflate it** | RULED | LSO §5.2 walkthrough rulings; Dan 08-10 *"If shape is narrow it uses minimum 1column of 2rows … L shape by definition will have 1 + 2"* |
| 3.8 | The frame hypothesis is a **starting capacity**; the structural map (5.x) names the free class | RULED | PB §4–5, §8 |

---

## 4. REGISTRATION

| # | Rule / value | Class | Source |
|---|---|---|---|
| 4.1 | Canonical registration = frame centre on the cutout **bounding-box centre** | RULED | PB §6 |
| 4.2 | **Parity:** odd magnet-line count → centre axis through a node line; even → through the middle spacer line. Per axis. | RULED | PB §6; Dan 08-10 13:54 (the 4×4 / 1×2 centring question) |
| 4.3 | **Canonical is the first test and the deterministic origin — never automatically the winner.** Mechanics choose; canonical proximity acts only inside the final mechanically-equivalent set. | RULED | PB §6 *"Canonical registration is the first test, not automatically the final placement"*; carried through every R3 round |
| 4.4 | Translation search bounded to **one 48 × 48 mm period**; **rotation prohibited** | RULED | PB §6 |
| 4.5 | Search resolution / representation (continuous vs sampled) | ENGINEERING (owner s62-kai) | PB §6 *"configurable policy parameter"*; PB §21.1 defers it. Owned by T3/T4, verified by measurement. |

---

## 5. SHAPE REPRESENTATIONS AND STRUCTURAL EVIDENCE

| # | Rule / value | Class | Source |
|---|---|---|---|
| 5.1 | Three representations preserved: **outer silhouette · safe core · structural support graph** | RULED | PB §7 |
| 5.2 | Safe core = exact 12 mm full-disc erosion. **Never** from bbox approximation, raster sampling, cosmetic offset joins, or vertex-only distance | RULED | PB §7.2 |
| 5.3 | An irregular edge entering **any part** of the required disc invalidates that centre | RULED | PB §7.2; Dan's own question answered in the brief |
| 5.4 | Structural graph carries: major regions, marginal regions, terminal branches, connecting corridors, area, centroid, local clearance, local width, vertical position, **persistence across nearby sizes** | RULED | PB §7.3 |
| 5.5 | Strong vs marginal is **geometric, per size** — nothing is permanently labelled noise; a connector may be mechanically vital yet host no magnet | RULED | PB §8 |
| 5.6 | The numeric thresholds separating strong from marginal, and the clearance probe levels | ENGINEERING (owner s62-kai) | PB §21.2 explicitly defers them. Builder derives from measurement and verifies. **The `r+4/r+8/r+12` levels in my earlier draft were invented and are withdrawn.** |
| 5.7 | Final legality always re-proved on the exact silhouette, never on the structural abstraction | RULED | PB §7.3, §13 |

---

## 6. MECHANICAL SELECTION

| # | Rule / value | Class | Source |
|---|---|---|---|
| 6.1 | **Selection is lexicographic, not one opaque score** | RULED | PB §11 |
| 6.2 | The order: **1 legality · 2 coverage of major support regions · 3 support of the upper gravity-critical mass · 4 reduction of unsupported extent · 5 reduction of peel/flap leverage · 6 coherent approved pattern · 7 distribution across distinct masses · 8 geometric and visual balance · 9 lower magnet count when support is equivalent** | RULED | PB §11 verbatim |
| 6.3 | **More magnets never automatically better**; a layout may not be chosen for containing more | RULED | PB §11, §13 |
| 6.4 | The centroid is **evidence, not the placement rule** | RULED | PB §11 |
| 6.5 | Gravity: upper support preferred; a magnet below a large unsupported upper region does not hold it | RULED | (D) **PB §11.3** (my earlier §13.3 citation was wrong — §13 is Hard exclusions) + (B) Dan 08-13 12:18:31 *"gravity must not place magnets in the bottom and leave top unprotected"* |
| 6.6 | Flap is measured from the **padded grid bounding box** outward to the silhouette, per side | RULED | (B) Dan 08-11 14:13:59 — verbatim record; *note:* the vault holds this as a lane relay, the brief holds Dan's own text |
| 6.7a | **Method** — the limit is a two-position switch (12 or 24), never a third invented number; both positions implemented and measured on the corpus | **RULED** | (V) Dan 08-11 10:32, meta lane day-file: *"why do i need to rule if i never tested the difference in the real life - why noit add all options and test?"* |
| 6.7b | **Active value** — `flapTight = 12` is the current default | **CALIBRATED** (owner s62-kai) | Source: `spec.ts` `flapTightMM: 12`. **Selection gate:** the default changes only if the T2 corpus shows the 12 position rejecting a placement Dan has ruled good, or the 24 position admitting one he has rejected. Until that measurement exists, 12 stands and the measurement is a T7 deliverable. |
| 6.8 | The trivial-limb exemption is **measured and reported**, never applied silently | RULED | L14 + PB §19 (rejection reasons) |
| 6.9 | Peel/flap-leverage numerical definition | ENGINEERING (owner s62-kai) | PB §21.3 defers it. Must be a **measured moment** (material × lever arm), never an invented weight; builder verifies against constructed cases. |
| 6.10 | Tie-breaking tolerances between mechanically equivalent arrangements | ENGINEERING (owner s62-kai) | PB §21.5 defers it |
| 6.11 | Size selector after the nine: the **snug seat** — tightest wrap of the winning arrangement | RULED | (B) `grid-brief.md` 2026-08-13 12:18:31 — *"the tight fit law - is the preference to select sizes with minimal flap around magnets"* |
| 6.12 | Approved-pattern library is versioned; the engine **may not create arbitrary subsets to increase count** | RULED | PB §10 |
| 6.13 | Pattern families: single · vertical pair · horizontal pair · **diagonal pair (same lattice)** · L · row · column · T · rectangular four · approved larger extensions | RULED | (D) PB §10 + (B) `grid-brief.md` 2026-08-13 12:59 — *"diagonal is also correct it does not introduce separate grid it is the same one"* |
| 6.14 | Row/column skipping is lawful (the duck's skipped mid row); corner holds with optional middles | RULED | (B) `grid-brief.md` 2026-08-13 12:52 (*"skipping mid row"*) and 12:53 (*"3 magnets utmost corners only mid 2 rows are optional"*) |

---

## 7. SIZE AND OFFER POLICY

| # | Rule / value | Class | Source |
|---|---|---|---|
| 7.1 | **Every candidate size evaluated independently.** No result inferred from a smaller or larger size | RULED | PB §12 |
| 7.2 | A band returns **all distinct optima its range unlocks**, with **one marked** as the guaranteed answer | RULED | **Captured source (V):** Dan 2026-08-16 10:52:27, this lane's day-file line 219 — *"i tested on the other shapes via upload and noticed that bands while having more than 1 optimal choice at different scales - engine does not show them all only 1"*, with *"Band 4 stopped at 168 but could have shown extra ... at 200-216mm range"*. **DERIVATION:** the normalized rule wording ("all optimal sizes and layouts if range permits") is **my normalization of an uncaptured mid-turn message**, not a captured turn — it is a derivation and is labelled as one. The marking half is (D) L17. |
| 7.3 | **Distinct = distinct governed window/scale identity** — never "more magnets" | RULED | Dan's own wording is scale-based: *"more than 1 optimal choice at different scales"*, *"Band 4 stopped at 168 but could have shown extra at 200-216mm range"*; PB §11.9 + §13 forbid count as the driver |
| 7.4 | A size may be **rejected with a machine-readable reason** — refusal is a legitimate outcome | RULED | PB §19 |
| 7.5 | Presentation cap on how many offers are shown | ENGINEERING (owner s62-kai) | applied only after the complete certified set exists |

---

## 8. OUTPUT CONTRACT  *(PB §19 — RULED in full)*

Every accepted size returns: band · exact width · exact height · scale factor · axis class X ·
axis class Y · node frame · registration offset · selected pattern ID · selected node addresses ·
magnet centres (mm) · minimum edge clearance · supported structural regions · unsupported-extent
metrics · gravity-support result · validation status · deterministic decision reasons.

Every rejected size returns a machine-readable reason (safe core empty · no strong grid node ·
no approved lawful pattern · upper critical mass unsupported · excessive unsupported extent ·
registration search exhausted).

Coordinates available as **both** board/node addresses and exact cutout-relative millimetres
(PB §17). Identity hashes (profile · Compute artifact · Logic artifact) — **ENGINEERING**,
mechanics taken from the compatible R3 certification reference.

---

## 8A. INPUT BOUNDARY  *(QA correction 3 — PB §15)*

| # | Input | Class | Requirement |
|---|---|---|---|
| 8A.1 | `outline` | RULED | **One validated simple closed polygon**, millimetres (D) PB §15 |
| 8A.2 | `top_direction` | RULED | Required — gravity evaluation is undefined without it (D) PB §15 |
| 8A.3 | `size_domain` | RULED | The permitted physical size range (D) PB §15 |
| 8A.4 | `size_step` | CALIBRATED (s62-kai) | 2 mm — see 1.11 |
| 8A.5 | `grid_profile` | RULED | 24 mm cells / 48 mm nodes (D) PB §15 |
| 8A.6 | `safety_profile` | RULED | 12 mm radius (D) PB §15 |
| 8A.7 | `pattern_policy_version` · `selection_policy_version` | RULED | Versioned, immutable once released (D) PB §15 |
| 8A.8 | **Holes and disconnected outlines HARD-REJECT in V1** | RULED | (D) PB §15 *"Initial scope excludes holes and disconnected silhouettes"* — reject with a reason, never silently repair |

---

## 8B. THE MECHANICS REGISTRY  *(QA correction 1 — the complete descriptor set)*

PB §21.2–5 defers these numerics to "a later mathematical decision"; that decision is
**ENGINEERING, owner s62-kai**, and each row carries its **completeness-proof duty** — the
obligation meta's T4.3 correction established (a criterion's optimum over a continuous feasible
region is not necessarily at a vertex).

| Descriptor | Formula | Direction | Units | Tolerance | Completeness-proof duty |
|---|---|---|---|---|---|
| **coverage** | fraction of major regions (5.4) containing ≥1 anchor | maximise | dimensionless | exact (integer counts) | **NOT discrete per candidate.** Which regions an anchor set covers **changes as the registration moves across `F`**; the value is piecewise-constant over a partition of `F`. Duty: a **certified partition of `F` into constant-coverage cells** with the argopt cell set returned — never one sampled registration. |
| **upperSupport** | material area above the **padded support boundary** — the block edge, one padding radius (12 mm) above the topmost anchor centre-line — ÷ block width | minimise | mm | coordinate quantum (8C.1) | **QA f078dfae correction:** the earlier formula used the anchor centre-line and so counted protected material as hanging mass. Reference line is the protected boundary. **Completeness duty deferred to T5's proof** — no optimisation shortcut is asserted here. |
| **unsupportedExtent** | per side, outline reach beyond the padded block edge (6.6); score = max side; exempt limb regions **returned as data** (6.8) | minimise | mm | coordinate quantum | **QA counterexample, accepted:** the score is a **max of linear functions** — convex, and on a symmetric feasible square `max(C+x, C−x, C+y, C−y)` is minimised at the strict interior `(0,0)`, not at any vertex or directional extremum. My earlier duty repeated the rejected critical-set recipe. Duty: **certified global argmin over `F` in its own right** (convex-program or certified subdivision), interior admissible. |
| **peelLeverage** | first moment of unsupported material about the padded support boundary: ∫(reach beyond edge)·dA | minimise | mm³ | quantum × area scale | **Convexity is NOT claimed** (unproved — QA f078dfae). Duty: **certified global argmin over `F`** by a method that does not assume convexity (certified subdivision with bounds), interior admissible. |
| **distribution** | count of distinct major masses holding ≥1 anchor; tie-break by variance of anchors per mass | maximise, then minimise | dimensionless | exact | **Same defect, same duty as coverage** — piecewise-constant over `F`, requires the certified partition and argopt cells, not a representative registration. |
| **balance** | ‖anchorCentroid(t) − materialCentroid‖² | minimise | mm² | quantum² | Convex quadratic **with a proof**: unconstrained minimiser projected onto `F`; optimum may be strictly interior. The one row whose completeness argument is established rather than deferred. |
| **count** | number of anchors | minimise **only at equivalent support** (6.2 pos. 9) | dimensionless | exact | discrete |

**THE T5 COMPLETENESS INVARIANT — governing plan `2e6bd212`, binding on every row below.**
Every **registration-sensitive** descriptor must certify its **global optimum over the whole feasible set `F`** by exactly one of:
1. **exact argopt** — the optimal set computed in closed form or by a certified program;
2. **interval-refined equivalent set** — a conservative set proven to contain the optimum, refined until dominance is decided;
3. **`DECISION_INDETERMINATE`** — returned honestly when neither can be established within budget.

**No recipe based on vertices, canonical projections, directional extrema or any fixed sample may imply completeness** — that is the defect meta identified as systemic after it recurred in my critical set (T4.3) and again in this registry's first draft. **Each descriptor owes its own proof**; a proof for one does not transfer to another. T5 may not implement a descriptor whose completeness is unproved, and a descriptor that cannot certify must return indeterminate rather than a plausible answer.

**Comparator:** lexicographic in the 6.2 order; a descriptor decides only when all earlier ones
tie **within their stated tolerance**; equality inside tolerance carries both candidates forward
(no silent pruning of a legal contender).

### 8B.1 Unsupported-extent definition *(QA correction 1, explicitly)*
Unsupported extent = the outline's reach beyond the **padded grid bounding box** (6.6), measured
per side, in millimetres, at the evaluated size. The **score** is the maximum side; the per-side
vector and any limb-exempt regions are **returned as evidence** (6.8, 8.x). It is *not* the gap
between magnets (Dan 08-11: *"between magnets? flap = outer edges not supported by magnet
connection and hold"* — (B) `grid-brief.md` 14:02:54).

### 8B.2 Pattern-permission matrix *(QA correction 1)*
**ENGINEERING, owner s62-kai — derived, never invented.** A pattern is permitted for a
(axis-class X, axis-class Y, band, population) tuple **iff** its node frame fits inside the axis
capacities (2.5, 3.2) **and** its population (48 or 96) is realisable at that size on the one
lattice (1.3–1.4). Nothing else may narrow or widen the set; the matrix is generated from those
two conditions and recorded per profile version, not hand-authored per shape.

---

## 8C. NUMERIC AND CERTIFICATION INPUTS  *(QA correction 1)*

| # | Input | Class | Value / duty |
|---|---|---|---|
| 8C.1 | Coordinate quantum | ENGINEERING (s62-kai) | Internal integer arithmetic at **1 µm** (Clipper2 `SCALE = 1000`, the existing convention in `compute/offset.ts`); published sizes remain even millimetres (1.10). Proof duty: exact tangency legal at the quantum, one-quantum intrusion illegal. |
| 8C.2 | Approximation / error envelope | ENGINEERING (s62-kai) | Any polygonal approximation of the safe core must be **conservative inward** with a stated ε, so a lawful placement can never be silently erased. Proof duty: demonstrate the sandwich relation; return `INDETERMINATE_WITHIN_TOLERANCE` rather than certify empty. |
| 8C.3 | Input vertex budget | ENGINEERING (s62-kai) | Not yet measured. Proof duty: establish at T3 on the real corpus and record the number; until measured, no vertex claim may be made. |
| 8C.4 | Runtime / memory gates | ENGINEERING (s62-kai) | R3's 16 ms / 50 ms is **provisional and not a Dan ruling**, so it is not itself the gate. **T3 selects and RECORDS the engineering runtime and memory gate from its measured probe; that recorded number becomes binding, and T7 FAILS if it is missed.** Reporting a miss is not sufficient — a non-falsifiable target is not a gate. |
| 8C.5 | Determinism | **ENGINEERING** (s62-kai) | Byte-identical canonical output for the same outline + profile + artifacts is an **R3 certification mechanism**, and R3 is a technical reference — it cannot carry (D). What *is* RULED is PB §19's "deterministic decision reasons". Classified ENGINEERING with the proof duty: two runs, byte-identical. |

---

## 8D. RESULT IDENTITY AND OUTPUT CONTRACT  *(QA correction 2 — replaces the narrow §8)*

**Identity — ENGINEERING (s62-kai), R3-derived certification mechanics** (not PB-ruled; recorded here because T6 consumes it):
source-geometry identity (canonical outline hash) · governed size/window · population ID and
origin parity · frame · pattern and variant · registration · profile hash · Compute artifact
hash · Logic artifact hash · canonical output hash.

**Result payload — RULED (D) PB §19, in full:** band · exact width · exact height · scale factor · axis
class X · axis class Y · node frame · registration offset · selected pattern ID · selected node
addresses · magnet centres (mm) · minimum edge clearance · supported structural regions ·
unsupported-extent metrics (per-side vector + score + exempt regions) · gravity-support result ·
**proof / uncertainty status** · validation status · deterministic decision reasons.

**Rejection payload — RULED (D) PB §19** for the listed reasons; the indeterminate codes are **ENGINEERING** (R3-derived): machine-readable reason — safe core empty · no strong grid node · no
approved lawful pattern · upper critical mass unsupported · excessive unsupported extent ·
registration search exhausted · **legality indeterminate** · **decision indeterminate**.

Coordinates available as **both** board/node addresses and exact cutout-relative millimetres
(D) PB §17.

---

## 9. DISPLACED CLAUSES  *(recorded, not blended — the displaced text is named so it cannot creep back)*

| Displaced | Winner | Why |
|---|---|---|
| **Cross-band out-counting** ("every band's answer carries more magnets than the band below") | 2.6 class × band frame | My inference; QA established the vault holds only my restatement. Conflicts with **6.2 position 9 (fewer at equivalent support)** and **6.3** — not with 6.9, which is peel leverage. |
| **Band separation "≥24 mm above the previous answer"** as search pruning | 7.1 independent per-size evaluation (PB §12) | My inference. May return only as an offer-presentation rule if ever traced to Dan's words — never as domain truncation. |
| **"Distinct optimum = the grid grew in magnets"** | 7.3 window/scale identity | My proxy, withdrawn. |
| **"Every band must answer"** as a hard law | 7.4 refusal-with-reason (PB §19) | My restatement; the brief makes refusal legitimate and explained. |
| **Universal `targetMagnets` (B1=1 / B2=2)** | 2.6 | Dan's 08-16 direct correction. |
| **Band-4 upper-hold exception at 40 mm** | 6.2 order + 6.9 measured leverage | Dan ruled the bottom-heavy *principle*; the number was mine. No band may weaken a hold law by special case. |
| **`sideHangMM`** (side area ÷ candidate block height) | 6.6 flap from the padded grid box | Dimensionally unstable — a taller candidate makes the same unsupported mass look safer. |
| **Sparse-spread as a standalone ranking key** | 6.2 position 9 | Sparseness enters only as fewer-at-equivalent-support. |
| **L18 "shape encapsulates the grid bounding box" as the legality test** | 1.6 full-disc containment (PB §2) | Later designated brief governs legality. L18's flap-measurement clause (6.6) is unaffected and stays. |
| **PB §2 "scale increment 12 mm"** | 1.11 CALIBRATED 2 mm | Unadopted proposal, flagged by its own author; Dan asked its rationale rather than ruling it. |
| **`maxTestedMM` 214** | 2.1 band ceiling | Stale v1-era value; the band top binds. |

---

## 10. RESIDUAL — GENUINELY UNRESOLVED AFTER EXHAUSTING SOURCES

**One item.**

| Item | Owner | When it blocks | Why not askable now |
|---|---|---|---|
| Identity of the uploaded contour that exposed the missing 200–216 mm optimum | Dan | The **final replacement gate** only | Searched: transcript names only screenshots (since deleted); the repo carries the seven library shapes and the fixture corpus the same seven; a screenshot is not a contour. Characterised from the frames seen: rounded organic blob, B1 36 / B2 80 / B3 122·4pt / B4 168·6pt at 171×214 mm on a 5×5·192 field — none of the seven. Neutral Compute work does not depend on it. |

**Formerly "open", now resolved from source — no question owed:**
B5 existence (2.2) · flap switch method (6.7) · 96 mm origin parity (1.5) · the three focus-spec
contradictions (§9 rows 1–3) · bat B4 "or B5" — withdrawn as premature: Dan ruled band 4 has an
answer (*"band 4 is the easiest band to fit … at least 4 points is easy"*) and no honest
infeasibility claim exists before certified placement; it is an engineering finding pending T4.

**Not decisions, therefore not listed as open:** butterfly B4 four-vs-six · bot B1 44-vs-60 ·
pill B4 population · poke2's unwalked rows. These are **outcomes** the mechanics registry
produces once implemented; the T2 oracle records them as observed and they reach Dan as
calibration events, never as questions.

---

## 11. CROSSWALK — every task input, to its ledger row

*(QA necessity finding: the previous §11 self-certified with checkmarks. Replaced by the
crosswalk a reviewer can walk. A task input with no row here is a ledger gap, by definition.)*

| Task | Input it consumes | Ledger row |
|---|---|---|
| T2 oracle | square/rect/circle standards | 3.3 · 3.5 · 3.6 |
| T2 | band boundaries and inclusivity | 2.1 · 2.3 |
| T2 | ruled frames + observed split | 6.x sources; §10 outcomes note |
| T3 probe | coordinate quantum · error envelope · vertex budget · perf gates | 8C.1–8C.4 |
| T3 | determinism requirement | 8C.5 |
| T4 safe core | radius, exactness, prohibited constructions | 1.2 · 1.6 · 5.2 · 5.3 |
| T4 feasibility | translation domain, rotation ban, representation | 4.4 · 4.5 · 8C.2 |
| T4 | input rejection (holes/disconnected) | 8A.8 |
| T5 regions | region attributes + persistence | 5.4 · 5.5 |
| T5 | strong/marginal thresholds + probe levels | 5.6 (ENGINEERING) |
| T5 descriptors | formula · direction · units · tolerance · completeness | 8B (all rows) |
| T5 | unsupported-extent definition | 8B.1 |
| T6 funnel | axis classes → band → frame → parity → permissions → nodes → placement | 2.4 · 2.5 · 3.2 · 3.4 · 4.1 · 4.2 · 8B.2 · 5.4 |
| T6 selection | the nine, lexicographic | 6.1 · 6.2 · 6.3 · 6.4 |
| T6 sizing | independent per size · snug seat | 7.1 · 6.11 · 1.10 · 1.11 |
| T6 offer | all distinct optima · one marked · distinctness · refusal | 7.2 · 7.3 · 7.4 · 7.5 |
| T6 identity/result | full identity + payload + rejection codes | 8D |
| T7 gate | flap-switch measurement · perf report · determinism | 6.7a · 6.7b · 8C.4 · 8C.5 |
| T9 UI | result identity as chip key · refusal display | 8D |

| T1 | which mechanisms to subtract, and the authority for each | §9 displaced clauses · 2.6 · 6.2 · 6.3 · 7.1 · 7.3 |
| T7 | live visual gate — real surface, provenance, captured frames | 8D result payload (what a frame must evidence) · 6.7a |
| T8 | what may be deleted once the replacement passes | §9 · T0b's UNGOVERNED list |

**Scope of this crosswalk, stated honestly (QA f078dfae):** it enumerates **task inputs → rows**. It does **not** claim the reverse enumeration is complete, and the earlier "no unmapped inputs / no unconsumed rows" claims are **withdrawn**. Rows not appearing above (1.7 · 1.8 · 2.7 · 3.7 · 3.8 · 5.7 · 6.8 · 6.12 · 6.13 · 6.14 · 8A.2 · 8C.5) are **constraints the tasks must honour rather than inputs they read** — they are enforced through T7's gate, not consumed by a step. That distinction is the honest form of the claim I over-stated.
