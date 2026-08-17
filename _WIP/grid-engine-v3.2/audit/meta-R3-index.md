# R3-specs indexed against the contract — /o-necessity, both directions

**Author:** s62-kai-meta · 2026-08-17 · **Ask:** Dan — "check R3, does it have additional ideas that are
missing from the plan, /o-necessity applied"
**Read in full:** `00-system-contract` (657) · `01-compute-engine-spec` (886) · `02-logic-engine-spec`
(1152) = 2,695 lines.
**Indexed against:** `plans/plan-and-contract.md` @ 169 lines.

R3 is a complete engineering contract. The plan cites it once. **Its authority relative to the Product
Base and the logic spec is Dan's to settle** — but it sits inside `canon/`, and the v3.2 compute layer
was demonstrably built from it: continuous feasibility, certified intervals,
`INDETERMINATE_WITHIN_TOLERANCE` and the `geometry-criteria-v1` registry all originate here. How much of
the below is binding depends on that ruling.

---

## NECESSITY (plan → canon) — three plan assertions that canon marks unresolved

### N1. The 96 mm population may not be real
`PD-04` is **UNRESOLVED**. `00 §2` records the provenance verbatim:

> `CARRYOVER-96-01` | Assistant carry-over recap; **not verified as Dan direct** | A 96 mm sparse
> population was described as every second 48 mm node. **This cannot create an approved product value.**

The contract's B4 row uses "48→96" as settled, and the class table's B4/B5 entries assume it.
`02 §6.4`: if `PD-04` is not confirmed, an approved profile **MUST OMIT** the 96 mm population. If it is
confirmed, it requires an explicit `populationOriginParity=(p_x,p_y)` as a **discrete frame field**
(`PD-34`) — never an implicit phase folded into the translation domain.

### N2. Two conflicting rules for the marked offer
- `PD-09` / `02 §5.4`: "evaluate all rungs; retain every accepted solution in diagnostics; expose the
  **smallest accepted rung** in each band as the primary user offer."
- `LS §1.2`: mark "the answer a person would have chosen **by eye**."

One mechanical, one judgemental, both inside `canon/`. The contract carries the LS version only.

### N3. "Every band answers" is not guaranteed
`PD-36` **UNRESOLVED**. `02 §5.5`: "the solver MUST report the evidence but **MUST NOT claim that every
valid silhouette has a B1 solution**." The contract's band table gives B1 an unconditional "one disc".
Same direction as the cross-band law already parked open.

---

## SUFFICIENCY (canon → plan) — ordered by damage

### S1. The ranking rules exist as exact formulas — `02 §11.2`, `onemo-mechanics-v1`
Ten steps, each with comparator, certification method and tolerance. Against PB §11's words:

| Step | Exact score | Comparator |
|---|---|---|
| `M01_MAJOR_COVERAGE` | `C` = #{major regions with ≥1 anchor}; `Q` = #{anchors in no region} | max `C`, then min `Q` |
| `M02_UPPER_REGION` | `U` = does the **top-most** major region hold an anchor | max `U` |
| `M03_UPPER_MOMENT` | ∫ over material above the highest anchor of (height − h_A) dA | min |
| `M04_MAX_OVERHANG` | max over {±u_y, ±u_x} of (polygon support − anchor support) | min |
| `M05_PATTERN_RANK` | exact permission rank | min |
| `M06_REGION_LOAD` | max(anchors in any one region, anchors in no region) | **min** — "one per distinct mass" as a formula |
| `M07_BALANCE` | \|lateral(c_A − c_P)\| then ‖c_A − c_P‖² | min, min — see S2 |
| `M08_ANCHOR_COUNT` | `m` | min |
| `M09_DISCRETE_ID` | (populationId, parityX, parityY, frameId, patternId, variantId) | ascending |
| `M10_REGISTRATION_ID` | (‖t − t₀‖², x, y) inside the certified optimum set only | ascending |

**PB §11's "peel/flap leverage" has no separate criterion here** — `M03` is the nearest, and PB §21.3
marks peel's numerical definition open. The nine do not map one-to-one onto ten.

### S2. R3 confirms the balance deferral and gives it provenance
`M07` **is** the centroid measure the shipped engine implements, and it is `PROPOSED_FOR_DAN` under
`PD-20` — never approved. The engine implemented a proposal as law: the same failure class as the 12 mm
limit. The contract's Open entry can now cite where the forbidden formula came from.

### S3. The two determinism tie-breaks are absent (`M09`, `M10`)
The contract's step 10 ends "fewer magnets → snuggest size" and leaves genuine ties undefined.
`00 §7.1` states the identity condition:

> Same canonical geometry bytes + same profile hash + same Compute artifact hash + same Logic artifact
> hash ⇒ byte-identical canonical output bytes… No random seed, system time, browser rendering result,
> locale, insertion-order accident or floating-point serialization difference may affect canonical output.

The contract has nothing on determinism.

### S4. The no-premature-collapse law — `00 §6.3`, `PD-15`
The candidate is the **tuple** `(size, frame, pattern, registration)`.

> Logic MUST NOT replace a connected feasible component with one canonical representative before
> mechanics: **one component may contain both a canonical chest-centre placement and a mechanically
> superior upper placement.**

Dan's bat B1 case stated as law — the formal version of the contract's step 7. `01 §11.3` makes it a
test: "an implementation that samples one representative per connected component **fails the suite**."

### S5. Region classes are four, not two — `02 §9.4`
`MAJOR` · `MARGINAL` · `CONNECTOR_ONLY` (real material connection with no safe centre at the protected
radius) · `UNCLASSIFIED_NEAR_TOLERANCE` (evidence changes inside the approximation envelope).

And `02 §9.3` gives **nine computable features** for the classification: component area / disc area ·
area / total safe-core area · clearance surplus over protected radius · deepest surviving clearance
level · persistence span · relative vertical/horizontal position in bbox · legal nodes contained ·
whether it contains a selected candidate · distance to material centroid normalised by dominant
dimension. **That is PB §8's five properties made computable** — it belongs with the mass-map Open entry.

### S6. Exact template coordinates — `02 §10.2`, `PD-18`
`single` (0,0) · `pair.vertical` (0,∓1) · `pair.horizontal` (∓1,0) · `row.3` (∓2,0),(0,0) · `column.3`
(0,∓2),(0,0) · `square.4` (±1,±1) · `t.top1-bottom3` (0,+2),(−2,−2),(0,−2),(+2,−2). The L family is the
four three-corner subsets of `square.4`, each with a stable variant ID.

`02 §10.4` lists the **seven fields** a permission record must carry — allowed bands · allowed X/Y
axis-class combinations · allowed population · whether marginal-region nodes are permitted · required
number of major regions covered · whether alternative orientations are considered · whether the template
can be a fallback or a primary offer — with "the solver **MUST NOT infer a permission matrix from
pattern geometry alone**." That is PB §21.4 made concrete.

### S7. Band thresholds are half-open — `PD-07`, `02 §5.2`
`[24,72)` `[72,120)` `[120,168)` `[168,216)` `[216,264]`. The contract writes "24–72 / 72–120" with no
inclusivity: a shape at exactly 72 mm has no defined band.

### S8. The rung formula — `PD-08`, `02 §5.3`
`D_n = 24 + 12n` across the 24–264 mm domain. "Every rung MUST be evaluated independently. No
monotonicity assumption may skip a rung."

### S9. Canonical frame maths — `02 §7.1`
Node coordinates `q_k = 2k − (n−1)` in base-cell units; frame span `2n − 1` cells. This **derives**
24/72/120/168/216 rather than storing them — the calibration-control principle with the formula that
implements it.

### S10. Failure taxonomy — `00 §10`
~20 typed codes with manufacture/offer consequences, including the distinction the contract most needs:
`LEGALITY_INDETERMINATE` (exclude the candidate; a proven-legal rival may win) vs
`CRITERION_SCORE_UNCERTAIN` (carry and refine; prune only on certified dominance) vs
`DECISION_INDETERMINATE` (emit no offer at all). `00 §10.1`: "hiding is a UI treatment for the complete
affected offer, **not a selection operation**." The contract's "no" reasons are four.

### S11. The manufacturable meaning of 12 mm is open — `PD-38`, `00 §9.3`
> Is 12 mm the minimum clearance that must remain **after** approved cut and magnet-placement
> tolerances, or is 12 mm the nominal design radius with an explicitly accepted residual manufacturing
> risk?

A profile cannot be production-approved without a base protected radius, an **effective verification
radius**, and a versioned tolerance-composition rule. The contract treats 12 mm as settled.

### S12. Two-stage ManufacturingSpec — `00 §9`
Engine spec created at selection; Fulfilment spec completed before manufacture; eight named hard stops
(artifact unresolvable, three hash mismatches, missing tolerance policy, missing/incompatible component,
failed containment proof, canonical-hash mismatch).

### S13. Required counterexample fixtures — `00 §12.2`, `02 §13.3`
Nine, and **not** the LS §7 shape suite already in the contract. These test the reasoning rather than the
shapes:
- a connected B1 feasible region containing both the canonical chest-centre and a mechanically superior
  upper/head translation — **the upper translation must survive candidate generation and win**;
- dominance safety: A proven legal at exact `10`, B proven legal at interval `[9,11]` — dropping B and
  selecting A **must fail** unless B is certified dominated;
- legality uncertainty: A proven legal at `10`, B's legality indeterminate — excluding B **must pass**;
- compound dominance (`min`/`min`, τ=(1,1)): X `(0,100)` vs Y `(10,0)` — component 1 is not certified
  equivalent, so it decides for X; pruning X through component 2 **must fail**.

### S14. Performance gates exist in canon — `PD-31`, `00 §11`
Compute ≤250 KB compressed (hard reject >500) · Logic ≤50 KB · adapter ≤25 KB · warm single-size ≤4 ms
(reject >20) · warm all-band ≤16 ms (reject >50) · flat memory under repeated runs.

*(The timing gate cut from the contract as "not in canon" — it is in canon, here, with numbers.)*

---

## THE HOLD ABOVE ALL OF IT — `00 §1.2`

> **HARD HOLD:** no backend probe and no implementation may begin until Dan approves, amends, or rejects
> every `PROPOSED_FOR_DAN` and `UNRESOLVED` item in the single register in §15. **Silence is not
> approval. A fixture authored by an implementer is not approval.**

Register: **37 product decisions — 10 `LOCKED_FROM_DAN`, 18 `PROPOSED_FOR_DAN`, 9 `UNRESOLVED`.** Hold A
covers the 27 non-locked rows.

v3.2 was built anyway. Whether that hold is live, cleared or superseded is Dan's to say — but starting
Phase 0 without answering it starts against an unresolved stop written into canon.

---

## VERDICT

- **Necessity — RESOLVE:** N1 (96 mm asserted where canon says unverified), N2 (two conflicting
  primary-offer rules), N3 (B1 guarantee asserted where canon says unresolved).
- **Sufficiency — PARTIAL, materially.** S1 and S3 are load-bearing: the contract states the ranking
  rules in words while canon states them as formulas, and omits the two tie-breaks that make an answer
  deterministic. **A builder implementing step 10 from the contract invents four formulas that already
  exist.**

Findings only. No contract text proposed — R3's authority must be settled first, and that ruling changes
how much of this is binding.

— s62-kai-meta
