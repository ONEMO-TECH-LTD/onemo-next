# v3.5.1 T0 baseline manifest

Frozen donor: `8d17780c`. Contract: `a626598fada3e908f848440b369e08e0fc36532726f21ba8025dcf342d27cc23`.

## Runtime inventory

| File | SHA-256 | T0 disposition |
|---|---|---|
| `src/lib/effect/grid-origin-spec.ts` | `bc8df2bc297f76a7e1f4dd4964b0582f5dd1cb9e0e45bd989870d11eb00fe9e6` | comparator frozen; ruled values adapted into new spec |
| `src/lib/effect/grid-origin-compute.ts` | `44b5144fb493284d28be3fff6c82c1be93ff8be90bad052ba6fa0569f6ab90fc` | comparator frozen; cleared neutral bodies move/adapt only |
| `src/lib/effect/grid-origin-logic.ts` | `bc317ef497bbcf19d0fdd9ae56431bd9ab5aab4ded470b363008e010de54659e` | comparator frozen; Centre-rules bodies are the policy donor |
| `src/lib/effect/grid-origin.ts` | `4afa144c7be468f94a9e6efc2f4b5c64c3ee1430c0963dac5a24c3afdea06fe7` | comparator frozen; Centre-rules branch is the behavioral donor |
| `src/lib/effect/grid-origin-bridge.ts` | `4878c9934c31f8ba54fd4c7cad7b7ac4a3552eb34da268321f6906db97a14eb0` | comparator frozen; pass-through contour behavior adapted |
| `src/app/(dev)/effect-creator/grid-origin/solve.worker.ts` | `0352f320cfeeb89cea7634b3d186cba4c5d50cf7329d6d49a0bf628d3fa17e0c` | comparator frozen; never a Law donor |
| `src/app/(dev)/effect-creator/grid-origin/page.tsx` | `515603b5ca2a4e13df24b24789e2f7828556bd9038d846aed9274b1cf3bcf1cf` | comparator frozen; T4 adds only the tab mount |
| `src/lib/effect/__tests__/grid-origin-separation.test.ts` | `4a3e9543a148c4b70af85e9a58df7cb512511a825936c204d6a1dea3a5c5e9e4` | historical guard only; new package gets its own guard |
| `src/app/(dev)/effect-creator/grid-origin/asset-lib/route.ts` | `6f943c1e0d361917a2980b69ec4f5bd3add1e219655de70759d4485943001b70` | unrelated loader; untouched |
| `src/app/(dev)/effect-creator/grid-origin/asset-lib/dirs.ts` | `4ef649f10646bf02c931a2a669f15077df7aea9edc24264ebe188bfb162edf1d` | unrelated loader; untouched |
| `src/app/(dev)/effect-creator/grid-origin/asset-lib/[file]/route.ts` | `3eea1cf0f7c231f04456b6f3453155b483d89c08fc6ed95cff1b466758d767cd` | unrelated loader; untouched |

## Centre-rules donor allowlist

Only bodies reachable from `positioning===1` may seed the Law centre layer. Voting-only symbols are `DELETE-LATER / NOT-A-LAW-DONOR`: `registrationScore`, `ORDERS`, `VOTING_ORDER`, `centeringRef`, phase sweep, voting weights, and voting persisted config.

| Body | Source lines | Disposition | Proof |
|---|---:|---|---|
| `governMass` | `grid-origin-logic.ts:51-68` | ADAPT representation only | all nine-policy characterization; identical branch decisions required |
| `centeringAnchors` | `grid-origin-logic.ts:75-105` | ADAPT accepted policy behavior; DELETE mesh-derived ruler | all nine-policy characterization; only named ruler defects may differ |
| `parityHolds` | `grid-origin.ts:134-143` | ADAPT/RE-ROOM | node/gap parity fixture |
| Centre-rules four placements and ranking | `grid-origin.ts:190-220` | ADAPT/RE-ROOM | pre-room/post-room characterization equality |
| `bbox` | `grid-origin-compute.ts:16-20` | MOVE-VERBATIM → `compute/seat.ts` | executable AST hash + neutral fixture |
| `axisFrom` | `grid-origin-compute.ts:36-43` | MOVE-VERBATIM → `compute/seat.ts` | executable AST hash + lattice fixture |
| `latticeAt` | `grid-origin-compute.ts:46-51` | MOVE-VERBATIM → `compute/seat.ts` | executable AST hash + lattice fixture |
| `latticeOver` | `grid-origin-compute.ts:54-56` | MOVE-VERBATIM → `compute/seat.ts` | executable AST hash + lattice fixture |
| segment seat predicate | `grid-origin-compute.ts:182-207` | ADAPT into exact neutral kernel | equivalence on accepted non-defect cases; exact boundary owns differences |
| `centroidOf` | `grid-origin-compute.ts:540-554` | MOVE-VERBATIM → `compute/centre-evidence.ts` | executable AST hash + centroid fixture |
| `scaleContour` | `grid-origin-compute.ts:583-585` | MOVE-VERBATIM → `compute/seat.ts` as public `scaleBoundary` | executable AST hash + contour-scale fixture |

The executable inventory in `grid-origin-inventory.test.ts` classifies every remaining callable body and top-level symbol individually. Its committed snapshot records every public export/re-export, runtime/test/build consumer, persisted key/default field, worker request/response/model field, queue rule, cache shape/cap/invalidation rule, and every tracked artifact under `grid-origin*` and `src/lib/grid-engine/**` with hash, active owner, destination, generated-source owner, legal disposition, and current deletion-proof state. The test fails if a callable body or top-level symbol is unclassified, if any inventory entry changes, or if a new consumer/artifact appears without a reviewed snapshot update.

The executable AST extractor and its snapshot are the sole MOVE-body hash authority. T1 must use the same extractor to assert donor body hash equals copied body hash; prose does not duplicate hash values.

The executable gate asserts that no duplicate inventory verifier or overlapping snapshot exists; `grid-origin-inventory.test.ts` is the sole inventory verifier.

One concurrent untracked `grid-origin-t0-inventory.test.ts` briefly appeared during T0 and disappeared before ownership could be identified. Grid-Meta confirmed it neither created nor removed the duplicate, and also did not modify the surviving verifier. Ownership is recorded as unknown; the duplicate is not an authority.

The surviving verifier also received concurrent disposition edits whose owner could not be identified. They were accepted only after an independent R14/current-source check: rejected mesh/tolerance/alternate-circle bodies delete; corrected worst-belt and belt semantics adapt; comparator shape adapters remain comparator-only; the Law bridge retains only pass-through sizing and field-view behavior.

No deletion is currently proved. Comparator files and their T0 test consumers are preserved through T5. At T7/T8 the old-provider tests/snapshots must migrate to canonical-package tests or be deleted before the providers can die; a zero-consumer trace is mandatory. Active-lane artifacts remain blocked on Dan's lane-precedence ruling.

## Characterization baseline

`grid-origin-centre-baseline.test.ts` freezes eight comparison shapes (square, circle, pill, tall rectangle, wide rectangle, DUCK, BOT, BAT-WOMAN), one representative scale in each user band (48/96/144/192mm), and all nine centre policies. It records governed centre, exposed centre evidence, phase, and final anchor positions. Its committed snapshot is the accepted Centre-rules baseline. The defect allowlist starts empty; no difference may be absorbed silently.

## Other engine lane

`src/lib/grid-engine/**` remains owned by active branch `session62-task/s62-kai-lead-v3.2-rv-t3`. Current non-local consumers are the `/grid-engine` page and canvas; `grid-origin-compute.ts` also imports its geometry kernel. This sprint does not modify or delete that tree. Final disposition remains behind Dan's post-comparison lane-precedence/cut-over gate; `KEEP-AS-SECOND-GRID-ENGINE` is not an accepted final state.

## Performance-gate provenance

The 1.0s desktop, 2.0s physical-phone, 50ms main-thread and 128MB worker limits are provisional engineering gates authored by the R14 contract, not Dan-ruled product limits. T1b cannot begin until the desktop and physical production-floor phone are named and Dan ratifies or replaces this envelope. No result may be used to tune the limits after measurement.
