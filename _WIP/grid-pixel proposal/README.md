# Grid Pixel Proposal

This folder is the GPT Pro `magfit-reference` package with a bounded review-mode correction. The original package remains unchanged in `_WIP/CHAT GPT/magfit-reference`.

It is a compact exact-geometry prototype for fitting an aspect-locked simple polygon to a fixed 48 mm magnetic lattice. It does not add a tracer, CAD kernel, UI, or second solver.

The prototype now returns every lawful connected layout at every legal size in each requested band. It does not rank, select, or hide variants. This review set is the evidence needed to decide later whether one result per band can be guaranteed without losing a better physical layout.

It provides:

- exact integer/rational geometry predicates;
- full 24 mm magnet-disc containment;
- full 24 mm-wide direct-capsule containment between adjacent magnets;
- every connected supported subset meeting the band floor and span;
- generated band templates through the 9x9 field ceiling;
- 48 mm dense and phase-coupled 96 mm sparse evaluation;
- no sparse engagement in band 2; connected 96 mm support from band 3 onward;
- deterministic option identity, topology labels, contacts, flap and tongue evidence;
- a callback-based C ABI suitable for WebAssembly without a fixed result cap;
- single-canonicalisation multi-band evaluation;
- native acceptance tests and a deterministic invariance corpus.

The normative product and implementation rules are in [`contract/MAGFIT_ENGINE_CONTRACT.md`](contract/MAGFIT_ENGINE_CONTRACT.md).

## Build and test

```bash
./build.sh
```

The script compiles the C++ suite, a true C caller through the C ABI, and the benchmark. It supplies the macOS SDK libc++ include path explicitly when required. CMake remains available where installed.

The exact core uses `__int128`, so the supported compiler family is Apple Clang, Android NDK Clang, Linux Clang/GCC, and Emscripten. MSVC is not supported by this proposal.

## C++ example

```cpp
#include "magfit/magfit.hpp"

magfit::PolygonInput shape{{
    {-36, -36}, {36, -36}, {36, -12},
    {-12, -12}, {-12, 36}, {-36, 36},
}};

magfit::EnginePolicy policy;
policy.sparse.mode = magfit::PhaseMode::Any;

const auto solved = magfit::solve(
    shape,
    {magfit::default_band_spec(2, policy),
     magfit::default_band_spec(3, policy)},
    policy);

const magfit::BandReview& band2 = solved.bands[0];
for (const magfit::LayoutOption& option : band2.options) {
    // Show every lawful size/layout option for manual review.
}
```

Grid coordinates are stored in 24 mm units:

```cpp
const int x_mm = node.x24 * 24;
const int y_mm = node.y24 * 24;
```

## C / WebAssembly boundary

Use `include/magfit/magfit_c.h`. `magfit_review_band_i32` enumerates one band. `magfit_review_bands_i32` canonicalises once and enumerates several bands. The visitor receives one complete option at a time, so the ABI does not impose a hidden maximum number of options. C++ exceptions never cross the boundary.

```c
static int32_t receive_option(const MagfitLayoutOptionC* option, void* context) {
    /* Copy or render the option. Return non-zero to continue. */
    return 1;
}

MagfitPolicyC policy;
size_t option_count = 0;
char error[256];
magfit_default_policy(&policy);

MagfitStatusC status = magfit_review_band_i32(
    xy, vertex_count, 2,
    NULL, 0,
    2,
    &policy,
    receive_option, NULL,
    &option_count,
    error, sizeof(error));
```

## Exact decision boundary

All decisions that can add or remove an option use integer arithmetic:

- polygon location;
- point-to-segment and segment-to-segment distance;
- disc and direct-capsule containment;
- legal size membership;
- connected-subset membership;
- sparse phase eligibility;
- flap threshold facts;
- canonical option ordering.

Floating-point fields are explanatory only. Exact rational dimensions/flaps and integer micrometre contact fields are available for stable serialization.

## Current boundary

Implemented here:

- all lawful connected subsets, not only the maximal supported component;
- all legal sizes, not one selected answer;
- topology labels (`Full`, `Connected`, `LinkedThree`, `Pair`) as descriptions only;
- shape overhang beyond the padded grid box, clamped at zero;
- neutral 12/24 extent and local-tongue evidence plus EC-09 coverage outcomes;
- 96 mm engagement from band 3 with every compatible phase reported;
- thin antenna/cove evidence through exact outward tongue capsules;
- band 4 and multi-band C ABI regression coverage.

Not added:

- an automatic winner or ranking policy;
- curved-corridor connectivity: the prototype proves only a direct straight 24 mm capsule;
- UI-side geometry: callers compute the fixed shape once and browse cached options.

## Measured reference run

Apple Clang Release, 1,000-vertex canonical polygon, bands 2 and 3, 135 returned options:

- already-canonical shape: 122.14 ms mean;
- validation plus enumeration: 113.61 ms mean;
- 8,100-point canonicalisation: 1.37 ms, retaining 5,872 vertices.

The square reference exposes 44 band-2 options and 780 band-3 options. At 72 mm, the full four-disc layout and pair layouts coexist in the same returned review set.

The complete review set is currently slower than the old winner-only path because evidence is built for every option. These are local prototype measurements, not target-device certification. Performance optimisation must preserve the exact option set.

## Repository layout

```text
include/magfit/magfit.hpp      C++ API
include/magfit/magfit_c.h      C / Wasm review ABI
src/magfit.cpp                 exact core and option enumeration
src/magfit_c.cpp               ABI adapter
tests/test_magfit.cpp          mathematical acceptance suite
tests/test_magfit_c.c          ABI acceptance suite
bench/bench_magfit.cpp         local microbenchmark
contract/                      normative proposal contract
```
