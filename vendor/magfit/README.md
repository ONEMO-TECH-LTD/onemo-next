# MagFit Reference Core

`magfit-reference` is a compact exact-geometry solver for fitting an aspect-locked simple polygon to a fixed 48 mm magnetic lattice.

It is deliberately **not** a general CAD kernel, polygon nesting system, continuous optimiser, SVG tracer, or image-processing pipeline. It answers one product question: for each requested band, what is the first legal manufactured size and the best supported magnetic layout at that size?

The reference implementation provides:

- exact integer/rational pass/fail predicates;
- full 24 mm magnet-disc containment;
- full 24 mm-wide link-capsule containment between adjacent magnets;
- band-2 pair, three-node L, and four-node square support;
- generated band templates through the 9×9 field ceiling;
- 48 mm dense and phase-coupled 96 mm sparse evaluation;
- deterministic candidate ranking and contact witnesses;
- exact rational manufactured dimensions and flap values;
- a C++20 API and an exception-safe C ABI suitable for WebAssembly;
- native acceptance tests and a deterministic invariance corpus.

The normative product and implementation rules are in [`contract/MAGFIT_ENGINE_CONTRACT.md`](contract/MAGFIT_ENGINE_CONTRACT.md).

## Build and test

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

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
policy.sparse.min_active_nodes = 1;

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

Use `include/magfit/magfit_c.h`. The function `magfit_solve_band_i32` solves one band and writes into fixed-capacity output structures. C++ exceptions never cross the boundary.

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
- flap switches;
- ranking and tie-breaking.

Floating-point fields are explanatory only. Exact rational dimensions/flaps and integer micrometre contact fields are supplied for deterministic serialization.

## Reference benchmark

On the provided container, Release build, 1,000-vertex canonical polygon, solving bands 2 and 3:

- canonical polygon already validated: approximately 3.3 ms per solve;
- validation plus solve: approximately 8.9 ms per solve.

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
