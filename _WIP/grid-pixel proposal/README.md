# Grid Pixel Proposal

This folder is the GPT Pro `magfit-reference` package with a bounded calibration patch. The original package remains unchanged in `_WIP/CHAT GPT/magfit-reference`.

It remains a compact exact-geometry solver for fitting an aspect-locked simple polygon to a fixed 48 mm magnetic lattice. It does not add a CAD kernel, tracer, UI, or second solver.

The reference implementation provides:

- exact integer/rational pass/fail predicates;
- full 24 mm magnet-disc containment;
- full 24 mm-wide link-capsule containment between adjacent magnets;
- band-2 pair, three-node L, and four-node square support;
- generated band templates through the 9×9 field ceiling;
- 48 mm dense and phase-coupled 96 mm sparse evaluation;
- no sparse engagement in band 2; a connected 96 mm pair from band 3 onward;
- deterministic candidate ranking and contact witnesses;
- full-layout-first tier selection, then the smallest legal size in that tier;
- neutral bbox/local-tongue evidence plus EC-09 12/24 mm coverage outcomes;
- a C++20 API and an exception-safe C ABI suitable for WebAssembly;
- a multi-band C ABI call that canonicalises a stable shape once;
- native acceptance tests and a deterministic invariance corpus.

The normative product and implementation rules are in [`contract/MAGFIT_ENGINE_CONTRACT.md`](contract/MAGFIT_ENGINE_CONTRACT.md).

## Build and test

```bash
./build.sh
```

The script compiles the C++ suite, the true C caller linked through the C ABI, and the benchmark. It supplies the macOS SDK libc++ include path explicitly when required. CMake remains available where installed.

The tested production path uses Clang/GCC-family compilers because the exact core uses `__int128`. This covers Apple Clang, Android NDK Clang, Linux Clang/GCC, and Emscripten. MSVC is not a supported compiler for this reference version.

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

const magfit::BandResult& band2 = solved.bands[0];
// For this L-shaped fixture: 72 mm, 3 magnets, 2 verified links.
```

Grid coordinates are stored in 24 mm units. Convert a node to physical coordinates with:

```cpp
const int x_mm = node.x24 * 24;
const int y_mm = node.y24 * 24;
```

## C / WebAssembly boundary

Use `include/magfit/magfit_c.h`. `magfit_solve_band_i32` solves one custom band. `magfit_solve_bands_i32` solves several default bands after canonicalising the shape once. C++ exceptions never cross the boundary.

```c
MagfitPolicyC policy;
MagfitBandResultC result;
char error[256];
magfit_default_policy(&policy);

MagfitStatusC status = magfit_solve_band_i32(
    xy, vertex_count, 2,
    NULL, 0,       /* default band-2 sizes */
    2,             /* minimum physical nodes */
    &policy,
    &result,
    error, sizeof(error));
```

## What is exact

All decisions that can change size or layout are made with integer arithmetic:

- polygon location;
- point-to-segment distance;
- segment-to-segment distance;
- disc containment;
- link-capsule containment;
- legal size membership;
- flap threshold facts;
- ranking and tie-breaking.

Floating-point fields are explanatory only. Exact rational dimensions/flaps and integer micrometre contact fields are supplied for deterministic serialization.

## Calibration boundary

Implemented here:

- correct flap direction: shape overhang beyond the padded grid box, clamped at zero;
- neutral 12/24 extent and local-tongue evidence, with band-logic coverage outcomes using Dan's maximum-overhang rule;
- 96 mm engagement starts at band 3 and requires a connected pair;
- full layouts precede linked-three and pair fallbacks; size is minimised inside the winning tier;
- thin antenna/cove evidence through exact outward tongue capsules;
- band 4 and multi-band C ABI regression coverage.

Deliberately not added:

- curved-corridor connectivity: v1 proves only a direct straight 24 mm capsule;
- a UI-side recomputation path: callers solve the frozen shape once for all bands and cache the returned result.

## Reference benchmark

On this Apple Clang machine, Release build, 1,000-vertex canonical polygon, solving bands 2 and 3:

- canonical polygon already validated: 6.88 ms per solve;
- validation plus solve: 7.33 ms per solve;
- 8,100-point validation/canonicalisation: 1.21 ms (5,872 retained vertices).

These figures are evidence about the reference build, not a claim about a target phone. The shipping gate must benchmark the actual lowest-supported iOS/Android device and the WebAssembly build.

## Repository layout

```text
include/magfit/magfit.hpp      C++ API
include/magfit/magfit_c.h      C / Wasm ABI
src/magfit.cpp                 exact core
src/magfit_c.cpp               ABI adapter
tests/test_magfit.cpp          mathematical acceptance suite
tests/test_magfit_c.c          ABI acceptance suite
bench/bench_magfit.cpp         local microbenchmark
contract/                      normative engine contract
```
