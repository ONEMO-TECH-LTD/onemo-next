# MAGFIT v2 — Normative Correction Specification

## 1. Module boundary

MAGFIT is one compute module containing two submodules:

```text
MagFitGeometryKernel
MagFitBandLogic
```

### 1.1 `MagFitGeometryKernel`

Owns only geometric truth:

- canonical polygon validation;
- exact uniform scaling about the bbox centre;
- full 24 mm disc containment;
- direct 24 mm capsule containment;
- local 12/24 mm flap-tongue evidence;
- optional eroded-component connectivity;
- limiting edge/contact witnesses;
- prepared-shape caches.

It does not decide which band/layout is commercially preferred.

### 1.2 `MagFitBandLogic`

Owns product law:

- band spans and legal sizes;
- ordered layout tiers;
- public versus internal layouts;
- sparse applicability and phase policy by band/SKU;
- direct versus general link mode;
- flap threshold interpretation;
- deterministic selection;
- fulfilment output.

## 2. Selection law

Selection is **layout-tier-first**, then size-first within the winning tier.

```text
for tier in orderedTiers(band):
    for size in legalSizes(band), ascending:
        candidates = evaluateTierAtSize(tier, size)
        if candidates not empty:
            return deterministicBest(candidates)
return NO_FIT
```

Band-2 normative public tiers:

```text
0 FULL_2X2
1 LINKED_L3, when enabled
2 ADJACENT_PAIR
```

A single magnet is an internal capability and cannot satisfy public band 2.

## 3. Density law

Density is evaluated after dense-layout geometry and is band-specific.

```text
band 2: NOT_ENGAGED on 96 mm density
band 3+: phase-aware sparse evaluation when required by SKU
```

No result may describe band 2 as sparse-compatible merely because one hidden phase retains one magnet.

Recommended sparse public minimum:

```text
2 active nodes
96 mm orthogonal adjacency
connection under selected LinkMode
```

## 4. Link law

```cpp
enum class LinkMode {
    DirectCapsule,
    ErodedComponent,
};
```

`DirectCapsule` means exactly:

```text
[q1,q2] ⊕ Disc(12) ⊆ P
```

It must not be described as equivalent to every possible 24 mm-wide curved route.

Default v1:

```text
DirectCapsule
```

## 5. Flap law

Geometry returns facts, not a policy-loaded pass/fail label.

For each side:

```cpp
struct SideFlapEvidence {
    ExactLength extent;
    bool extent_reaches_12;
    bool extent_reaches_24;

    bool local_tongue_any_12;
    bool local_tongue_all_12;
    bool local_tongue_any_24;
    bool local_tongue_all_24;

    bool narrow_limb_exception_12;
    bool narrow_limb_exception_24;

    std::vector<GridPoint> failing_outer_nodes_12;
    std::vector<GridPoint> failing_outer_nodes_24;
    std::optional<ContactWitness> limiting_local_contact;
};
```

For threshold `h`, a local tongue at outer node `q` is:

```text
[q, q + h·outwardNormal] ⊕ Disc(12)
```

The band logic may classify the raw evidence as desired flap, excess-overhang risk, warning, or rejection.

## 6. Prepared API

The public integration boundary must prepare once and solve all bands from the same frozen shape.

```cpp
PreparedShape prepare(const PolygonInput&, const PreparePolicy&);
SolveResult solve(const PreparedShape&, const SolveRequest&);
```

The C/Wasm API must expose an opaque prepared handle or one multi-band one-shot call. The one-band validating function may remain only as a convenience wrapper.

## 7. Cache law

Cache keys are exact and include:

```text
shape hash
engine version
geometry-policy version
manufactured size
node or edge identity
link mode
flap threshold
```

Per-size cache:

```text
ScaledPolygon
DiscEvidence[node]
DirectLinkEvidence[edge]
LocalTongueEvidence[node,side,12|24]
SparseLinkEvidence[phase,edge]
```

## 8. Validation performance

The quadratic edge-pair validator is not acceptable as the only production path at 8,100 vertices.

Required release options:

```text
exact sweep line
or deterministic AABB/BVH broad phase + exact intersection
or trusted canonical input with strict upstream proof and vertex cap
```

Preparation may be slower than a hot solve, but target-device p95 must be measured and versioned.

## 9. Result contract

Every fitted band result returns:

```text
engine_version
policy_version
shape_hash
band
manufactured_size_mm
exact manufactured width/height
layout_tier
layout_id
magnet coordinates in mm and lattice indices
verified direct links
link_mode
sparse status and per-phase evidence
binding/limiting contact
raw flap extent
local flap witnesses
narrow-limb exceptions
previous-size/tier failure witness
```

The renderer and fulfilment systems consume these coordinates directly and must not recalculate them.

## 10. Acceptance gates

The engine is not release-ready until:

1. a circle-equivalent fixture proves full-layout-first selection;
2. band 2 reports sparse `NOT_ENGAGED`;
3. a thin antenna triggers a narrow-limb exception;
4. a cove cannot be hidden by bbox flap;
5. the U-corridor fixture distinguishes direct and general connectivity;
6. band 4 full 4×4 is tested at 168 mm;
7. prepared and one-shot outputs are byte-equivalent;
8. CI independently builds GCC, Clang, sanitizers, and Wasm;
9. target-device performance gates pass.
