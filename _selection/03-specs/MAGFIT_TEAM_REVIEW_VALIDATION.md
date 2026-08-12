# MAGFIT Team Review — Independent Validation and Decision

**Audit date:** 2026-08-12  
**Repository inspected:** `ONEMO-TECH-LTD/onemo-next`  
**Branch inspected:** `session62-task/KAI-10261-grid-canvas`  
**Package path:** `_WIP/CHAT GPT/magfit-reference`

## Executive verdict

The team's overall conclusion is substantially correct: the delivered package contains a sound exact disc-containment core, but the package is not yet the final product engine described by the user's quadrant/grid-led method.

The review is not accepted wholesale. The exact verdict is:

| Review point | Verdict | Required action |
|---|---|---|
| 1. Size-first selection contradicts full-layout calibration | **Correct; release-blocking** | Replace size-first selection with layout-tier-first selection. |
| 2. Band-2 sparse `ANY + min 1` is wrong/vacuous | **Correct; release-blocking** | Mark sparse as `NOT_ENGAGED` for band 2; make phase rules band-specific. |
| 3. Local flap/limb evidence was not delivered | **Correct; release-blocking for claimed flap output** | Add exact local tongue/strip witnesses and narrow-limb exceptions. |
| 3a. Existing `>=12/24` reverses a settled maximum-overhang law | **Not proven by the inspected brief/transcript** | Return raw extent and neutrally named switches; product policy must define whether thresholds are minima, maxima, or risk markers. |
| 4. Straight capsule is not equivalent to general connection | **Correct mathematically** | Rename it `DIRECT_CAPSULE_LINK`; retain it only as an explicit conservative product rule or add a separate erosion-component mode. |
| 5. Performance/API architecture is unfinished | **Partly correct** | C++ already supports prepare-once/multi-band solving; C/Wasm does not. Add prepared C API, caches, and faster polygon validation. |
| Validation record is not independent execution proof | **Correct** | Add reproducible CI, compiler images, commands, logs, and artifact hashes. |

## 1. Selection policy

### Finding

The transcript states a layout-quality-first policy:

1. search all legal sizes for the full layout;
2. only if no full layout exists in the band, search the next fallback tier;
3. within the winning tier, choose the smallest legal size.

The delivered code instead loops through legal sizes in ascending order and returns as soon as any layout passes. Candidate quality is considered only among candidates at that one size.

### Proof using the circle calibration

For a 72 mm diameter circle:

- centred pair magnet centres are at `(-24,0)` and `(24,0)`;
- required circle radius is `24 + 12 = 36 mm`, so the pair passes at 72 mm;
- four-corner magnet centres are at `(±24,±24)`;
- required radius is `sqrt(24²+24²)+12 = 45.941125... mm`;
- required diameter is `91.882250... mm`, so the first legal four-disc size is 96 mm.

Therefore:

- **size-first** returns `72 mm / pair`;
- **full-layout-first** returns `96 mm / full 2×2`.

The user's quadrant calibration method and the transcript's explicit conclusion select the second result.

### Correct rule

For ordered layout tiers `T[0], T[1], ...`:

```text
for tier in layoutTiers, strongest first:
    for size in legalSizes, ascending:
        candidates = all valid layouts in this tier at this size
        if candidates exist:
            return deterministicBest(candidates)
return NO_FIT
```

Band-2 public default tiers:

```text
0  FULL_2X2
1  LINKED_L3          if approved by product law
2  ADJACENT_PAIR
```

`SINGLE` remains internal and must not satisfy a public band-2 result.

## 2. Sparse 96 mm handling

### Finding

The delivered default is:

```text
phase mode = ANY
minimum active nodes = 1
96 mm connectivity = false
```

For every non-empty layout on one dense parity class, at least one node belongs to one of the four sparse phase combinations. Therefore `ANY + minimum 1` always passes a non-empty layout. It is not a meaningful compatibility test.

### Proof of vacuity

Every node has one residue pair:

```text
(x24 mod 4, y24 mod 4)
```

The `ANY` mode enumerates all four phase pairs compatible with the dense parity. Selecting the phase equal to any existing node's residue produces at least one active node. With no connectivity requirement, the predicate is true for every non-empty layout.

### Correct rule

Sparse applicability must be a **per-band product rule**, not a global engine default.

```text
band 2: sparseStatus = NOT_ENGAGED
band 3+: evaluate the explicit garment/SKU phase rule
```

For a customer-facing sparse attachment in band 3 or above, the recommended minimum is:

```text
at least two active nodes
96 mm orthogonal adjacency
required connection under the selected link policy
```

`FIXED_PHASE` is the preferred production mode. `ANY_PHASE` is legitimate only when manufacturing is actually allowed to choose the phase and the selected phase is persisted in the fulfilment specification.

The engine should compute phase evidence; the logic module should decide whether that evidence is applicable.

## 3. Flap and narrow-limb evidence

### Finding

The implementation returns only:

```text
shape bbox minus padded magnet-layout bbox
```

It does not inspect the exact local contour outside the selected magnet cluster. Consequently a thin antenna can produce a large bbox flap even though there is no broad flap behind the magnets.

The contract acknowledges this limitation, but the API does not return the promised narrow-limb exception or structural evidence. That is incomplete against the direct brief.

### Threshold-direction qualification

The inspected brief says the flap is “tested at 12 mm and 24 mm switches” but does not state whether these are:

- minimum desired material depths;
- maximum permitted unsupported overhangs; or
- neutral classification/risk thresholds.

The earlier mathematical response explicitly used `extent >= threshold`. Therefore the team's claim that the code reversed a previously settled maximum rule is not established by the inspected record.

The safe correction is to avoid a policy-loaded field named `pass`.

### Correct output

For each side and threshold `h ∈ {12,24}` return:

```text
extent_mm
extent_reaches_h
local_tongue_any_h
local_tongue_all_h
continuous_strip_h        optional product rule
narrow_limb_exception_h
limiting_boundary_edge
```

For an outer-row magnet `q` and outward unit direction `n`, define the exact local tongue witness:

```text
[q, q + h n] ⊕ closedDisc(0,12)
```

It passes only when this entire 24 mm-wide capsule is inside the exact scaled polygon. It extends `h` millimetres beyond the original magnet-disc edge.

A narrow-limb exception is reported when the bbox reaches the threshold but the required local witness fails.

The logic module—not the geometry kernel—must interpret whether `extent_reaches_24` means desirable material or an overhang-risk switch.

## 4. Straight capsule versus general connection

### Finding

A straight radius-12 capsule is sufficient to prove a direct 24 mm-wide bridge. It is not necessary for two magnets to belong to the same connected component of the radius-12 eroded shape.

### Counterexample

Use a U-shaped polygon with outer box `[-60,60]×[-60,60]` and a notch open from the top over `(-18,18)×[-20,60]`.

Let:

```text
q1 = (-36,24)
q2 = ( 36,24)
```

Both radius-12 discs fit. The straight segment between them crosses the open notch, so the direct capsule fails.

However the polyline:

```text
(-36,24) → (-36,-36) → (36,-36) → (36,24)
```

stays at least 16 mm from the notch bottom and at least 18 mm from the notch sides. Thus both centres lie in the same component of `P ⊖ Disc(12)` and a curved 24 mm-wide route exists.

### Decision

The delivered predicate is not mathematically wrong. The overclaim is calling it equivalent to generic “linked.”

The revised contract must expose:

```text
LinkMode::DIRECT_CAPSULE
LinkMode::ERODED_COMPONENT
```

Recommended v1 auto-release law:

```text
DIRECT_CAPSULE
```

This guarantees a short, straight, 24 mm-wide load path and remains exact and phone-fast. It is conservative and may reject curved corridors.

`ERODED_COMPONENT` should be added only if curved corridors are a legitimate product class. Exact implementation requires erosion-topology computation and is materially more complex than renaming a predicate.

## 5. Prepared shape, caching, and validation complexity

### Finding

The native C++ API already provides:

```text
canonicalize_and_validate(...)
solve_canonical(... multiple bands ...)
```

So the mathematical core already supports prepare-once use.

The stable C/Wasm API exposes only `solve one band`, rebuilds the polygon input, and calls the validating solve path. A caller following the documented one-call-per-band integration repeats validation.

The polygon simplicity validator compares every non-adjacent edge pair. For `n` edges it performs:

```text
n(n−3)/2
```

potential intersection tests. At `n=8100` this is exactly:

```text
32,792,850
```

The team's count is correct.

### Qualification

Prepare-once and query caching fix repeated work. They do **not** remove the one-time quadratic validation cost. A complete performance correction also needs one of:

1. an exact sweep-line validator;
2. a deterministic edge-AABB/BVH broad phase followed by exact predicates;
3. a strict upstream canonical vertex cap plus a trusted prepared-input mode.

### Required API

```c
typedef struct MagfitPreparedShape MagfitPreparedShape;

MagfitStatusC magfit_prepare_i32(
    const int32_t* xy,
    size_t vertex_count,
    const MagfitPolicyC* policy,
    MagfitPreparedShape** out_shape,
    ...);

MagfitStatusC magfit_solve_prepared_bands(
    const MagfitPreparedShape* shape,
    const MagfitBandRequestC* requests,
    size_t request_count,
    MagfitBandResultC* results,
    ...);

void magfit_prepared_destroy(MagfitPreparedShape* shape);
```

The prepared object should cache, per manufactured size:

- exact scaled polygon;
- disc-support result and witness per grid node;
- direct-link result and witness per adjacent grid edge;
- local-flap tongue result per outer node, side, and 12/24 threshold;
- optional sparse 96 mm link results.

## 6. Independent validation status

The supplied validation record is evidence that the package author compiled and ran the suite in the original environment. It is not independent reproduction.

The reviewing Mac's missing standard C++ headers do not disprove the record; they only mean that machine did not reproduce it.

Before release, add reproducible CI containing:

- pinned GCC and Clang images;
- exact configure/build/test commands;
- Release and ASan/UBSan jobs;
- WebAssembly build;
- source commit and manifest hashes;
- uploaded test logs and binaries;
- performance runs at 1,000 and 8,100 vertices.

## 7. Required new tests

Release-blocking tests:

```text
selection_full_layout_beats_earlier_pair
circle_calibration_or_exact_circle_oracle
band2_sparse_not_engaged
band3_fixed_sparse_pair
local_flap_thin_antenna_exception
local_flap_cove_exception
butterfly_wings_not_reduced_to_waist
curved_corridor_direct_fails_component_passes
band4_168_full_4x4
prepared_equals_one_shot
multi_band_validates_once
8100_vertex_performance_gate
```

The existing tests that assert `sparse ANY + one node` as valid band-2 behaviour must be removed or moved under an explicitly named legacy/single-contact policy.

## Final decision

Do not discard the exact geometry core. Retain:

- rational uniform scaling;
- exact point-in-polygon;
- exact point-to-segment clearance;
- inclusive tangency;
- independent legal-size evaluation;
- deterministic witnesses.

Do not release the existing package as the final engine. Correct:

- selection order;
- band-specific density applicability;
- local flap evidence;
- link terminology/policy;
- prepared C/Wasm API and validation performance;
- missing regression coverage.
