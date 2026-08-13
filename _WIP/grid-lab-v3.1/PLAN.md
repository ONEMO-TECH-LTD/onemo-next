# Grid Lab v3.1 — execution plan

Status: HELD — no build authorised. Execution starts ONLY on Dan's explicit go relayed by @s62-lead. Next increment when unlocked: T1.1.

## Governing scope

Build fresh in this clean-scaffold worktree. The archived Lead branch is donor-only. Reuse GPT's existing exact predicates unchanged; add complete neutral enumeration; prove it from Dan's canon; connect it through one bridge without changing the scaffold protocol.

## T1 — Engine + raw visual surface

Compose one pure C++ engine from GPT's verbatim predicates. Exclude the old solver, ranking, and selector from the production compile.

Acceptance criteria:

- Every lawful `r×c` sub-window at every lattice placement.
- Per-axis parity on one lattice.
- Coupled 48/96 populations.
- Every lawful even manufactured size.
- Neutral canonical output containing all lawful candidates.
- GPT predicate suite remains green.
- Output is byte-stable.
- No selector or ranking path is compiled.
- Raw candidates are browsable through the thinnest bridge on the untouched scaffold.

## Donor map

### Authority chain

Later layers override only the named contract points. They do not replace the v1 predicate implementations.

#### Layer 1 — v1 package code: the only code authority

Clone code only from `_WIP/CHAT GPT/magfit-reference/` in the `s62-grid-canvas` donor worktree. Its source manifest is:

```text
43dca5e26a3652e076b8123831a854dd6720e45782c8c5c430937d0bb0dc1133  src/magfit.cpp
c7bab8f22268b080743aff4b085758c4cd540a2bfe846ba0bcb595d252e3bd72  include/magfit/magfit.hpp
003199f4ea618c97977bf9b4bb13087b9fe245f625c70a9bb629a8307f197b9d  tests/test_magfit.cpp
```

Transcripts and `_selection/` are specification and evidence only. Zero code is cloned from them. Layer 1 supplies the exact predicate implementations, but its solver contract is superseded by Layers 2 and 3.

#### Layer 2 — v2 normative contract correction: no code

Authority: `_WIP/CHAT GPT/corrected and defended/MAGFIT_V2_CORRECTION_SPEC (1).md`, SHA-256 `2b0ab5d7e11a1708b81f6495c98baeba8c9a3dd1bfa5f73c1f4fee894758c136`, together with the 7k-line defence transcript `_WIP/CHAT GPT/corrected and defended/ChatGPT-Branch · Magnetic-Grid Fitting Algorithm-20260812-1413.md` as evidence.

This layer ships no code. It supersedes the v1 contract on these points:

1. **Flap law replaced.** V1 bbox `flap_metrics` is deprecated reference, not production code. Geometry must return per-side/per-node `SideFlapEvidence`: exact extent, 12/24 mm local-tongue any/all facts, narrow-limb exceptions, failing outer-node lists, and limiting witnesses.
2. **Direct capsule meaning narrowed.** `capsule_supported` is `DIRECT_CAPSULE_LINK`, a conservative geometric fact. It is never described as general fabric connectivity. `ErodedComponent` is optional/later.
3. **Prepared API required.** `prepare` performs canonical validation once, freezes `PreparedShape`, and owns the shape hash. Solves reuse it with per-size `ScaledPolygon`, disc evidence per node, direct-link evidence per edge, and local-tongue evidence caches.
4. **Kernel/logic split normative.** The production `GeometryKernel` returns facts only. It cannot choose a commercial band, layout tier, or winner.

#### Layer 3 — Dan's canon: final product authority

Authority:

- `_WIP/grid-engine-v3/grid-laws.md` L20;
- `_WIP/grid-engine-v3/selection-examples/` on `session62-task/KAI-10261-grid-canvas`;
- `_WIP/grid-engine-v3/engine-mathematics.md` at the clean scaffold head.

Layer 3 supersedes Layer 2 where they conflict:

1. V2 tier-first `deterministicBest` and all single-winner selection are dead. The pure engine returns every lawful candidate neutrally.
2. V2's “single magnet cannot satisfy band 2” is logic-layer product policy, not engine truth. Single-magnet holds are lawful facts, proven by the Band 1 canon.
3. The sealed grammar's enumeration of every `r×c` window at every placement replaces v1 `templates_for_band` entirely.
4. Gravity, tight wrap, axis following, arrangement preference, and escalation remain above the neutral geometry engine and are added only after Dan accepts the raw candidate set visually.

### Clone verbatim — function boundary

Clone these exact geometry functions without rewriting their mathematics:

- `square128`
- `dot`
- `cross`
- `orient`
- `orient_i64`
- `sign128`
- `between_inclusive`
- `on_segment`
- `on_segment_i64`
- `segments_intersect_inclusive`
- `segments_intersect_inclusive_i64`
- `point_between_collinear`
- `validate_no_duplicate_vertices`
- `validate_simple_polygon`
- `signed_area2`
- `remove_redundant_collinear`
- `validate_no_collinear_backtracking`
- `scale_polygon`
- `grid_to_internal`
- `locate_point`
- `point_segment_distance2`
- `multiply_u128`
- `compare_u256`
- `compare_distance2`
- `distance_ge_radius`
- `disc_supported`
- `segment_segment_distance2`
- `capsule_supported`
- `run_coordinates`
- `binding_contact`

Clone the supporting types `P128`, `ScaledPolygon`, `DistanceSquared`, and `U256` verbatim with them.

### Deprecated reference — never cloned into production

- `flap_metrics` — v1 bbox flap; replaced by Layer 2 `SideFlapEvidence` local-tongue facts.

### Exclude from the production compile

These old solver and selector paths never enter the production target:

- `templates_for_band`
- `possible_sparse_phases`
- `evaluate_one_sparse_phase`
- `evaluate_sparse`
- `component_spans_band`
- `connected_components` when used as a product gate
- `links_for_component` when used as a product gate
- `better_candidate`
- `better_contact` when used as a selector
- `best_candidate_at_size`
- `solve`
- the old selector-facing C ABI

`binding_contact` may retain only the deterministic comparison required to identify its limiting evidence witness; that comparison cannot rank or remove candidate families.

### New code — only fresh implementation

Fresh engine code is limited to the contract work not shipped as v1 code:

- enumeration of every `r×c` window at every lattice placement, every lawful size, and the 48 mm plus 96 mm populations;
- the required `PreparedShape` API and exact cache ownership;
- Layer 2 per-side/per-node local-tongue and narrow-limb evidence;
- neutral canonical assembly/serialization.

Enumeration calls `disc_supported` and `capsule_supported` per site/edge and computes no geometric predicate itself. New local-tongue code implements the Layer 2 Minkowski capsule definition and returns evidence only. No fresh code may recreate a v1 predicate already on the clone-verbatim list.

### T1 increment contract

#### T1.1 — Band 1 raw vertical slice

File-level deliverable:

- `_WIP/grid-lab-v3.1/engine/include/grid_engine/grid_engine.hpp` — neutral Band 1 request/result types.
- `_WIP/grid-lab-v3.1/engine/src/exact_geometry.cpp` — only the listed verbatim donor predicates and dependencies.
- `_WIP/grid-lab-v3.1/engine/src/prepared_shape.cpp` — `prepare` once, frozen canonical shape/hash, and exact per-size cache owner.
- `_WIP/grid-lab-v3.1/engine/src/enumerate.cpp` — every single-disc placement for one supplied outline and manufactured size.
- `_WIP/grid-lab-v3.1/engine/src/c_api.cpp` — opaque `prepare/solve/destroy` Band 1 C/Wasm entry; no selector.
- `_WIP/grid-lab-v3.1/engine/tests/band1_test.cpp` — containment, tangency, completeness, canonical order, and prepared-versus-one-shot identity.
- `_WIP/grid-lab-v3.1/engine/build.sh` — builds/runs the native tests and emits the same source as Wasm.
- `src/lib/grid-engine/raw-engine.ts` — Wasm transport only.
- `src/lib/grid-engine/bridge.ts` — converts the current outline/box/spec into one request and returns immutable raw candidates.
- `src/app/(dev)/grid-engine/GridCanvas.tsx` and `page.tsx` — browse/highlight returned positions through the existing renderer; no geometry or steering.

Pasted-evidence gate:

- source manifest hashes match;
- GPT predicate suite output is green;
- Band 1 native tests print total enumerated/held counts and PASS;
- preparation count is one while candidate browsing and pan/drag/camera add zero prepares/solves;
- native and Wasm candidate bytes match for the same request;
- live page provenance identifies this worktree/head;
- Chrome screenshot shows DUCK at 60 mm with the head placement among browsable raw candidates;
- console errors are zero and pan/drag/camera cause zero additional solves.

Stop for Lead QA and Dan's visual gate before T1.2.

#### T1.2 — Complete 48 mm placement enumeration

File-level deliverable:

- `engine/src/enumerate.cpp` — every `r×c` window at every 48 mm lattice placement, per-axis parity, neutral deduplication.
- `engine/tests/dense_enumeration_test.cpp` — exhaustive extent/placement/residue/completeness cases.
- `GridCanvas.tsx` and `page.tsx` — the existing raw browser exposes the expanded set without new geometry.

Pasted-evidence gate:

- native test output prints expected versus actual window/placement/family counts for each band;
- one residue per axis per candidate and no half-pitch union;
- raw browser reaches every returned 48 mm family;
- live screenshots cover the accepted Band 1 and Band 2 examples;
- Lead QA verdict before T1.3.

#### T1.3 — Add 96 mm population and coupling

File-level deliverable:

- `engine/src/enumerate.cpp` — derive the fixed sparse population from the same base lattice and couple every lawful 48/96 arrangement at one size.
- `engine/tests/population_coupling_test.cpp` — thinning, per-axis residue, completeness, and no-one-population-only-family cases.
- `raw-engine.ts` and the existing raw browser — expose both returned populations without recomputation.

Pasted-evidence gate:

- tests print 48 count, 96 count, and coupled-family count for each corpus case;
- every 96 coordinate is a member of the same 48 base lattice;
- native/Wasm bytes match;
- live screenshots show the corresponding 48/96 raw families without moving the shape;
- Lead QA verdict before T1.4.

#### T1.4 — Enumerate every lawful even size

File-level deliverable:

- `engine/src/enumerate.cpp` — publish every lawful even manufactured size, preserving disjoint lawful ranges and never returning first-fit only.
- `engine/tests/size_enumeration_test.cpp` — tangency boundaries, enter/leave/re-enter ranges, and no omitted even values.
- `page.tsx` — browse returned sizes as cached result indices; changing selection never solves.

Pasted-evidence gate:

- tests print every expected and actual size set, including a non-monotonic case;
- repeated solves are byte-identical;
- interaction counter remains unchanged while browsing sizes;
- live screenshots show multiple raw sizes with identical shape pixel bounds;
- Lead QA verdict before T1.5.

#### T1.5 — Complete neutral evidence, prepared caches, and canonical output

File-level deliverable:

- `grid_engine.hpp`, `prepared_shape.cpp`, `exact_geometry.cpp`, and `enumerate.cpp` — coordinates, active topology, direct-capsule facts, binding witness, Layer 2 `SideFlapEvidence`, canonical IDs/order, explicit empty reasons, exact caches, and immutable fingerprinted output.
- `engine/tests/canonical_output_test.cpp` — translation/winding/start-index invariance, prepared-versus-one-shot equality, local tongue/cove/narrow-limb cases, stable IDs/order/bytes, and selector-symbol absence.
- `build.sh` — fail-loud native/Wasm identity gate for the seven-shape corpus.
- `raw-engine.ts`, `bridge.ts`, and the raw browser — display returned evidence only.

Pasted-evidence gate:

- GPT predicate suite remains green;
- seven-shape output counts and canonical hashes are pasted;
- prepared-shape cache counters show one validation and reused per-size disc/link/tongue evidence;
- native/Wasm bytes are identical for the full corpus;
- compiled-symbol check shows no excluded solver/selector surface;
- Chrome visual evidence covers every canon folder with zero console errors and fixed shape bounds;
- Lead QA verdict closes T1 and opens Dan's full raw-set acceptance gate.

## T2 — Dan visual acceptance

Dan checks the running raw candidate set against every `selection-examples/` placement. No headless fixture substitutes for this gate.

Acceptance criteria:

- Duck 60 mm head placement appears naturally in Band 1 raw candidates.
- Band 2 diagonal and axis-following pairs appear naturally.
- Band 3 corner, row-skipping, diagonal, and lawful alternatives appear naturally.
- Band 4 arrangements appear naturally on the 96 mm population.
- Missing canon placements fail the engine; they are not patched in the UI.

## T3 — Steering

Add gravity and tight-wrap ranking above the visually accepted neutral engine. No steering logic enters C++ candidate generation.

## T4 — Regression fixtures

Only after Dan accepts the raw set and steering behavior, encode the accepted state as permanent fixtures, then run the seven-shape regression and native/Wasm byte-identity gate.

## Integration constraint

Add one bridge into the untouched scaffold.

Acceptance criteria:

- Candidate browsing is cached lookup.
- Pan, drag, zoom, and camera trigger zero solves.
- Shape remains pixel-fixed across candidates.
- Grid realigns and scales to the selected candidate.
- One shape renderer and one lattice authority.
- Chrome visual gate matches the canon screenshots.

## Pipeline gates

Builder → `@s62-lead` QA → Meta → Dan product sign-off. These are gates, not implementation tasks.

## Increment cadence

One small increment at a time. Every increment ends with:

1. Measured evidence pasted into the ledger.
2. Rolling ledger updated with exact state and next action.
3. Local commit and push.
4. Stop for `@s62-lead` QA; do not continue until its verdict.

After every compaction, read the latest transcript segment and `LEDGER.md` before touching code.

## Current increment — T1.1

Build Band 1 only:

- pure engine enumerates every lawful single-disc placement for the selected outline and manufactured size;
- thin bridge exposes immutable raw candidates;
- scaffold page browses those candidates and draws returned positions through its existing lattice/canvas protocol;
- no ranking, steering, fixture assertion, or solve-on-pan;
- first visual falsifier is duck at 60 mm: the head candidate must be visible in the raw set.

Stop after running evidence, ledger, commit, push, and Lead QA dispatch.

## Rejected decomposition

The prior 25-task plan is superseded as overbuilt. The proof-first ordering is also superseded: five prior builds were disproved only by Dan's eye on the running surface. The exact history remains in the transcript; it is not execution authority.
