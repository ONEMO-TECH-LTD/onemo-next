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

| Body | Source lines | Disposition | Body SHA-256 | Proof |
|---|---:|---|---|---|
| `governMass` | `grid-origin-logic.ts:51-68` | ADAPT representation only | `f9c2a1e6a091a710f15348d39aa7a507662f2065956a9466147e4c10a9e0525e` | all nine-policy characterization; identical branch decisions required |
| `centeringAnchors` | `grid-origin-logic.ts:75-105` | ADAPT accepted policy behavior; DELETE mesh-derived ruler | `552b359e8e549262bb89d42a943a0dc155459b2f38f39b37667c2f109211c46c` | all nine-policy characterization; only named ruler defects may differ |
| `parityHolds` | `grid-origin.ts:134-143` | ADAPT/RE-ROOM | `bea5685bb4bdc1f351e3f1f32f1c69d09cf2bc7f629816a4ba357a8aba2203e0` | node/gap parity fixture |
| Centre-rules four placements and ranking | `grid-origin.ts:190-220` | ADAPT/RE-ROOM | `df311380469ea8f0b93c60b20b391ef22c76298e9b932005cc7fc61a123c9b1b` | pre-room/post-room characterization equality |
| `bbox` | `grid-origin-compute.ts:16-24` | MOVE-BODY | `64e353985eca429749f422857314fa428eb9faac5f3691b5500b4d50c671cfbd` | current primitive fixture unchanged |
| `latticeAt` | `grid-origin-compute.ts:46-65` | MOVE-BODY | `5ac8a286b8cd3f497f353b84375813a77302e33da6202291a2228aad9c76ac02` | current primitive fixture unchanged |
| segment seat predicate | `grid-origin-compute.ts:182-236` | ADAPT into exact neutral kernel | `97cc15c6f42fccb8c0646ae7e15a0997ebf40a5d37320a51d7d43ed1c52caf4c` | equivalence on accepted non-defect cases; exact boundary owns differences |
| `centroidOf` | `grid-origin-compute.ts:540-558` | MOVE-BODY | `1236d29cb8f2924badec11077bda11a728d0e7da34214b01fb50698d781f2427` | current primitive fixture unchanged |
| `scaleContour` | `grid-origin-compute.ts:583-600` | MOVE-BODY | `e04e9f1a41a448ae209b7c0d805097e3a5fe90eb59832da3cd93c1d9135a052f` | current primitive fixture unchanged |

Every other tracked body is classified by the contract's untangle table. In particular: `safeSegments` is ADAPT then old mesh DELETE; `splitPerimeter` is ADAPT measurement/policy separation; `assignSizes` is ADAPT measurement/policy separation; old in-place Law walk/ranking is fixture donor only; `panMM`, `bestKx`, `bestKy`, tolerance gates, decimation constants, scoring, worker duplication, and comparator persistence are DELETE-LATER after Dan's comparison gate.

## Characterization baseline

`grid-origin-centre-baseline.test.ts` freezes eight comparison shapes (square, circle, pill, tall rectangle, wide rectangle, DUCK, BOT, BAT-WOMAN), one representative scale in each user band (48/96/144/192mm), and all nine centre policies. It records governed centre, exposed centre evidence, phase, and final anchor positions. Its committed snapshot is the accepted Centre-rules baseline. The defect allowlist starts empty; no difference may be absorbed silently.

## Other engine lane

`src/lib/grid-engine/**` remains owned by active branch `session62-task/s62-kai-lead-v3.2-rv-t3`. Current non-local consumers are the `/grid-engine` page and canvas; `grid-origin-compute.ts` also imports its geometry kernel. This sprint does not modify or delete that tree. Final disposition remains behind Dan's post-comparison lane-precedence/cut-over gate; `KEEP-AS-SECOND-GRID-ENGINE` is not an accepted final state.

## Performance-gate provenance

The 1.0s desktop, 2.0s physical-phone, 50ms main-thread and 128MB worker limits are provisional engineering gates authored by the R14 contract, not Dan-ruled product limits. T1b cannot begin until the desktop and physical production-floor phone are named and Dan ratifies or replaces this envelope. No result may be used to tune the limits after measurement.
