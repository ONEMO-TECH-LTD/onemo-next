# FINAL PROPOSAL — v3.2 → THE PRODUCT SELECTOR

**Status:** proposal for review. **Nothing is built until Dan says go.**
**Supersedes** `v3.2-completion-proposal.md`, `v3.2-consolidated-plan.md` and
`v3.2-task-breakdown.md` — this is the single document; those remain as history.

**Produced by:** s62-kai (builder lane), read-only audit under /o-necessity.
**Reviewed into by:** s62-grid-qa (three audit documents) and s62-kai-meta (conformance audit,
four corrections). Every correction they made to my claims is recorded in §8, unburied.

---

## 1. AUTHORITY ORDER  *(binding — settled by QA's finding)*

1. **Dan's direct rulings** — his own words, vault- or pane-verified.
2. **The amended R3 contracts** (`00-system-contract`, `01-compute-engine-spec`,
   `02-logic-engine-spec`) + the GPT Pro product-base document
   (*ONEMO Magnetic Grid Compute System — Product Base and Logic Architecture*).
3. `logic-spec-optimum.md` — **only where it does not conflict with 1 or 2.** It carries three
   unresolved internal contradictions (§7) and values I promoted from inference to law. It is a
   synthesis, not the governing authority.
4. **The canon fixtures are NOT authority.** They encode what the bench returns, re-pinned to
   law-derived winners. Passing rows are regression evidence only.

*Provenance notes:* the 16ms/50ms budget is R3's **provisional** target, not a Dan ruling. QA's
"install v3.3.1" wording is moot — that artifact is dead (§2); the correct reading, and what this
proposal does, is **in-house implementation of the same contract**.

---

## 2. STATE OF PLAY  *(verified by execution, not assertion)*

| Thing | State | Evidence |
|---|---|---|
| GPT Pro engine | **Dead** | "Repaired" delivery byte-identical to the failed original — three archives same SHA-256; master = 19 files, no source tree; reports claim repairs its own bytes contradict |
| v3.3 | **Not ready** | No audited implementation exists |
| v3.2 | **NON-CONFORMANT** (QA) / PARTIAL (mine) — same substance | Exact-geometry substrate sound; search/selection/offer must be replaced |
| Current suite | **Red** | 91/97 (mine) · 93/97 (QA isolated rerun) · five canon shapes failing |
| Current speed | **Non-conformant by orders of magnitude** | Bat solve **42.2s** on the live bench; canon gate 372s; full suite ~6 min |
| The phase flood | **Broke protected bands** | Duck B3, Butterfly B3, Poke1 B2, Poke2 B3 were green before it |
| Bat band 4 | **Open defect** | Dan rejected both presentations: *"1st is same as before = not optimal and second is same situation with added column"* |

---

## 3. THE REUSE BOUNDARY

**PRESERVE — untouched by every task below:**
exact contour preparation and legality predicates (`prepareExactContour`,
`distanceToPreparedContour`, `pointInPreparedContour` — BVH + y-interval accelerated) · exact
construction verification (`computePreparedGrid(prepared, {construction})`, the proof door) ·
independently-validated neutral measures · `bridge.ts` and the module separation · the UI scaffold
and its variant rendering · guarded configuration mechanics (refuse-never-clamp, deep-frozen
templates) · source contours and Dan's directly-ratified frames as test inputs.

**REPLACE:**
`logic/judgement.ts` search · ranking · offer assembly · fallback · band-target/count-growth
policy · the phase/sub-window growth door · the candidate-dependent side-mass proxy ·
topology-only result identity · rejection-by-discard · the re-pinned canon expectations.

**DELETE once the replacement passes its gate:**
the 2mm template sweep as search · the phase flood · cross-band search truncation · the
increasing-count ladder · the inferred B4 40mm exception · `probe-winners.test.ts` **and**
`probe-bat4.test.ts` · the `B4DEBUG` branch · every superseded parallel selector path.

**Primitives already in the repo — probed, not assumed:**
`@countertype/clipper2-ts` (pure-TS integer polygon booleans + offsetting, already used by
`compute/offset.ts`) · the BVH and y-interval trees in `compute/grid-prepared.ts` — **the exact
acceleration the prior certified implementation lacked.**

---

## 4. THE TASKS

One task = one commit = one pushed snapshot. Each states **objective · method · verification**.

### T0 — CLEAR THE TREE
- **Objective:** the unverified working edits do not survive into the rebuild by accident.
- **Method:** `git checkout -- src/lib/grid-engine/logic/judgement.ts`. The two salvageable
  ideas in it (tier judged on mass; ruled names preserved through twin-merge) are re-expressed
  inside T5's descriptors, never carried as patches.
- **Verification:** `git status` clean.
- **Snapshot:** none — nothing to commit.

### T1 — RESTORE THE ENGINE TO `60656152`
- **Objective:** start from the last state clean of all four condemned mechanisms.
- **Why this commit:** verified by direct inspection — growth door 0 · count ladder 0 · phase
  flood 0 · side-hang proxy 0. Its bat B3 (`tee-96·146`) is the frame Dan approved
  (*"band 3 - correct"*). **Two earlier targets were wrong and are struck:** `4bf5043a` (Dan
  rejected its band 4) and `9123ba3d` (meta C1 — it *is* the growth-door + ladder commit).
- **This base is least-wrong, not good.** It still carries `targetMagnets` (5 sites),
  sparse-spread, the honest-population law and the out-counting law — T2 removes them. Band 4
  remains an open defect here.
- **Method:** `git checkout 60656152 -- src/lib/grid-engine/` then commit forward. **No reset,
  no force-push** — history stays intact and the restore is itself a snapshot.
- **Verification:** `git diff 60656152 -- src/lib/grid-engine/` empty · full suite run **today**
  and the number recorded as measured (96/96 was measured when it landed — that is history, not
  proof) · bench restarted, proven serving the restored commit by `lsof` → tree → `git log` ·
  bat B1–B3 frames captured and matched to Dan's approved ones · **no canon expectation
  re-pinned** to anything a regressed build produced.

### T2 — DELETE THE CONDEMNED MECHANISMS  *(six commits, in this order)*

Separated so any answer that moves is attributable to exactly one deletion. **Every commit body
names each shape whose answer changed, before and after.**

| # | Deletion | Method | Extra verification |
|---|---|---|---|
| T2.1 | **Band-count law** | Remove ranking key 1d from `better()`; remove `targetMagnets` from `BandSpec`, the four band rows, and any writer/limit. Typecheck drives out the rest. | Dan's ruling: *"we do not have rule of band 1 = 1 magnet or band 2 having only pair — square in band 2 is 4 magnets"* |
| T2.2 | **Sparse-spread standalone key** | Delete the `spreadCapMM`/`nearestAnchorMM` comparison block. | Sparseness returns only inside "fewer at equivalent support" (T5.3) |
| T2.3 | **Count-direction flip + fullest-per-footprint** | Delete the `band.stepUp ?` ternary in key 4b; delete the `fullest` branch in footprint dedup. | Contradicts §11.9 — count may never win upward |
| T2.4 | **Cross-band pruning + out-counting** | `judgeShape` stops carrying `sizeFloorMM`/`prevCount`; `judgeBand` starts at `band.minSizeMM`; remove the `> prevCount` filter and the `maxOffered` ladder. | **Demonstrate** a previously-hidden later-band answer reappearing (the 200–216 case) |
| T2.5 | **Dead ceiling `maxTestedMM`** | Delete value, writer entry, limits row, boundary-fixture row. | Band top (216) is the real bound |
| T2.6 | **Test residue** | Delete `probe-winners.test.ts`, `probe-bat4.test.ts`, the `B4DEBUG` block. | Both are print-only, assertion-free, and rerun full solves inside the gate |

### T3 — REBUILD THE ACCEPTANCE ORACLE FROM DAN'S EVIDENCE  *(before any engine work)*

- **T3.1 — the standards gate** *(new `__tests__/standards-gate.test.ts`)*
  **Objective:** the calibration control that does not exist today — and whose absence let the
  band-count mis-derivation survive undetected, because every shape in the corpus is a
  free/narrow class.
  **Method:** synthetic exact contours — square, tall rectangle, wide rectangle, circle — solved
  through the real door at the standard sizes; assert the frames the square standard requires
  (1 · 2×2 · 3×3 · 4×4 · 5×5), the per-axis combinations for rectangles, and the circle's
  measured padding growth (92 / 160 / 228).
  **Verification:** it runs and either passes or names the first genuine class defect. A failure
  here is a finding, not a blocker.

- **T3.2 — the missing contour**
  **Objective:** the shape that exposed the absent 200–216mm optimum is not in the corpus.
  **Method:** trace it through the bench's own `engineOutline` door and add to
  `__fixtures-canon-shapes.json`, same as the other seven.
  **BLOCKED:** Dan must identify which upload it was.

- **T3.3 — re-author the canon expectations**
  **Objective:** the gate can no longer pass by agreeing with itself.
  **Method:** split every row into **ruled** (hard assertion, source comment citing Dan's words)
  and **observed** (recorded to a report; asserted only for legality, never for family). Bat B4
  is observed, explicitly, until Dan rules. Assertions check what the contract requires — region
  coverage, registration/window identity, flap optimum, failure semantics — not
  count-plus-loose-family.
  **Verification:** no assertion without a citation · no expectation traceable only to a previous
  engine run.

### T4 — CERTIFIED PLACEMENT  *(the real build)*

**Context that governs this task:** the R3 certified contract is **not untested**. GPT's build
was that contract, and meta's R6 audit measured it returning `DECISION_INDETERMINATE` at 60mm
(23.3s) and 96mm (54.9s), with 18–36s previews across all seven shapes, **because it had no
spatial acceleration**. Adopting the contract buys correctness, not speed — speed is ours to earn
by building on v1's existing accelerated predicates.

**Why this architecture nonetheless:** the same adaptive approach survived five independent
adversarial attacks in R6 — zero-area corridor found exactly · too-narrow corridor **certified**
infeasible rather than guessed · the concave notch that broke Grok's kernel produced **zero false
seats** · a starved budget degraded honestly to INDETERMINATE instead of inventing an answer ·
a hairline ±0.01mm seat found. It is attack-proven where the current heuristic flood is not.

- **T4.1 — the safe core** *(new `compute/safe-core.ts`)*
  **Method:** Clipper2 `InflatePaths(−radius, round joins)` on the scaled contour in integer
  units, then **shrunk by the stated approximation epsilon** so the result is provably *inside*
  the true region — false-negative-safe per the R3 contract, so a narrow-but-valid seat can never
  silently vanish. Holes handled by the same call.
  **Verification:** every returned point passes `distanceToPreparedContour ≥ r` on the exact
  predicate · exact tangency (distance = r) included · a 0.01mm intrusion excluded.

- **T4.2 — feasible translations** *(new `compute/feasibility.ts`)*
  **Method:** for a pattern with offsets `o₁…oₖ`, the lawful translation set is
  `F = ⋂ᵢ (SafeCore − oᵢ)` — translate the safe core by each offset and intersect, all in
  Clipper2 integer space. `F` empty ⇒ **certified infeasible**, not "not found".
  **Verification:** the five adversarial cases above, each reproduced.

- **T4.3 — the critical set**
  **Method:** candidates = vertices of `F` + the canonical registration point projected into `F` +
  the extremal points of `F` along each criterion direction. Every candidate re-proved through
  `computePreparedGrid(..., {construction})` on the BVH-backed predicates. **No sampled
  representative ever stands in for a region.**
  **Verification (two hard criteria from meta C3):**
  1. the certified path must **actually certify** — not `INDETERMINATE` — on the real canon
     contours at product vertex counts; an engine that cannot decide is not a replacement;
  2. the feasibility search must run on **v1's accelerated predicates**, never freshly-written
     linear scans — this is the precise defect that made the prior implementation unusable.
  Plus: A/B against the old sweep used **only** as a falsification oracle (it may not find
  something we miss) · runtime measured and reported against R3's provisional 16ms/50ms.

### T5 — THE GOVERNING COMPARATOR

- **T5.1 — the region graph** *(new `compute/regions.ts`)*
  **Objective:** make "covers the major masses" a measurement instead of a class heuristic.
  **Method:** erode at several clearances (r, r+4, r+8, r+12) via the same Clipper2 path; extract
  connected components at each level; per component record area, centroid, local width, vertical
  position and **persistence** (levels survived). Pure measurement — thresholds live in the
  profile.
  **Verification:** the bat's map reads head-mass / narrow connector / broad lower mass with **no
  shape name anywhere in the code** · ear tips and neck drop out by measurement, per size · the
  existing counterexample suite still passes.

- **T5.2 — criterion descriptors** *(new `logic/criteria.ts`)*
  **Method:** each rule becomes a named, versioned, independently testable function returning a
  value plus its tolerance: `coverage` · `upperSupport` (material above the top anchor line,
  mass-weighted) · `unsupportedExtent` (per-side wrap against the 12/24 switch, limb exemption
  **returned as data, not applied silently**) · `peelLeverage` · `patternAdmission` ·
  `distribution` · `balance` (evenness across all sides at once) · `count`.
  **Verification:** each descriptor unit-tested on a purpose-built synthetic shape where its
  answer is known by construction.

- **T5.3 — the comparator**
  **Method:** `better()` replaced by `compare(a, b, profile)` applying descriptors in the
  governing order: **legality → coverage of major regions → upper gravity-critical support →
  unsupported extent → peel leverage → approved pattern → distribution across masses → balance →
  fewer magnets at equivalent support**; then the snug seat selects the size. `structureScore`,
  `isCorners`, the fit tier and the mass-axis buckets retire into descriptors or vanish. **The
  current `tier` is not moved across — its definition is unsound** (`allowed` ignores side flap
  entirely).
  **Verification:** constructed pairs prove each position — a candidate better only on rule *n*
  beats one better only on *n+1* · every ruled canon frame holds · every moved answer goes to Dan
  with its frame.

### T6 — RESULT IDENTITY AND THE OFFER
- **Method:** `layoutIdentity` (topology only) → `solutionIdentity` = topology + window step +
  registration + size. Offer assembly: group certified optima by governed window step, one per
  step, **equal-count optima at different windows both survive**, mark one bulls-eye, return the
  rest ordered, attach a machine-readable reason to every rejected size. **The fallback is
  deleted** — where certification cannot complete, the band returns the contract's indeterminate
  result with its reason. `optionsPerBand` caps presentation only after the complete ordered set
  exists; it never defines correctness.
- **Verification:** two equal-count optima at different windows both appear · the bat's 200–216
  case is present or explicitly reasoned absent · no answer can originate from a fallback.

### T7 — THE GATE
- **Method:** standards gate · ruled canon rows · the uploaded contour · the adversarial set ·
  determinism (two runs byte-identical) · measured performance · **and the visual gate** — frames
  captured on the live bench at the exact commit, provenance proven, my eyes on each, before any
  claim of done.
- **Verification:** all green, or the failures named with no claim of done.

### T8 — DELETE THE SUPERSEDED PATH
- **Method:** remove the 2mm template sweep as *search* (the template library survives as the
  pattern registry), the auto-search door, `shapeStructure`/`structureScore`/`isCorners`, and
  every remnant of the old ranking. **Only after T7 passes. No two selectors ship.**
- **Verification:** suite green after removal · no import of the removed path remains.

### T9 — WIRE THE BENCH
- **Method:** chip key becomes `solutionIdentity`; rejection reasons rendered; the bulls-eye
  marked visually. UI edit only — no logic crosses into the shell.
- **Verification:** eyes on the bench — the marked answer is distinguishable and a refusing band
  says why.

---

## 5. SEQUENCING AND DEPENDENCIES

- **T0 → T1 → T2** are pure removal, reversible, each its own snapshot.
- **T3 must precede T4 and T5.** Building against a self-agreeing gate is exactly how the current
  state was reached.
- **T4 and T5.1 are the real work**; T5.2/5.3, T6, T8, T9 are assembly on top of them.
- **T3.2 is blocked** on Dan naming the contour.
- **No time estimates** — QA struck my last ones as unsupported, correctly.

---

## 6. EXPLICITLY DEFERRED  *(named, not smuggled)*

Package cut · ManufacturingSpec output · B5 band · fulfilment tolerances · adoption of any
external engine code.

---

## 7. OPEN — DAN'S, NOT OURS

1. **Three contradictions inside `logic-spec-optimum.md`**, each needing a stated winner:
   (a) "no band-count law" vs "every band out-counts the previous";
   (b) "every size evaluated independently" vs the previous-answer size floor;
   (c) "fewer magnets last, at equivalent support" vs "a distinct optimum means the grid grew in
   magnets".
   Until resolved, those clauses govern nothing.
2. **Bat band 4:** does it have an answer inside 168–216 at all, or does its tight face-and-skirt
   co-registration at ~219mm mean the honest answer is B5? The engine cannot decide this.
3. **T3.2:** which uploaded contour exposed the missing 200–216mm optimum.

---

## 8. AUDIT TRAIL — WHERE I WAS CORRECTED

| My claim | Corrected by | Correction |
|---|---|---|
| B4 40mm allowance "RULED" | QA | Inference. Dan ruled the bottom-heavy principle; the number is mine. Removed from code. |
| Cross-band +24 / identity suppression / out-counting "RULED" | QA | Not established, and they conflict with independent per-size evaluation. |
| Structure law "KEEP" | QA | Temporary oracle only; retires when region coverage exists. |
| Grid-growth door "KEEP substrate" | QA | Rejected for production — ungoverned, combinatorial, slow. |
| Canon harness as acceptance authority | QA | Rejected — mutable, re-pinned from engine output. |
| "Nothing else is unnecessary" | QA | Wrong — flood, cross-band pruning, side proxy, fallback, count-growth logic, debug branch and both probes are unnecessary. |
| `probe-winners.test.ts` only | QA | Missed `probe-bat4.test.ts`. |
| Performance absent from my audit | QA | Material omission — 42s vs a 16ms target is a conformance failure, not a later optimization. |
| "Steps 1–2 are a day" | QA | Struck — no schedule evidence. |
| Restore to `4bf5043a` | QA + Dan's words | Wrong — Dan rejected its band 4. |
| Restore to `9123ba3d` | meta C1, confirmed by inspection | Wrong again — that IS the growth-door + ladder commit. Verified target: `60656152`. |
| Plan silent on the dirty tree | meta C2 | Explicit discard now precedes T1. |
| Step 2 treated the R3 contract as untested | meta C3 (material) | GPT's build was that contract; measured INDETERMINATE and 18–55s. Two acceptance criteria added. |
| No evidence for *why* this boundary | meta C4 | Five adversarial attacks survived on the same architecture — recorded in T4. |

---

## 9. /o-necessity VERDICT

**Necessity — no unnecessary elements.** Every task traces to a defect one of three lanes proved
by execution. Nothing that works is rewritten: the geometry kernel, bridge, guards and UI scaffold
are explicitly preserved. The deletions are genuine subtraction — nine mechanisms removed, none
replaced by an equivalent.

**Sufficiency — delivers the audited gap in full.** Correctness and performance are both inside
the plan rather than one deferred; the acceptance oracle is rebuilt from Dan's evidence before
the engine is touched; §6 names the deferrals and §7 names the decisions that are his. Nothing is
sliced away and called "phase one".

**Requested of the reviewing QA lane:** attack §4's methods (particularly T4.2's intersection
formulation and T4.3's critical-set completeness), the sufficiency of each task's verification,
and any place where a task's method could pass its own gate while failing the contract.
