# ONEMO Magnetic Free-Shape System Contract

**File:** `00-system-contract.md`  
**Stage:** Turn 1 — specification only  
**Implementation status:** prohibited until the approval hold in §1 is cleared  
**Authority rule:** the earlier *Product Base and Logic Architecture* is source foundation only. It is not an approved executable specification.

---

## 0. Normative language

- **MUST / MUST NOT**: required for conformance.
- **SHOULD / SHOULD NOT**: preferred unless a documented exception is approved.
- **MAY**: optional.
- Product values are visibly classified as:
  - `LOCKED_FROM_DAN`: directly stated by Dan or adopted by Dan from the review pack.
  - `PROPOSED_FOR_DAN`: a concrete value proposed here; not executable until approved.
  - `UNRESOLVED`: insufficient authority or evidence; implementation must not invent a value.

System invariants such as “no hidden randomness” are contract rules, not product values.

---

## 1. Revised execution control and hard holds

### 1.1 Turn 1 scope

This turn delivers only:

1. `00-system-contract.md`
2. `01-compute-engine-spec.md`
3. `02-logic-engine-spec.md`

No production code, build configuration, runtime dependency, backend selection, or package ZIP is created in Turn 1.

### 1.2 Hold A — product approval

**HARD HOLD:** no backend probe and no implementation may begin until Dan approves, amends, or rejects every `PROPOSED_FOR_DAN` and `UNRESOLVED` item in the single register in §15.

Silence is not approval. A fixture authored by an implementer is not approval.

### 1.3 Engineering gate `PD-30` — backend selection

After Hold A clears, the Compute contract remains backend-neutral while one bounded probe compares the smallest viable candidates:

- fixed-point TypeScript;
- C++/Clipper2 compiled to WebAssembly, only if it can actually be built reproducibly in the execution environment.

The probe MUST measure the approved engineering constraints:

- build reproducibility in the available environment;
- exact tangency acceptance;
- rejection of one approved coordinate quantum of intrusion;
- deterministic output;
- conservative approximation conformance;
- compressed payload;
- warm compute on the approved corpus;
- bounded memory on repeated runs.

`PD-30` is retained as an engineering traceability identifier, not as a product-decision ballot item. The probe selects the one backend that satisfies the approved correctness, reproducibility, payload and performance constraints. Dan is not asked to choose an implementation backend.

Exactly one production backend ships. No dual runtime and no unverified build recipe are permitted.

### 1.4 Remaining delivery sequence after approval

1. **Backend probe:** select the one production backend from measured evidence.
2. **Compute package:** source, tests, benchmark evidence, documentation, downloadable ZIP.
3. **Logic package:** source, approved profile, tests, documentation, downloadable ZIP.
4. **Next.js integration package:** reference page, persistence/verifier flow, tests, documentation, downloadable ZIP.

**Cadence:** this specification response is Turn 1. Four implementation-delivery turns remain after approval, for five delivery turns in the revised sequence. Dan’s approval reply clears or amends Hold A but is not itself counted as an implementation-delivery turn.

This sequencing is authorised by the review requirement that the backend be probed before it is frozen.

---

## 2. Source and canon traceability

| Source ID | Authority | Canon content used by these specifications |
|---|---|---|
| `DAN-PHYS-01` | Dan direct | Each magnet has a 24 mm protected disc; its centre has 12 mm material clearance in every direction; actual magnets may be 6/8/10 mm. |
| `DAN-CELL-01` | Dan direct | The measurement board is made of 24 mm square cells; empty midpoint cells still exist; cells should have chess-like coordinates. |
| `DAN-GRID-01` | Dan direct, still live | Magnet centres lie on the fixed 48 mm square lattice. |
| `CARRYOVER-96-01` | Assistant carry-over recap; not verified as Dan direct | A 96 mm sparse population was described as every second 48 mm node. This cannot create an approved product value. |
| `DAN-BAND-01` | Dan direct | Square references: 24, 72, 120, 168, 216 mm; the omitted 168 mm reference was explicitly restored. |
| `DAN-BAND-02` | Dan direct | Bands are dimensional ranges; the dominant bounding-box side determines the overall band; rectangular combinations are valid. |
| `DAN-SAFE-01` | Dan direct | The 12 mm inward safe-core concept was accepted; an irregular edge may not enter the 24 mm protected disc. |
| `DAN-CANON-01` | Dan direct | Batwoman: B1 single upper/head anchor; B2 vertical pair preferred to horizontal; B3 one upper anchor plus lower row of three, forming a T. |
| `DAN-REG-01` | Dan direct | B1 begins bbox-centre to disc-centre; long B2 rectangles use a centred pair on the long axis; square B2 centres an empty 24 mm cell between four points; larger bands inherit parity logic. |
| `DAN-STRUCT-01` | Dan direct | Small limbs, tips, narrow necks and curved margins may be legal-looking noise; useful inner mass, gravity, mass concentration and balance must be considered. |
| `DAN-ARCH-01` | Dan direct | Compute must be neutral; product values live in an editable but locked Logic profile; browser compute must be lightweight and fast; output must persist into physical fulfilment. |
| `DAN-SCOPE-01` | Dan direct, still live | V1 receives one simple closed outer outline; no holes, disconnected shapes, rotation, mirroring or deformation. |
| `DAN-ADOPTION-01` | Dan direct | The first adversarial-review feedback pack was adopted for plan revision and Turn 1 execution. |
| `DAN-ADOPTION-02` | Dan direct | The second correction pack is adopted for amendment of the three Turn-1 specifications only. |
| `DAN-ADOPTION-03` | Dan direct | The R2 follow-up amendment request is adopted for amendment of the same three Turn-1 specifications only. |
| `DAN-ADOPTION-04` | Dan direct | The cleared R4 global-anchor correction pack is adopted and applied directly to the three Turn-1 specifications by the team, ending the external revision loop for this fix. |
| `TEAM-PLAN-01` | Adopted review requirement | Add approval holds; treat product decisions as proposals; probe the backend before lock. |
| `TEAM-SPEC-01` | Adopted review requirement | Add canon regression, deterministic identity, false-negative contract, canonical ManufacturingSpec, shape-residue decisions and module seam rules. |
| `TEAM-AMEND-02` | Adopted review requirement | Make registration and mechanics one certified optimisation problem; split Compute/Logic artifact identity; add physical-tolerance policy; remove backend selection from Dan’s ballot; repair authority/status/fixture handling. |
| `TEAM-AMEND-03` | Adopted review requirement | Make uncertainty propagation dominance-safe; ballot the exact mechanical descriptor registry; close the conditional 96 mm origin phase; correct Compute artifact wording; restore decision traceability and quantum parameterisation. |
| `TEAM-AMEND-04` | Adopted review requirement, applied directly by the team | Global-optimum anchored phase-two restriction on registration-criterion optimisation; exact one-sided anchor and symmetric candidate scalar/compound interval-equivalence semantics; regression fixtures for the global-anchor, compound-uncertainty and compound candidate-dominance cases. |
| `TEAM-EXEC-01` | Adopted review requirement | Execute Turn 1 only and stop at product approval. |
| `FOUNDATION-01` | Assistant-authored foundation | May motivate proposals; cannot create `LOCKED_FROM_DAN` values. |

Where a direct quote is not reproduced, the source ID preserves the chain back to the live conversation. The Batwoman screenshots are visual canon, but they are not yet an approved vector test fixture.

### 2.1 Current repository state probed before specification

Repository probed: `ONEMO-TECH-LTD/ONEMO-EFFECTS-ENGINE`, branch `main`.

Observed state:

- the repository README describes `src/lib/` as the intended headless engine but states the project is scaffolded;
- `src/lib/grid/README.md` contains a planned module list rather than implementation;
- the only test under `src/lib/__tests__` is a smoke test;
- the app page is still the default Next.js starter page.

Therefore the smallest complete Turn 1 change is specification only. There is no current magnetic engine implementation to move, clone, rename or preserve in place. Earlier “proven logic” claims and planned module names are context, not an executable correctness oracle for this new contract.

---

## 3. System purpose

The system receives one validated cutout outline in millimetres and returns, under an approved Logic profile:

- candidate physical sizes;
- size-band classification;
- canonical and, where permitted, translated grid registration;
- lawful magnet-centre coordinates;
- the selected approved pattern;
- geometric and mechanical evidence;
- a canonical engine manufacturing specification;
- verification results suitable for fulfilment.

The system does not trace images, interpret pixels, render the editor, or manufacture the product.

---

## 4. Required architecture

```text
Effects Studio / fulfilment caller
                |
                v
        Logic Engine package
  product profile + deterministic policy
                |
      neutral requests/evidence
                |
                v
       Compute Engine package
 geometry predicates + measurements only
```

### 4.1 Compute Engine ownership

The Compute Engine MUST own:

- canonical polygon validation;
- scale and translation transforms;
- bounding box, area, centroid and projection measurements;
- point clearance and full-disc containment;
- inward safe regions;
- connected-component and multi-clearance measurements;
- neutral lattice coordinates;
- feasible translation regions for caller-supplied point sets;
- neutral directional support measurements;
- deterministic numerical evidence.

It MUST NOT know:

- ONEMO;
- magnets as a product concept;
- bands;
- B1/B2/B3 labels;
- gravity preference;
- “head”, “ear”, “shoulder”, “strong”, “marginal” or “T pattern” semantics;
- product ranking values.

### 4.2 Logic Engine ownership

The Logic Engine MUST own:

- versioned product profiles;
- cell size, node stride and permitted populations;
- bands and candidate size sequence;
- canonical frame and registration policy;
- region interpretation thresholds;
- approved patterns and permissions;
- mechanical priority order;
- deterministic selection;
- output reasons;
- ManufacturingSpec creation and verification policy.

### 4.3 Integration ownership

React/Next.js MUST only:

- adapt an already validated Studio outline to the contract;
- lazy-load the engine;
- render returned sizes and overlays;
- persist the selected canonical specification;
- send that specification to fulfilment;
- display machine-readable failures.

No product rule may live in React components.

---

## 5. Shared coordinate and geometry contract

### 5.1 Canonical coordinate system

The canonical engine coordinate system MUST be:

- units: millimetres represented by an approved integer quantum;
- origin: centre of the source outline bounding box before product scaling;
- positive X: right;
- positive Y: up;
- polygon winding after canonicalisation: counter-clockwise;
- ring closure: implicit; the final vertex is not duplicated.

SVG or canvas coordinates MUST be converted by the integration adapter before hashing or computation.

### 5.2 Canonical input

A canonical input contains:

| Field | Requirement |
|---|---|
| `schema` | Exact input-schema identifier |
| `coordinateQuantumMm` | Approved millimetre quantum |
| `outerRing` | Ordered integer coordinate pairs |
| `topDirection` | Unit vector in canonical coordinates |
| `sourceGeometryHash` | Hash of canonical input geometry |
| `profileHash` | Hash of the immutable Logic profile |
| `computeArtifactHash` | Hash of the exact Compute executable artifact used |
| `logicArtifactHash` | Hash of the exact Logic executable artifact used |

For solve identity, “canonical geometry bytes” are the canonical serialization of `schema`, `coordinateQuantumMm`, `outerRing` and `topDirection`; `sourceGeometryHash` hashes those bytes. For a Compute-only operation, evidence identity is the canonical operation-request bytes plus `computeArtifactHash`. Compute MUST NOT fabricate or infer a Logic artifact identity.

### 5.3 V1 outline acceptance

The canonicaliser MUST reject:

- fewer than three distinct vertices;
- zero-length edges after quantisation;
- self-intersection;
- holes;
- disconnected components;
- non-finite coordinates;
- an outline whose area becomes zero at the approved quantum.

It MUST NOT silently retain only an outer boundary.

The V1 exclusion is `LOCKED_FROM_DAN`; the proposed rejection codes appear in §10 and decision `PD-22`.

---

## 6. Engine interaction contract

### 6.1 Logic-to-Compute request families

The Logic Engine may request only neutral operations:

| Request family | Required input | Returned evidence |
|---|---|---|
| Prepare polygon | Canonical ring | Prepared handle, validation facts |
| Measure | Prepared polygon | Bounds, area, centroid, projections |
| Transform | Prepared polygon + scale/translation | Transformed geometry or transform handle |
| Clearance | Polygon + points | Signed clearance and nearest-boundary facts |
| Disc containment | Polygon + centres + radii | Exact legality and margins |
| Safe region | Polygon + radius + tolerance | Conservative inward region plus error envelope |
| Component hierarchy | Safe regions at caller radii | Components, lineage, area, bounds, persistence facts |
| Lattice | Origin, bases, integer index domain | Neutral coordinates only |
| Feasible translation | Safe region + relative offsets + domain | Conservative feasible region plus error envelope |
| Directional metrics | Polygon + anchor points + directions | Extents, areas and moments |
| Registration criterion optimisation | Current feasible set + relative offsets + descriptor from the versioned neutral `geometry-criteria-v1` registry + equivalence tolerance + optional caller-supplied restriction anchor: the certified global optimum scalar or compound interval/threshold | Exact score or certified score interval, conservative mechanically-equivalent subset, and certification metadata; or a proven-complete finite critical-point set with refinement/error certificate. When the restriction anchor is supplied, Compute returns a conservative subset of the supplied feasible set containing every registration that may remain equivalent to that anchor under the approved tolerance. The anchor is numeric comparator input, not product policy; Compute neutrality remains unchanged. |
| Final registration tie-break | Certified mechanically equivalent optimum set + canonical target + output quantum | Deterministically selected point or classified failure |

### 6.2 Compute-to-Logic evidence

Compute evidence MUST be:

- product-neutral;
- deterministic;
- accompanied by precision/tolerance metadata;
- explicit about exact versus approximate facts;
- explicit about indeterminate results;
- free of policy labels.

The Logic Engine may interpret evidence but may not rewrite or approximate it.

### 6.3 Joint candidate and no-premature-collapse law

For product selection, the candidate is the complete tuple:

```text
(size, frame, pattern, registration)
```

The complete tuple retains its size identity. Mechanical optimisation is performed within each evaluated size so that every size has its own lawful solution; only the approved per-band offer policy compares accepted sizes afterward. For each discrete `(size, frame, pattern)` hypothesis, registration ranges over its continuous feasible set. Logic MUST preserve that set through the approved mechanical criteria. It MUST NOT replace a connected feasible component with one canonical representative before mechanics: one component may contain both a canonical chest-centre placement and a mechanically superior upper placement.

A registration-sensitive criterion MUST be resolved by one of two backend-neutral, certified methods:

1. compute the criterion optimum and its argmin/argmax subset, then restrict the current feasible set to values equivalent to the certified global optimum — the caller-supplied restriction anchor — under the approved tolerance; a hypothesis-local tolerance subset must not stand in for the global restriction; or
2. evaluate a proven-complete finite critical-point set with bounded refinement and exact revalidation, together with a certificate that no omitted point can improve the criterion beyond the approved tolerance.

If neither method can certify the next restriction, the result is `INDETERMINATE_WITHIN_TOLERANCE`; canonical proximity may not be used as a substitute.

An exact score is represented by the degenerate interval `[v,v]`. An approximate score MUST carry a certified interval and a conservative surviving registration set containing every point that may remain equivalent under the caller-supplied tolerance. A backend may over-retain uncertain points; it may not remove a potentially superior point.

---

## 7. Deterministic identity and canonical output

### 7.1 Identity condition

The required solve identity is:

> Same canonical geometry bytes + same profile hash + same Compute artifact hash + same Logic artifact hash ⇒ byte-identical canonical output bytes.

Compute-only evidence identity is its canonical operation input plus the Compute artifact hash.

Version strings are descriptive metadata and MUST NOT substitute for either artifact hash.

No random seed, system time, browser rendering result, locale, insertion-order accident or floating-point serialization difference may affect canonical output.

### 7.2 Certified mechanical optimisation, dominance-safe uncertainty and final registration order

The feasible translation region is continuous. Manufacturing requires one registration, but registration MUST NOT be selected before mechanical optimisation.

For each evaluated size, let every permitted discrete frame/pattern hypothesis carry its current feasible registration set. The exact proposed `onemo-mechanics-v1` policy is defined in `02-logic-engine-spec.md` §11.2 and maps to the neutral `geometry-criteria-v1` registry in `01-compute-engine-spec.md` §5.10.1. The criteria are applied successively across the joint candidate space:

1. for the next criterion, obtain each surviving hypothesis’s exact score or certified score interval over its current registration set;
2. compare the scores with the approved scalar or compound comparator and tolerance;
3. prune only candidates certified dominated under that comparator, and certify the global best across all surviving hypotheses;
4. issue an anchored restriction request for every surviving hypothesis against that certified global optimum (the restriction anchor): restrict each surviving registration set to a conservative subset containing every registration that may remain equivalent to the anchor under the approved tolerance; Logic must not reuse a locally anchored equivalent subset as the final global restriction;
5. refine when intervals overlap or the equivalent subset is not certified;
6. continue with the next approved criterion only when the current criterion is either exact or dominance-safe.

A criterion constant over registration, such as a pattern permission rank or node count, restricts the discrete hypotheses without collapsing their continuous registration sets.

#### 7.2.1 Legality uncertainty versus score uncertainty

The two uncertainty classes have different mandatory consequences:

- **Indeterminate legality:** the candidate is excluded because manufacture cannot rely on unproved containment or representability. A proven-legal rival may still win.
- **Proven legality with uncertain criterion score:** the candidate remains in the comparison. It may be pruned only when certified dominated under the complete current comparator. Otherwise the affected size decision returns `DECISION_INDETERMINATE` and produces neither an offer nor an Engine ManufacturingSpec.

For a scalar criterion with equivalence tolerance \(\tau\):

- under `min`, candidate \(X\) is certified worse than \(Y\) only when \(\underline{x}>\overline{y}+\tau\);
- under `max`, candidate \(X\) is certified worse than \(Y\) only when \(\overline{x}<\underline{y}-\tau\).

For a compound comparator, all earlier components MUST be certified equivalent and the first decisive component MUST satisfy the corresponding inequality. Two certified-equivalence definitions apply and MUST NOT be interchanged. **Against the certified global anchor** \(a\) — one-sided, because the anchor is the certified optimum: an earlier component is certified equivalent only when, under `min`, \(\overline{x}\le\underline{a}+\tau\); under `max`, \(\underline{x}\ge\overline{a}-\tau\). **Between two candidates \(X\) and \(Y\)** — symmetric, because equivalence between candidates is symmetric: an earlier component is certified equivalent only when both directions hold — under `min`, \(\overline{x}\le\underline{y}+\tau\) AND \(\overline{y}\le\underline{x}+\tau\); under `max`, \(\underline{x}\ge\overline{y}-\tau\) AND \(\underline{y}\ge\overline{x}-\tau\). If an earlier component is neither certified equivalent nor certified decisive, the comparison is uncertain: refine or carry the candidate; a later component may not decide while any earlier component remains uncertain. For the full lexicographic policy, all earlier criteria have already been restricted to their certified equivalent sets. Overlapping intervals that do not satisfy these rules are not dominance.

If adaptive refinement cannot certify dominance or equivalence, the size is `DECISION_INDETERMINATE`. If that size could alter the approved per-band offer, the band is also `DECISION_INDETERMINATE`; no rival offer may be emitted by silently dropping the score-uncertain legal candidate. UI policy may hide the complete affected offer, but it may not hide one candidate and continue to a winner.

#### 7.2.2 Final registration identity

Only after all approved mechanical criteria have produced a certified mechanically-equivalent optimum set may the proposed `PD-15` registration order operate:

1. choose canonical translation if it belongs to the final optimum set;
2. otherwise minimise squared Euclidean distance to canonical translation within that final optimum set;
3. among equal-distance optimum solutions, choose the smallest canonical X;
4. among remaining ties, choose the smallest canonical Y;
5. map to the approved manufacturing coordinate quantum and prove that the mapped point remains inside the final mechanically-equivalent optimum set;
6. exact-revalidate every selected centre using the approved effective verification radius;
7. if quantisation invalidates the point, choose the next representable point under the same order, but only from the same mechanically-equivalent optimum set;
8. if the continuous optimum set exists but contains no approved-quantum point, return `FEASIBLE_BELOW_OUTPUT_QUANTUM` rather than inventing or silently rejecting.

No implementation may select one representative per connected feasible component before the criteria are exhausted. This order is governed by `PD-15`, not `PD-14`.

### 7.3 Canonical serialization

Canonical serialization MUST define:

- field order;
- integer encoding;
- string normalization;
- array ordering;
- polygon component ordering;
- pattern-node ordering;
- omission rules;
- hash algorithm and version.

Timestamps, benchmark data, UI labels and run metadata MUST remain outside the canonical hashed payload.

---

## 8. Adjacent-module ownership seams

Maximal atomisation is prohibited. The following seams remain because each side has an independent contract and test surface.

| Adjacent modules | Ownership rule |
|---|---|
| Compute `clearance` / `containment` | `clearance` returns signed geometric distance; `containment` applies caller radii and closed-disc legality to that evidence. Neither owns product thresholds. |
| Compute `lattice` / Logic `cell-board` + `frames` | `lattice` generates neutral coordinates from bases and indices; Logic assigns cell names, node eligibility, product frames and parity meaning. |
| Logic `profile-schema` / `profile-registry` | `profile-schema` validates structure and invariants; `profile-registry` canonicalises, hashes, deep-freezes and resolves approved versions. |
| Logic `patterns` / `pattern-permissions` | `patterns` define relative node geometry; `pattern-permissions` decide when a profile may consider each template. |
| Logic `mechanics` / `selection` | `mechanics` defines the ordered product criteria and equivalence relations; `selection` successively restricts the joint candidate space and invokes the final deterministic tie-break only on the certified mechanically equivalent optimum set. |
| Compute `registration-optimisation` / `final-tiebreak` | `registration-optimisation` certifies criterion extrema/argopt subsets or a proven-complete critical set; `final-tiebreak` selects canonical/nearest/X/Y only inside the already-certified optimum set. |

Any later module split MUST demonstrate a separate swap or test seam. Otherwise it MUST remain merged.

---

## 9. Manufacturing specification and fulfilment completion

Two canonical artifacts are required.

### 9.1 Engine ManufacturingSpec

Created when the user selects an offered solution. Its canonical hashed payload MUST include:

- schema version;
- canonical source-geometry hash;
- final cut geometry or immutable content-addressed reference;
- exact width and height;
- scale;
- registration;
- selected pattern ID and version;
- selected cell/node addresses;
- exact centre coordinates;
- base protected radius;
- approved effective verification radius;
- tolerance-composition rule ID/version;
- minimum verified clearance and margin against the effective radius;
- profile hash;
- compute artifact hash;
- logic artifact hash;
- deterministic decision reasons;
- proof status.

It MUST NOT include timestamps or mutable run metadata in the hash.

### 9.2 Fulfilment ManufacturingSpec

Before manufacture, fulfilment MUST add:

- versioned magnet component reference;
- diameter, thickness and tolerance where they affect geometry or assembly;
- cut, placement, material and assembly tolerance references required by the approved composition rule;
- assembly/material profile reference;
- verifier artifact hashes;
- verification result.

Fulfilment MUST verify that the physical component and process tolerances are compatible with the effective verification radius and tolerance-composition rule pinned by the approved product profile. An incompatible component/process profile requires a new approved profile or a newly verified solution; fulfilment may not silently reuse a 12 mm-only proof.

Fulfilment then canonicalises and hashes the complete physical product specification.

Manufacture MUST stop on:

- unresolved Compute or Logic artifact;
- Compute or Logic artifact-hash mismatch;
- profile-hash mismatch;
- geometry-hash mismatch;
- missing physical-tolerance policy;
- missing or incompatible component/process reference;
- failed effective-radius containment proof;
- canonical-hash mismatch.

“Exact physical repetition” applies only to the completed Fulfilment ManufacturingSpec, not to an incomplete browser result.

### 9.3 Physical-tolerance contract

`PD-01` establishes the 24 mm protected-disc product rule. `PD-38` remains unresolved on how that rule composes with manufacturing tolerances:

> Is 12 mm the minimum clearance that must remain after approved cut and magnet-placement tolerances, or is 12 mm the nominal design radius with an explicitly accepted residual manufacturing risk?

Before a profile can be approved for production, it MUST supply:

- the base protected radius;
- the effective verification radius sent to Compute;
- a versioned tolerance-composition rule;
- the physical tolerance inputs the rule requires;
- compatibility conditions for the fulfilment component/process profile.

Compute remains neutral and evaluates only the caller-provided effective radius. No engine, profile or fulfilment adapter may invent tolerance values or assume that base-radius verification is production-safe.

---

## 10. Shared failure taxonomy

| Code | Meaning | Manufacture/offer consequence |
|---|---|---|
| `INVALID_OUTLINE` | Polygon violates canonical input rules | Reject |
| `HOLES_UNSUPPORTED_V1` | One or more holes detected | Reject |
| `DISCONNECTED_OUTLINE_UNSUPPORTED_V1` | More than one component detected | Reject |
| `SELF_INTERSECTION` | Ring is not simple | Reject |
| `EMPTY_SAFE_REGION` | No centre can satisfy the requested protected radius | Reject that size |
| `NO_APPROVED_PATTERN` | Legal nodes exist but no permitted template is feasible | Reject that size |
| `NO_ROBUST_FEASIBLE_REGISTRATION` | Continuous infeasibility is certified after the approved refinement/error procedure | Reject that candidate or size |
| `INDETERMINATE_WITHIN_TOLERANCE` | Compute cannot certify a requested geometric fact within the approved error envelope | Logic MUST classify the affected fact as legality or criterion evidence; this code alone is not permission to drop a legal contender |
| `LEGALITY_INDETERMINATE` | A candidate’s containment, representability or other manufacture-critical legality fact is not proved | Exclude that candidate; a proven-legal rival may continue; never manufacture the excluded candidate |
| `CRITERION_SCORE_UNCERTAIN` | A proven-legal candidate has a certified criterion interval that is not yet decisive | Carry and refine; prune only on certified dominance under the complete comparator |
| `DECISION_INDETERMINATE` | At least one proven-legal score-uncertain candidate remains not certified dominated | Emit no offer and no ManufacturingSpec for the affected size; if it can affect the band offer, emit no offer for that band |
| `FEASIBLE_BELOW_OUTPUT_QUANTUM` | Continuous feasible placement exists but no approved coordinate can represent it | Never manufacture until policy resolves |
| `EXACT_REVALIDATION_FAILED` | An approximate candidate failed exact disc containment | Reject candidate |
| `COMPUTE_ARTIFACT_UNRESOLVABLE` | Exact Compute executable cannot be resolved | Hard stop |
| `LOGIC_ARTIFACT_UNRESOLVABLE` | Exact Logic executable cannot be resolved | Hard stop |
| `COMPUTE_ARTIFACT_HASH_MISMATCH` | Resolved Compute executable differs | Hard stop |
| `LOGIC_ARTIFACT_HASH_MISMATCH` | Resolved Logic executable differs | Hard stop |
| `PROFILE_HASH_MISMATCH` | Product policy differs | Hard stop |
| `PHYSICAL_TOLERANCE_POLICY_MISSING` | Effective verification radius or composition rule absent | Hard stop |
| `COMPONENT_REFERENCE_MISSING` | Physical magnet/component profile absent | Hard stop |
| `COMPONENT_TOLERANCE_INCOMPATIBLE` | Component/process tolerances do not satisfy the approved composition rule | Hard stop |
| `FULFILMENT_VERIFICATION_FAILED` | Final physical spec did not verify | Hard stop |

### 10.1 Mandatory uncertainty propagation

A proven-legal score-uncertain candidate is never equivalent to an illegal or legality-indeterminate candidate:

- legality uncertainty removes only that candidate from manufacturable consideration;
- score uncertainty preserves the legal candidate until certified dominance or a whole-decision failure;
- hiding is a UI treatment for the complete affected offer, not a selection operation.

The canonical verification cases are:

1. A is proven legal with certified ascending score `10`; B is proven legal with interval `[9,11]`. Rejecting B and selecting A MUST fail unless B is certified dominated under the complete comparator.
2. A is proven legal with certified score `10`; B’s legality is indeterminate. Excluding B and selecting A MUST pass.

---

## 11. Performance contract and re-baseline

Earlier discussion mentioned approximately 150–200 KB, 2 ms single-size and 10 ms all-band targets. The planning review re-baselined the provisional gates to allow a robust backend-neutral probe without pretending a backend has already been measured.

The Turn 1 proposals are:

| Measure | `PROPOSED_FOR_DAN` target | Hard rejection |
|---|---:|---:|
| Compute runtime + loader, compressed | ≤250 KB | >500 KB |
| Logic runtime, compressed | ≤50 KB | >100 KB |
| Integration adapter excluding React/Next | ≤25 KB | >60 KB |
| Warm typical single-size evaluation | ≤4 ms | >20 ms |
| Warm typical all-band solve | ≤16 ms | >50 ms |
| Repeated warm-run memory | Flat after bounded caches | Unbounded growth |

The change is a planning correction, not permission to regress. Final runtime selection remains subject to the engineering gate in §1.3 (`PD-30`); Dan approves the product and performance constraints, not the backend implementation.

Browser evidence MUST include current WebKit and Chromium automation plus a benchmark page for physical mobile-device measurement. Automation MUST NOT be reported as an iPhone hardware result.

---

## 12. Canon regression constraints

The Logic package MUST include black-box regression constraints for an approved Batwoman vector fixture:

| Case | Required outcome | Status |
|---|---|---|
| B1 | One selected upper/head anchor | `LOCKED_FROM_DAN` |
| B2 | A vertical pair ranks above a horizontal pair | `LOCKED_FROM_DAN` |
| B3 | One upper anchor plus lower row of three, a T | `LOCKED_FROM_DAN` |

These outcomes are constraints, not a calibration corpus.

### 12.1 Canon-fixture intake

The authoritative Batwoman fixture MUST be ingested as follows:

1. the source outline is supplied by Dan or explicitly blessed by Dan after export from the Effects Studio editor;
2. its exact canonical geometry hash and B1/B2/B3 size mappings are approved together with the vector;
3. GPT- or implementer-authored tracings may be submitted only as fixture proposals;
4. a proposed tracing cannot become authority or outvote the approved vector, screenshots and Dan’s walkthrough.

`PD-29` remains unresolved until that intake is completed.

### 12.2 Required regression and counterexample coverage

Rules used to satisfy the canon MUST also ship with:

- a counterexample where the opposite pair orientation is correct;
- a just-inside/just-outside geometric boundary fixture;
- a symmetry/tie fixture;
- a concavity fixture;
- a rounded/circle fixture;
- a mixed-parity rectangular fixture;
- a connected B1 feasible-region fixture containing both canonical chest-centre and mechanically superior upper/head translations; the upper/head translation MUST survive candidate generation and win under the approved mechanics.
- a dominance-safety fixture where A is proven legal at ascending score `10` and B is proven legal with score interval `[9,11]`; dropping B and selecting A MUST fail unless B is certified dominated under the complete comparator;
- a legality-uncertainty fixture where A is proven legal at score `10` and B’s legality is indeterminate; excluding B and selecting A MUST pass;
- a compound candidate-dominance fixture (compound `min`/`min`, `tau = (1,1)`) where candidate X has exact compound score `(0,100)` and candidate Y has `(10,0)`: component 1 is NOT certified equivalent under the symmetric test, so it decides in X's favour; pruning X through component 2 MUST fail.

The exact Batwoman vector input is unresolved until Dan approves a canonical outline. An implementer-generated approximation cannot become the authority.

---

## 13. Package boundaries for later delivery

The approved implementation will create three independent downloadable packages:

1. `@onemo/geometry-compute`
2. `@onemo/magnetic-logic`
3. `@onemo/magnetic-next`

Each ZIP MUST include its own source, generated distribution, tests, benchmark evidence, API documentation, integration guidance and licence notices. No combined fourth ZIP is required.

---

## 14. `/o-necessity` verdict for this Turn 1 artifact set

**Necessity:** no amendment outside the five corrections in `TEAM-AMEND-03` and the global-anchor correction in `TEAM-AMEND-04` is introduced.

**Sufficiency:** the three files deliver dominance-safe uncertainty propagation, an exact balloted mechanical registry, explicit conditional 96 mm origin phase, corrected Compute artifact wording, restored decision traceability/parameterisation, and the `TEAM-AMEND-04` global-optimum anchored restriction with its one-sided anchor and symmetric candidate equivalence semantics and regression fixtures.

**Verdict:** the amended Turn 1 files stop at the product-approval hold in §1.2. No next turn is authorised.

---

# 15. Consolidated product-decision register

This is the only product-decision register. The Compute and Logic specifications reference these IDs rather than creating competing registers.

| ID | Status | Value / proposed rule | Rationale | Source/canon trace | Dan approval needed |
|---|---|---|---|---|---|
| `PD-01` | `LOCKED_FROM_DAN` | Base product geometry is a closed 24 mm diameter protected disc with 12 mm radius; `PD-38` determines whether that 12 mm is a post-tolerance minimum or a nominal design radius. | Direct physical safety rule. | `DAN-PHYS-01`, `DAN-SAFE-01` | No |
| `PD-02` | `LOCKED_FROM_DAN` | Base measurement cell is 24 × 24 mm; empty cells remain addressable. | Preserves standard measurement and midpoint cells. | `DAN-CELL-01` | No |
| `PD-03` | `LOCKED_FROM_DAN` | Canon magnet-node pitch is 48 mm, every second base cell. | Existing fixed grid and the 24/72/120 progression. | `DAN-CELL-01`, `DAN-GRID-01` | No |
| `PD-04` | `UNRESOLVED` | Whether ONEMO has a product-level 96 mm sparse population defined as every second 48 mm master-lattice node. If confirmed, the population definition MUST include an explicit master-node origin parity rather than an implicit phase. | The fact appears only in an assistant carry-over recap and is not verified as Dan-direct canon; the follow-up review requires any confirmed sparse population to close its origin phase. | `CARRYOVER-96-01`, `TEAM-AMEND-02`, `TEAM-AMEND-03` | **Confirm/reject fact and origin model** |
| `PD-05` | `LOCKED_FROM_DAN` | Square references are 24, 72, 120, 168 and 216 mm. | Explicitly stated and corrected. | `DAN-BAND-01` | No |
| `PD-06` | `LOCKED_FROM_DAN` | Overall band is determined by the dominant outer-bbox side; each axis retains its own class for rectangular combinations. | Direct aspect-ratio/band rule. | `DAN-BAND-02` | No |
| `PD-07` | `PROPOSED_FOR_DAN` | Threshold ownership is lower-inclusive, upper-exclusive: B1 [24,72), B2 [72,120), B3 [120,168), B4 [168,216), B5 [216,264]. | Removes duplicates; places each reference at the start of its band. | `DAN-BAND-01`, `DAN-BAND-02`, `TEAM-PLAN-01` | **Approve/amend** |
| `PD-08` | `PROPOSED_FOR_DAN` | User-offer rungs are every 12 mm on the dominant dimension; aspect ratio is preserved. | Matches earlier accepted candidate-step direction while keeping finite, fast offers. | foundation discussion; review requires explicit proposal | **Approve/amend** |
| `PD-09` | `PROPOSED_FOR_DAN` | Return the smallest accepted rung in each band as the primary offer; retain all accepted rungs in diagnostics. | Gives one clear size per band without discarding evidence. | `DAN-ARCH-01`; no direct lock | **Approve/amend** |
| `PD-10` | `PROPOSED_FOR_DAN` | Internal board is unbounded integer cells; the editor may show a 10 × 10 named viewport. Human names are display-only; integer coordinates are canonical. | Avoids edge effects while preserving chess-like use. | `DAN-CELL-01` | **Approve/amend** |
| `PD-11` | `LOCKED_FROM_DAN` | B1 canonical start aligns bbox centre with the single disc centre. | Direct registration statement. | `DAN-REG-01` | No |
| `PD-12` | `LOCKED_FROM_DAN` | Per-axis parity rule: odd node count puts a node line on bbox centre; even count puts the central empty 24 mm cell line on bbox centre. | Direct B2 square/midpoint rule extended by Dan to larger bands. | `DAN-REG-01`, `DAN-CELL-01` | No |
| `PD-13` | `LOCKED_FROM_DAN` | Feasible registration is treated as continuous, not sampled placement. | Adopted review correction. | `DAN-ADOPTION-01`, `TEAM-SPEC-01` | No |
| `PD-14` | `PROPOSED_FOR_DAN` | Translation search is bounded to one 48 × 48 mm master-lattice period around canonical registration, with independent X-only, Y-only or XY domains. If a 96 mm population is confirmed, its additional phase is represented only by the discrete `populationOriginParity` frame field under `PD-34`; it is not silently absorbed into this domain. | One master period covers continuous 48 mm phase; explicit discrete parity closes the conditional 96 mm phase without widening the continuous domain. | `DAN-REG-01`, `TEAM-SPEC-01`, `TEAM-AMEND-03` | **Approve/amend domain and conditional phase model** |
| `PD-15` | `PROPOSED_FOR_DAN` | Treat `(size, frame, pattern, registration)` as the joint candidate; successively optimise and restrict the continuous feasible registration sets by the approved mechanical criteria, using the phase-two restriction anchored to the certified global optimum. Canonical/nearest/X/Y ordering applies only inside the final mechanically equivalent optimum set, followed by output-quantum exact revalidation. | Preserves superior noncanonical support inside one connected feasible region while still producing one deterministic manufacturing point. | `DAN-CANON-01`, `TEAM-AMEND-02`, `TEAM-AMEND-04` | **Approve/amend optimisation and final tie-break** |
| `PD-16` | `PROPOSED_FOR_DAN` | Useful-area evidence is a multi-clearance component hierarchy derived from exact/safe inward regions; no semantic primitive fitting. | Filters tips/narrow regions while keeping Compute neutral and lightweight. | `DAN-STRUCT-01`, `DAN-SAFE-01` | **Approve/amend** |
| `PD-17` | `UNRESOLVED` | Numeric thresholds separating major, marginal and ignored regions. | Dan defined the behaviour but not calibrated values. | `DAN-STRUCT-01`, `TEAM-PLAN-01` | **Value required** |
| `PD-18` | `PROPOSED_FOR_DAN` | Initial templates: single, vertical pair, horizontal pair, L, three-node row/column, T, and 2×2 four-corner pattern. | Smallest library covering stated canon and B2 square geometry. | `DAN-CANON-01`, `DAN-REG-01` | **Approve/amend** |
| `PD-19` | `UNRESOLVED` | Exact pattern permissions by axis class, band and approved population; 96 mm permissions exist only if `PD-04` is confirmed. | Canon covers only selected B1–B3 cases. | `DAN-CANON-01`, `TEAM-SPEC-01` | **Policy required** |
| `PD-20` | `PROPOSED_FOR_DAN` | Approve `onemo-mechanics-v1` exactly as specified in `02` §11.2 and mapped to neutral `geometry-criteria-v1` in `01` §5.10.1: formulas, compound comparator order, certification methods and equivalence tolerances are part of this decision. Proposed tolerances are exact zero for discrete criteria; `q·area(P)` mm³ for upper moment; `q` mm for maximum overhang and horizontal balance; and `2Dq+q²` mm² for squared centroid balance, where `q` is `PD-25` and `D` is dominant dimension. `PD-17` still owns region-class thresholds and `PD-19` still owns concrete pattern-rank values. | Ballots the actual executable selection policy rather than only qualitative criterion names or order. | `DAN-CANON-01`, `DAN-STRUCT-01`, `TEAM-AMEND-02`, `TEAM-AMEND-03` | **Approve/amend complete registry, formulas, certification and tolerances** |
| `PD-21` | `PROPOSED_FOR_DAN` | V1 top direction is canonical canvas up (+Y), fixed per effect and not user-settable; rotations remain excluded. | Gives gravity a stable reference under current scope. | `DAN-CANON-01`, `DAN-SCOPE-01`, `TEAM-SPEC-01` | **Approve/amend** |
| `PD-22` | `PROPOSED_FOR_DAN` | Holes and disconnected silhouettes hard-reject with dedicated codes; never evaluate outer-boundary-only. | Prevents silent geometry loss. | V1 exclusion `LOCKED_FROM_DAN`; consequence requested by `TEAM-SPEC-01` | **Ratify consequence** |
| `PD-23` | `PROPOSED_FOR_DAN` | Circles/rounded shapes use the same outer-bbox band classification and parity frame; exact safe-core/pattern fit determines whether a reference footprint is actually lawful. | Explains why square references do not imply corner occupancy in a circle. | `DAN-BAND-02`, `TEAM-SPEC-01` | **Approve/amend** |
| `PD-24` | `PROPOSED_FOR_DAN` | Mixed-parity frames are first-class: e.g. 1×3, 2×3; registration search can be X-only, Y-only or both. | Required for long and rectangular shapes. | `DAN-REG-01`, `TEAM-SPEC-01` | **Approve/amend permissions** |
| `PD-25` | `PROPOSED_FOR_DAN` | Canonical manufacturing coordinate quantum `q` is 0.01 mm. | Supports deterministic hashing and a probe intrusion of one approved quantum; 0.01 mm applies only if this proposal is approved unchanged. | `TEAM-PLAN-01`, `TEAM-AMEND-03`; no Dan lock | **Approve/amend** |
| `PD-26` | `PROPOSED_FOR_DAN` | Conservative geometry tolerance must be ≤ one quarter of the manufacturing quantum. | Guarantees a quantified robustness envelope below output precision. | `TEAM-SPEC-01` | **Approve/amend** |
| `PD-27` | `UNRESOLVED` | Whether continuous placements that exist only below output quantum are hidden, shown as marginal, or trigger finer precision. | Review forbids silent false negatives; product behaviour is not set. | `TEAM-SPEC-01` | **Policy required** |
| `PD-28` | `LOCKED_FROM_DAN` | Batwoman outcomes: B1 upper single; B2 vertical pair over horizontal; B3 T with upper single and lower three. | Direct walkthrough and adopted regression requirement. | `DAN-CANON-01`, `TEAM-SPEC-01` | No |
| `PD-29` | `UNRESOLVED` | Exact Batwoman vector fixture supplied by Dan or explicitly blessed after Effects Studio export, with its geometry hash and B1/B2/B3 mappings approved together. | Screenshots do not provide canonical millimetre geometry; implementer/GPT tracings are proposals only. | `TEAM-SPEC-01` | **Fixture approval required** |
| `PD-31` | `PROPOSED_FOR_DAN` | Re-baselined gates: Compute ≤250 KB compressed, Logic ≤50 KB, typical single-size ≤4 ms, typical all-band ≤16 ms. | Allows robust backend comparison while preserving mobile-first limits. | `TEAM-SPEC-01` | **Approve/amend** |
| `PD-32` | `LOCKED_FROM_DAN` | Canonical engine spec excludes magnet SKU; final fulfilment spec must add a versioned physical component reference and re-hash before manufacture. | Adopted review requirement for a complete physical product. | `DAN-ADOPTION-01`, `TEAM-SPEC-01` | No |
| `PD-33` | `PROPOSED_FOR_DAN` | Component reference includes diameter, thickness and tolerances only where they affect geometry or assembly. | Keeps geometry engine neutral while making fulfilment complete. | `TEAM-SPEC-01` | **Approve/amend fields** |
| `PD-34` | `UNRESOLVED` | If `PD-04` is confirmed, define band/pattern permissions and the allowed `populationOriginParity=(p_x,p_y)`, with each parity in `{0,1}` over 48 mm master-node indices. The parity is a discrete frame-hypothesis field; a fixed-origin product permits exactly one tuple. Continuous translation remains the one-master-period domain in `PD-14`. Otherwise retire this decision. | Makes the sparse population’s extra origin phase explicit and deterministic rather than treating it as covered by a 48 mm translation domain. | `PD-04`, `PD-14`, `CARRYOVER-96-01`, `TEAM-SPEC-01`, `TEAM-AMEND-03` | **Policy and parity required only if PD-04 is confirmed** |
| `PD-35` | `UNRESOLVED` | Maximum accepted outline vertex count and who must simplify an over-budget outline. | Mobile performance cannot be guaranteed against unbounded input; Compute may not silently simplify. | `DAN-ARCH-01`, backend-probe requirement | **Limit/ownership required** |
| `PD-36` | `UNRESOLVED` | Whether “B1 is always possible” is a universal product guarantee, a rule only when one disc fits inside B1, or Batwoman-specific description. | Extreme thin aspect ratios may need a dominant size outside B1 before any 24 mm disc fits. | `DAN-CANON-01` | **Meaning required** |
| `PD-37` | `PROPOSED_FOR_DAN` | Axis class is maximum frame capacity, not a compulsory frame count; profile permits frame hypotheses up to that capacity. Initial B2 coverage: 1×2, 2×1 and 2×2. | Preserves Dan’s distinction between long-pair and square-four-point registrations and lets a square-bbox freeform T use a vertical pair. | `DAN-REG-01`, `DAN-CANON-01` | **Approve/amend** |
| `PD-38` | `UNRESOLVED` | Is 12 mm the minimum clearance that must remain after approved cut and magnet-placement tolerances, or is 12 mm the nominal design radius with an explicitly accepted residual manufacturing risk? The approved profile must define the effective verification radius and versioned tolerance-composition rule. | Base geometry alone cannot prove production safety under unspecified process tolerances. Compute must remain neutral and evaluate the caller-provided effective radius. | `DAN-PHYS-01`, `DAN-ARCH-01`, `TEAM-AMEND-02` | **Physical-tolerance policy required** |

**Register count:** 37 product decisions — 10 `LOCKED_FROM_DAN`, 18 `PROPOSED_FOR_DAN`, 9 `UNRESOLVED`. `PD-30` is outside this ballot as the engineering gate in §1.3.

**Approval action:** Dan should respond with approval or amendments by `PD-xx` for every non-locked register row. Hold A remains active until all 27 non-locked product decisions are resolved. Backend selection is then performed by the measured `PD-30` engineering gate rather than by Dan’s ballot.
