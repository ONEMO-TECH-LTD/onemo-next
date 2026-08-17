# KAI-10285 independent de-slop review — corrected execution list

Date: 2026-08-12
Reviewed snapshot: `c4f17f47f7f12c6f0c958699cd158619c07eb970` (local HEAD = upstream)
Reviewed sweep: SHA-256 `c2e4fbab5b4498ef0abd30f0d1c83287905c01cb71e9efb50b586383935ec9b2`, 83 lines
Disposition: **REVISE** the proposed sweep before execution.

## Governing boundary

Dan's direct test and acceptance of this snapshot as the current golden state supersedes the stale KAI-10285 normalization/seam prose. Direct Paint subtraction is accepted behavior. This review authorizes hygiene only; it does not reopen Paint architecture or product semantics.

The package is private (`package.json` has no export map). Public-risk checks still include internal barrels, the portable closure contract, and shared Creator/manufacturing callers.

## Verdict

**Necessity — shrink.** Remove the proposed tick/public-seam collapse, wheel-range change, OutlineDocument public-type collapse, `EFFECT_TYPES` collapse, two `ShapeBuildConfig` field removals, `eruda` deletion, UI-copy change, and architecture work. None belongs in a locked dead-code-only pass. Remove the approximate deletion-line claim. Do not change golden Paint subtraction or any other runtime behavior.

**Sufficiency — partial until corrected.** The sweep missed dead `simplifyPaper`, a failing stale characterization assertion, and two omitted closure metadata members. The corrected list below covers the locked dead/duplicate/stale perimeter only.

## Corrected minimal execution kill-list

### 1. Delete direct residue

- In `flow.ts`, remove the unused `acceptMask` option `erase` and its three call arguments. The function never reads it.
- In `CutoutStudio.tsx`, collapse only the identical brush-radius ternary.
- In `ui-config.ts`, delete only `CHIP_RANGE.straighten` and `.curve`. Keep the engine operations and per-node `nodeCurve`.
- In `outline-resolve.ts`, delete zero-caller `smoothFactor` and the unused `simplifyPaper` import.
- In `paper-kernel.ts`, delete zero-production-caller `roundShapePaper` and `simplifyPaper`, plus only their test-only assertions/imports. Keep `roundCornersPaper` and `smoothPaper`.
- Delete `scripts/cutout-lab-verify.mjs`. `package.json` already calls the preservation oracle directly; only the closure test enumeration retains the wrapper.
- Repair the `mask-tools` boolean comment: Paint add may polish the combined mask; Paint erase is direct subtraction.

Tracked-tree proof: every symbol above has only its definition, dead import, test-only assertion, or generated-list reference. `paper-kernel` is not exported by the `vector-core` public barrel.

### 2. Delete the retired fairing cemetery as one reviewed material change

- From `outline-core/resolver.ts`, delete `catmullRomClosed`, `turnDeg`, `FairTracedRingOpts`, `BEN_DEFAULT_DETAIL`, `fairingFromDetail`, and `fairTracedRing`.
- Remove their exports from `outline-core/index.ts` and `math.ts`.
- Delete `outline-core/__tests__/fair-freeze.test.ts` and `effect/__tests__/geometry-truth.legacy.ts`.
- Delete only legacy-fixture consumers: the legacy section/imports/helpers in `geometry-truth.test.ts`, and the full legacy-only `corner-integrity`, `crop-corner-default`, `upload-fit-repro`, and `watertight-fit` tests. Preserve the live contour, cuttability, hash, RDP, resample, validation, repair, Paper, and Clipper tests.

Tracked-tree proof: all fairing/catmull consumers are the retired fixture/tests or barrels. `resampleClosedUniform`, `rdpClosed`, `normalizeRing`, `validateSelfIntersection`, `repairSimplePolygon`, `signedArea`, and hashing retain production/shared callers.

### 3. Restore only literal proof/closure truth after the deletions

- Update the existing stale literals in `verify-cutout-v1-grabcut.mjs` to the already-accepted snapshot: edge finish `12`, Cutout default `CLASSIC`, first-Paint `CUSTOM` with visible `0/0/15/0/0`, and affected frozen hashes. No oracle redesign or new behavior proof.
- Fix `cutout-v1-characterization.test.ts` from edge finish `8` to `12`. This is a currently failing tracked oracle, not optional cleanup.
- Make closure metadata describe the existing returned API by adding live `actions.selectOutlineSource` and top-level `measureNode`; retain both ticks. Regenerate `closure.generated.json` after deletions. Current read-only recomputation finds four already-stale source entries, actual source bytes `336831`, and pre-cleanup closure hash `6509728f16316c0cff57f840164f490e256d72bdeb0dfe57622ebf8189266119`.

## Explicit KEEP / no-edit boundary

- Direct Paint subtraction and current first-Paint `CUSTOM 0/0/15/0/0` behavior.
- Current wheel range behavior; `shapeTick`/`histTick`, their existing public/test seam, and the existing flow oracle. Removing or redesigning them is outside the dead-only lock.
- Existing `outline-core` public types, CutoutLabMount copy, and architecture documents. No public-contract or documentation programme in this pass.
- `EFFECT_TYPES`: canonical taxonomy data with live type consumers; no non-type import proves runtime bundle cost.
- `ShapeBuildConfig.minCornerAngleDeg` and `.cornerRadiusMM`: removing them changes `EFFECT_BUILD_CONFIG`, which feeds the planned manufacturing payload `config_hash`. That is a migration, not hygiene.
- `?debug=1` / `eruda`: conditionally live route behavior, sole direct caller, and pinned by a characterization test. Absence from automated oracles is not proof that the manual diagnostic is dead.
- `paper`, `paperjs-round-corners`, Clipper2, `bakeStickerEngine`, local tracer `signedArea`/`dedup`, `?admin=1`, payload, persistence, attachment, and sizes.

## Execution gates

1. Material deletion receives the deletion approval required by the execution lane; no delete is implied by this QA record.
2. Typecheck, focused lint, existing tests/build, closure generation, and existing Cutout browser oracles must pass on the edited tree. No new proof or product behavior change.

## Review evidence

- Full focused run at the golden snapshot: 79 tests passed; one failed only because `cutout-v1-characterization.test.ts` still expects `edgeFinishPx: 8`.
- `npm run typecheck`: pass.
- Focused ESLint: zero errors; the sole warning is the missed unused `simplifyPaper` import included above.
- No product source, Builder report, existing QA record, or Linear state was changed by this review.
