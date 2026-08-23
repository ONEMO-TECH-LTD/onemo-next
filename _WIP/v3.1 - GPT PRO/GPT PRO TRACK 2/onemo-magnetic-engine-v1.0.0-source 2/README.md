# ONEMO Magnetic Free-Shape Engine

Minimal production source package for exact magnet-disc feasibility and complete arrangement enumeration over one concave simple cutout outline.

## What is included

- C++20 exact geometry kernel.
- C++20 finite candidate enumerator.
- Single deterministic UTF-8 JSON request/result boundary.
- C ABI suitable for native linking and WebAssembly exports.
- Thin TypeScript contracts, guarded physical specification, explicit arrangement grammar, product-rule executor, and UI bridge.
- No image tracing, pixels, UI, camera implementation, old solver, hidden selector, or duplicated cutout geometry in TypeScript.
- Focused C++ and TypeScript tests.
- Reproducible benchmark request/result and measured runtime/memory report.

Read [AUDIT.md](AUDIT.md) before changing product rules. It separates proofs from modelling choices and unresolved policy.

## Build and test

Requirements:

- CMake 3.20 or newer;
- a C++20 compiler;
- Boost.Multiprecision headers (`boost/multiprecision/cpp_int.hpp`);
- Node.js and TypeScript for the thin TypeScript package.

```bash
./scripts/build_and_test.sh
```

Equivalent commands:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure

cd ts
npm test
```

The package was compiled and tested with GCC 14.2.0 and Clang 17.0.0, CMake 3.31.6, Node 22.16.0, and TypeScript 5.8.3. The Clang build was run with warnings promoted to errors.

## Command-line solve

```bash
./build/onemo-magnetic-cli fixtures/benchmark_request.json > result.json
```

The CLI also accepts the request on standard input.

## Exact request contract

The top-level schema is `onemo.magnetic.solve.request/1`.

```json
{
  "schema": "onemo.magnetic.solve.request/1",
  "outline": [["-100", "-60"], ["100", "-60"], ["100", "60"], ["-100", "60"]],
  "scale_basis": "max_bbox_extent",
  "magnet_radius_mm": "12",
  "base_pitch_mm": "48",
  "field": {"min_x": -4, "max_x": 4, "min_y": -4, "max_y": 4},
  "sizes": [{"id": "size-96", "band": "band-2", "max_extent_mm": "96"}],
  "registrations": [{"id": "r.site-site", "origin_mm": ["0", "0"]}],
  "populations": [{"id": "p48", "stride": 1, "phase": [0, 0]}],
  "patterns": [{
    "id": "pair.h.adjacent",
    "class": "horizontal_pair",
    "sites": [[0, 0], [1, 0]],
    "edges": [{"from": 0, "to": 1, "corridor": "report"}]
  }]
}
```

### Numeric rules

- Every physical quantity is a decimal **string**, parsed as an exact rational.
- JSON numbers are used only for bounded integer indices, strides, phases, and edge references.
- Exponent notation is not accepted for physical decimal strings.
- The outline may repeat its first point once as its final point; preparation removes that closure duplicate.
- The outline must otherwise be a non-self-intersecting, non-self-touching simple polygon with nonzero area and no zero-length or backtracking edges.
- The only accepted scale basis is `max_bbox_extent`: the longer canonical bounding-box dimension is scaled to the requested physical size about the bounding-box centre.

### Population mapping

Pattern sites are integer coordinates in population space. A translated pattern site maps to a base-lattice index as:

```text
baseIndex.x = phase.x + stride * (patternSite.x + translation.x)
baseIndex.y = phase.y + stride * (patternSite.y + translation.y)
coordinateMm = registrationOriginMm + baseIndex * basePitchMm
```

For the guarded system:

- `p48` has stride 1 and phase `(0,0)`;
- the four `p96` phase entries have stride 2;
- all populations reuse the same selected registration origin.

### Pattern legality

A translated pattern is emitted when:

1. every complete holding disc is contained; and
2. every edge explicitly marked `require` has a contained direct corridor.

Edges marked `report` never exclude a candidate; their exact corridor facts are still returned. The initial grammar uses `report` because the brief does not make corridors a universal arrangement law.

## Deterministic result contract

The result schema is `onemo.magnetic.solve.result/1`. Successful output contains:

- canonical outline summary and exact scale transforms;
- the exact physical specification used;
- every 9 × 9 lattice coordinate for each registration;
- every lawful candidate in canonical order;
- exact site clearances and limiting boundary witnesses;
- exact direct-corridor clearances and limiting witness pairs;
- solve counters.

Distances are represented exactly by `squared_mm2`. The actual non-negative distance is the square root of that rational; this avoids approximating irrational values.

Candidate IDs include size, registration, population, arrangement class, explicit pattern ID, and population-space translation. No result ordering depends on map iteration, floating-point tolerance, or thread timing.

## C ABI

Header: `include/onemo/c_api.h`.

```c
char* onemo_magnetic_solve_json(
    const char* request_utf8,
    size_t request_size,
    size_t* result_size);

void onemo_magnetic_free(void* buffer);
```

The solve function returns either canonical success JSON or canonical error JSON. The returned byte buffer is owned by the caller and released with `onemo_magnetic_free`.

This is the complete native/WASM boundary: one immutable request in, one immutable result out.

## WebAssembly/worker use

Build through an Emscripten toolchain without changing the semantic API:

```bash
emcmake cmake -S . -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm -j
```

Export the three C ABI functions from the final Emscripten link. Run the cold solve in a Web Worker. The TypeScript `EngineTransport` interface accepts and returns `Uint8Array`, so native, worker, and WASM transports share the same bridge.

## TypeScript integration

### Physical specification

`ts/src/guardedPhysicalSpec.ts` contains physical values only:

- radius 12 mm;
- pitch 48 mm;
- 9 × 9 field;
- band-2 sizes 72, 84, 96, 108 mm;
- band-3 sizes 120, 132, 144, 156 mm;
- four explicit half-pitch registration origins;
- one 48 mm population and four 96 mm phase populations.

### Explicit grammar

`ts/src/initialGrammar.ts` expands the named profile into 461 explicit lattice-index patterns. It never searches arbitrary subsets. The exact class meanings are documented in that file and in `AUDIT.md`.

### Bridge protocol

`MagneticEngineBridge`:

- builds the request from the traced outline, guarded physical spec, and explicit grammar;
- uses a deterministic bounded LRU cache keyed only by canonical solve bytes;
- calls the transport only on an outline/spec/grammar cache miss;
- returns `SolvedCandidateSet` for indexed browsing;
- resolves exactly one candidate, one lattice, and one size record for rendering;
- performs no cutout geometry or product scoring.

Pan, drag, pinch, camera changes, and candidate browsing never enter the solve request and therefore never trigger a solve.

The engine result already supplies lattice coordinates and scale transforms. The canvas should render those values and should not reconstruct containment, placement, or product policy.

### Product logic

`ts/src/productLogic.ts` keeps the raw candidate set and applies only explicit evidence:

- gates include pass/fail and a reason;
- criteria include an exact rational value and a reason;
- precedence and direction are supplied explicitly;
- rejected candidates remain traceable;
- all accepted candidates are returned in order;
- no winner is selected.

The regional helper requires an explicit site-to-region membership table. It demonstrates why complete-disc containment and regional support are separate facts. Gravity, top support, tight wrap, escalation, and local tongue remain undefined until their product contracts are supplied.

## Cache and mobile execution

The C++ solve performs:

- one outline preparation/validation;
- one reusable scaled outline per physical size;
- one site-fact cache per size/registration;
- one corridor-fact cache per size/registration;
- a bounded finite traversal of explicit patterns and translations.

No arbitrary connected-subset search exists. No solve runs during interaction. The included benchmark exercises all 374,720 placements of the guarded profile; see [MEASUREMENTS.md](MEASUREMENTS.md).

## Test coverage

C++ tests cover:

- closed tangency;
- concavity and reflex-boundary clearance;
- endpoint discs that do not form a direct corridor;
- pass/fail/pass non-monotonic sizing;
- shared 48/96 registration;
- every arrangement class;
- complete translation enumeration;
- explicit `report` versus `require` corridor grammar;
- canonical bytes under reordered size, registration, population, pattern, and outline inputs;
- deterministic repeated result bytes.

TypeScript tests cover:

- all 461 explicit grammar patterns and every required class;
- both diagonal pair slopes;
- clustered-but-poor regional coverage;
- immutable raw candidates and rejection reasons;
- deterministic product tie-breaking without locale-sensitive comparison;
- bounded solve caching and indexed candidate browsing.

The build script also executes the full 461-pattern guarded fixture twice, verifies all 374,720 placement tests, and compares both outputs with the checked canonical result bytes.
