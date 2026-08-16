# ONEMO Neutral Geometry Compute Engine Specification

**File:** `01-compute-engine-spec.md`  
**Package target:** `@onemo/geometry-compute`  
**Stage:** Turn 1 — specification only  
**Backend:** intentionally unselected  
**Approval dependency:** `00-system-contract.md` §15 and Hold A

---

## 0. Status and authority

This document specifies a neutral mathematical package. It does not approve product policy.

The earlier Product Base document is explanatory foundation only. Product-value status is inherited from the single decision register in `00-system-contract.md`.

### Product-value dependencies visible in this specification

Product-decision status is read only from the single authoritative register in `00-system-contract.md` §15. This table retains decision IDs and local Compute treatment but does not duplicate mutable status values.

| Decision | Compute treatment |
|---|---|
| `PD-01` protected radius | Accept as caller-supplied base/effective radius; never embed 12 mm in algorithms. |
| `PD-02` base cell | Accept as caller-supplied lattice basis; never embed 24 mm. |
| `PD-03` 48 mm node pitch | Accept as caller-supplied stride/basis; never call it a magnet pitch. |
| `PD-04` possible 96 mm population | Any caller-supplied stride and origin offset are representable; Compute neither asserts the product fact nor invents a sparse-population origin phase. |
| `PD-13` continuous feasibility | Compute a continuous feasible-translation region or a certified conservative representation. |
| `PD-15` joint optimisation and final tie-break | Provide neutral certified extrema/argopt restriction or a proven-complete finite critical-point operation; apply canonical/nearest/X/Y only inside the final certified mechanically equivalent optimum set. |
| `PD-20` exact mechanical registry | Implement the neutral `geometry-criteria-v1` descriptors and their certification/tolerance units; never embed ONEMO semantic labels or criterion priority. |
| `PD-21` top direction | Accept a direction vector; never assume gravity or canvas orientation. |
| `PD-25` coordinate quantum | Public canonical integers use the approved quantum. |
| `PD-26` approximation tolerance | Enforce the approved error-envelope relation. |
| `PD-27` sub-quantum handling | Return explicit status; do not choose product behaviour. |
| `PD-31` performance gates | Benchmark, do not claim compliance before measurement. |
| `PD-35` input vertex budget | Measure and report; do not silently simplify. |
| `PD-38` physical-tolerance composition | Evaluate the caller-provided effective verification radius; do not compose or invent manufacturing tolerances. |

Engineering gate `PD-30` remains behind the backend interface until the bounded probe; it is not a product-status row.

Traceability: `DAN-PHYS-01`, `DAN-CELL-01`, `DAN-GRID-01`, `DAN-SAFE-01`, `DAN-ARCH-01`, `TEAM-PLAN-01`, `TEAM-SPEC-01`, `TEAM-AMEND-02`, `TEAM-AMEND-03`, `TEAM-AMEND-04`.

---

## 1. Purpose

The Compute Engine MUST answer neutral geometric questions for a caller-supplied polygon, values and point sets.

It MUST be reusable without source changes for:

- another protected radius;
- another cell size;
- another lattice;
- another pattern library;
- another direction system;
- another product.

The package MUST NOT select a product size, band, pattern or mechanical preference.

---

## 2. Non-goals

The package MUST NOT:

- trace pixels;
- identify objects or semantic body parts;
- know ONEMO bands;
- store product profiles;
- rank vertical against horizontal;
- label geometry strong, weak, useful or noisy;
- decide how many anchors are desirable;
- perform image rendering;
- contain React, Next.js or DOM code;
- persist orders;
- choose magnet SKU;
- silently simplify source geometry;
- mutate caller input.

---

## 3. Package submodules

The package is modular but not maximally atomised.

| Module | Owns | Public seam / reason to remain separate |
|---|---|---|
| `contracts` | Canonical request, evidence, error and lifecycle schemas | Shared stable boundary independent of backend |
| `numeric` | Integer quantum conversion, overflow checks, canonical comparison | Backend and profile values may change without changing geometry APIs |
| `polygon` | Ring validation, winding, canonicalisation and prepared-polygon lifecycle | Independently testable input boundary |
| `measure` | Bounds, area, centroid, projections, half-plane area/moments | Reused by Logic evidence and benchmarks |
| `clearance` | Point location and signed distance to exact source boundary | Independent primitive used beyond disc containment |
| `containment` | Closed-disc legality and batch margins | Applies caller radii; separate law/test seam from distance |
| `morphology` | Conservative inward regions and component hierarchy | Backend-swappable Boolean/offset seam |
| `lattice` | Neutral affine lattice coordinates and finite index windows | No product names or permissions |
| `translation-space` | Feasible regions for caller-supplied relative point sets | Continuous configuration-space operation |
| `directional` | Neutral projection, unsupported-area and moment evidence | Caller supplies directions; no preference |
| `registration-optimisation` | Certified neutral criterion extrema, score intervals and conservative argmin/argmax-equivalent subsets, or a proven-complete finite critical-point set with bounded refinement | Preserves every potentially superior registration through mechanics without product semantics |
| `final-tiebreak` | Canonical/nearest/X/Y point selection inside a caller-certified mechanically equivalent optimum set | Determinism seam after, never before, optimisation |
| `backend` | Minimal polygon Boolean/offset implementation interface | Exactly one measured implementation ships |
| `runtime` | Initialisation, prepared handles, bounded caches and disposal | Allows browser/Node loading without policy coupling |
| `index` | Narrow documented public API | Prevents internal module leakage |

`clearance` and `containment` remain separate under the ownership rule in the system contract. Other internal helpers MUST remain private unless they demonstrate an independent replacement or test seam.

---

## 4. Canonical data model

### 4.1 Scalar and point

Canonical public geometry MUST use integer coordinate units.

- One integer unit equals `coordinateQuantumMm`.
- The quantum comes from the canonical input/profile contract.
- The backend MAY use another internal representation.
- Returned canonical facts MUST be converted without locale-dependent formatting.

A point is an ordered pair `(x, y)` of signed canonical integers.

### 4.2 Polygon

V1 polygon input is exactly one simple outer ring:

- at least three distinct vertices;
- implicit closure;
- counter-clockwise after canonicalisation;
- no holes;
- no disconnected paths;
- no self-intersection;
- no duplicated adjacent vertices;
- non-zero canonical area.

The package MUST reject invalid topology before any measurement.

### 4.3 Prepared polygon

A prepared polygon is an immutable runtime handle containing only neutral acceleration data:

- canonical ring reference/hash;
- exact edge list;
- edge bounding boxes;
- polygon bounds;
- area and centroid;
- backend-specific index;
- bounded cached inward regions keyed by radius/tolerance.

A handle MUST be explicitly disposable. Reusing a handle MUST not change output.

### 4.4 Evidence provenance

Every evidence response MUST identify:

- canonical input geometry hash;
- operation identifier;
- numeric quantum;
- requested tolerance;
- actual certified tolerance;
- exact/approximate status;
- Compute artifact hash;
- deterministic error code where applicable.

---

## 5. Mathematical contract

Let the accepted outer polygon be \(P \subset \mathbb{R}^2\), with boundary \(\partial P\).

### 5.1 Uniform transform

For scale \(s>0\), translation \(t\), and canonical origin \(o\):

\[
T(x)=o+s(x-o)+t
\]

The Compute Engine MUST support scale and translation only. Rotation, mirroring and non-uniform deformation are absent from V1 requests.

A transformed request MAY be represented lazily. The result MUST be mathematically identical to transforming every source vertex and re-preparing it at the approved quantum.

### 5.2 Bounding box

The axis-aligned bounds are:

\[
x_{\min},x_{\max},y_{\min},y_{\max}
\]

with:

\[
W=x_{\max}-x_{\min},\quad H=y_{\max}-y_{\min}
\]

The Compute Engine reports these facts. It does not assign a band.

### 5.3 Area and centroid

Signed polygon area and centroid MUST use deterministic polygon moment formulas over canonical coordinates.

The engine MUST report:

- signed and absolute area;
- centroid;
- whether the centroid lies in the polygon;
- bounds centre.

The centroid is evidence only.

### 5.4 Signed clearance

For point \(c\), exact boundary clearance is:

\[
d_{\partial P}(c)=\min_{e\in\partial P} d(c,e)
\]

Signed clearance is:

- positive when \(c\) is strictly inside;
- zero on the boundary;
- negative when outside, with magnitude equal to boundary distance.

Nearest-edge identity and nearest point SHOULD be returned for diagnostics but MUST NOT affect canonical ordering unless specified.

### 5.5 Closed-disc containment

For caller radius \(r\ge0\), the closed protected disc is:

\[
D(c,r)=\{x:\|x-c\|\le r\}
\]

The legality predicate is:

\[
\operatorname{DiscLegal}(P,c,r)
\iff c\in P_{\text{closed}}
\land d_{\partial P}(c)\ge r
\]

For the accepted simple outer polygon, this is the authoritative proof that the full disc is contained.

Required evidence per centre:

- inside/outside/on-boundary classification;
- exact or certified clearance;
- requested radius;
- margin `clearance − radius`;
- legal boolean;
- nearest-boundary witness.

Closed tangency is legal. Any positive intrusion is illegal at the approved precision.

### 5.6 Safe centre region

The exact safe region for radius \(r\) is:

\[
C_r(P)=\{c\in P:d_{\partial P}(c)\ge r\}
      =P\ominus D(0,r)
\]

This region describes legal disc centres. It is not a replacement cut line.

The package MAY return multiple components. It MUST preserve concavities and component topology supported by the certified tolerance.

The exact safe set may contain:

- two-dimensional regions;
- one-dimensional limiting segments;
- isolated limiting points.

Zero area MUST NOT be treated as mathematical emptiness. A 24 mm-wide corridor can produce a legal centre line under closed tangency. If the selected backend cannot represent lower-dimensional safe sets directly, it MUST preserve exact witnesses or return `INDETERMINATE_WITHIN_TOLERANCE`; it may not report a false empty region.

### 5.7 Multi-clearance component hierarchy

For caller-supplied radii:

\[
r_0<r_1<\dots<r_n
\]

the engine computes safe regions \(C_{r_i}(P)\) and their connected components.

For each component it MUST report neutral facts:

- level radius;
- deterministic component ID;
- area;
- perimeter if available within the selected backend;
- bounds;
- centroid;
- maximum certified clearance;
- parent component at the previous shallower level;
- children at the next deeper level;
- appearance/disappearance level;
- persistence interval;
- whether it touches another component only below the current radius.

The engine MUST NOT label components as head, ear, major, marginal, useful or noise.

This hierarchy is the proposed minimum geometric normalisation under `PD-16`. No medial-axis or semantic primitive-fitting module is required for V1 unless the approved tests prove the hierarchy insufficient.

### 5.8 Neutral affine lattice

For origin \(o\), basis vectors \(b_x,b_y\) and integer indices \(i,j\):

\[
L(i,j)=o+i\,b_x+j\,b_y
\]

The lattice operation MUST:

- accept arbitrary bases;
- generate only a caller-bounded index window;
- return points in deterministic row/column order;
- attach integer indices only;
- contain no cell names, band labels or node permissions.

Logic converts these neutral indices into product cell addresses and eligible populations.

### 5.9 Point-set feasibility under translation

Let a caller-supplied pattern be a finite relative point set:

\[
O=\{o_1,\ldots,o_m\}
\]

and let \(A\) be the permitted translation domain.

A translation \(t\) is exactly feasible when every requested protected disc fits:

\[
t\in F(P,r,O,A)
\iff t\in A
\land \bigwedge_{k=1}^m \operatorname{DiscLegal}(P,t+o_k,r)
\]

Using the safe region:

\[
F(P,r,O,A)
=A\cap\bigcap_{k=1}^m(C_r(P)-o_k)
\]

The feasible set may likewise be two-dimensional, a curve/segment, an isolated point, or empty. Lower-dimensional feasibility remains mathematically valid when its selected point is representable and passes exact containment.

The Compute Engine MUST return:

- a continuous feasible-region representation or certified conservative representation;
- component count and bounds;
- whether canonical translation is feasible;
- error envelope;
- exact witness points where available;
- `FEASIBLE`, `INFEASIBLE_CERTIFIED`, or `INDETERMINATE_WITHIN_TOLERANCE`.

It MUST NOT call the point set a pair, L, T or magnet pattern.

### 5.10 Certified registration optimisation and final tie-break

The package MUST support the joint optimisation contract without learning product meaning.

#### 5.10.1 Versioned neutral descriptor registry

Logic may request optimisation only through the closed, canonical registry `geometry-criteria-v1`. Every backend selected under engineering gate `PD-30` MUST implement every descriptor referenced by an approved profile. Unknown IDs are typed failures; arbitrary JavaScript callbacks and fallback sampling are prohibited.

For translation \(t\), relative points \(o_k\), translated points \(a_k(t)=t+o_k\), caller regions \(R_j\), polygon \(P\), caller directions \(u\), point count \(m\), coordinate quantum \(q\), dominant dimension \(D\), and polygon area \(A_P\), the registry is:

| Descriptor ID | Exact value / formula | Comparator | Required certification | Proposed caller tolerance under `PD-20` |
|---|---|---|---|---|
| `REGION_COVERAGE_V1` | \(n_j(t)=\sum_k 1[a_k(t)\in R_j]\); \(C(t)=\sum_j1[n_j(t)>0]\); \(Q(t)=\sum_k1[a_k(t)\notin\cup_jR_j]\). Output `(C,Q)`. | Lexicographic: maximise `C`, then minimise `Q`. | Certified occupancy partition from translated-region intersections; returned set contains every translation attaining an equivalent tuple. | `(0 regions, 0 points)`; exact integers. |
| `REGION_SUBSET_COVERAGE_V1` | For caller subset \(J\), \(U(t)=\sum_{j\in J}1[n_j(t)>0]\). | Maximise `U`. | Same certified occupancy partition restricted to `J`. | `0 regions`; exact integer. |
| `CAP_FIRST_MOMENT_V1` | \(h_A(t)=\max_k u\cdot a_k(t)\); \(M_u(t)=\int_{x\in P,\,u\cdot x>h_A(t)}(u\cdot x-h_A(t))\,dA\). | Minimise. | Certified half-plane clipping/moment function over the feasible set using exact critical projection levels or a proven-complete critical set with interval refinement. | \(qA_P\) mm³. |
| `MAX_DIRECTIONAL_OVERHANG_V1` | For caller finite direction set \(V\), \(E_v(t)=\max(0,p_P^+(v)-\max_k v\cdot a_k(t))\); output \(E_{max}(t)=\max_{v\in V}E_v(t)\). | Minimise. | Certified support-function/linear-envelope extrema over every feasible component. | \(q\) mm. |
| `DISCRETE_SCALAR_V1` | Caller-supplied canonical integer scalar. | Caller declares `min` or `max`; `onemo-mechanics-v1` uses `min`. | Exact constant; no geometry backend call required. | `0` scalar units. |
| `REGION_MAX_LOAD_V1` | With `Q(t)` from `REGION_COVERAGE_V1`, \(L(t)=\max(\{n_j(t)\}_j\cup\{Q(t)\})\). | Minimise. | Certified occupancy partition. | `0 points`; exact integer. |
| `ANCHOR_CENTROID_BALANCE_V1` | \(c_A(t)=m^{-1}\sum_k a_k(t)\); caller centroid \(c_P\) and lateral unit \(u_x\); \(B_x(t)=\lvert u_x\cdot(c_A-c_P)\rvert\); \(B_2(t)=\lVert c_A-c_P\rVert^2\). Output `(B_x,B_2)`. | Lexicographic: minimise `B_x`, then `B_2`. | Certified linear-absolute and convex-quadratic argmin over the feasible set, via exact projection/boundary critical points or a proven-complete interval-refined set. | `(q mm, 2Dq+q² mm²)`. |
| `POINT_COUNT_V1` | \(m\). | Minimise. | Exact constant; no geometry backend call required. | `0 points`. |
| `DISCRETE_KEY_V1` | Caller-supplied canonical tuple of integers/normalized strings. | Ascending canonical lexicographic order. | Exact byte/integer comparison; no geometry backend call required. | No equivalence tolerance. |
| `FINAL_REGISTRATION_ORDER_V1` | Within a caller-certified final optimum set and canonical target \(t_0\), output tuple \((\lVert t-t_0\rVert^2,x,y)\). | Ascending lexicographic order. | Certified nearest-point/argmin over the final set, then approved-quantum mapping and exact disc revalidation. | No mechanical equivalence tolerance; exact identity order. |

The tolerance formulas above are proposed product inputs under `PD-20`; Compute validates and applies caller-provided canonical numbers and units but MUST NOT embed ONEMO values or priorities. If `PD-25` is approved unchanged, \(q=0.01\) mm; otherwise every formula uses the approved replacement quantum.

Descriptor inputs contain geometry, directions, region IDs, scalar values and comparator metadata only. They MUST NOT contain labels such as head, major, gravity, T or magnet.

#### 5.10.2 Successive certified restriction

Given current feasible set \(S_i\), neutral descriptor \(g_i\), its exact scalar/compound comparator, and approved component tolerances \(\tau_i\), Compute MUST provide either:

1. an exact optimum represented as a degenerate interval `[v,v]` plus the exact mechanically-equivalent argmin/argmax subset; or
2. a certified optimum interval for every scalar component plus a conservative equivalent-set outer approximation containing every translation that may remain equivalent under \(\tau_i\), with bounded refinement and a certificate that no omitted point can improve beyond the reported interval; or
3. a proven-complete finite critical-point set carrying the same score bounds and completeness certificate.

The request above without an anchor is **phase one**: its optimum and equivalent subset are relative to the supplied feasible set's own optimum. **Phase two** uses the same request with the optional caller-supplied restriction anchor — the certified global optimum scalar or compound interval/threshold. When the anchor is supplied, Compute returns a conservative subset of the supplied feasible set containing every registration that may remain equivalent to that anchor under the approved tolerance. The anchor is numeric comparator input, not product policy; Compute neutrality remains unchanged.

Anchored equivalence is defined by the same interval rules as dominance, applied against the anchor: an exact score is the degenerate interval `[v,v]`; under `min`, a registration may be excluded from the anchored subset only when its certified score lower bound exceeds `upper(anchor) + τ`; under `max`, only when its certified upper bound is below `lower(anchor) − τ`; for a compound score, components apply in their stated order and the first decisive component decides. An earlier compound component is certified equivalent to its anchor component only when its entire certified interval is equivalent for every value in the anchor interval — under `min`, `upper(x) ≤ lower(anchor) + τ`; under `max`, `lower(x) ≥ upper(anchor) − τ`. A later component may decide exclusion only when every earlier component is certified equivalent. If an earlier component is neither certified equivalent nor certified excludable, the registration MUST be retained in the conservative subset or refined; exclusion through a later component is forbidden while any earlier component remains uncertain. The anchored mode carries the same bounded-refinement and certificate obligations; if Compute cannot certify the anchored subset under the approved error envelope, it returns `INDETERMINATE_WITHIN_TOLERANCE`.

The caller successively restricts the joint candidate space criterion by criterion: phase-one local optimum evidence per hypothesis, then a phase-two anchored restriction against the certified global optimum for every surviving hypothesis. A hypothesis-local tolerance subset MUST NOT stand in for the global restriction. Compute MUST preserve connected feasible regions and every potentially superior point; it MUST NOT return one canonical representative per component as a substitute for optimisation.

Compute reports score intervals and certificates but does not decide product dominance. If it cannot certify bounds or a conservative surviving set under the approved error envelope, it returns `INDETERMINATE_WITHIN_TOLERANCE`.

#### 5.10.3 Final canonical tie-break

Only after Logic supplies a set certified as mechanically equivalent under all approved criteria may `final-tiebreak` apply `PD-15`:

1. canonical target if it belongs to the certified optimum set;
2. otherwise nearest squared Euclidean distance to canonical target within that set;
3. then smallest canonical X;
4. then smallest canonical Y;
5. output-quantum mapping, proof that the mapped point remains inside the certified optimum set, and exact disc revalidation using the caller-provided effective verification radius.

If quantisation invalidates the selected point, the operation continues to the next representable point under the same order within the same optimum set. It may not fall back to a mechanically inferior region.

The final point is not legal merely because it belongs to an approximate set. Every translated centre MUST pass direct `DiscLegal` exact revalidation after selection and output quantisation.

### 5.11 Directional evidence

For a unit direction \(u\), polygon \(P\), and caller anchor points \(A=\{a_k\}\), return:

#### Projection facts

\[
p_P^-=\min_{x\in P}u\cdot x,\quad
p_P^+=\max_{x\in P}u\cdot x
\]

\[
p_A^-=\min_k u\cdot a_k,\quad
p_A^+=\max_k u\cdot a_k
\]

#### Unsupported extents

\[
E_u^+=\max(0,p_P^+-p_A^+)
\]

\[
E_u^-=\max(0,p_A^--p_P^-)
\]

#### Unsupported cap regions

\[
P_u^+=\{x\in P:u\cdot x>p_A^+\}
\]

\[
P_u^-=\{x\in P:u\cdot x<p_A^-\}
\]

Return for each cap:

- area;
- centroid;
- first moment about the anchor-extreme line;
- maximum projection extent.

The positive cap first moment is:

\[
M_u^+=\int_{P_u^+}(u\cdot x-p_A^+)\,dA
\]

The negative form is analogous.

These are neutral measurements. Logic decides whether \(+u\) is “top”, whether a moment is unacceptable, and how it ranks.

### 5.12 Batch evaluation

The package MUST accept arrays of:

- centres;
- radii;
- relative point sets;
- directions.

A browser/WASM implementation MUST not require one language-boundary call per point.

---

## 6. Approximation and false-negative contract

### 6.1 Conservative inward requirement

For requested radius \(r\) and certified approximation tolerance \(\varepsilon>0\), a returned approximate safe region \(\widehat{C}_{r,\varepsilon}\) MUST satisfy:

\[
C_{r+\varepsilon}(P)
\subseteq \widehat{C}_{r,\varepsilon}
\subseteq C_r(P)
\]

Consequences:

- no point outside the true legal region may be introduced;
- every placement with at least \(\varepsilon\) extra clearance must survive;
- placements with margin below \(\varepsilon\) may be absent and must be handled explicitly.

For a point set, the approximate feasible region MUST likewise satisfy:

\[
F(P,r+\varepsilon,O,A)
\subseteq \widehat{F}_{r,\varepsilon}
\subseteq F(P,r,O,A)
\]

### 6.2 Selected-centre proof

Before a candidate can be returned as legal:

1. choose the candidate under the approved total order;
2. quantise it to the approved output quantum;
3. directly evaluate every centre \(t+o_k\) against the exact source boundary;
4. reject on any failed disc;
5. report the verified minimum margin.

Offset membership alone is never proof.

### 6.3 Empty approximate result

An empty conservative approximation is not automatically proof that the exact feasible region is empty.

Before returning any no-feasible result, the backend MUST:

1. refine the approximation to the approved minimum tolerance;
2. run direct exact predicates on all generated boundary/witness candidates;
3. return `INFEASIBLE_CERTIFIED` only when the backend can certify continuous-domain emptiness;
4. otherwise return `INDETERMINATE_WITHIN_TOLERANCE`.

Logic MUST NOT rewrite an indeterminate result as mathematical impossibility.

### 6.4 Sub-quantum feasibility

When a continuous exact region exists but contains no representable output point, Compute returns `FEASIBLE_BELOW_OUTPUT_QUANTUM`.

Product behaviour is governed by `PD-27`; Compute returns the status without choosing the product response.

### 6.5 Optimisation and structural measurements

The same error envelope applies to registration-criterion extrema, argmin/argmax subsets, finite critical-point completeness, safe-region components and persistence measurements.

An approximate optimiser MUST NOT discard a registration that could improve the current criterion within the certified envelope. It MUST refine, retain the ambiguity in the equivalent subset, or return `INDETERMINATE_WITHIN_TOLERANCE`.

The same error envelope applies to safe-region components and persistence measurements.

If a component appears/disappears within \(\varepsilon\) of a threshold, the evidence MUST carry `NEAR_TOLERANCE_BOUNDARY`; Logic may not treat it as a stable categorical fact without an approved rule.

---

## 7. Numerical determinism

### 7.1 Canonical integers

Input and canonical output MUST use integers at the approved quantum.

Intermediate arithmetic MUST:

- detect overflow;
- avoid undefined platform behaviour;
- use a deterministic rounding mode;
- never serialise non-finite values;
- produce the same ordering across browser and Node runtimes.

### 7.2 Backend freedom

A backend MAY use:

- exact integer/rational operations;
- bounded floating-point operations with certified error;
- polygonal arc approximation under §6.

It MUST expose the same canonical evidence and error envelope.

### 7.3 Ordering

The following orders MUST be specified and tested:

- vertices after canonicalisation;
- polygon components;
- component hierarchy nodes;
- lattice points;
- feasible-region components;
- selected-point ties;
- batched evidence items.

### 7.4 Artifact identity

The runtime MUST expose the exact Compute artifact hash. Compute-only evidence identity is the canonical operation input plus that Compute artifact hash. A caller MUST be able to pin it into ManufacturingSpec.

A version string without the Compute artifact hash is non-authoritative. Timestamps and mutable run metadata remain outside the canonical evidence hash.

---

## 8. Runtime, memory and performance

### 8.1 Initialisation

The package MUST expose an explicit async initialisation boundary so the integration can lazy-load a compiled backend if selected.

After initialisation, warm operations SHOULD be synchronous unless the selected backend proves otherwise.

### 8.2 Caching

Permitted bounded caches:

- prepared source polygon;
- edge acceleration index;
- measurements;
- safe regions keyed by `(radius,tolerance,scale identity)`;
- component hierarchies keyed by approved radius vector.

Caches MUST:

- have deterministic keys;
- have a configured maximum;
- be clearable;
- not change canonical output;
- show flat memory under repeated benchmark runs.

### 8.3 Scale reuse

The backend SHOULD avoid rebuilding source topology for every uniform scale where exact inverse-transform evaluation is cheaper.

Any lazy-scale optimisation MUST be proven equivalent at the canonical quantum.

### 8.4 Main-thread target

The default design assumes warm mobile compute fits the approved main-thread budget. A Worker is not part of the required package.

If measured hard-rejection limits are exceeded, the implementation plan must return to Dan; it may not silently add a Worker lane.

### 8.5 Input complexity

The engine MUST report:

- vertex count;
- edge count;
- safe-region output complexity;
- operation timings in benchmark mode.

It MUST NOT simplify input to meet a budget. Maximum accepted vertices and any pre-simplification responsibility are governed by `PD-35`.

---

## 9. Backend interface and bounded probe

### 9.1 Required backend capabilities

A candidate backend must implement only:

- polygon validation support required by the package;
- point-in-polygon;
- nearest point/segment clearance;
- inward disc erosion or a certified equivalent;
- polygon intersection;
- component extraction;
- half-plane clipping and polygon moments;
- deterministic canonical conversion.

Unrelated geometry features MUST not enter the production bundle.

### 9.2 Probe candidates

The bounded probe compares:

1. fixed-point TypeScript;
2. C++ polygon backend to WebAssembly, only if the environment can build and reproduce it.

The specification does not prefer a candidate.

### 9.3 Probe corpus

The approved probe corpus MUST include:

- square;
- long vertical and horizontal rectangles;
- circle approximation approved for test use;
- concave notch;
- narrow neck;
- thin terminal limb;
- Batwoman canonical vector once approved;
- high-vertex but valid outline at the approved budget;
- near-tangency and near-intrusion cases;
- mixed-parity pattern offsets;
- empty and multi-component safe regions.

### 9.4 Probe gates

Each candidate is measured for:

- clean build from repository instructions;
- deterministic hash and outputs;
- exact tangency;
- one approved coordinate quantum of intrusion; if `PD-25` is approved unchanged, this probe case is 0.01 mm;
- conservative approximation contract;
- compressed runtime size;
- cold initialisation;
- warm single-size and all-band supporting operations;
- memory after repeated runs;
- WebKit, Chromium and Node compatibility.

### 9.5 Selection

- A candidate failing correctness is disqualified regardless of speed.
- A candidate failing reproducible build is disqualified.
- If both pass, choose the smaller complete runtime unless it breaches the approved warm-compute gate; otherwise choose the faster passing runtime.
- If neither passes, implementation is blocked and the plan returns to Dan.
- Exactly one runtime ships.

The final selection rule itself is engineering policy authorised by the review. `PD-30` is resolved by measured engineering evidence after Hold A; it is not a Dan product ballot item.

---

## 10. Error contract

The package MUST use typed machine-readable failures, including:

- canonical input failures from the system contract;
- `NUMERIC_OVERFLOW`;
- `UNSUPPORTED_QUANTUM`;
- `INVALID_RADIUS`;
- `INVALID_DIRECTION`;
- `UNSUPPORTED_CRITERION_DESCRIPTOR`;
- `INVALID_LATTICE_BASIS`;
- `BACKEND_NOT_INITIALISED`;
- `BACKEND_FAILURE`;
- `APPROXIMATION_CONTRACT_BREACH`;
- `INDETERMINATE_WITHIN_TOLERANCE`;
- `FEASIBLE_BELOW_OUTPUT_QUANTUM`;
- `EXACT_REVALIDATION_FAILED`;
- `RESOURCE_LIMIT_EXCEEDED`.

Errors MUST include enough neutral context to reproduce the failed request but MUST not assign product meaning.

---

## 11. Verification plan

### 11.1 Predicate tests

Mandatory:

- centre exactly 12 mm from a straight edge is legal for radius 12;
- centre less than 12 mm by one approved quantum is illegal;
- nearest vertex rather than edge controls clearance;
- concave notch intrusion invalidates a disc whose centre is otherwise inside;
- boundary point with positive radius is illegal;
- zero-radius query follows closed point containment;
- orientation reversal canonicalises to identical output;
- translated/scaled equivalent inputs give equivalent evidence.

### 11.2 Safe-region tests

Mandatory:

- 24 mm-wide corridor produces a zero-width limiting centre set under exact geometry;
- just-below corridor produces no safe region;
- just-above corridor produces a positive-width region;
- narrow terminal branches disappear before broad masses at deeper radii;
- conservative inclusion relation in §6 holds;
- components are deterministically ordered;
- empty approximation never becomes an unqualified exact-negative result.

### 11.3 Translation-space and optimisation tests

Mandatory:

- one point reduces to the safe region;
- pair feasibility equals intersection of two shifted safe regions;
- a single connected feasible region containing canonical chest-centre and mechanically superior upper translations is preserved rather than collapsed to one representative;
- each neutral criterion returns a certified optimum and equivalent argmin/argmax subset, or a proven-complete finite critical set;
- successive criteria restrict the feasible set without losing a superior point;
- an implementation that samples one representative per connected component fails the suite;
- canonical/nearest/X/Y ordering acts only inside the final certified optimum set;
- equal-distance optimum solutions resolve X then Y;
- quantised selected point is exact-revalidated using the caller-provided effective verification radius;
- continuous-but-sub-quantum optimum set returns its dedicated status;
- no-feasible or no-optimum outcome is certified or indeterminate, never guessed.
- every `geometry-criteria-v1` descriptor returns the specified scalar/compound score, unit and comparator semantics;
- exact scores return degenerate intervals and approximate scores return certified intervals plus conservative surviving sets;
- each descriptor is tested one approved tolerance below, exactly on, and one tolerance above equivalence;
- unknown descriptor IDs fail rather than sampling or substituting another metric;
- global-anchor fixture (minimised scalar, `tau = 1`): hypothesis A has attainable scores `{0}`; hypothesis B has attainable scores `{0.9, 1.9}`; B remains a surviving hypothesis after the criterion, and B's `1.9` registration is removed by the anchored restriction before the next criterion; tested with exact scores and with certified intervals at the tolerance boundary;
- a hypothesis-local tolerance subset standing in for the anchored global restriction fails the suite;
- compound-uncertainty fixture (compound `min`/`min`, `tau = (1,1)`, anchor `([0,0],[0,0])`): a registration scoring `([0.5,1.5],[100,100])` has an uncertain first component; it MUST be retained or refined, and excluding it through the second component while the first remains uncertain fails the suite.

### 11.4 Directional tests

Mandatory:

- symmetric polygon and symmetric anchors produce equal opposing metrics;
- upper unsupported cap differs from lower cap when anchor set is shifted;
- rotating only the caller direction rotates reported metrics without changing geometry;
- centroid is reported but does not alter metrics.
- `CAP_FIRST_MOMENT_V1`, `MAX_DIRECTIONAL_OVERHANG_V1`, and `ANCHOR_CENTROID_BALANCE_V1` match their registry formulas and certified critical-set/argopt contracts.

### 11.5 Neutrality tests

Mandatory source/API checks:

- no product profile import;
- no B-band identifier;
- no pattern name;
- no gravity preference;
- no React/Next/DOM dependency;
- alternative radii, bases and directions work without source changes.

### 11.6 Determinism tests

Canonical input, profile-independent request and Compute artifact MUST produce byte-identical evidence across:

- repeated runs;
- Node;
- Chromium;
- WebKit;
- cold and warm runtime;
- different object insertion order.

### 11.7 Property and adversarial tests

Generated simple polygons MAY supplement, never replace, named fixtures.

Every implemented rule MUST have:

- positive case;
- negative case;
- exact boundary case;
- counterexample;
- tolerance-boundary case.

---

## 12. Benchmark contract

Benchmark results MUST state:

- hardware/runtime;
- browser version;
- cold or warm state;
- polygon edge count;
- radii count;
- pattern point count;
- number of sizes/registrations;
- median, p95 and maximum;
- compressed artifact bytes;
- peak and post-loop memory where measurable.

The “typical” corpus is approved with the product decisions; no easy single shape may stand in for the full claim.

The provisional targets are governed by `PD-31`; status is authoritative only in the system register.

---

## 13. Documentation and later package contents

The eventual Compute ZIP MUST contain:

- source;
- selected backend source and reproducible build;
- generated distribution;
- type declarations/contracts;
- API guide;
- mathematical notes;
- integration guide for browser and Node;
- test fixtures;
- test results;
- benchmark harness and measured report;
- third-party notices;
- artifact hash manifest.

This section defines later delivery only. Turn 1 creates no ZIP or implementation.

---

## 14. Compute acceptance gate

The all-stop Hold A in `00-system-contract.md` §1.2 remains authoritative. The Compute-specific dependency set includes at least:

1. Dan resolves `PD-14`, `PD-15`, `PD-25`, `PD-26`, `PD-27`, `PD-31` and `PD-35`;
2. the Batwoman vector fixture requirement is resolved or explicitly deferred without weakening its locked expected outcomes;
3. Hold A clears;
4. the backend probe is executed before any backend is frozen.

Until then, this document is a complete backend-neutral contract but not implementation authority.
