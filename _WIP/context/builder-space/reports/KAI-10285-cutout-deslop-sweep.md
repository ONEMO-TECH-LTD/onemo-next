# Cutout Lab whole-build de-slop sweep

Date: 2026-08-12
Mode: `/o-deslop --sweep` (read-only; no candidate deleted)
Golden snapshot: `c4f17f47f7f12c6f0c958699cd158619c07eb970`
Scope: `/cutout-lab` route and mount, 40-file portable closure, Cutout browser oracles, package dependencies, and repo-wide production callers of shared geometry.

## Verdict

Necessity: the proposed list separates direct residue from shared/material deletions. Nothing outside a source-proven zero-reference, stale-proof, duplicate-wrapper, or truth-mismatch class is proposed for removal.

Sufficiency: the sweep covers the complete current Cutout package closure and its route/proof/dependency perimeter. It does not claim to de-slop unrelated ONEMO product areas.

The golden behavior remains untouched. The build contains small safe residue, stale generated/proof artifacts, and one material retired geometry cemetery kept alive only by legacy tests.

## KILL — direct residue

1. `src/components/cutout-studio/flow.ts:322,431,609,637` — unused `acceptMask` option `erase` and three dead arguments. `acceptMask` never reads the field.
2. `src/components/cutout-studio/CutoutStudio.tsx:196-198` — identical conditional branches; both return `brushRef.current / 2`.
3. `src/components/cutout-studio/ui-config.ts:13-14` — `CHIP_RANGE.straighten` and `.curve` remain after both chips were removed from `VEC_CHIPS`; no dynamic consumer reaches either entry. Engine operations stay.
4. `src/lib/effect/outline-resolve.ts:86` — exported `smoothFactor` has zero repository callers.
5. `src/lib/vector-core/paper-kernel.ts:126-129` — exported `roundShapePaper` has zero code callers; `roundCornersPaper` is the live radius path.
6. `scripts/cutout-lab-verify.mjs` — three-line duplicate wrapper around the preservation oracle. No package script or code caller; only the closure generator and stale manifest list it.

## REPAIR — current truth is stale or contradictory

1. `src/components/cutout-studio/CutoutStudio.tsx:446` — mouse-wheel brush control still permits `1..120`, while the one visible approved range is `2..50`. Route wheel input bypasses the displayed owner.
2. `src/components/cutout-studio/closure.generated.json` — generated closure is stale at the golden snapshot. Four recorded source hashes/byte counts differ from disk: `CutoutStudio.tsx`, `finish.ts`, `flow.ts`, and `mask-tools/index.ts`. Regenerate after an approved cleanup, not during the sweep.
3. `scripts/verify-cutout-v1-grabcut.mjs:240,255,325,340,354,370,393,490,497` — browser oracle encodes superseded values: edge finish `8`, public default `PURE`, and first-Paint named `ZERO 0/0/0/0/0`. Golden source currently exposes edge `12`, Cutout `CLASSIC`, and Paint custom `0/0/15/0/0`. The oracle must be reconciled to the owner-approved golden behavior before it is trusted again.
4. `src/lib/mask-tools/index.ts:82-84` — comment says subtract results re-enter smoothing, but golden erase is deliberately direct subtraction without whole-mask smoothing.
5. `src/app/(dev)/cutout-lab/CutoutLabMount.tsx:81` — admin copy says Mask smoothing recalculates an erase stroke. Golden direct-inverse erase ignores Mask smoothing by design; Autotune still shapes the eraser swath.
6. `src/app/(dev)/effect-creator/v5.3.1/ARCHITECTURE.md:186,189,283,285` — calls zero-production-reference fairing functions “all live,” claims `outline-core/types.ts` has no document-model residue although most of that file is exactly retired document types, and describes the legacy trace fit as retained test-only. The document must match the code disposition.
7. `src/app/(dev)/effect-creator/v5.3.1/ARCHITECTURE.md:170-171` — calls manufacturing payload/persistence dormant. Dan has explicitly ruled manufacturing is planned product work, not dead product intent. Clarify wiring status without classifying the capability as discarded.

## COLLAPSE — test/debug plumbing exposed as product API

1. `shapeTick` and `histTick` are React revision counters exposed in the portable flow state. `shapeTick >= 0` is always true; `histTick` is leaked into `<h1 data-hist>` only for `verify-cutout-v1-flow.mjs`. Keep internal rerender triggers, rewrite the oracle around real Undo/Redo settlement, then remove both from the public package contract and generated API list.
2. `src/lib/effect/effect-types.ts` exports a runtime `EFFECT_TYPES` registry with zero runtime callers; only the derived `EffectType` is used. Collapse to the smallest type source only after checking whether this exported registry is intentionally public to external package consumers.
3. `ShapeBuildConfig.minCornerAngleDeg` and `.cornerRadiusMM` are documented and source-proven unused. Internal callers spread the canonical config, but the exported config type is shared. Remove only in a reviewed shared-API cleanup, not a Cutout-only edit.

## MATERIAL KILL-LIST — explicit approval required

### Retired trace/fairing cemetery

The active product creates a raw marching-squares polygon and resolves it through the Paper/Clipper vector system. The prior fair-and-Schneider trace pipeline has zero production callers; its only callers are a quarantined legacy fixture and tests of that fixture.

Proposed removal:

- `src/lib/outline-core/resolver.ts:107-140` — unused `catmullRomClosed`.
- `src/lib/outline-core/resolver.ts:224-481` — `turnDeg`, `FairTracedRingOpts`, `BEN_DEFAULT_DETAIL`, `fairingFromDetail`, `fairTracedRing`.
- corresponding exports in `src/lib/outline-core/index.ts` and `math.ts`.
- `src/lib/outline-core/__tests__/fair-freeze.test.ts`.
- `src/lib/effect/__tests__/geometry-truth.legacy.ts` and legacy-only portions/callers in `geometry-truth.test.ts`, `corner-integrity.test.ts`, `crop-corner-default.test.ts`, `upload-fit-repro.test.ts`, and `watertight-fit.test.ts`.

Evidence: repo-wide production trace finds no callers outside definitions/barrels. The test-only fixture declares itself retired and warns not to wire it back. Approximate cemetery size is 679 lines before removing associated imports/comments.

### Retired OutlineDocument type residue

`src/lib/outline-core/types.ts` still defines `ArcLengthRangePx`, `CornerSpec`, `SegmentConfidence`, `OutlineSegment`, `OutlineNode`, and the full `OutlineRing` document union. None has a production caller except using `OutlineRing['role']` as a two-value type. `GeometryLocator` exposes three variants while the only producer returns `arc_length_range`.

Proposed collapse: retain `Vec2Px`; replace the role and self-intersection result with minimal live types local to the actual API; delete the retired document types. This is architecture-bearing shared code and therefore belongs in the reviewed material pass.

### Route debug residue

`src/app/(dev)/cutout-lab/page.tsx:11` dynamically loads `eruda` only for `?debug=1`. It is the sole code import, adds a direct dependency (~1.9 MB installed), and the portable product boundary explicitly excludes it. Proposed removal: query branch, dependency/lock closure, and characterization assertion. Keep `?admin=1`; it remains the active calibration surface.

## KEEP

- Direct Paint subtraction in the golden snapshot. It is the owner-tested inverse brush; no topology/healing/parallel erase path remains.
- `paper`, `paperjs-round-corners`, and Clipper2. All back live shared Vector operations.
- `bakeStickerEngine`. It is the legitimate Cutout crop/coordinate adapter around the shared compositor.
- One local `signedArea`/`dedup` inside the marching-squares tracer. Small duplication keeps the tracer pure and independent; collapsing it yields no meaningful reduction.
- Admin calibration route and `?admin=1`.
- Manufacturing payload/persistence code as planned capability; its current wiring status should be documented truthfully, not used as a deletion rationale.

## Suggested execution order

1. Safe residue + proof/manifest repairs in one small snapshot.
2. Retired trace/fairing and OutlineDocument cemetery as one reviewed deletion snapshot.
3. Route `eruda` deletion as a separate dependency snapshot.
4. Rebuild, full tests, browser oracles, current live visual check after every snapshot.

No cleanup has been applied. `_WIP`, QA evidence, screenshots, and unrelated dirty paths were not touched.
