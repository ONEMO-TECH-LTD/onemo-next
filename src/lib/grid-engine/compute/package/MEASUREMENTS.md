# Measured execution results

Measured on 2026-08-13 in the supplied Linux x86-64 container.

## Environment

- CPU presented to container: Intel Xeon Platinum 8573C, 5 vCPUs available.
- OS/kernel: Linux x86-64, kernel 6.18.35 under KVM.
- Primary benchmark compiler: GCC 14.2.0.
- Cross-compiler validation: Clang 17.0.0 with warnings promoted to errors.
- Build: CMake Release (`-O3` as selected by the toolchain’s Release profile).
- CMake: 3.31.6.
- Node: 22.16.0.
- TypeScript: 5.8.3.

These measurements describe this environment; they are not asserted as mobile budgets.

## Benchmark fixture

Input: `fixtures/benchmark_request.json`.

The fixture uses:

- one 16-vertex concave outline;
- radius 12 mm;
- base pitch 48 mm;
- one 9 × 9 base field;
- eight independently tested physical sizes: 72–156 mm;
- four finite half-pitch lattice registrations;
- one dense and four sparse phase populations;
- all 461 explicit initial-grammar patterns.

Request size: **306,192 bytes**.

SHA-256:

```text
317cb53cfb986a0e68297db7eb9a083d334505d3a055082ecd4f90b4604a7301
```

## Solve counters

The canonical result reports:

- prepared outline vertices: **16**;
- placement tests: **374,720**;
- unique site facts computed: **2,592**;
- unique corridor facts computed: **21**;
- lawful candidates emitted: **88**;
- canonical result size: **107,517 bytes**.

Result SHA-256:

```text
7fb0966f8486be9321a20e019a0ed365afd7ccdef3cf6b2d35733819ddc5f921
```

A second complete process produced byte-identical output (`cmp` succeeded).

## Process-cold runtime and memory

Five fresh CLI processes were run against the same request. Each process rebuilt all in-memory preparation and caches.

| Run | Wall time | Peak RSS |
|---:|---:|---:|
| 1 | 0.25 s | 10,732 KB |
| 2 | 0.25 s | 10,672 KB |
| 3 | 0.24 s | 10,756 KB |
| 4 | 0.26 s | 10,688 KB |
| 5 | 0.28 s | 10,664 KB |

- Median wall time: **0.25 s**.
- Observed range: **0.24–0.28 s**.
- Maximum observed peak RSS: **10,756 KB**.

A separate detailed GNU `time -v` run recorded 0.25 s wall time and 10,728 KB maximum resident set size.

## Test execution

- Release C++ CTest suite: passed.
- AddressSanitizer + UndefinedBehaviorSanitizer C++ suite: passed.
- Strict TypeScript compilation: passed.
- TypeScript behavioural suite: passed.
- Full guarded-profile fixture regeneration and two-process byte comparison: passed.
- C header compilation and C ABI allocation/free ownership check: passed.

## Independent predicate differential check

As an additional validation step, the exact C++ predicates were compared with a separate Shapely 2.1.2 reference over 40 deterministic concave polygon fixtures. Cases within `1e-6` mm of the floating reference threshold were excluded rather than adjudicated by floating arithmetic.

- Site predicates compared: **3,240**.
- Direct-corridor predicates compared: **1,771**.
- Observed mismatches: **0**.

Shapely is not a package dependency and is not used by the production engine.
