# ONEMO Magnetic Logic Engine Specification

**File:** `02-logic-engine-spec.md`  
**Package target:** `@onemo/magnetic-logic`  
**Stage:** Turn 1 — specification only  
**Implementation status:** blocked by `00-system-contract.md` Hold A  
**Compute dependency:** `@onemo/geometry-compute` through the backend-neutral shared contract only

---

## 0. Status and product-value visibility

The Logic Engine is the sole owner of ONEMO product meaning. This document does not silently promote proposals into approved rules.

### Product-value dependencies used here

Product-decision status is read only from the single authoritative register in `00-system-contract.md` §15. This table retains IDs and local Logic treatment but does not duplicate mutable status values.

| Decision | Logic treatment |
|---|---|
| `PD-01` protected disc | Store the base product radius in the profile; `PD-38` determines its production-tolerance interpretation. |
| `PD-02` base cell | Define the canonical cell board. |
| `PD-03` 48 mm node pitch | Encode node stride as two base cells. |
| `PD-04` possible 96 mm population | Do not enable it unless confirmed; if confirmed, require explicit sparse-population origin parity through `PD-34`. |
| `PD-05` reference spans | Use 24/72/120/168/216 mm references. |
| `PD-06` dominant-side band | Derive overall band from dominant bbox side while retaining per-axis classes. |
| `PD-07` threshold ownership | Apply only after approval. |
| `PD-08` size rungs | Apply only after approval. |
| `PD-09` primary offer per band | Apply only after approval. |
| `PD-10` board/display split | Keep integer coordinates canonical; display policy follows approval. |
| `PD-11` B1 canonical centre | Use as the starting frame origin, never as a pre-mechanics winner. |
| `PD-12` parity registration | Apply independently on each axis. |
| `PD-13` continuous feasibility | Preserve continuous registration sets; no sampled-placement policy. |
| `PD-14` translation domain | Apply one approved 48 mm master-lattice period and keep any conditional 96 mm origin phase as a discrete frame field under `PD-34`. |
| `PD-15` joint optimisation/final tie | Treat `(size, frame, pattern, registration)` as the candidate; mechanically optimise continuous registration first, then canonical/nearest/X/Y only in the final optimum set. |
| `PD-16` multi-clearance structure | Use the approved minimum normalisation method. |
| `PD-17` structural thresholds | Solver cannot approve a profile until values are supplied. |
| `PD-18` initial patterns | Use only approved template data. |
| `PD-19` pattern permissions | Do not infer a matrix. |
| `PD-20` exact mechanics registry | Apply the complete approved `onemo-mechanics-v1` formulas, comparator components, certification rules and tolerances from §11.2. |
| `PD-21` top direction | Supply the approved canonical direction. |
| `PD-22` topology rejection | Apply the approved V1 consequence. |
| `PD-23` circle rule | Apply only after approval. |
| `PD-24` mixed parity | Apply approved permissions and axis search. |
| `PD-25` coordinate quantum | Use the approved quantum for canonical coordinates, tolerance formulas, final registration mapping and ManufacturingSpec. |
| `PD-26` approximation tolerance | Send and validate the approved conservative approximation tolerance on every affected Compute request and proof record. |
| `PD-27` sub-quantum policy | Surface the Compute status; do not invent behaviour. |
| `PD-28` Batwoman outcomes | Enforce mandatory black-box constraints. |
| `PD-29` Batwoman vector fixture | Ingest only through the approved canon-fixture procedure. |
| `PD-32` two-stage physical spec | Require fulfilment completion. |
| `PD-33` fulfilment component fields | Require diameter, thickness and tolerance fields only where they affect geometry or assembly, exactly as approved. |
| `PD-34` 96 mm usage | If `PD-04` is confirmed, require approved origin-parity tuple(s), band/pattern permissions and discrete frame identity; otherwise omit the population. |
| `PD-36` B1 guarantee | Do not claim a universal guarantee until resolved. |
| `PD-37` frame hypotheses | Treat axis class as capacity and use approved hypotheses. |
| `PD-38` physical tolerances | Profile must provide effective verification radius and tolerance-composition rule; send only the effective radius to Compute. |

Traceability: `DAN-GRID-01`, `DAN-BAND-01`, `DAN-BAND-02`, `DAN-CANON-01`, `DAN-REG-01`, `DAN-STRUCT-01`, `DAN-ARCH-01`, `TEAM-SPEC-01`, `TEAM-AMEND-02`, `TEAM-AMEND-03`, `TEAM-AMEND-04`.

---

## 1. Purpose

Given:

- one canonical simple outer outline;
- one immutable approved product profile;
- one exact Compute artifact;
- the exact Logic artifact identity executing the solve;

the Logic Engine MUST deterministically produce:

- evaluated size solutions;
- per-axis classes and overall bands;
- approved pattern candidates;
- exact selected registration;
- exact centre coordinates;
- explainable acceptance/rejection;
- an Engine ManufacturingSpec;
- verification of a stored Engine ManufacturingSpec.

The package MUST make policy decisions only from profile values and neutral Compute evidence.

---

## 2. Non-goals

The Logic Engine MUST NOT:

- implement point-in-polygon, distance, offsets or polygon Boolean operations;
- identify semantic objects or body parts;
- process images or trace outlines;
- render React UI;
- choose or load a geometry backend;
- silently alter the source outline;
- rotate, mirror or non-uniformly scale;
- manufacture or select a magnet SKU;
- use an opaque weighted score where a lexicographic rule is required;
- tune rules solely until one Batwoman fixture passes;
- treat a self-authored fixture as authority.

---

## 3. Package submodules

| Module | Owns | Swappable/editable unit |
|---|---|---|
| `contracts` | Solve input, solution, rejection and ManufacturingSpec schemas | Schema version |
| `profile-schema` | Structural validation and cross-field invariants | Schema version |
| `profile-registry` | Canonicalisation, deep freeze, hash, version resolution | Profile artifact |
| `size-domain` | Candidate dominant dimensions and scaling requests | Size policy |
| `bands` | Per-axis classes and overall band | Band table |
| `cell-board` | Product cell coordinates, names, populations and mm conversion | Grid profile |
| `frames-registration` | Canonical frame coordinates and permitted translation domains | Registration strategy |
| `region-policy` | Convert neutral component evidence to product region classes | Threshold policy |
| `patterns-permissions` | Template geometry, variants and context permissions | Pattern library/policy |
| `mechanics` | Convert neutral measurements to ordered product criteria | Mechanical policy |
| `selection` | Lexicographic comparison, tie-break and reasons | Selection strategy |
| `solver` | Required evaluation sequence and Compute request orchestration | Stable orchestration |
| `manufacturing-spec` | Canonical selected-output creation | Schema version |
| `verifier` | Artifact/profile resolution and exact re-proof | Verification policy |
| `index` | Narrow solve/verify/profile APIs | Stable public surface |

Pairs requested by review remain logically separate inside a combined file/folder where appropriate:

- `profile-schema` validates; `profile-registry` freezes/hashes/resolves.
- `patterns` defines geometry; `permissions` selects contexts.
- `mechanics` derives criterion values; `selection` compares them.

No additional module may be added without an independent swap or test seam.

---

## 4. Immutable product profile

### 4.1 Profile lifecycle

A profile has three lifecycle states:

1. **Draft:** editable, not executable for production.
2. **Approved:** schema-valid, canonicalised, content-hashed and deep-frozen.
3. **Retired:** still resolvable for historical verification; unavailable for new orders.

Any value change creates a new profile hash and approved version. Existing output is never reinterpreted under a new profile.

### 4.2 Required profile sections

| Section | Contents |
|---|---|
| Identity | Profile ID, schema version, approval state |
| Numeric | Coordinate quantum governed by `PD-25`; approximation tolerance policy governed by `PD-26` |
| Grid | Cell size, node stride, populations, display addressing |
| Safety | Base protected radius; effective verification radius; versioned tolerance-composition rule; required tolerance inputs |
| Size domain | Minimum/maximum, band boundaries, candidate sequence |
| Frames | Per-axis count rule, canonical parity registration |
| Translation | Permitted domains and total-order reference |
| Structure | Clearance levels and classification thresholds |
| Patterns | Relative cell coordinates and stable IDs |
| Permissions | Allowed contexts by axis class/band/population |
| Mechanics | Exact `onemo-mechanics-v1` registry ID, formulas, comparator order, certification choices and tolerances governed by `PD-20` |
| Output | Per-band offer policy and canonical rounding |
| Fulfilment | Required component-profile fields governed by `PD-33`, plus physical-tolerance composition governed by `PD-38` |
| Regression | Canon fixture IDs and expected outcomes |

### 4.3 Profile schema invariants

An approved profile MUST satisfy:

- positive cell size, base protected radius, effective verification radius and coordinate quantum under `PD-25`;
- the base/effective-radius relationship satisfies the approved tolerance-composition rule under `PD-38`;
- integer node stride in cell units;
- strictly ordered non-overlapping bands;
- every pattern point lies on a permitted population;
- pattern IDs are unique and immutable;
- permission references resolve;
- clearance levels are strictly increasing;
- approximation tolerance satisfies the approved `PD-26` relation to the `PD-25` output quantum;
- every `PD-20` registration-sensitive criterion resolves to the exact `geometry-criteria-v1` descriptor and tolerance specified in §11.2, and every registration-independent criterion resolves to its canonical profile constant;
- every selection criterion has a total comparison;
- every tie ends in the system total order;
- no `UNRESOLVED` field remains;
- profile canonical bytes reproduce the recorded hash.

### 4.4 Source trace in profile

Every product-value field MUST carry a non-runtime provenance entry:

- decision ID;
- status at approval;
- approving authority/date outside canonical decision data;
- canon or calibration evidence reference.

The provenance record may be stored beside the canonical profile. Approval timestamps do not enter the profile hash unless Dan explicitly requires them.

---

## 5. Size and band model

### 5.1 Source measurements

Logic requests the exact outer bounding-box width \(W_0\) and height \(H_0\).

Define dominant dimension:

\[
D_0=\max(W_0,H_0)
\]

For target dominant dimension \(D\), uniform scale is:

\[
s=D/D_0
\]

Scaled dimensions are:

\[
W=sW_0,\qquad H=sH_0
\]

The aspect ratio is preserved.

### 5.2 Per-axis class

Each scaled side is classified independently against the approved band table.

Under `PD-07`:

| Axis class | Side range mm | Maximum node-line capacity | Reference span |
|---|---:|---:|---:|
| 1 | [24,72) | 1 | 24 |
| 2 | [72,120) | 2 | 72 |
| 3 | [120,168) | 3 | 120 |
| 4 | [168,216) | 4 | 168 |
| 5 | [216,264] | 5 | 216 |

Overall band is:

\[
B=\max(\text{class}_X,\text{class}_Y)
\]

The overall-band rule is governed by `PD-06`; exact threshold ownership is governed by `PD-07`. An axis class states how many canonical node lines the dimension can accommodate at most; it does not force every candidate pattern to use that many lines.

### 5.3 Candidate-size sequence

Under `PD-08`, dominant target rungs are:

\[
D_n=24+12n
\]

within the approved 24–264 mm domain.

Every rung MUST be evaluated independently. No monotonicity assumption may skip a rung.

### 5.4 Per-band output

Under `PD-09`:

- evaluate all rungs;
- retain every accepted solution in diagnostics;
- expose the smallest accepted rung in each band as the primary user offer;
- if no rung is accepted, return a rejection reason for that band.

Whether a mathematically continuous minimum should replace discrete rungs is not approved and MUST NOT be added silently.

### 5.5 B1 guarantee ambiguity

Dan described B1 as “by default possible” because the shape can be scaled until one disc fits.

The unresolved question is whether this is:

- a universal product guarantee even when the needed dominant dimension leaves B1;
- a rule only for shapes whose safe region appears inside B1;
- a statement about the Batwoman example.

Until `PD-36` is resolved, the solver MUST report the evidence but MUST NOT claim that every valid silhouette has a B1 solution.

---

## 6. Cell board and populations

### 6.1 Base cell board

The product board uses `PD-02`:

- cell side: 24 mm;
- integer cell coordinates `(i,j)`;
- empty cells remain real coordinate cells;
- canonical geometry uses integer cell coordinates, not display names.

Physical cell-centre coordinates relative to board origin are:

\[
x=i\cdot c,\qquad y=j\cdot c
\]

where \(c\) is profile cell size.

### 6.2 Human addresses

Under `PD-10`:

- internal board is unbounded;
- canonical identity uses integer `(i,j)`;
- a UI may display a 10×10 window with chess-like names;
- display names never enter ManufacturingSpec identity.

The exact letter/number direction belongs to the integration display guide, not the geometric contract.

### 6.3 48 mm population

With cell size \(c=24\) mm and node stride \(s_n=2\):

\[
\text{node pitch}=c\,s_n=48\text{ mm}
\]

Eligible 48 mm nodes have cell-coordinate parity determined by the registered population origin.

### 6.4 Conditional 96 mm population and origin phase

`PD-04` remains unresolved. If it is not confirmed, an approved profile MUST omit the 96 mm population and this subsection has no runtime effect.

If `PD-04` is confirmed, the complete model is:

- the 48 mm master-node lattice uses integer node indices `(i,j)`;
- a 96 mm sparse population selects indices satisfying `i mod 2 = p_x` and `j mod 2 = p_y`;
- `populationOriginParity=(p_x,p_y)` with `p_x,p_y∈{0,1}` is a required discrete field of the frame hypothesis;
- the approved `PD-34` profile lists the permitted parity tuple(s); a fixed-origin product lists exactly one tuple;
- continuous registration remains inside the one-48-mm-master-period domain governed by `PD-14`; the additional sparse-population phase is never treated as implicit translation;
- frame, pattern and ManufacturingSpec identity include the selected population ID and origin parity.

Logic enumerates every approved parity as a separate frame hypothesis before continuous registration optimisation. Compute needs no product special case: it receives the resulting generic origin offset and four-cell stride.

---

## 7. Canonical frames

### 7.1 Axis node coordinates

For \(n\) node lines on one axis, canonical node coordinates in base-cell units are:

\[
q_k=2k-(n-1),\qquad k=0,\ldots,n-1
\]

Examples:

| Count | Cell coordinates | Frame span in cells | Physical reference at 24 mm |
|---:|---|---:|---:|
| 1 | 0 | 1 | 24 mm |
| 2 | −1, +1 | 3 | 72 mm |
| 3 | −2, 0, +2 | 5 | 120 mm |
| 4 | −3, −1, +1, +3 | 7 | 168 mm |
| 5 | −4, −2, 0, +2, +4 | 9 | 216 mm |

The frame cell span is:

\[
2n-1
\]

This derives the locked reference sequence without treating empty cells as absent.

### 7.2 Per-axis parity registration

`PD-12` applies independently on X and Y:

- odd count: a node line lies on bbox centre;
- even count: bbox centre lies on the middle empty cell line between two node lines.

Therefore mixed frames are valid:

- 1×2;
- 1×3;
- 2×3;
- 3×4;
- and other approved axis-class combinations.

### 7.3 Frame hypotheses versus axis capacity

Axis class is a capacity, not a compulsory frame count.

Under `PD-37`, for axis capacities \(c_x,c_y\), Logic may consider only profile-permitted frame hypotheses satisfying:

\[
1\le n_x\le c_x,\qquad 1\le n_y\le c_y
\]

The initial B2 candidate coverage must include:

- 1×2 for a centred vertical pair;
- 2×1 for a centred horizontal pair;
- 2×2 for L and four-corner layouts.

A square-looking B2 silhouette may therefore still support a 1×2 vertical-pair hypothesis when its real material distribution is T-like. The 2×2 empty-centre frame is not forced merely because the bbox is square.

For larger bands, the same rule permits profile-approved 1×N, N×1 and mixed N×M frames up to the axis capacities.

### 7.4 Frame versus selected pattern

A frame defines one canonical grid phase and envelope. It does not require every frame node to be selected.

Safe geometry, structural policy and pattern permissions determine which relative nodes form a candidate. Every pattern declares the minimal frame hypothesis it requires.

---

## 8. Registration model

### 8.1 Coordinate convention

The scaled outline remains fixed with bbox centre at `(0,0)`.

A pattern consists of relative node offsets \(O=\{o_k\}\).

Registration vector \(t\) places actual centres at:

\[
a_k=t+o_k
\]

Canonical registration is:

\[
t_0=(0,0)
\]

after parity frame construction.

### 8.2 B1 canonical start

For B1, the single pattern offset is `(0,0)`, so canonical registration places the disc centre on the bbox centre.

This is governed by `PD-11`.

Canonical placement is a starting test, not a guarantee that the final selected anchor remains central.

### 8.3 Continuous feasible region

Logic sends the relative offsets, radius and allowed translation domain to Compute.

Compute returns the continuous feasible region. Logic MUST NOT replace it with coarse sampled shifts.

This is governed by `PD-13`.

### 8.4 Permitted domain

Under `PD-14`, the phase search is one 48 mm period centred on canonical registration:

\[
t_x\in[-24,24),\qquad t_y\in[-24,24)
\]

Logic may request:

- X-only;
- Y-only;
- X and Y;

according to approved mixed-parity permissions.

The half-open boundary prevents duplicate master-lattice phases. If the conditional 96 mm population is approved, its `populationOriginParity` is enumerated discretely under §6.4/`PD-34`; the continuous domain is not silently enlarged or treated as covering that origin choice. Exact domain and axis restrictions await Dan.

### 8.5 Joint registration optimisation and final point

Registration is part of the candidate, not a point chosen before mechanics.

For every discrete `(size, frame, pattern)` hypothesis, Logic retains the full continuous feasible registration set returned by Compute. It then applies the approved criteria under `PD-20` successively across the surviving joint candidates:

1. for a registration-sensitive criterion, request from Compute each surviving hypothesis's local optimum evidence — the certified optimum and equivalent argmin/argmax subset for each surviving feasible set, or its proven-complete finite critical-point certificate;
2. for a registration-independent criterion, use the exact profile constant for that discrete hypothesis;
3. certify the global best value across all surviving joint candidates;
4. discard only hypotheses certified unable to attain that value; then issue an anchored restriction request for every surviving hypothesis against the certified global optimum (the restriction anchor), restricting each surviving feasible set to a conservative subset containing every registration that may remain equivalent to that anchor under the approved tolerance; Logic must not reuse a locally anchored equivalent subset as the final global restriction;
5. carry certified score intervals and refine; prune a proven-legal candidate only on certified dominance under §11.3, otherwise return `DECISION_INDETERMINATE`.

Logic MUST NOT choose one representative per connected feasible component. A single B1 component may contain both the canonical chest-centre translation and the mechanically superior upper/head translation.

Only after every approved mechanical criterion is exhausted may Logic request the `PD-15` final order inside the final mechanically equivalent optimum set:

- canonical if present in that optimum set;
- otherwise nearest to canonical inside that optimum set;
- then X and Y;
- output-quantum proof under `PD-25` that the mapped point remains in the final optimum set, followed by exact revalidation using the approved effective verification radius.

No later or earlier canonical-collapse path is permitted.

---

## 9. Structural-region policy

### 9.1 Purpose

Structural policy distinguishes:

- substantial stable safe regions;
- marginal safe regions;
- material connectors that cannot host a centre;
- transient geometry near tips and curves.

It does not replace the original silhouette.

### 9.2 Neutral evidence input

Under `PD-16`, Logic receives from Compute:

- safe region at the approved effective verification radius;
- deeper safe regions at approved clearance levels;
- component area, bounds and centroid;
- component lineage;
- maximum clearance;
- persistence interval;
- node clearance/margin;
- outer polygon area and centroid;
- directional position.

### 9.3 Normalised features

Logic MAY derive only profile-defined dimensionless or physical features, including:

- component area divided by protected-disc area;
- component area divided by total safe-core area;
- clearance surplus over protected radius;
- deepest surviving clearance level;
- persistence span;
- relative vertical/horizontal position in bbox;
- number of legal nodes contained;
- whether the component contains a selected candidate;
- distance to material centroid normalised by dominant dimension.

Every feature formula MUST be documented and tested.

### 9.4 Region classes

The proposed classes are:

- `MAJOR`: substantial and persistent enough to influence support selection;
- `MARGINAL`: legal but below one or more approved significance thresholds;
- `CONNECTOR_ONLY`: original material connection with no safe-centre region at the protected radius;
- `UNCLASSIFIED_NEAR_TOLERANCE`: evidence changes inside the approximation envelope.

`MAJOR` and `MARGINAL` thresholds are governed by `PD-17`.

A node remains geometrically legal even when its region is marginal. Logic policy decides whether marginal nodes may be used; exact legality is never rewritten.

### 9.5 No permanent semantic exclusion

A geometric branch excluded at one size MUST be recomputed at every other size.

No profile rule may state “ears are noise” or permanently exclude a named feature.

### 9.6 Connector consequence

A `CONNECTOR_ONLY` area:

- cannot host a selected centre;
- remains part of the manufactured outer polygon;
- remains part of area/centroid/directional metrics;
- may link two major safe components mechanically.

V1 does not require a semantic skeleton. If the approved counterexamples prove component hierarchy insufficient, the scope must return to Dan before adding a medial-axis module.

---

## 10. Pattern templates

### 10.1 Representation

A pattern is immutable data:

- stable ID and version;
- population ID;
- relative base-cell coordinates;
- node count;
- optional symmetry-family identifier;
- display label outside canonical policy;
- permission references.

Pattern coordinates are product values. Compute receives only their resulting point offsets.

### 10.2 Proposed initial 48 mm templates

`PD-18`:

| Pattern ID | Relative base-cell coordinates |
|---|---|
| `single` | `(0,0)` |
| `pair.vertical` | `(0,-1)`, `(0,+1)` |
| `pair.horizontal` | `(-1,0)`, `(+1,0)` |
| `row.3` | `(-2,0)`, `(0,0)`, `(+2,0)` |
| `column.3` | `(0,-2)`, `(0,0)`, `(0,+2)` |
| `square.4` | `(-1,-1)`, `(+1,-1)`, `(-1,+1)`, `(+1,+1)` |
| `t.top1-bottom3` | `(0,+2)`, `(-2,-2)`, `(0,-2)`, `(+2,-2)` |

### 10.3 L family

The proposed L family consists of the four three-corner subsets of `square.4`.

Each orientation MUST have a deterministic stable variant ID. Pattern rotation is variation of relative node data, not rotation of the cutout.

### 10.4 Permissions

`PD-19` must define, for each template:

- allowed overall bands;
- allowed X/Y axis-class combinations;
- allowed approved population, including 96 mm only if `PD-04` is confirmed;
- whether marginal-region nodes are permitted;
- required number of major regions covered;
- whether alternative orientations are considered;
- whether the template can be a fallback or a primary offer.

The solver MUST NOT infer a permission matrix from pattern geometry alone.

### 10.5 Minimal canon coverage

Any approved initial permission matrix MUST at least allow evaluation of:

- B1 `single`;
- B2 `pair.vertical` and `pair.horizontal`;
- B2 L candidate discussed by Dan;
- square B2 `square.4`;
- B3 `t.top1-bottom3`.

This is candidate coverage, not an instruction that every candidate must win.

---

## 11. Mechanical policy

### 11.1 Legality gate and uncertainty class

A candidate is proven legal only when:

- its pattern and frame/population origin are permitted;
- its final registration is representable at the approved `PD-25` quantum;
- every centre passes exact full-disc containment using the approved effective verification radius;
- profile, Compute artifact and Logic artifact hashes are resolved.

If any manufacture-critical legality fact is `INDETERMINATE_WITHIN_TOLERANCE`, Logic classifies the candidate as `LEGALITY_INDETERMINATE` and excludes it. A proven-legal rival may still win. No later score can compensate for failed or unproved legality.

Score uncertainty is different. Once legality is proved, an uncertain mechanical criterion does not make the candidate ineligible. The candidate remains in the comparison with its certified score interval and may be pruned only under the dominance rule in §11.3.

### 11.2 Proposed exact `onemo-mechanics-v1` policy

`PD-20` places the complete table below on Dan’s ballot. Approval covers the registry ID, formulas, compound comparator order, certification method and equivalence tolerances—not only the criterion names. `PD-17` separately supplies the `MAJOR`/`MARGINAL` classification thresholds; `PD-19` separately supplies concrete pattern permission ranks.

For registration \(t\), selected offsets \(o_k\), anchors \(a_k(t)=t+o_k\), approved major regions \(R_j\), counts \(n_j(t)=\sum_k1[a_k(t)\in R_j]\), top unit \(u_y\), lateral unit \(u_x\), polygon \(P\), area \(A_P\), dominant dimension \(D\), point count \(m\), and approved coordinate quantum \(q\) from `PD-25`, the proposed policy is:

| Step / policy ID | Exact score | Comparator, including compound order | Certification method | Equivalence tolerance and unit |
|---|---|---|---|---|
| 1 `M01_MAJOR_COVERAGE` | `geometry-criteria-v1/REGION_COVERAGE_V1`: \(C=\sum_j1[n_j>0]\); \(Q=\sum_k1[a_k\notin\cup_jR_j]\). | Maximise `C`; if tied, minimise `Q`. | Certified translated-region occupancy partition and conservative equivalent set. | `0 regions`, then `0 anchors` (exact integers). |
| 2 `M02_UPPER_REGION` | Let \(h_j=\max_{x\in R_j}u_y\cdot x\), \(J_{top}=\{j:h_j=\max_l h_l\}\), and \(U=\sum_{j\in J_{top}}1[n_j>0]\); if no major regions, `U=0`. Uses `REGION_SUBSET_COVERAGE_V1`. | Maximise `U`. | Certified occupancy partition for the exact caller-selected `J_top`. | `0 regions` (exact integer). |
| 3 `M03_UPPER_MOMENT` | `CAP_FIRST_MOMENT_V1`: \(h_A=\max_k u_y\cdot a_k\); \(M=\int_{x\in P,u_y\cdot x>h_A}(u_y\cdot x-h_A)dA\). | Minimise `M`. | Certified half-plane clipping/moment optimum from exact critical projection levels or a proven-complete interval-refined critical set. | \(qA_P\) mm³; with proposed `PD-25`, `0.01·A_P` mm³. |
| 4 `M04_MAX_OVERHANG` | `MAX_DIRECTIONAL_OVERHANG_V1` over \(V=\{u_y,-u_y,u_x,-u_x\}\): \(E_{max}=\max_{v\in V}\max(0,p_P^+(v)-\max_kv\cdot a_k)\). | Minimise `E_max`. | Certified support-function/linear-envelope extrema over all feasible components. | \(q\) mm; proposed `0.01 mm`. |
| 5 `M05_PATTERN_RANK` | `DISCRETE_SCALAR_V1`: exact non-negative `patternPermissionRank` from the approved `PD-19` record. | Minimise rank. | Exact canonical profile constant. | `0 rank units`. |
| 6 `M06_REGION_LOAD` | `REGION_MAX_LOAD_V1`: with `Q` from step 1, \(L=\max(\{n_j\}_j\cup\{Q\})\). | Minimise `L`. | Certified translated-region occupancy partition. | `0 anchors` (exact integer). |
| 7 `M07_BALANCE` | `ANCHOR_CENTROID_BALANCE_V1`: \(c_A=m^{-1}\sum_ka_k\), material centroid \(c_P\); \(B_x=\lvert u_x\cdot(c_A-c_P)\rvert\); \(B_2=\lVert c_A-c_P\rVert^2\). | Minimise `B_x`; if tied, minimise `B_2`. | Certified linear-absolute and convex-quadratic argmin over the full feasible set using exact boundary/critical points or a proven-complete interval-refined set. | \(q\) mm for `B_x`; \(2Dq+q^2\) mm² for `B_2`. Proposed values use `q=0.01 mm`. |
| 8 `M08_ANCHOR_COUNT` | `POINT_COUNT_V1`: \(m\). | Minimise. | Exact pattern constant. | `0 anchors`. |
| 9 `M09_DISCRETE_ID` | `DISCRETE_KEY_V1`: `(populationId, populationOriginParityX, populationOriginParityY, frameId, patternId, variantId)`; parity fields are omitted only when not applicable. | Ascending canonical lexicographic order. | Exact canonical integer/string comparison. | No equivalence tolerance. |
| 10 `M10_REGISTRATION_ID` | `FINAL_REGISTRATION_ORDER_V1`: within the already-certified final mechanical optimum set, \((\lVert t-t_0\rVert^2,x,y)\). | Ascending lexicographic order, then `PD-25` mapping and exact legality revalidation. | Certified nearest-point argmin within the final set; no earlier use permitted. | No mechanical tolerance; exact identity order. |

Criteria 1–8 are product mechanics. Criterion 9 resolves discrete identity only after those product scores are equivalent. Criterion 10 resolves registration identity only inside the final certified mechanically-equivalent set. More anchors never receive a positive score.

### 11.3 Certification, equivalence and dominance

An exact scalar score `s` is `[s,s]`. An approximate score is a certified interval `[lower,upper]`. Compound scores carry one interval per component and apply components in the order stated in §11.2.

For tolerance \(\tau\):

- under `min`, candidate `X` is certified dominated by `Y` only if `lower(X) > upper(Y) + τ`;
- under `max`, candidate `X` is certified dominated by `Y` only if `upper(X) < lower(Y) - τ`;
- for a compound score, all previous components must be certified equivalent and the first decisive component must satisfy the corresponding rule;
- for the full lexicographic policy, all earlier criteria have already been restricted to their certified-equivalent sets.

A proven-legal score-uncertain candidate MUST remain when intervals overlap. Logic adaptively refines the relevant descriptor. If it cannot certify equivalence or dominance, the affected size returns `DECISION_INDETERMINATE` and produces no solution. If that size could change the approved band offer, the band also returns `DECISION_INDETERMINATE` and produces no offer. UI policy may hide the complete affected offer; it may not drop the uncertain legal candidate and select a rival.

Equivalence against the certified global anchor follows the same interval rules, applied to registrations rather than candidates: under `min`, a registration may be excluded from the anchored restriction only when its certified score lower bound exceeds `upper(anchor) + τ`; under `max`, only when its certified upper bound is below `lower(anchor) − τ`; for a compound score, components apply in the §11.2 order and the first decisive component decides. An earlier compound component is certified equivalent to its anchor component only when its entire certified interval is equivalent for every value in the anchor interval — under `min`, `upper(x) ≤ lower(anchor) + τ`; under `max`, `lower(x) ≥ upper(anchor) − τ`. A later component may decide exclusion only when every earlier component is certified equivalent; if an earlier component is neither certified equivalent nor certified excludable, the registration MUST be retained or refined, and exclusion through a later component is forbidden while any earlier component remains uncertain. Candidate-to-candidate compound dominance uses a different, **symmetric** equivalence test defined in `00 §7.2.1`: an earlier component of candidates X and Y is certified equivalent only when both directions hold — under `min`, `upper(X) ≤ lower(Y) + τ` AND `upper(Y) ≤ lower(X) + τ`; under `max`, `lower(X) ≥ upper(Y) − τ` AND `lower(Y) ≥ upper(X) − τ`. The one-sided anchor test applies only to the anchored restriction, never to candidate dominance. Exact scores are degenerate intervals. This is the definition Compute's anchored restriction mode in `01 §5.10.2` implements; a hypothesis-local tolerance subset is never a substitute for the global restriction.

### 11.4 Top direction

Under `PD-21`:

- canonical `topDirection=(0,+1)`;
- it is derived from editor-canvas up after coordinate adaptation;
- users cannot change it in V1;
- rotating the silhouette remains unsupported.

If Dan requires wearable orientation independent of canvas orientation, this decision must change before code.

### 11.5 Magnet count

More anchors are not a primary objective.

A larger pattern wins only when an earlier approved support criterion improves. Magnet count is an economy tie-break after equivalent support.

---

## 12. Solver architecture

### 12.1 Solve input

Required:

- canonical outer ring;
- approved profile ID/hash;
- exact Compute artifact handle/hash;
- exact Logic artifact hash;
- optional diagnostic level.

No caller may directly override an approved profile value in production solve mode.

### 12.2 Evaluation sequence

For one solve:

1. Resolve and verify the approved profile.
2. Resolve the exact Compute artifact.
3. Canonicalise and validate the outline.
4. Measure source bbox, area and centroid.
5. Generate every approved candidate dominant dimension.
6. For each candidate size:
   1. derive uniform scale;
   2. obtain scaled bounds;
   3. classify X and Y axes;
   4. assign overall band;
   5. enumerate profile-permitted frame hypotheses within the X/Y capacities;
   6. request the safe region at the approved effective verification radius and the approved deeper levels;
   7. build structural component evidence;
   8. classify regions under the profile;
   9. enumerate only templates and variants permitted for each frame hypothesis;
   10. compute each template’s continuous feasible registration region;
   11. classify indeterminate evidence by role: exclude a candidate only when its manufacture-critical legality is indeterminate; for every proven-legal candidate, carry its certified criterion intervals and full conservative feasible set;
   12. instantiate each surviving joint candidate as `(size, frame, pattern, feasible-registration-set)`;
   13. apply the approved lexicographic criteria successively across all joint candidates: obtain each hypothesis's local optimum evidence, certify the global best across hypotheses, and use exact constants for registration-independent criteria;
   14. after each criterion, discard only candidates certified unable to attain the global optimum, then issue an anchored restriction request for every surviving hypothesis against that certified global optimum (the restriction anchor), restricting every surviving registration set to a conservative subset containing every registration that may remain equivalent to the anchor under the approved tolerance; a locally anchored equivalent subset must not stand in for this global restriction;
   15. adaptively refine; prune a proven-legal score-uncertain candidate only when it is certified dominated under the complete comparator in §11.3; otherwise return `DECISION_INDETERMINATE` for the size and create neither a solution nor a ManufacturingSpec; never substitute one representative per connected component;
   16. after all mechanical criteria, apply stable discrete identity and then `PD-15` canonical/nearest/X/Y only inside the final mechanically equivalent optimum registration set;
   17. quantise at the `PD-25` coordinate quantum, prove the mapped registration remains inside the final mechanically equivalent optimum set, and exact-revalidate every selected centre using the approved effective verification radius; if a point fails, continue only within the same optimum set or return the defined status;
   18. retain rejected-candidate reason codes and certified decision evidence.
7. Group accepted solutions and `DECISION_INDETERMINATE` size results by band.
8. Apply the approved per-band offer policy; if an indeterminate size is not certified irrelevant/dominated under that complete offer comparator, return `DECISION_INDETERMINATE` for the band and emit no offer.
9. Create canonical solution records only for unambiguous accepted offers.
10. On user selection, create Engine ManufacturingSpec only from an unambiguous offered solution.

Every size is evaluated independently. A result at one rung may not be inferred from another.

### 12.3 Compute request plan

For each size, Logic sends a neutral evaluation plan containing:

- scale;
- base protected radius for provenance;
- effective verification radius for every legality computation;
- tolerance-composition rule ID/version for traceability;
- safe-region clearance levels derived from the effective radius;
- relative pattern offsets;
- allowed translation domain;
- output quantum governed by `PD-25`;
- approximation tolerance governed by `PD-26`;
- requested direction vectors;
- requested neutral metrics.

It MUST NOT send semantic labels such as “head” or “gravity-critical” to Compute.

### 12.4 Solve output

Per evaluated size:

- target dominant dimension;
- exact width/height;
- scale;
- X/Y classes;
- overall band;
- structural evidence IDs;
- selected pattern ID;
- selected registration;
- integer cell/node addresses;
- exact mm centres;
- verified margins;
- ordered decision reasons;
- rejected candidates and reasons in diagnostic mode;
- exact/approximation status;
- canonical hashes.

---

## 13. Canon registration constraints

### 13.1 Batwoman black-box constraints

Using the Dan-approved vector fixture and approved size mappings:

| Case | Required selected result |
|---|---|
| Batwoman B1 | `single` in the upper/head major region |
| Batwoman B2 | `pair.vertical` ranks ahead of a lawful `pair.horizontal` |
| Batwoman B3 | `t.top1-bottom3` with one upper anchor and lower row of three |

These outcomes are governed by `PD-28`.

#### 13.1.1 Canon-fixture intake

The fixture becomes authoritative only when:

1. Dan supplies the outline or explicitly blesses an outline exported from the Effects Studio editor;
2. the canonical geometry hash and B1/B2/B3 expected size mappings are approved with the vector;
3. the approved fixture is stored immutably and referenced by profile regression metadata.

GPT- or implementer-authored tracings may be submitted only as proposals. They cannot become authority or outvote the approved vector, screenshots and Dan’s walkthrough. `PD-29` remains unresolved until this intake is completed.

### 13.2 Non-overfitting law

The Batwoman fixture MUST NOT be the sole calibration dataset.

A threshold or priority that passes Batwoman but fails its approved counterexample is invalid.

Fixture data written by an implementer is a proposal only; it cannot alter the approved outcomes or outvote the canon-fixture intake rule.

### 13.3 Required counterexamples

At minimum:

1. **Wide shallow shape:** horizontal pair must be available/preferred where vertical support is geometrically inappropriate.
2. **Tall narrow shape:** vertical pair must be available/preferred where horizontal support is geometrically inappropriate.
3. **Symmetric square:** horizontal and vertical evidence ties; stable policy and registration ordering decide.
4. **Circle/rounded shape:** bbox may be square while four corner discs fail exact containment.
5. **Narrow terminal tips:** a small legal-at-limit region must not outrank a broad persistent region under approved thresholds.
6. **Narrow connector:** connector may host no centre while both adjacent masses remain relevant.
7. **Concave notch:** centre-inside alone must not authorise the disc.
8. **Mixed-parity rectangle:** 1×3 and 2×3 frames register correctly and exercise single-axis translation.
9. **Tolerance boundary:** rule result changes only through the approved near-tolerance status, not backend accident.
10. **Pattern economy:** extra anchors do not win when all support criteria are equivalent.
11. **Connected B1 registration region:** one connected feasible region contains both canonical chest-centre and mechanically superior upper/head translations; the upper/head translation survives candidate generation and wins, and canonical proximity acts only if mechanical criteria tie.

### 13.4 Boundary fixtures

For every width/clearance threshold, fixtures MUST include:

- one `PD-25` coordinate quantum below;
- exactly on boundary;
- one `PD-25` coordinate quantum above.

Band fixtures likewise include exact 72, 120, 168, 216 and 264 mm boundaries after `PD-07` is approved.

---

## 14. Circles, rounded shapes and rectangles

### 14.1 Circle rule

Under `PD-23`:

- band is derived from the outer bbox dominant side exactly as for other silhouettes;
- a circle is square-like for frame parity because width equals height;
- safe-core geometry, not bbox occupancy, determines lawful nodes;
- a reference square footprint is never assumed to fit inside a circle;
- exact pattern feasibility may require a larger rung in the same or later band.

This directly preserves Dan’s statement that circles require additional padding because rounded corners remove material.

### 14.2 Rectangular combinations

Each side retains its own axis class.

Examples:

- class 1 × class 2 → B2 long rectangle;
- class 2 × class 2 → B2 square-like;
- class 2 × class 3 → B3 mixed rectangle.

The overall band remains the maximum axis class.

### 14.3 Mixed parity

Under `PD-24`:

- odd/even registration is calculated independently per axis;
- a 2×3 node frame centres between two X node lines and on the middle Y node line;
- translation domains may be constrained per axis;
- pattern permissions, not geometry code, decide which templates are evaluated.

---

## 15. Engine ManufacturingSpec

### 15.1 Creation point

A ManufacturingSpec is created only after:

- an approved profile is resolved;
- one offered solution is selected by the user;
- exact centre containment is revalidated;
- all canonical hashes are available.

### 15.2 Canonical payload

The Engine ManufacturingSpec MUST contain:

| Group | Required canonical fields |
|---|---|
| Identity | Schema ID/version; Compute artifact hash; Logic artifact hash; profile ID/hash |
| Geometry | Source geometry hash; final cut geometry or immutable reference; width; height; scale |
| Coordinates | Canonical origin; axis convention; coordinate quantum governed by `PD-25` |
| Grid | Population ID; cell coordinates; registration |
| Pattern | Pattern ID/version; ordered selected node addresses |
| Centres | Exact integer coordinates and mm interpretation |
| Safety proof | Base protected radius; effective verification radius; tolerance-composition rule ID/version; approximation tolerance/error envelope governed by `PD-26`; per-centre clearance; minimum effective margin; exact proof status |
| Decision | Ordered criterion facts and stable reason codes |
| Verification | Canonical payload hash |

It MUST omit timestamps and run metadata from the hash.

### 15.3 Fulfilment completion

The engine-produced spec remains geometry/policy pure.

Before manufacture, fulfilment MUST add the versioned physical component and assembly/process profile required by `PD-32`; include diameter, thickness and tolerance fields governed by `PD-33` wherever they affect geometry or assembly; verify compatibility with the effective verification radius and tolerance-composition rule required by `PD-38`; then re-verify and hash the complete Fulfilment ManufacturingSpec.

Logic verifier MUST hard-fail when:

- exact Compute or Logic artifact cannot be resolved;
- either resolved artifact hash differs;
- profile hash differs;
- source/final geometry differs;
- the effective verification radius or tolerance-composition rule is absent;
- selected centres fail exact containment at the effective radius;
- component/process reference is absent or incompatible with the composition rule;
- final canonical hash differs.

### 15.4 Historical resolvability

Artifact and profile storage are external deployment responsibilities, but the verifier contract requires resolvability.

A historical spec whose Compute or Logic executable artifact is unavailable returns the corresponding `COMPUTE_ARTIFACT_UNRESOLVABLE` or `LOGIC_ARTIFACT_UNRESOLVABLE`; it is not re-run under the newest version.

---

## 16. Rejection and explanation model

Every rejected size/pattern MUST carry stable machine-readable reasons, not free-text-only explanations.

Logic-specific reasons include:

- `OUTSIDE_APPROVED_SIZE_DOMAIN`;
- `NO_AXIS_CLASS`;
- `NO_PERMITTED_PATTERN`;
- `NO_MAJOR_REGION_UNDER_PROFILE`;
- `UPPER_CRITICAL_REGION_UNSUPPORTED`;
- `UNSUPPORTED_EXTENT_EXCEEDS_POLICY`;
- `MARGINAL_NODE_NOT_PERMITTED`;
- `PATTERN_PERMISSION_DENIED`;
- `NO_ACCEPTED_SOLUTION_IN_BAND`;
- `PROFILE_UNAPPROVED`;
- `PROFILE_HASH_MISMATCH`;
- `LEGALITY_INDETERMINATE`;
- `CRITERION_SCORE_UNCERTAIN`;
- `DECISION_INDETERMINATE`;
- Compute failure codes passed through unchanged.

User-facing prose is generated by integration from stable codes.

---

## 17. Determinism

For fixed canonical geometry bytes, approved profile hash, Compute artifact hash and Logic artifact hash, the Logic Engine MUST return byte-identical canonical output.

Required deterministic orders and restrictions:

- candidate sizes ascending;
- bands ascending;
- frame variants by stable ID before optimisation begins;
- pattern variants by profile order before optimisation begins;
- criteria by approved profile order;
- for every criterion, certified global optimum comparison followed by deterministic anchored restriction against that certified global optimum;
- no representative-per-feasible-component collapse;
- stable discrete identity only after all earlier product criteria are equivalent;
- `PD-15` canonical/nearest/X/Y only inside the final mechanically equivalent optimum registration set;
- output nodes by canonical cell order;
- rejection reasons by stable code order.

The backend’s internal component or critical-point enumeration order MUST NOT alter the certified optimum set or final bytes.

No date, locale, device, UI state, mutable run metadata or asynchronous completion order may affect selection or any canonical hash.

---

## 18. Next.js and fulfilment integration boundary

The Logic package public surface MUST support operations equivalent to:

- load/resolve an approved profile;
- solve an outline;
- select one returned solution;
- create Engine ManufacturingSpec;
- verify Engine ManufacturingSpec;
- expose stable overlay coordinates and reason codes.

The Next.js adapter owns:

- lazy loading;
- React state;
- editor-outline adaptation;
- rendering;
- persistence transport.

The Logic package MUST run without React in browser and Node.

---

## 19. Verification plan

### 19.1 Profile tests

Mandatory:

- draft profile cannot run in production mode;
- approved profile is deeply immutable;
- one-byte value change creates a different hash;
- retired profile remains verifiable;
- unresolved fields prevent approval;
- invalid band overlap rejected;
- pattern references and permissions must resolve;
- an alternate non-ONEMO profile uses the same Compute API.

### 19.2 Band and frame tests

Mandatory:

- every approved threshold boundary;
- dominant-side overall band;
- rectangular per-axis classes;
- 1×1, 1×2, 2×2, 2×3, 3×3, 4×4 and 5×5 frame coordinates;
- odd/even centre rule;
- no duplicated phase at half-open translation boundary.
- if `PD-04` is confirmed, every approved 96 mm `populationOriginParity` is a distinct frame hypothesis while translation remains inside one 48 mm master period; a fixed-origin profile permits exactly one parity tuple.

### 19.3 Region-policy tests

Mandatory after `PD-17` approval:

- broad persistent component classified as major;
- small short-lived component classified as marginal;
- threshold one `PD-25` coordinate quantum below/on/above;
- near-tolerance evidence remains unclassified;
- feature classification recomputed at every size;
- no named-shape semantic rule exists.

### 19.4 Pattern tests

Mandatory:

- exact coordinates of every template;
- deterministic L variant IDs;
- permission denied/allowed cases;
- mixed parity;
- approved-population validation, including 96 mm only if `PD-04` is confirmed;
- conditional 96 mm node membership matches `i mod 2 = p_x`, `j mod 2 = p_y` and never relies on implicit translation phase;
- no arbitrary subset created by solver;
- more nodes do not automatically improve rank.

### 19.5 Mechanical tests

Mandatory after `PD-20` approval:

- Batwoman constraints;
- every counterexample in §13.3;
- each lexicographic criterion independently flips one comparison while earlier criteria tie;
- equivalence tolerances one `PD-25` coordinate quantum below/on/above;
- final economy rule only acts after equal support;
- centroid cannot override approved upper-support canon unless earlier criteria allow it;
- a connected B1 feasible region containing chest-centre and upper/head placements selects the mechanically superior upper/head placement;
- canonical/nearest/X/Y never operates before the mechanically equivalent optimum set is certified;
- every registration-sensitive criterion’s argopt restriction is deterministic across Node, Chromium and WebKit.
- every `onemo-mechanics-v1` row matches its exact formula, compound comparator, certification method, tolerance value and unit;
- A proven-legal candidate A with certified ascending score `10` and proven-legal candidate B with interval `[9,11]`: rejecting B and selecting A fails unless B is certified dominated under the complete comparator;
- proven-legal A with certified score `10` and candidate B with indeterminate legality: excluding B and selecting A passes;
- an unresolved overlapping score interval returns `DECISION_INDETERMINATE`, emits no size/band offer where it could affect selection, and creates no ManufacturingSpec;
- global-anchor fixture (minimised scalar, `tau = 1`): proven-legal hypothesis A with attainable scores `{0}` and proven-legal hypothesis B with attainable scores `{0.9, 1.9}`: B remains a surviving hypothesis after the criterion, and B's `1.9` registration is removed by the anchored restriction before the next criterion; carrying a hypothesis-local tolerance subset forward instead fails; tested with exact scores and with certified intervals at the tolerance boundary;
- compound-uncertainty fixture (compound `min`/`min`, `tau = (1,1)`, anchor `([0,0],[0,0])`): a registration scoring `([0.5,1.5],[100,100])` has an uncertain first component; it MUST be retained or refined, and excluding it through the second component while the first remains uncertain fails the suite;
- compound candidate-dominance fixture (compound `min`/`min`, `tau = (1,1)`): candidate X with exact compound score `(0,100)` and candidate Y with exact compound score `(10,0)`: component 1 is NOT certified equivalent under the symmetric test (`upper(Y)=10 > lower(X)+τ=1`), so component 1 decides in X's favour; pruning X through component 2 fails the suite.

### 19.6 Manufacturing tests

Mandatory:

- canonical payload round-trip;
- timestamps outside hash;
- artifact hash mismatch hard-fails;
- unavailable historical artifact hard-fails;
- profile drift hard-fails;
- geometry drift hard-fails;
- fulfilment component missing hard-fails;
- missing effective verification radius or tolerance-composition rule hard-fails;
- component/process tolerances incompatible with the approved composition rule hard-fail;
- exact revalidation at production coordinates uses the effective verification radius;
- byte-identical output across browser and Node for the same geometry, profile, Compute artifact and Logic artifact hashes.

---

## 20. Performance requirements

Logic SHOULD remain a small TypeScript package because it performs orchestration and deterministic comparisons, not geometry.

Under `PD-31`:

- compressed Logic runtime target ≤50 KB;
- hard rejection >100 KB;
- no runtime dependency beyond the shared contract and minimum schema/canonicalisation support;
- all-band warm target contributes to the combined ≤16 ms typical solve;
- profile resolution/hashing is cached and excluded from repeated warm solve only when benchmark reporting says so.

The solver MUST batch Compute requests where possible and avoid one cross-runtime call per candidate node.

---

## 21. Documentation and later ZIP contents

The eventual Logic ZIP MUST contain:

- source;
- approved profile schema;
- approved ONEMO profile;
- canonical pattern data;
- public contracts;
- tests and approved fixtures;
- benchmark harness/results;
- API guide;
- profile authoring/calibration guide;
- ManufacturingSpec and verifier guide;
- integration guide;
- artifact/hash manifest.

This section defines later delivery only. No code or ZIP is created in Turn 1.

---

## 22. Logic acceptance gate

The all-stop Hold A in `00-system-contract.md` §1.2 remains authoritative: every non-locked product-decision row must be resolved before any probe or implementation. The Logic-specific dependency set includes at least:

- `PD-07`, `PD-08`, `PD-09`;
- `PD-10`, `PD-14`, `PD-15`;
- `PD-16`, `PD-17`;
- `PD-18`, `PD-19`, and the complete `PD-20` mechanics registry, formulas, certification methods and tolerances;
- `PD-21`, `PD-22`, `PD-23`, `PD-24`;
- `PD-27`, `PD-29`, `PD-34`, `PD-36`, `PD-37`, `PD-38`.

The Batwoman outcomes remain authoritative under `PD-28` while the exact vector fixture remains governed by `PD-29`.

After approval, the bounded backend probe occurs before Compute implementation. No implementation code is authorised by this document alone.
