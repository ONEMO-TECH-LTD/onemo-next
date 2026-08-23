# Magnetic Engine Design

**User:** Anonymous  
**Created:** 8/13/2026 15:07:26  
**Updated:** 8/13/2026 17:42:12  
**Exported:** 8/14/2026 14:25:59  
**Link:** [https://chatgpt.com/c/6a7dcf9e-0b54-83eb-b8f2-1dbe4fbfaf46](https://chatgpt.com/c/6a7dcf9e-0b54-83eb-b8f2-1dbe4fbfaf46)  

## Prompt:
13/08/2026, 15:07:25

Build the minimum production engine for ONEMO’s magnetic free-shape cutouts.

  ## Product context

  A user uploads a transparent image or selects a saved cutout. The existing browser shell traces its visible silhouette into a vector outline.

  That outline represents the boundary of the physical cutout material. It is not an arbitrary polygon and not the rectangular source image. The cutout
  may be irregular and concave.

  The product must determine:

  - which physical sizes can manufacture that same cutout without changing its proportions;
  - which magnet arrangements can hold it;
  - where those magnets sit on ONEMO’s fixed magnetic grid;
  - which lawful arrangement best supports the important regions of the shape.

  The engine does not trace images, process pixels or render UI. It receives a validated cutout outline and works entirely in millimetres.

  Initial scope is one simple closed outer outline. Do not silently add holes, disconnected shapes, rotation, mirroring or deformation.

  ## Magnetic system

  - Each holding area is a closed disc with radius 12 mm.
  - Magnet centres lie on one fixed 48 mm square lattice.
  - The 96 mm population is every second point of that same lattice. It is not a second grid and must not move the lattice origin.
  - The released field is 9 × 9 base-lattice positions.
  - The cutout keeps its geometry and aspect ratio. Only uniform physical scaling is allowed.
  - Legal manufactured sizes are supplied by the guarded product specification and must be tested independently.
  - Boundary tangency is valid.
  - Do not assume feasibility is monotonic across sizes.
  - A band is a product size label, not a prescribed arrangement.

  ## Critical distinction

  Individual magnet containment answers:

  “Can this complete magnet holding disc fit at this site?”

  It does not answer:

  “Does this arrangement support the distinct important regions of the shape?”

  A candidate may contain every disc correctly while clustering them in one region and leaving another region unsupported. Never collapse regional
  coverage or arrangement quality into disc containment.

  ## Required architecture

  Build three one-way layers.

  ### 1. Geometry kernel

  Input:

  - canonical cutout outline;
  - physical size;
  - lattice origin and population;
  - magnet radius;
  - requested sites or edges.

  Prepare and validate the outline once.

  Return neutral geometric facts only:

  - complete-disc containment for each site;
  - boundary clearance and limiting witness;
  - direct straight-corridor containment between requested sites;
  - exact geometric measurements needed by local tongue or overhang evaluation.

  A direct corridor is only evidence that that straight corridor exists. It is not proof of general fabric connectivity.

  If “local tongue” has no unique mathematical definition from the supplied physical facts, identify the missing definition. Do not invent a threshold,
  witness pattern or pass/fail rule.

  The kernel contains no band rules, arrangement classes, region-quality rules, gravity, ranking, escalation or winner.

  ### 2. Candidate enumerator

  Consume kernel facts plus an explicit arrangement grammar.

  Return every lawful matching placement. Do not score, rank, prune or select.

  The initial grammar must represent:

  - single-site arrangements;
  - horizontal, vertical and diagonal pairs on the same lattice;
  - complete rectangular windows;
  - row- and column-skipping arrangements;
  - corner triangles;
  - corner rectangles;
  - every valid translation and registration within the released field.

  Represent arrangements as explicit lattice-index patterns. Do not replace the grammar with arbitrary connected subsets, centred-only templates or a
  hidden solver.

  Each candidate must include:

  - stable ID;
  - physical size and band label;
  - population and lattice registration;
  - arrangement class;
  - exact lattice indices and millimetre coordinates;
  - all supporting kernel facts.

  Canonical output must be deterministic and contain the complete candidate set.

  ### 3. Product logic

  Consume the immutable candidate set. It may evaluate and rank candidates but must never change geometry, manufacture missing candidates or hide the
  raw set.

  Its concerns are:

  - coverage of distinct shape regions;
  - worst-supported region;
  - gravity and top support;
  - tight wrap;
  - escalation between arrangement classes;
  - arrangement ranking.

  The exact definition and precedence of these criteria are product rules. Use the supplied selection examples as acceptance oracles, not as
  mathematical proof.

  If regional decomposition, tight-wrap measurement or ranking precedence is not fully defined by the examples, state the missing rule. Do not silently
  choose one.

  Every score, rejection and ordering decision must include a reason trace.

  ## Existing integration

  The current application is a Next.js/React admin proof surface with:

  - a guarded TypeScript specification module containing physical values only;
  - one bridge between the UI and engine;
  - an SVG canvas where one SVG unit equals one millimetre;
  - browser-only cutout tracing and camera modules.

  Preserve this protocol:

  - The cutout stays fixed in position and apparent pixel size on the canvas.
  - Changing physical cutout size changes the grid scale beneath it; it does not visually scale the cutout.
  - Selecting a candidate realigns the grid to that candidate’s registration and placement.
  - Only one lattice and one selected candidate are shown.
  - The canvas renders coordinates supplied through the bridge and computes no geometry or product policy.
  - Pan, drag, pinch, camera movement and candidate browsing perform no geometry solve.
  - Outline or guarded-spec changes are the only solve invalidations.
  - Candidate browsing is an indexed lookup over an immutable cached result.

  ## Mobile constraint

  The implementation must be practical on mobile hardware:

  - prepare and validate the outline once;
  - reuse per-outline and per-size geometry;
  - keep candidate enumeration finite and bounded by the 9 × 9 field and explicit grammar;
  - avoid arbitrary-subset search;
  - perform no solve during interaction;
  - use deterministic bounded caches;
  - expose a portable request/result boundary suitable for native and WebAssembly execution;
  - keep cold solving worker-compatible so it cannot block the mobile UI;
  - report measured runtime, peak memory, candidate count and canonical output size rather than inventing performance budgets.

  ## Deliverable

  First audit the brief:

  1. Separate mathematical facts, modelling assumptions and product policy.
  2. Name contradictions or missing definitions.
  3. Prove or falsify the proposed geometry predicates.
  4. Confirm whether the three layers are sufficient.

  Then produce one complete minimal source package:

  - portable C++20 geometry kernel and candidate enumerator;
  - a narrow deterministic request/result interface suitable for native and WebAssembly;
  - thin TypeScript product logic and bridge contracts;
  - no UI implementation;
  - no previous solver or selector;
  - no duplicated geometry in TypeScript;
  - focused tests for tangency, concavity, non-monotonic sizes, shared 48/96 registration, every grammar class, complete enumeration, deterministic
  bytes and clustered-but-poor regional coverage.

  Return complete compilable files, not illustrative fragments.

  Prefer the smallest implementation that delivers the full brief. Do not add frameworks, speculative extension points, fallback heuristics or a single-
  winner selector.

  Necessity: no unnecessary product programme, deployment work or UI rebuild.

  Sufficiency: contains the missing product purpose, cutout meaning, magnetic system, three-layer boundary, scaffold protocol and mobile execution
  constraint. No repository files were changed.

## Response:
13/08/2026, 15:07:45

I’ll audit and lock the mathematical contract first, then build and compile the minimal C++20/TypeScript package with focused tests and measured outputs, leaving undefined product rules explicit.

Two geometry terms remain underspecified: physical-size scaling and corridor width. I’ll provisionally use maximum bounding-box span and a 12 mm-radius capsule, explicitly as replaceable assumptions.

I’m fixing the engine boundary around exact fixed-point input, rational scaling, closed-set containment, and deterministic canonical JSON, with diagnostics excluded. Grammar dimensions and several policy definitions remain explicit unresolved inputs.

The exact kernel and enumerator now compile; focused tests cover geometry edge cases, non-monotonic sizing, shared registration, all grammar classes/translations, deterministic bytes, and the C/Wasm boundary.

> **Building the engine package**
>
> I’m checking the supplied requirements, but the request includes no repository files or prior solver implementation to modify. I can still produce a self-contained starter package, though existing integration details may need adapting.
>
> **Built the engine package**
>
> 
>
> **Remembering**
>
>
> **Designing the package**
>
> I’m translating the requirements into a compact C++20 kernel, deterministic request/result contract, TypeScript bridge layer, audit brief, and focused tests. I’m first pinning down geometry, size scaling, grammar, candidate enumeration, and stable serialization.
>
> **Designed the package**
>
> 
>
> **Formalizing geometry inputs**
>
> I’m defining canonical outlines with fixed-point coordinates and scaling each size by its declared physical span. I’m also documenting this assumption so exact predicates remain deterministic without duplicating geometry logic in TypeScript.
>
> **Formalized geometry inputs**
>
> 
>
> **Choosing exact arithmetic**
>
> I’m favoring header-only multiprecision integers for robust rational predicates, including tangency and clearance comparisons. This keeps results deterministic across native and WebAssembly builds, while adding only a small documented dependency.
>
> **Chose exact arithmetic**
>
> 
>
> **Reviewed ONEMO decisions, examples, grammar, and geometry critiques**
>
> 
>
> **Inspecting engine source and line counts**
>
>
> **Designing JSON handling**
>
> I’m considering Boost.Property Tree for parsing because it’s already available, while manually serializing output preserves deterministic ordering and exact numeric formatting. I’m keeping the package compact with a public header, implementation file, and tests.
>
> **Designed JSON handling**
>
> 
>
> **Inspected engine sources, data contents, package structure, and JSON header availability**
>
> 
>
> **Implementing exact geometry engine with Boost JSON parsing**
>
>
> **Refining the parser**
>
> I’m continuing with Boost.Property Tree for compact parsing, using child traversal for arrays and exact integer conversion. I’m also checking required fields and validating numeric values, while recognizing its type-handling limitations.
>
> **Refined the parser**
>
> 
>
> **Switching to Boost.JSON**
>
> I’m moving from Property Tree to Boost.JSON because it preserves numeric types, supports structured arrays naturally, and makes deterministic serialization easier. I’m planning fixed key insertion order, exact integer validation, and compact integration.
>
> **Switched to Boost.JSON**
>
> 
>
> **Implemented robust exact geometry kernel with Boost JSON parsing and public BigPoint**
>
> 
>
> **Reading magnet engine implementation**
>
>
> **Defining initial grammar**
>
> I’m specifying deterministic arrangement classes, explicit lattice offsets, stride-aware normalization, and corridor edges. I’ll include single sites, pairs, windows, skipped rows or columns, and corner-based shapes.
>
> **Defined initial grammar**
>
> 
>
> **Generating Magnetic Placement Pattern Grammar**
>
>
> **Implemented magnet engine interfaces, placement grammar, build support, and validated examples**
>
> 
>
> **Calculating test harness coverage and performance**
>
>
> **Calculated test harness coverage and performance**
>
> 
>
> **Computing Pattern Grid Formula**
>
>
> **Computed pattern grid formula and verified container file persistence**
>
> 
>
> **Reconstructing C++20 geometry engine package**
>
>
> **Reconstructed, tested, and patched the C++20 geometry engine package**
>
> 
>
> **Implementing stable traced candidate decomposition engine**
>
>
> **Completing the package**
>
> I’m finishing the TypeScript tests and package metadata, then I’ll patch the moved-string size issue, verify deterministic sorting, rebuild everything, run tests, and prepare the final archive.
>
> **Completed the package**
>
> 
>
> **Inspecting Project Files and Storage**
>
>
> **Implemented and tested stable candidate decomposition across engine, API, and diagnostics**
>
> 
>
> **Benchmarked, formatted, documented, and validated the project build and tests**
>
> 
>
> **Building and Testing Magnetic Geometry Engine**
>
>
> **Finalized and verified the ONEMO magnetic-engine package**
>
> 
>
> Worked for 99m 48s

# ONEMO magnetic free-shape engine — delivered

[Download the complete C++20/TypeScript source package](sandbox:/mnt/data/onemo-magnetic-engine-v1.0.0-source.zip)

Supporting files:

- [Brief audit and geometry proofs](sandbox:/mnt/data/onemo-magnetic-engine-v1.0.0-source/AUDIT.md)
- [Build, API and integration manual](sandbox:/mnt/data/onemo-magnetic-engine-v1.0.0-source/README.md)
- [Measured runtime, memory and validation results](sandbox:/mnt/data/onemo-magnetic-engine-v1.0.0-source/MEASUREMENTS.md)
- [Source-file checksum manifest](sandbox:/mnt/data/onemo-magnetic-engine-v1.0.0-source/MANIFEST.sha256)
- [ZIP SHA-256 checksum](sandbox:/mnt/data/onemo-magnetic-engine-v1.0.0-source.zip.sha256)

ZIP SHA-256:

```text
b900864c637635fed661852b49063ea3e1115dfe1b9d52a0144a64a40b60f981
```

## Audit conclusion

The three requested layers are sufficient for the defined one-outline, uniform-scale, no-rotation scope:

1. **Geometry kernel** establishes neutral geometric facts.
2. **Candidate enumerator** generates every lawful placement relative to an explicit finite grammar.
3. **Product logic** applies explicit regional evidence, gates and precedence without modifying the raw candidate set.

The worker, C ABI, deterministic cache and UI bridge are execution infrastructure rather than a fourth semantic layer.

### Proven geometry

The package implements and tests these exact predicates:

$$
D(p,r)\subseteq\Omega
\iff
p\in\Omega\ \land\ \operatorname{dist}(p,\partial\Omega)\ge r
$$

Therefore, a complete magnet disc fits exactly when its centre lies in the closed cutout region and its exact boundary clearance is at least 12 mm. Equality passes, so closed tangency is lawful.

For a direct straight corridor with centre segment $S$:

$$
S\oplus D(0,r)\subseteq\Omega
\iff
S\subseteq\Omega\ \land\ \operatorname{dist}(S,\partial\Omega)\ge r
$$

The implementation separately computes exact centreline containment and exact segment-to-boundary clearance. It does not infer a corridor merely because both endpoint discs fit.

The tests also provide a concrete concave-shape counterexample in which the same fixed magnet site has:

```text
size 100: pass
size 300: fail
size 900: pass
```

Consequently, no monotonic size pruning is used.

## Explicit modelling contracts

Several terms in the brief do not have one mathematically forced implementation. They are made visible rather than hidden:

- A physical size means the target **maximum bounding-box extent**.
- Scaling is uniform about the canonical bounding-box centre.
- The released field is indexed `[-4,4] × [-4,4]`.
- The guarded profile contains the four explicit half-pitch registrations `(0,0)`, `(24,0)`, `(0,24)` and `(24,24)` mm.
- The 96 mm populations use stride two and four phase combinations while retaining the selected 48 mm lattice origin.
- Pattern sites are explicit population-space lattice indices.
- Pattern edges declare corridor mode individually as either `report` or `require`.

The initial arrangement grammar contains **461 explicit patterns**:

| Arrangement family | Explicit patterns |
|---|---:|
| Single site | 1 |
| Horizontal, vertical and both diagonal adjacent pairs | 4 |
| Complete rectangular windows | 64 |
| Strict alternating-row arrangements | 36 |
| Strict alternating-column arrangements | 36 |
| Corner triangles | 256 |
| Corner rectangles | 64 |

“Row skipping,” “column skipping,” and the permitted rectangle spans were not uniquely defined by the brief. The profile therefore adopts a transparent v1 definition: strict alternation, with both outer selected rows or columns present, over spans up to the 9 × 9 field. The C++ enumerator consumes the resulting explicit patterns and does not contain a connected-subset solver or infer pattern classes itself.

## Intentionally unresolved product rules

The supplied facts and examples do not uniquely define:

- regional decomposition;
- treatment of sites on regional boundaries;
- local tongue, flap or overhang measurement;
- gravity direction and coordinate frame;
- top-support measurement;
- tight-wrap measurement;
- class-escalation precedence;
- ranking precedence and tie policy.

No threshold or substitute formula has been invented for these.

The TypeScript product layer instead accepts explicit:

- site-to-region membership;
- gate results and reasons;
- exact criterion values and reasons;
- criterion precedence and direction.

It returns all candidate evaluations, all rejections, the full accepted ordering and adjacent ordering traces. It does **not** select or publish one winner.

## Package implementation

The source package contains:

- an exact Boost.Multiprecision rational geometry kernel;
- one-time simple-polygon validation and canonicalisation;
- reusable per-size outlines;
- per-size/per-registration site and corridor caches;
- exhaustive bounded translation enumeration;
- deterministic canonical JSON;
- a single C ABI request/result boundary;
- native/WASM-compatible ownership functions;
- a worker-compatible TypeScript transport contract;
- a deterministic bounded LRU bridge;
- indexed candidate browsing;
- complete lattice coordinates supplied by C++;
- no UI, pixel processing, tracing or camera implementation;
- no geometry duplicated in TypeScript;
- no previous selector or fallback solver.

The guarded TypeScript physical specification includes the established legal sizes:

```text
band-2: 72, 84, 96, 108 mm
band-3: 120, 132, 144, 156 mm
```

Every size is solved independently.

## Validation results

The final source package passed:

- GCC 14.2 C++20 compilation;
- Clang 17 compilation with warnings promoted to errors;
- release CTest suite;
- AddressSanitizer and UndefinedBehaviorSanitizer;
- strict TypeScript compilation;
- TypeScript behavioural tests;
- C-language header compilation and C ABI allocation/free test;
- full 461-pattern integration fixture;
- two separate process solves compared byte-for-byte;
- manifest verification after ZIP extraction.

An additional independent differential run compared the exact kernel with Shapely over 40 deterministic concave polygons, excluding cases within `1e-6` mm of the floating reference threshold:

```text
site predicates compared:       3,240
corridor predicates compared:   1,771
observed mismatches:                 0
```

Shapely is not included and is not a production dependency.

## Measured bounded solve

For the complete guarded profile:

```text
prepared vertices:          16
explicit grammar patterns: 461
placements tested:     374,720
site facts computed:     2,592
corridor facts computed:     21
lawful candidates:            88
request bytes:           306,192
canonical result bytes:  107,517
```

Five fresh-process runs in the supplied Linux x86-64 container measured:

```text
median wall time:       0.25 s
observed range:    0.24–0.28 s
maximum peak RSS:     10,756 KB
```

These are measurements from the stated server container, not invented mobile performance budgets. The solve is synchronous at the C boundary and designed to run as a cold operation inside a Web Worker or native worker. Interaction and candidate browsing perform no solve.

The archive is source-only; build directories and generated TypeScript output are excluded. No repository files were changed.



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)