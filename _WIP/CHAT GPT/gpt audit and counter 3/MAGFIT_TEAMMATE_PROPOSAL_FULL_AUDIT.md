# MAGFIT Grid-Pixel Proposal — Full Independent Audit

**Audit date:** 12 August 2026  
**Proposal archive:** `Grid-Pixel-Magfit-Proposal-20260812.zip`  
**Archive SHA-256:** `4eac3583ac61580b1fc6b519fd7af373fbc24a8ce324389b8c46a75551b6f818`  
**Unpacked package:** `grid-pixel proposal`  
**Package version:** `0.2.0`  
**Auditor decision:** **Accept as an improved exact-geometry reference prototype; reject as the final production MAGFIT engine.**

---

## 1. Executive verdict

The teammate proposal is a substantial improvement over the previous package. It correctly repairs several release-blocking faults:

- selection is now layout-tier-first rather than first-size-first;
- band 2 no longer pretends that one surviving 96 mm phase node is sparse engagement;
- the default sparse rule begins at band 3 with two active nodes and 96 mm connectivity;
- local contour evidence has been added for flap analysis;
- the direct straight-capsule rule is no longer presented as curved-corridor connectivity;
- the C ABI now supports solving several bands after one canonicalisation pass;
- polygon simplicity validation has an AABB broad phase;
- circle, antenna, cove, U-corridor, band-4 and multi-band tests were added.

The exact point/disc and direct-capsule mathematics are strong. Independent builds and sanitizers passed. Nevertheless, the package is **not yet a correct final engine** because the implementation and the contract still diverge on allowed layouts; the local flap method can remain blind to coves; an exact-threshold narrow-limb case is silently unreported; the promised two-submodule architecture is not implemented; the stable output is insufficient to drive fulfilment without recomputation; and worst-case hot-solve performance remains far outside the phone-frame target for high-vertex traces.

### Release decision

```text
Mathematical geometry kernel       ACCEPT
Reference implementation          ACCEPT WITH CORRECTIONS
Normative product contract         REVISE
Editor integration API             INCOMPLETE
Manufacturing/fulfilment output    INCOMPLETE
Phone/Wasm release                 REJECT FOR NOW
```

The correct response is **not to discard the proposal**. Retain the exact geometry implementation and repair the product-logic, flap, prepared API, result provenance and performance layers.

---

## 2. Audit scope and method

The audit covered all 16 delivered files, approximately 3,839 source/document lines, including:

```text
contract/MAGFIT_ENGINE_CONTRACT.md
include/magfit/magfit.hpp
include/magfit/magfit_c.h
src/magfit.cpp
src/magfit_c.cpp
tests/test_magfit.cpp
tests/test_magfit_c.c
bench/bench_magfit.cpp
README.md
VALIDATION.md
ERRORS.md
CMakeLists.txt
build.sh
```

### 2.1 Integrity

The archive SHA-256 was recorded above. Every file covered by `SOURCE_MANIFEST_SHA256.txt` passed `sha256sum -c`; no manifest corruption or unexplained source alteration was found.

### 2.2 Independent execution

The package was compiled independently rather than accepting its validation record at face value.

| Check | Result |
|---|---:|
| GCC C/C++ Release, warnings as errors | PASS |
| Clang C/C++ Release, warnings as errors | PASS |
| Native C++ acceptance suite, GCC | PASS |
| C ABI acceptance suite, GCC | PASS |
| Native C++ acceptance suite, Clang | PASS |
| C ABI acceptance suite, Clang | PASS |
| Clang AddressSanitizer + UndefinedBehaviorSanitizer | PASS |
| GCC UndefinedBehaviorSanitizer | PASS |
| libstdc++ debug-mode build | PASS |
| Source manifest | PASS |
| One million random 128×128→256 multiplication comparisons against Boost multiprecision | PASS |
| 1,000 random polygon comparisons against an independent geometry oracle for the current algorithm | 0 mismatches |

The random oracle result validates that the code generally implements **its own present rules** correctly. It does not prove that those rules are the correct ONEMO product rules.

### 2.3 Independent benchmark results on the audit container

The proposal records Apple Clang figures of 6.88 ms hot, 7.33 ms cold, and 1.21 ms for 8,100-point preparation. Those figures may be genuine for that machine, but they are not portable performance guarantees.

Independent results on this audit container were:

```text
GCC Release, 1,000 vertices, bands 2+3
    hot solve mean                 approximately 11.2 ms
    validation + solve            approximately 11.2 ms

Clang Release, 1,000 vertices, bands 2+3
    hot solve mean                 approximately 9.1 ms
    validation + solve            approximately 9.0 ms
```

A separate 8,100-point hot-solve benchmark, after canonicalisation retained 5,872 vertices, produced:

```text
bands 2+3+4, already canonicalised
    approximately 208 ms per solve
```

This is the more relevant result for a complex editor contour. The package benchmark times only 8,100-point **preparation**, not an 8,100-point multi-band hot solve.

---

## 3. Findings summary

| ID | Severity | Finding | Decision |
|---|---|---|---|
| F-01 | **Blocker** | Code invents `ConnectedFallback`, contradicting the locked band-2 layout catalogue | Must fix |
| F-02 | **Blocker** | Solver extracts only maximal connected components, so approved L/pair subsets can be lost | Must fix |
| F-03 | **Blocker** | Local flap samples outer nodes and one midpoint only; coves can lie between witnesses | Must fix |
| F-04 | **Blocker** | Exact-threshold narrow limb is not reported because `>` is used instead of threshold reach | Must fix |
| F-05 | **Major** | Promised GeometryKernel/BandLogic split is not implemented | Must fix before production integration |
| F-06 | **Major** | “Prepare once” exists only per call; no persistent prepared object or cross-interaction cache | Must fix for editor use |
| F-07 | **Major** | Worst-case validation and hot-solve performance do not meet stated mobile goal | Must optimise and benchmark |
| F-08 | **Major** | Result does not contain enough provenance/transform data for fulfilment without recomputation | Must fix |
| F-09 | **Major** | C/Wasm build instructions omit the new multi-band export | Must fix |
| F-10 | **Major** | C ABI lacks count caps, overflow guards, complete failure initialisation and ABI versioning | Must fix |
| F-11 | **Major** | Sparse phase semantics remain under-specified for real SKUs and return only one phase | Must settle product law |
| F-12 | **Major** | Band-3+ layout tiers are implicitly invented, not specified per band | Must specify |
| F-13 | **Major** | Integer-millimetre manufacturing law conflicts with rational transformed contour | Must settle manufacturing law |
| F-14 | **Major** | Nominal 12 mm core cannot yet guarantee physical zero-adjustment fit | Requires tolerance calibration |
| F-15 | **Moderate** | Tests are good but miss the actual blind spots found in this audit | Add regressions |
| F-16 | **Moderate** | Documentation contains contradictory or unverifiable policy statements | Correct contract and provenance |
| F-17 | **Moderate** | No-fit result carries a false default layout tier | Add explicit `NONE` state |

---

# 4. Findings in detail

## F-01 — Unapproved `ConnectedFallback` contradicts the locked product law

### What the contract says

The proposal contract locks band-2 tiers as:

```text
FULL_2X2
LINKED_L3, when enabled
ADJACENT_PAIR
```

See contract lines 128–145 and the v1 lock table at lines 925–945. It says band 2 can yield a pair, linked three-node L, or four-node square.

### What the code does

The public enums introduce:

```cpp
Full = 0
ConnectedFallback = 1
LinkedThree = 2
Pair = 3
```

`layout_tier()` in `src/magfit.cpp:753–761` classifies every connected candidate that is not a complete square, two-node pair or three-node layout as `ConnectedFallback`. Because enum order controls cross-size ranking, this unapproved tier outranks the approved L and pair.

The suite explicitly validates a U-shaped four-disc/three-link result as `ConnectedFallback` in `tests/test_magfit.cpp:281–295`.

### Why this matters

This is not harmless diagnostic metadata. It changes the selected product:

- a four-node U/tree layout may win over a valid three-node L;
- a band-3 arbitrary five- or eight-node connected component may outrank an approved smaller fallback;
- the application receives a magnetic SKU not present in the normative catalogue.

### Independent reproduction

The delivered U fixture returns:

```text
fit=1
layout tier=ConnectedFallback
magnets=4
verified links=3
```

### Decision

The implementation is wrong **relative to its own contract**. There are two legitimate resolutions, but one must be chosen explicitly:

1. Remove `ConnectedFallback` and permit only versioned approved masks; or
2. Make every accepted connected topology an explicit named product layout with a product decision, ranking, fulfilment mapping and regression fixture.

The current implicit catch-all is not acceptable.

---

## F-02 — Maximal connected components do not implement “approved connected subsets”

The contract says a final layout may be a connected supported **subset** of a parent template. The code does not enumerate subsets. It computes maximal connected components over all supported nodes (`src/magfit.cpp:676–701`, `828–857`).

This produces a subtle but important failure.

In the U fixture:

- all four discs are supported;
- three direct links are supported;
- the maximal component contains all four nodes;
- a valid approved three-node L exists as a subset of that component;
- the code never emits that L because it emits only the four-node maximal component;
- it therefore needs the invented `ConnectedFallback` tier to return anything.

Removing `ConnectedFallback` without changing candidate extraction would therefore still be wrong.

### Required correction

Use explicit, versioned layout masks. The search space is tiny:

```text
band 2 parent: 4 nodes → 16 subsets
band 3 parent: 9 nodes → 512 subsets
band 4 parent: 16 nodes → explicit catalogue strongly preferred
```

For band 2, no generic search is needed at all:

```text
FULL_2X2
L_NE, L_NW, L_SE, L_SW
PAIR_H_CENTRE / approved edge variants
PAIR_V_CENTRE / approved edge variants
```

Each mask declares:

- required nodes;
- required direct links;
- optional links;
- parent registration;
- product tier;
- layout ID;
- sparse applicability;
- fulfilment mapping.

This also resolves a deeper ambiguity: does `FULL_2X2` require all four straight links, merely four fully supported discs plus graph connectivity, or four discs regardless of a cove between them? That is a product law and must be encoded in the mask definition, not inferred by a generic graph component.

---

## F-03 — The local-flap algorithm can still be blind to coves

### Delivered method

For each side, `side_witness_points()` selects:

- each outermost selected magnet;
- one midpoint between each pair of consecutive outermost magnets.

It then checks a radius-12 straight outward tongue at those finite witnesses. See `src/magfit.cpp:906–989`.

This catches the proposal’s single cove fixture, but it does **not** certify the complete side. A cove can be placed between the finite witness positions.

### Exact counterexample

The following simple polygon, evaluated as band 3 at exactly 156 mm, was independently executed against the proposal:

```text
( 78, 78) ( 78,-78) (-78,-78) (-78, 78)
(-28, 78) (-28, 28) (-28, 20) (-20, 20)
(  4, 20) (  4, 28) (-20, 28) (-20, 78)
( 20, 78) ( 20, 34) ( 28, 34) ( 28, 78)
```

The selected top outer magnets are at:

```text
x = -48 mm and +48 mm
```

The implementation samples:

```text
x = -48, 0, +48 mm
```

The proposal reports:

```text
fit=1
size=156
layout tier=ConnectedFallback
selected magnets=8
top bbox overhang=18 mm
local_tongue_any_12=true
local_tongue_all_12=true
narrow_limb_exception_12=false
failing witnesses=0
```

But the contour contains top coves centred around approximately `x=-24` and `x=+24`. A radius-12 tongue at those positions intersects the missing material. For example, at `x=-24`, the starting radius-12 disc contains `(-24,36)`, which lies in the open cove. The tongue therefore fails exactly even though every sampled witness passes.

This reproduces the user’s explicit concern: **the engine remains blind to a cove in a widened butterfly/wing area because the local representation is still under-sampled.**

### Required correction

The geometry kernel should return at least two distinct facts:

```text
sampled_outer_node_tongues
continuous_side_strip
```

For top side depth `h`, a strong continuous witness is the swept region:

```text
([outerMinX, outerMaxX] × [outerY, outerY+h]) ⊕ Disc(12)
```

contained in the exact polygon. Equivalent side definitions apply to left, right and bottom.

This can be tested exactly with a rounded-rectangle/rectangle-to-boundary containment predicate or a versioned exact polygon-operation implementation. It should not be approximated by only one midpoint per gap.

If the product intentionally wants only magnet-local tongues rather than continuous side material, the fields must be named accordingly and must not claim `local_tongue_all` for the entire side. The current name overstates the evidence.

---

## F-04 — Exact-threshold narrow limbs are silently missed

The code sets:

```cpp
exception = extent > threshold && !anyTongue;
```

at `src/magfit.cpp:980`.

Therefore a side whose bbox overhang equals exactly 12 mm or 24 mm never receives a narrow-limb exception, even when every full-width local tongue fails.

### Exact counterexample

This polygon was solved as band 2 at exactly 96 mm:

```text
(-48,-48) (48,-48) (48,36) (5,36)
(5,48) (-5,48) (-5,36) (-48,36)
```

It is a 96 mm-wide body with a 10 mm-wide top antenna. The proposal returns:

```text
fit=1
layout=Full
top overhang=12 mm
extent_reaches_12=true
local_tongue_any_12=false
local_tongue_all_12=false
narrow_limb_exception_12=false
coverage_within_12=true
```

This is unsafe as a diagnostic result: the exact 12 mm extent is supplied only by a 10 mm-wide antenna, yet the exception is absent.

### Required correction

At minimum:

```text
narrow_limb_exception_h = extent_reaches_h && !local_tongue_any_h
```

which means `>=`, not `>`.

A better model is independent of threshold coincidence:

```text
narrow_feature_present
extent_reaches_h
continuous_strip_h
sampled_local_tongue_any_h
```

The product logic can then classify exact-threshold cases without losing the geometry fact.

The current code matches the contract’s word “exceeds,” but the contract itself should be corrected because it fails the direct requirement to report narrow-limb exceptions rather than auto-clearing them at equality.

---

## F-05 — The two-submodule compute architecture was not delivered

The previously agreed architecture requires one compute module containing:

```text
MagFitGeometryKernel
MagFitBandLogic
```

The proposal contract sometimes speaks conceptually about geometry versus band logic, but the implementation remains one monolithic `src/magfit.cpp` anonymous namespace. `EnginePolicy` mixes:

- physical geometry constants;
- sparse product rules;
- band engagement;
- selection behaviour.

There is no public immutable geometry-evidence object and no separate product-logic layer consuming it.

This is not merely a source-layout preference. The coupling is the reason that:

- an unapproved `ConnectedFallback` entered geometry extraction;
- flap facts and “Dan’s maximum-overhang rule” are mixed in one result builder;
- sparse applicability is embedded in candidate geometry;
- no reusable support mask exists for an editor preview or alternative product policy.

### Required source boundary

```text
src/geometry/
    canonical_polygon.cpp
    exact_predicates.cpp
    scaled_shape.cpp
    disc_support.cpp
    direct_link.cpp
    flap_evidence.cpp
    prepared_shape.cpp

src/logic/
    band_specs.cpp
    layout_catalog.cpp
    dense_selection.cpp
    sparse_policy.cpp
    ranking.cpp
    fulfilment_result.cpp
```

The geometry module should return facts. The logic module should select products.

---

## F-06 — “Prepare once” is only one-shot-per-call, not editor preparation

### What is good

The C++ API supports:

```cpp
canonicalize_and_validate(...)
solve_canonical(... several bands ...)
```

The new C function `magfit_solve_bands_i32` also canonicalises once inside one multi-band call. This is a genuine improvement over calling the one-band API repeatedly.

### What is missing

There is no persistent prepared shape for the editor lifecycle. Every call to `magfit_solve_bands_i32`:

1. copies all vertices;
2. canonicalises;
3. validates;
4. rebuilds scaled polygons;
5. recomputes all support/link/flap queries.

The package calls this “prepare once,” but it means “once per API invocation,” not “once per frozen shape.”

### Required API

```cpp
PreparedShape prepare(const PolygonInput&, const PreparePolicy&);
SolveResult solve(const PreparedShape&, const SolveRequest&);
```

Stable C/Wasm:

```c
MagfitStatusC magfit_prepare_i32(..., MagfitPreparedShapeHandle* out);
MagfitStatusC magfit_solve_prepared(...);
void magfit_prepared_destroy(...);
```

The prepared object should cache exact per-size facts:

```text
shape hash
canonical contour
scaled edge data
node disc evidence
adjacent direct-link evidence
flap strip/tongue evidence
sparse phase evidence
```

The current one-shot multi-band API may remain as a convenience wrapper.

---

## F-07 — Performance does not yet meet the stated phone requirement

### Validation broad phase

The proposal improves the old all-pairs validator with an x-sorted active set and y-AABB rejection. It remains worst-case quadratic because every active edge is still linearly scanned.

An independently generated simple zigzag polygon whose edge x-ranges overlap produced:

```text
input vertices     preparation time
502                0.213 ms
1,002              0.581 ms
2,002              2.359 ms
4,002              8.102 ms
8,002             33.202 ms
16,002           132.336 ms
32,002           510.171 ms
```

The approximately fourfold time growth when vertex count doubles is clear quadratic behaviour.

This does not mean the validator is incorrect. It means the AABB broad phase is not a sufficient worst-case production guarantee.

### Hot solve

The more serious issue is repeated full edge scanning for each disc, link and flap witness at every legal size. For a nominal 8,100-point circular trace retaining 5,872 canonical vertices, bands 2, 3 and 4 took approximately:

```text
208 ms per already-canonicalised solve
```

That is far above the stated 16.7 ms frame target and contradicts any general claim that 100s–1000s of vertices are automatically inexpensive.

### Required optimisation order

1. Persistent prepared shape.
2. Per-size scaled edge records built once.
3. Node and direct-link query cache shared across all templates and bands.
4. Deterministic segment AABB tree/BVH for nearest-boundary and capsule queries.
5. Exact broad phase followed by the same exact rational predicate.
6. Target iOS, Android and Wasm benchmarks over real traced contours.

Do not weaken exact decisions to floating-point epsilon tests.

---

## F-08 — Output cannot yet power fulfilment without geometric recomputation

The direct request requires the engine output to power any editor/customisation application and provide precise manufacturing millimetre specifications and clear grid coordinates.

The present result includes:

- band and size;
- width/height rational;
- template runs;
- selected magnets;
- verified links;
- one sparse phase;
- one binding contact;
- flap facts.

It does **not** include several required provenance and fulfilment fields:

```text
engine version in each result
policy version/hash
shape hash
stable layout_id
link_mode
explicit sparse status
all compatible sparse phases/evidence
previous tier/size failure witness
limiting local flap contact
exact shape-to-manufacturing transform
final manufactured contour or exact transform recipe
```

The C++ result returns the canonical source polygon, but the C ABI result does not return the source bbox centre/max span needed to reproduce exact transformed vertices. Width/height and magnet coordinates are not sufficient to cut an arbitrary shape.

### Required transform output

At minimum return:

```text
source centre numerator: centre2X, centre2Y
scale numerator: manufacturedSizeMm
scale denominator: sourceMaxSpan
translation: grid origin
orientation/mirror flags
canonical contour hash
```

or return the manufactured contour itself in exact rational/fixed-point coordinates.

The renderer and fulfilment service must consume this output. They must not independently rebuild the transform and risk a different rounding path.

---

## F-09 — WebAssembly integration instructions omit the multi-band function

The contract tells the TypeScript adapter to call:

```text
magfit_solve_bands_i32
```

once for the requested bands, but the Emscripten export list contains only:

```text
_magfit_engine_version
_magfit_default_policy
_magfit_solve_band_i32
_malloc
_free
```

See contract lines 707–731.

A Wasm build following the documented command cannot call the recommended multi-band API because dead-code elimination may remove it.

### Required correction

Add:

```text
_magfit_solve_bands_i32
```

and, after the prepared API is added, its prepare/solve/destroy functions.

No actual Emscripten build or JavaScript integration test is included, so Wasm suitability remains unproven.

---

## F-10 — C ABI hardening is incomplete

The contract says every caller-controlled count and range is validated before multiplication or allocation. The implementation does not fully satisfy that rule.

### Issues

- no maximum `vertex_count`;
- no maximum `band_count`;
- no guard that `2 * vertex_count` cannot overflow `size_t` before indexing `xy[2*i]`;
- unbounded `reserve(vertex_count)` enables memory-denial input;
- multi-band outputs are zeroed only after several validations, so some early error paths leave caller storage unchanged;
- no `struct_size` or ABI version field;
- no opaque validated prepared type;
- `CanonicalPolygon` is public and can be manually constructed, while `solve_canonical` performs only shallow checks;
- no explicit `NONE` layout tier.

### Demonstrated no-fit state bug

A non-fitting thin triangle returns:

```text
fit=false
layout_tier=ConnectedFallback
size=0
magnets=0
```

The layout tier should be:

```text
NONE / NOT_APPLICABLE
```

### Required correction

Add hard caps derived from product limits, multiplication overflow checks, complete output initialisation at entry, ABI versioning, and an explicit no-fit enum state. Make the validated prepared representation opaque or impossible to fabricate through the public API.

---

## F-11 — Sparse geometry is improved but production phase semantics remain incomplete

### Correct improvements

- sparse is disengaged below band 3;
- minimum active nodes is 2;
- 96 mm adjacency and direct-capsule connectivity are checked;
- dense and sparse use the same transformed shape.

These are valid corrections.

### Remaining issues

1. Default `ANY` is appropriate only if fulfilment can genuinely choose and persist the phase. A fixed garment SKU should provide `FIXED` phase.
2. Result contains only one representative phase, not evidence for every compatible phase.
3. “Require 96 mm connectivity” currently means every active node in the selected phase must form one connected component. The contract sometimes describes the weaker rule “at least one verified 96 mm pair.” These are not equivalent.
4. When sparse is not engaged, absence of `sparse_phase` does not distinguish:
   - not applicable;
   - disabled by policy;
   - evaluated and failed;
   - not requested.

### Required result

```text
SparseStatus:
    NOT_ENGAGED
    NOT_REQUESTED
    ENGAGED_PASS
    ENGAGED_FAIL

per phase:
    residue pair
    active nodes
    verified sparse links
    pass/fail reason
```

The BandLogic policy then selects a phase or rejects the SKU.

---

## F-12 — Band-3 and higher fallback rules are not product-defined

The code generates rectangular parents for every band and ranks arbitrary maximal connected components. Only a complete square is `Full`; all non-square components of four or more nodes become `ConnectedFallback`.

Examples:

- a complete `3×2` rectangle is not a named layout;
- an eight-node `3×3` shape with one missing node receives the same broad tier as much weaker connected shapes;
- the earliest size in `ConnectedFallback` may beat a near-complete stronger shape at a later size;
- sparse evaluation can change ranking through active-node count without a stated SKU layout catalogue.

The user’s “repeat the segmented method for band 3 and 4” does not authorise arbitrary graph classes.

### Required correction

Define a versioned layout catalogue per band, including allowed masks and ordered tiers. For example, band 3 might distinguish:

```text
FULL_3X3
APPROVED_3X2 / 2X3
APPROVED_CROSS_OR_RING variants
LINKED_3_RUN
PAIR fallback, if actually allowed for band 3
```

These are product decisions, not mathematical facts. The engine must not invent them.

---

## F-13 — Rational transformed vertices conflict with the stated integer-millimetre law

The engine accepts integer source coordinates but uniformly scales the shape using an exact rational transform. The non-max bbox dimension and transformed vertices are generally fractional millimetres.

The original product law says everything is integer millimetres and nothing below 1 mm exists. Both cannot hold for arbitrary aspect ratios unless a final quantisation rule exists.

### Required decision

Choose one:

1. Published scalar size is integer, but cutter geometry may use rational/sub-mm coordinates; or
2. Final cutter path is snapped to whole millimetres under a specified rule and the complete fit is rerun on the snapped contour.

Independent vertex rounding before the final fit is unsafe because it changes aspect ratio, local clearance and potentially topology.

Until this is fixed, the output is exact mathematically but not a complete manufacturing law.

---

## F-14 — Nominal geometry is not yet a physical zero-adjustment guarantee

The engine certifies exactly 12 mm nominal CAD clearance. It does not model:

- cut tolerance;
- effect-side magnet placement error;
- garment lattice error;
- material shrinkage/stretch;
- assembly registration tolerance;
- trace-to-cut conversion tolerance.

`disc_radius_mm` is integer, so a calibrated allowance such as 0.8 mm cannot be represented.

### Required release model

Use integer micrometres or another exact sub-mm unit:

```text
nominal radius       12,000 µm
release radius       12,000 µm + calibrated tolerance budget
```

Return separate statuses:

```text
NOMINAL_PASS
PRODUCTION_PASS
NOMINAL_ONLY_BORDERLINE
FAIL
```

Until physical calibration is supplied, the engine must not claim guaranteed zero-adjustment fulfilment.

---

## F-15 — Test suite quality is good, but important blind spots remain

The suite is materially better than the previous package. It covers the major repaired behaviours and passes under independent sanitizers.

Missing regressions include:

```text
vertical pair
explicit diagonal-only rejection
just-below exact tangency using rational source geometry
butterfly with valid wing placements and narrow waist
cove between finite flap witnesses
exact-threshold narrow antenna
approved L subset inside a four-node maximal component
no-fit layout tier = NONE
all sparse phases returned and compared
FIXED production phase
at-least-one sparse pair versus all-active-connected semantics
C ABI count/overflow/capacity limits
multi-band output zeroing on every failure path
transformed manufacturing contour/recipe
WebAssembly compile and JavaScript round trip
adversarial validation complexity
8,100-vertex hot solve
phone p50/p95/max
```

The deterministic corpus currently compares only a subset of the fields that the contract describes as deterministic. It should also compare:

- verified links;
- layout ID and tier;
- sparse evidence;
- binding contact identity;
- exact flap numerators;
- exact manufactured transform;
- reason/status enums.

The circle regression should prove both facts explicitly:

```text
72 mm custom size → pair passes
96 mm custom size → full 2×2 passes
normal band solve → 96/full selected
```

---

## F-16 — Contract and documentation inconsistencies

Several documentary claims require correction:

1. The locked band-2 table excludes `ConnectedFallback`, while code and tests include it.
2. The contract says “connected supported subset,” while code extracts only maximal components.
3. The Wasm export list omits the recommended multi-band function.
4. “Prepare once” overstates one canonicalisation per API call as persistent editor preparation.
5. The contract says approximately 1,100 core lines; `src/magfit.cpp` is 1,283 lines.
6. `EC-09`, `EC-10` and “Dan’s maximum-overhang rule” are referenced but not reproduced or linked to immutable normative definitions. Their direction and acceptance meaning cannot be independently audited from this package alone.
7. The status table says GCC and Clang builds are supplied, while `VALIDATION.md` correctly says only Apple Clang was originally run. Independent audit has now run both, but the package record itself should distinguish original and later evidence.
8. The result contract says a policy version change is required for rule changes, but no runtime policy version/hash is implemented.
9. `coverage_within_12` uses `<=12`, while `extent_reaches_12` uses `>=12`. Both may be valid facts, but the opposing directions are easy to misuse and need explicit names such as `max_overhang_le_12`.

---

## F-17 — No-fit and not-applicable states need explicit enums

Default-initialising `BandResult::layout_tier` to `ConnectedFallback` creates a false product fact whenever `fit=false`.

The same ambiguity affects sparse output and binding data.

Use explicit discriminated states:

```cpp
enum class LayoutTier {
    None,
    Full,
    LinkedThree,
    Pair,
    // only additional product-approved tiers
};

enum class SparseStatus {
    NotEngaged,
    NotRequested,
    Pass,
    Fail,
};
```

Fields that have no meaning on no-fit should be absent, optional, or zeroed under a documented convention.

---

# 5. What should be retained and defended

The audit does **not** support rewriting the engine from scratch. The following parts are correct and should be retained.

## 5.1 Finite legal-size evaluation

Testing every legal 12 mm candidate directly is the correct response to concave non-monotonicity. Do not replace it with continuous binary search or critical-scale rounding.

## 5.2 Exact uniform scaling about bbox centre

The rational transform preserves aspect ratio and device determinism. The remaining manufacturing quantisation question is downstream policy, not a reason to abandon exact scaling.

## 5.3 Full-disc predicate

For a closed simple solid polygon:

```text
centre inside/on polygon
and
minimum distance to polygon boundary >= 12 mm
```

is exactly equivalent to complete radius-12 disc containment. The delivered exact segment-distance implementation is sound.

## 5.4 Direct capsule as a conservative v1 law

The straight capsule is not universal connectivity, but it is a strong and auditable manufacturing law:

```text
[q1,q2] ⊕ Disc(12) is fully inside the shape
```

It proves a direct 24 mm-wide bridge. Keep it as `DIRECT_CAPSULE`; do not describe it as every possible curved connection.

## 5.5 Exact arithmetic and tangency

Inclusive comparisons and rational cross multiplication correctly make exact tangency pass without platform-dependent epsilon. The custom 256-bit comparison helper survived one million random comparisons against a multiprecision oracle.

## 5.6 Canonicalisation and invariance

Duplicate handling, winding normalisation, canonical start vertex and exact local-coordinate arithmetic are well designed. The invariance corpus is valuable and should be expanded rather than replaced.

## 5.7 Sparse engagement beginning at band 3

The physical proof remains:

```text
12 + 96 + 12 = 120 mm
```

so a true sparse adjacent pair cannot fit inside the 72–108 mm band-2 size range when size is the maximum bbox dimension.

## 5.8 Vendor-research direction

The proposal correctly avoids using a generic nesting engine. Clipper2 is suitable for optional path cleanup/Boolean operations, while exact disc and direct-link decisions remain clearer in the small custom kernel. CGAL remains a possible independent oracle for exact offset topology rather than a necessary phone runtime dependency.

---

# 6. Corrected architecture

The next revision should not add more generic abstractions. It should make the existing responsibilities explicit.

```text
MagFitComputeModule
│
├── GeometryKernel
│   ├── PreparedShape
│   ├── ExactScaledShape[size]
│   ├── DiscEvidence[node,size]
│   ├── DirectLinkEvidence[edge,size]
│   ├── FlapEvidence[side,size]
│   ├── SparseGeometryEvidence[phase,size]
│   └── ContactWitnesses
│
└── BandLogic
    ├── BandSpec
    ├── ApprovedLayoutCatalog
    ├── TierOrder
    ├── Density/SKU Policy
    ├── Flap Classification Policy
    ├── Deterministic Selector
    └── Fulfilment Result Builder
```

## 6.1 Geometry evidence must be policy-neutral

```cpp
struct DiscEvidence {
    bool supported;
    ExactLength clearance;
    ContactWitness limiting_contact;
};

struct DirectLinkEvidence {
    bool supported;
    ExactLength clearance;
    ContactWitness limiting_contact;
};

struct SideGeometryEvidence {
    ExactLength bbox_extent;
    SampledTongueEvidence sampled;
    ContinuousStripEvidence continuous;
    std::vector<ContactWitness> limiting_contacts;
};
```

## 6.2 Product layouts must be data

```cpp
struct LayoutDefinition {
    LayoutId id;
    int band;
    LayoutTier tier;
    ParentRegistration parent;
    std::vector<GridPoint> required_nodes;
    std::vector<GridEdge> required_direct_links;
    std::vector<GridEdge> optional_links;
    SparseRule sparse_rule;
};
```

No catch-all connected component becomes a product automatically.

## 6.3 Fulfilment result must be self-contained

```text
engine_version
geometry_policy_version
band_policy_version
shape_hash
source contour hash
exact transform
manufactured size/width/height
layout_id and tier
magnet lattice and mm coordinates
required direct links
sparse status and selected/fixed phase
flap geometry and policy classification
limiting contacts
production tolerance status
```

---

# 7. Required correction order

The following order minimises rework.

## Stage 1 — Freeze product law

1. Remove or explicitly approve `ConnectedFallback`.
2. Define exact band-2 masks and whether full four-disc requires all four direct links.
3. Define allowed band-3 and band-4 layouts.
4. Define centred versus edge-offset pair placements.
5. Define fixed/any sparse phase by SKU.
6. Embed EC-09/EC-10 definitions in the contract.
7. Decide integer-only versus rational cutter geometry.

## Stage 2 — Split geometry from logic

1. Introduce immutable `PreparedShape`.
2. Expose support/link/flap evidence independently.
3. Move layout catalogue and ranking into BandLogic.
4. Replace maximal-component product extraction with approved mask evaluation.

## Stage 3 — Correct flap evidence

1. Fix exact-threshold exception.
2. Rename finite sample fields as sampled evidence.
3. Add continuous side-strip/rounded-rectangle evidence.
4. Return limiting flap contacts.
5. Add butterfly, hidden-cove and antenna regressions.

## Stage 4 — Complete integration result

1. Add result/provenance versions and hashes.
2. Add exact transform/manufactured path recipe.
3. Add explicit no-fit/sparse statuses.
4. Add per-phase evidence.
5. Add persistent C/Wasm prepared handle.
6. Add TypeScript adapter and Wasm build test.

## Stage 5 — Performance and release

1. Add edge BVH/AABB tree and per-size caches.
2. Benchmark actual 1k, 5k and 8.1k real traces.
3. Run GCC, Clang, ASan, UBSan and Emscripten in CI.
4. Benchmark lowest supported iOS/Android and Safari/Chrome Wasm.
5. Calibrate production tolerance radius.

---

# 8. Acceptance gates for the next proposal

The next package is not accepted until all of the following pass.

## Product-law gates

- [ ] No runtime layout exists unless it has a stable approved `layout_id`.
- [ ] A U-shaped four-disc/three-link component resolves according to an explicit rule, not catch-all ranking.
- [ ] Approved L and pair subsets can be selected from a larger maximal component.
- [ ] Circle returns 96 mm/full under default band-2 policy.
- [ ] Band-2 sparse status is explicitly `NOT_ENGAGED`.

## Flap gates

- [ ] Exact 12 mm antenna triggers structural/narrow-limb evidence.
- [ ] A cove placed between outer magnets and their midpoint is detected.
- [ ] Butterfly wings are not erased by waist normalisation.
- [ ] Bbox extent, sampled tongues and continuous strip are separate fields.
- [ ] Limiting flap contact is returned.

## API gates

- [ ] Persistent prepared shape exists in C++ and C/Wasm.
- [ ] Multi-band and repeated prepared solves are byte-equivalent to one-shot solves.
- [ ] Result carries engine/policy versions and shape hash.
- [ ] Result carries exact transform or manufactured contour.
- [ ] No-fit layout tier is `NONE`.
- [ ] Sparse status and every phase are explicit.
- [ ] All caller counts are capped and overflow-checked.

## Performance gates

- [ ] 8,100-vertex hot solve benchmark is measured, not preparation only.
- [ ] p95 canonical hot solve meets the agreed target on the oldest supported phone.
- [ ] Wasm p95 is measured in Safari and Chrome.
- [ ] Adversarial simplicity validation does not show uncontrolled quadratic release behaviour or is protected by a documented cap/trusted-input mode.

## Manufacturing gates

- [ ] Final trace/cutter quantisation law is versioned.
- [ ] Fit is rerun on the final manufactured contour.
- [ ] Release radius includes measured tolerance budget.
- [ ] Fulfilment can cut and place magnets solely from returned data.

---

# 9. Final response to the teammate proposal

The proposal should be acknowledged as a serious correction rather than rejected as “more slop.” It fixes the earlier selection and sparse failures and provides a sound exact geometric foundation.

However, it cannot be approved as final because its strongest claimed additions are not yet complete:

- the layout catalogue is contradicted by an invented catch-all tier;
- maximal components are not approved subsets;
- local flap is sampled, not complete, and can miss coves;
- exact-threshold narrow limbs disappear;
- the promised compute-module split is conceptual rather than implemented;
- the C/Wasm API is one-shot rather than persistently prepared;
- the output cannot yet be used as a complete cut/fulfilment specification;
- high-vertex hot solve performance remains unproven and, on this audit machine, materially too slow.

The correct disposition is:

```text
KEEP:
    exact rational core
    canonicalisation
    full-disc test
    direct capsule test
    full-layout-first concept
    sparse band-3 engagement
    current good tests

REWORK:
    explicit layout masks and tiers
    subset extraction
    continuous flap evidence
    threshold equality
    GeometryKernel/BandLogic boundary
    PreparedShape API and cache
    result provenance and exact transform
    C/Wasm hardening
    performance index

DO NOT SHIP:
    current ConnectedFallback product logic
    current local_tongue_all claim
    current no-fit enum state
    current manufacturing-guarantee wording
```

---

# Appendix A — Independent reproducer output

```text
EXACT_THRESHOLD fit=1 size=96 tier=Full top_mm=12
    reaches12=1 any12=0 all12=0 exception12=0 coverage12=1

COVE_BLINDSPOT fit=1 size=156 tier=ConnectedFallback
    magnets=8 links=9 top_mm=18
    reaches12=1 any12=1 all12=1 exception12=0 failpoints12=0

COVE_MAGNETS
    (-2,-2) (-2,0) (-2,2)
    (0,-2)  (0,0)
    (2,-2)  (2,0)  (2,2)

U_FALLBACK fit=1 tier=ConnectedFallback magnets=4 links=3

NO_FIT_ENUM fit=0 tier=ConnectedFallback size=0 magnets=0
```

The full reproducer source and output are supplied alongside this report.

# Appendix B — Independent performance output

```text
PREP_ADVERSARIAL input=502   canonical=502   us=213
PREP_ADVERSARIAL input=1002  canonical=1002  us=581
PREP_ADVERSARIAL input=2002  canonical=2002  us=2359
PREP_ADVERSARIAL input=4002  canonical=4002  us=8102
PREP_ADVERSARIAL input=8002  canonical=8002  us=33202
PREP_ADVERSARIAL input=16002 canonical=16002 us=132336
PREP_ADVERSARIAL input=32002 canonical=32002 us=510171

HOT_8100 input=8100 canonical=5872 bands=3 mean_us=208253
```

# Appendix C — Important source references

```text
Contract layout law:
    contract/MAGFIT_ENGINE_CONTRACT.md:128-145
    contract/MAGFIT_ENGINE_CONTRACT.md:925-945

ConnectedFallback implementation:
    include/magfit/magfit.hpp:40-46, 148-166
    src/magfit.cpp:724-770
    tests/test_magfit.cpp:281-295

Maximal-component extraction:
    src/magfit.cpp:676-701
    src/magfit.cpp:808-859

Finite flap witnesses and strict threshold:
    src/magfit.cpp:906-989

Cross-size selection:
    src/magfit.cpp:1122-1166

Multi-band C ABI:
    include/magfit/magfit_c.h:177-190
    src/magfit_c.cpp:205-257

Wasm export mismatch:
    contract/MAGFIT_ENGINE_CONTRACT.md:707-731

Performance claims:
    VALIDATION.md:35-45
    README.md:115-123
    contract/MAGFIT_ENGINE_CONTRACT.md:813-850
```
