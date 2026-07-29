# KAI-9790 builder ledger

## Authority

- Brain OS task body read in full on 2026-07-28.
- Product default: standard pattern + light density for every non-freeform source.
- Dice and diamond: explicit admin controls only.
- Freeform: generators and AI are confirmed; presets are measured before classification.
- Engine remains one neutral path. No shape-name branch or second admin algorithm.

## Hydration notes

- Full-read the 1,128-line neutral engine, its 98-line job facade, the worker client,
  the 481-line bench page, both panel files, the affected boundary/engine/source
  tests, the shape-library definitions, the live generator source, and `ERRORS.md`.
- The engine is already shape-neutral. `mode: 'auto'` searches standard, diamond,
  and dice; an explicit mode restricts that search. No engine change is needed to
  express the product rule.
- The page currently sends one `gridMode` to both ladder and plan. Its `Auto`
  setting is therefore the source of the product drift, not a second engine path.
- A reproducible measurement harness now lives at
  `scripts/grid-remediation/kai-9790-pattern-report.ts`. It uses the page's exact
  preset-contour pipeline, shape-specific standard ladders, square-reference preset
  ladders, both densities, the product's 12mm auto-margin, and the one-anchor
  boundary as a classified exclusion.

## Before measurement

- Circle / Auto / light reproduces:
  `130 -> dice`, `215 -> dice`, `303 -> dice`; `158`, `221`, and `226` remain
  standard. The task's earlier `303 -> diamond` figure is the `maxGrowMM: 0`
  diagnostic, not the live product default: at 12mm auto-margin it is dice.
- Circle Auto ladder:
  `23, 71, 90, 130, 158, 215, 221, 226, 303`.
- Circle Standard ladder:
  `23, 71, 90, 130, 158, 221, 226, 303`.
- Presets cannot honestly be classified as one evidence-clean source category
  under today's square-reference sizes:
  - preset square passes every multi-anchor standard rung at both densities;
  - the other sixteen presets have 1-8 `ok:false` / flap-bearing standard cases;
  - Auto improves some irregular presets but also makes preset circle choose dice
    at 118mm and 214mm, contradicting Dan's explicit circle law.
- The evidence therefore exposed a sequencing decision rather than authorising a
  silent taxonomy. Recommendation sent to Designer: presets remain curated /
  non-freeform; generators and AI are the sole freeform sources; current preset
  rung failures are explicit KAI-9791 size-law debt. Product code remains unchanged
  until that scope decision is confirmed.

## Live Dan-directed increment — gravity + grid-snap calibration

- Dan clarified the two-anchor selection law as gravity: when count, pitch,
  pattern, and grid extent are equal, greater top-to-bottom support beats a
  horizontal pair that leaves the long upper side unsupported.
- The engine now delays only that two-anchor rung within its unchanged extent.
  Measured blast radius: Triangle / Standard / 96 only, `S 135 -> 143`; its two
  anchors become vertical. All other sampled shapes, modes, and 48mm ladders are
  byte-unchanged.
- Dan then chose one snap toggle rather than a duplicate slider. The admin
  calibration surface now owns `Snap test size to grid` plus one test-size slider:
  off is continuous millimetres; on advances to the next engine-derived size.
  Exact sizes stay exact and values above the final rung clamp to it.
- Snap inputs are the active contour, pattern mode, and fixed/automatic pitch.
  Generator/AI use their real contour only while snapping is enabled, so ordinary
  continuous editing does not incur a shape-ladder solve.
- Live Playwright proof at `:3970`: raw Triangle 140mm / Standard / 96 snaps to
  143mm with the vertical two-anchor plan; the same raw value resolves to 183/205/
  206mm for Standard/Dice/Diamond at 48 and 143/205/223mm at 96. Both Light and
  Standard density resolve through the snapped size without changing the ladder.

## SSOT rehydration after the coverage-model correction

- Full-read the 961-line historical brief plus both promoted current canon files before another engine
  edit: `magnetic-grid-standard-brief.md`, `3.13-magnetic-grid-product-law.md`, and
  `7.6-magnetic-grid-manufacturing-standard.md`.
- Current authority is the promoted canon, not historical §§0–18. The live Dan clarification is newer
  but must be reconciled with, not overwrite, the promoted constants.
- `MAGGRID-REQ-004` and manufacturing §Constants and density pin two independent physical inputs:
  hard minimum centre padding = 10mm; maximum uncovered-edge hold reach = 48mm. Hold reach is not pitch
  and is not recalibrated.
- Historical §13.2 defines the square zero-point as padding coinciding edge-to-edge; §19.8 corrects the
  formula's universal overclaim and keeps the exhaustive solver authoritative for non-square contours.
  Therefore a catalogue zero-point is constructed from its grid population; it is not created by scanning
  arbitrary millimetres and it is not rejected because a radial 48mm check finds a between-anchor sliver
  on an already edge-registered zero-point.
- The 48mm radial flap/lift check remains the adaptive/freeform and protrusion-class verdict. The triangle
  tip remains a real failure. Interior points may not turn a geometric protrusion into a valid catalogue
  wrap.
- Hard padding is now two-sided by Dan's live addendum: no anchor may seat below 10mm; an optimal registered
  edge meets the padding floor rather than using the historical corner-tolerance exception. This requires
  explicit RED coverage before the tolerance path is removed.

## Parked-package fixes resumed on 2026-07-29

### KAI-9833 / KAI-9834 — gravity cleanup and interim publication stop

- `semanticSteps` no longer resolves a second, differently padded layout to measure gravity. The gravity
  span now comes from the exact anchor population the rung publishes.
- The historical Triangle 143mm vertical-pair pin was tolerance-dependent and conflicted with the newer
  coverage ruling. It is gone. Law 5.8 is pinned on the lawful Circle / Standard / 48 S rung instead:
  71mm, extent 70, two anchors, vertical span 48mm, zero gaps.
- Triangle Auto now publishes `ONE 39 / S 135 (4 anchors) / M 231 (9 anchors)`. Standard / 96 publishes
  `ONE 39 / S 260 (4 anchors)` and no unlawful two-anchor tier.
- Law 3.19 now gates scanner publication on zero uncovered intervals. This is explicitly an interim
  safety stop, not compliance with laws 3.1/3.2: the arbitrary-millimetre scanner remains characterized
  and the permanent population-derived solver is still an explicit `todo`.

### KAI-9825 / KAI-9826 — ring coverage and severity

- Exact coverage is ring-specific. The outer ring retains the supported-span envelope; every hole rim
  independently requires radial support from seated anchors.
- RED witness: a 310mm square with a 100mm central hole changed from false `0mm uncovered` to four
  unsupported hole-rim intervals / `400mm uncovered`.
- `GridResult` now carries `uncoveredMM`, the worker-cache validator requires it, and both Auto and
  balanced fallback rank physical unsupported length before anchor count.
- RED witness: Star 184 changed from Dice / 96 (`8` markers, `348.4416mm`) to Standard / 48
  (`10` markers, `128.7084mm`). Marker count no longer hides a much longer unsupported edge.

### KAI-9818 / KAI-9829 — categorical hard floor and one padding authority

- The floor test was observed RED before the cut: Triangle Auto/Standard-48 S135 seated at 9.402mm;
  Circle Standard-48 XL221 at 8.672mm; Circle 2XL263 at 9.115mm.
- Delivery and sizing now share the same hard validity rule. `PAD_CORNER_TOL_MM`,
  `RING_COVERAGE_MIN`, their rescue path, policy-signature fields, and the then-dead `strictPad`
  split are deleted. `DEFAULT_LAW.paddingMM` is sourced from `PADDING_FLOOR_MM`.
- Post-cut exhaustive probe: zero sub-10mm seats across four standard shapes × six mode/pitch
  combinations. The approved sharp-square Auto ladder remains
  `22, 70, 118, 166, 214, 262, 310` with the same populations.
- Full-suite falsification caught exact coverage outranking registration across Auto combinations.
  Registration now ranks before uncovered length within a conforming phase, and Auto continues past
  a first covered but unregistered combination when a covered registered combination exists. The
  complete reachable rectangle matrix and every canon square are registered again.
- Circle 166 remains an off-ladder diagnostic. Exact outer-wrap coverage changes its symmetric
  population from 8 to 4; the regression guard now pins its actual invariant (equal x/y axes) rather
  than an off-domain count. No customer circle rung was rebaselined by that test change.
- 70mm before/after:
  - sharp square: unchanged, four anchors at 11mm from the boundary;
  - shipped rounded/squircle geometry: before four anchors, minimum seat 9.117868mm; after two
    anchors, minimum seat 10.994296mm. The tolerance deletion is categorical; this movement is
    reported to Dan under law 2.2 rather than used to reopen it.

### KAI-9832 and delivered-label honesty

- Removed the customer-facing `Holds / Won't hold` verdict block from the shared canvas. Engine
  diagnostics, uncovered intervals, and calibration rendering remain available; they are no longer
  presented as a customer product choice.
- The product summary's tier population now comes from `model.grid.anchors.length`, the delivered
  plan, instead of `model.rung.points`, the independently solved ladder metadata. The size label
  remains ladder-owned; the displayed magnet population is now the construction actually rendered.
- Product size buttons now render only calibrated `visible` rungs. Untested rungs are neither moved
  nor duplicated; the admin test-size slider remains the calibration route for the full 22–310mm
  range. This removes the customer-reachable `2XL†` / `3XL†` state without removing calibration.
- The Square→Triangle flash is not absorbed into this batch. `planDesign` is intentionally independent
  of ladder metadata so KAI-9690 can paint the new non-rectangle shape before its ladder resolves.
  Suppressing that plan on `ladderState.pending` would delete the only preserved KAI-9690 behaviour,
  and producing a shape-only stage is not a trivial ordering fix. The explicit verdict is removed;
  the underlying solver/consumer identity mismatch remains owned by KAI-9823.

### Per-shape Auto verification at the pre-land head

- Every multi-anchor rung below is exact-coverage green and seats at or above the 10mm floor.
  Single-anchor `ONE` remains a classified, `ok:false` boundary owned by the minimum-two-anchor task.
- Square: `22/1`, `70/4`, `118/8`, `166/12`, `214/16`, `262/20`, `310/25`.
  Delivered Light populations are `1,4,4,12,8,12,12`; Standard populations are
  `1,4,9,16,25,36,49`.
- Circle: `23/1`, `71/2`, `119/4`, `174/8`, `215/9`, `263/14`.
  Delivered Light populations are `1,4,4,4,4,12`; Standard populations are `1,4,5,12,13,22`.
- Triangle: `39/1`, `135/4`, `231/9`. Delivered Light populations are `1,4,4`;
  Standard populations are `1,4,10`.
- Rotated diamond: `32/1`, `80/2`, `128/5`, `176/8`, `224/12`, `272/16`.
  Delivered Light populations are `1,2,4,4,4,4`; Standard populations are `1,2,5,8,13,18`.
- This is not a claim of laws 3.1/3.2 completion. Auto still selects Diamond/Quincunx for some
  non-freeform rungs and the ladder population can differ from the delivered construction. KAI-9823
  and the standard-light grid-first solver remain open. The product label now reports the delivered
  population instead of hiding that mismatch.

### Intentional device-performance re-baseline

- The current harness was run before editing its baseline and failed exactly on the changed circle
  ladder: T2 `FAIL`, raw SHA `c88186a8… -> 348cd151…`.
- Baselines now enumerate the real law-driven output:
  - circle ladder `23/71/90/130/158/215/221/226/303` ->
    `23/71/119/174/215/263`;
  - dense-plan raw SHA `f291088e… -> a3f1a99f…` with T2 geometry unchanged;
  - small-square raw SHA `455ae16f… -> 09cad563…` with T2 geometry unchanged.
- Re-run on real WebKit 26.0: all three scenarios direct-Worker byte-equal and T1/T2 PASS.
  Timings were circle `1035/1ms`, dense `109/1ms`, small square `29/1ms` cold/warm.

### Final builder gates

- Full suite: `46 passed / 1 skipped` files; `433 passed / 10 skipped / 1 todo` tests.
- Typecheck: exit 0. Lint: exit 0, 214 existing warnings and zero errors. Production build: exit 0.
- Device baseline guard: `5/5`. Device harness: all three T1/T2 PASS.
- Real-browser Worker oracle: PASS `6/6`, including holed-plan bytes, all-attachment seed hits,
  and physical pre-emption.
- Live visual: `http://localhost:3970/effect-creator/grid-lab`, grid-lab worktree at base
  `79ffb261` plus this package. Circle L 174 reached `ready`, rendered four Standard/96 magnets,
  and reported `size L · tier 4pt · seated 4`. No product verdict, no dagger tiers, no page or console
  errors. Screenshot: `output/playwright/kai-9817-preland-final.png`.
- Operational incident surfaced and resolved: running `next build` invalidated the same-tree dev
  server. The failed probe stayed at `resolving-grid`; restarting only `:3970` with
  `npx next dev -p 3970 --webpack` restored the live surface. `:3980` was untouched.

## KAI-9790 resumed — source-owned automatic pattern policy

### Authority and mechanism

- Re-read `grid-laws.md` (859 lines), `briefs.md` (1,409 lines), the complete neutral engine,
  page, panels, renderer, transport/cache callers, and affected suites before writing.
- Law 4.1: standard is the automatic product pattern; diamond and dice are explicit admin
  experiments. Generators and AI are the only freeform sources and retain the adaptive search.
- RED at staging `d8a3a26`: exactly 9/18 visible product rungs selected a non-standard pattern:
  `square/ONE/22`, `circle/ONE/23`, `circle/M/119`, `circle/XL/215`,
  `triangle/ONE/39`, `diamondShape/ONE/32`, `diamondShape/M/128`,
  `diamondShape/L/176`, `diamondShape/XL/224`.
- Root cause: `modeCombos('auto')` supplied standard + diamond + dice to every source. The engine
  had no input distinguishing curated product geometry from freeform.
- Correction: `GridPlanOptions.source` carries the already-existing source category into the neutral
  engine. `modeCombos` and `resolveGridPlan` restrict `std`/`preset` Auto to standard while
  `gen`/`magic` retain every legal pattern. Explicit manual diamond/dice remains unchanged.
  `semanticSteps` is untouched; KAI-9843 replaces it next.
- Source participates in ladder and plan cache identity; cache contract version advances 4 → 5.

### Before → after table

Each plan cell is `pattern/pitch/seated`; Light then Standard.

| Shape | Rung | Before | After |
|---|---|---|---|
| square | ONE 22/1 | diamond/48/1 · quincunx/96/1 | standard/48/1 · standard/96/1 |
| square | S 70/4 | standard/48/4 · standard/48/4 | unchanged |
| square | M 118/8 | standard/96/4 · standard/48/9 | unchanged |
| square | L 166/12 | standard/48/12 · standard/48/16 | unchanged |
| square | XL 214/16 | standard/96/8 · standard/48/25 | unchanged |
| circle | ONE 23/1 | diamond/48/1 · quincunx/96/1 | standard/48/1 · standard/96/1 |
| circle | M 119/4 | quincunx/96/4 · standard/48/5 | M 130/6 · standard/48/6 · standard/48/6 |
| circle | XL 215/9 | diamond/96/4 · standard/48/13 | XL 220/10 · standard/48/8 · standard/48/16 |
| triangle | ONE 39/1 | diamond/48/1 · quincunx/96/1 | standard/48/1 · standard/96/1 |
| diamond shape | ONE 32/1 | diamond/48/1 · quincunx/96/1 | standard/48/1 · standard/96/1 |
| diamond shape | M 128/5 | quincunx/96/4 · standard/48/5 | standard/48/5 · standard/48/5 |
| diamond shape | L 176/8 | quincunx/96/4 · standard/48/8 | standard/48/8 · standard/48/8 |
| diamond shape | XL 224/12 | diamond/96/4 · standard/48/13 | standard/48/12 · standard/48/13 |

- Unlisted visible rungs are byte/value unchanged in the audit.
- Final product-pattern result: **0/18 non-standard**, both densities measured.
- Square catalogue stays `22 · 70 · 118 · 166 · 214`; every shown square rung and population is
  unchanged. Circle M and XL re-derive because their prior sizes were certified by admin-only
  pattern populations.

### Necessity result

- KAI-9788 survives but drops below the product blocker: explicit admin `light + quincunx` still
  reaches the dead dice-full-grid exemption in `perimeterForDensity`; law 4.5 remains a separate
  engine correction.
- KAI-9819 is not built separately. The pattern-family half is fixed here, while the remaining
  rung/delivery construction identity is absorbed by KAI-9843, the grid-first solver.

### Executable evidence

- `scripts/grid-remediation/kai-9790-pattern-report.ts --verify` now fails loud unless the
  visible four-shape table is exactly 18 rungs and 0 use an admin-only automatic pattern.
- Mutation: restored the old all-pattern automatic set; the new regression failed with the exact
  original 9 offenders. Restored source policy returned green.
- Device baseline RED: the baseline guard rejected the old Circle Auto ladder at exactly the two
  re-derived rungs (`M 119/4 -> 130/6`, `XL 215/9 -> 220/10`). The intentional re-baseline changes
  only `canonical-ladder`, to SHA-256
  `9a54d89319c63fa7dd40ce5f164bcf46da4c5a521ade16d37d2279901555f161`;
  dense and small-square fixtures are unchanged.
- Real WebKit 26.0 device run: all three scenarios direct-Worker byte-equal and T1/T2 PASS.
  Cold/warm timings: Circle `624/0ms`, dense real-AI `70/1ms`, small square `32/0ms`.
- Real Chromium Worker oracle: PASS `6/6` — standard ladder, holed plan, explicit diamond ladder,
  signed-margin Velcro, all-attachment seed hits, and physical pre-emption.
- Full Vitest: 47 files passed / 1 skipped; 454 passed / 10 skipped / 1 explicit law-3.1 todo.
  Typecheck exit 0. Lint exit 0 with 214 pre-existing warnings and zero errors. Production build
  exit 0. `git diff --check` clean.

### Live visual at the working tree

- `http://localhost:3970/effect-creator/grid-lab` served from the grid-lab worktree at staging
  `d8a3a26` plus this bounded delta; HTTP 200 before and after the production build.
- Product Auto observations: Circle M `130mm / standard / 6 seated`; Circle XL
  `220mm / standard / 8 seated`; Triangle M `231mm / standard / 5 seated`; rotated-diamond XL
  `224mm / standard / 12 seated`.
- Explicit admin Diamond remains live: rotated-diamond 224mm resolved Diamond/96 with 4 seated.
  Generator Blob Auto remained adaptive and selected Dice-5/96 with 4 seated.
- Screenshots:
  `output/playwright/kai-9790-product-auto-standard.png` and
  `output/playwright/kai-9790-freeform-auto-adaptive.png`. `output/` remains disposable and
  untracked; the executable audit and all acceptance assertions are tracked.
