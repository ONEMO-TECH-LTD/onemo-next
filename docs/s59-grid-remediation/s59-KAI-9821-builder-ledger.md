# KAI-9821 builder ledger

## Authority and state

- Branch: `session59-task/kai-9821-constant-split`
- Base: `origin/staging` at `0dd107ae9cf489085d16be573f814b7e30f06753`
- Task body: read in full from the Brain-Linear relay.
- Standing constraint: `HOLD_REACH_MM = 48` remains flap/lift physics only. Other roles must derive from their own laws; equal aliases are forbidden.

## Hydration checklist

- [x] Read current `grid-core.ts` in full and relocate every `HOLD_REACH_MM` use.
- [x] Read current `grid.test.ts` in full before editing tests.
- [x] Read live `grid-laws.md` at SSOT main and the verbatim wrap/perimeter turns in `briefs.md`.
- [x] Read immediate imported authorities/callers for any changed role.
- [x] Re-read changed files in full after editing.

## Current source findings

- Current search found three role classes in `grid-core.ts`:
  - exported `HOLD_REACH_MM = 48`;
  - light-belt contour-depth classification;
  - exact perimeter coverage/ranking/runtime verdict.
- Current policy signature carries `holdReachMM` only.
- Line numbers in the Linear body are stale; all decisions will cite current-head sites.
- `exactPerimeterCoverage(contour, seated, radius)` builds the outer seated-anchor hull/capsule and
  expands it by the supplied radius; hole rims use radial discs of the same radius.
- Every current caller passes `HOLD_REACH_MM`, so placement ranking, runtime `flaps`, `uncoveredMM`,
  adaptive fit and publication acceptance all currently use the 48mm flap-physics radius as the
  support-envelope radius.
- Light-mode belt selection separately retains anchors with contour distance `< HOLD_REACH_MM` and
  drops anchors at `>= HOLD_REACH_MM`.
- `balancedPreparedFit` and auto fallback rank the resulting `uncoveredMM`; changing the coverage
  radius is output-affecting and therefore cache-identity relevant.
- The policy signature has only `holdReachMM`; any distinct derived role that affects output must be
  named there.

## Source ruling and minimal diff

Expert reconciled the collision from the existing law after the executed probe:

1. Coverage remains `HOLD_REACH_MM = 48`; coverage and flap/lift are one physical question under
   law 5.3, not two aliases.
2. Seating remains the 10mm fabric floor under laws 2.1/2.2.
3. At the time of this ruling, zero-point wrapping remained padding + frame = 11mm under law
   3.5/F5. Dan subsequently superseded that reading; see the final section. KAI-9821 does not touch it.
4. Light-rim membership is construction-population topology under law 4.5. No lawful numeric depth
   exists, so the `< HOLD_REACH_MM` discriminator is the defect.

Minimal diff:

- add one private population-boundary splitter using the pattern's exact lattice basis;
- replace the `< HOLD_REACH_MM` light-rim filter with that splitter;
- replace the obsolete distance-based regression with an executable topology regression;
- bump manual cache identity because delivered light populations change.

Necessity: no module, config, product constant, policy alias or UI change. Sufficiency: the one false
role is removed while coverage, seating and wrap sources remain untouched by this task.

## Law reconciliation and collision probe

- Live law 5.3: `HOLD_REACH_MM = 48` is flap/lift physics only.
- Live laws 2.1, 3.4 and the verbatim 13:02 ruling: each magnet owns a 10mm-radius safe spot;
  optimal geometric fabric wraps those spots edge-to-edge.
- Law 3.5/F5 at probe time: the canonical outer zero-point was padding + the 1mm frame = 11mm;
  subsequently superseded by Dan for the separate KAI-9844 sizing change.
- Live law 3.23: upward publication remainder is margin, never flap.
- Live law 4.5 defines Light as a perimeter belt, but supplies no numeric contour-depth threshold.
- Historical L82 says the support oracle measures outward protrusion from the seated safe-spot
  envelope, with zero geometric allowance and configured freeform auto-margin.

Executed 18 visible product constructions through `exactPerimeterCoverage` with unconditional count:

- Radius 48: zero gaps on all 18.
- Radius 10/11: square zero-points pass at 11 but not 10; every current circle, triangle and rotated
  diamond construction remains uncovered.
- Examples: circle S 72mm = 96 gap intervals / 226.15mm uncovered at radius 10 or 11;
  triangle S 136mm = 2 intervals / 236.18mm uncovered at radius 11.

This proves the split is product-consequential. It is not safe to choose a replacement numeric value
as a rename. Escalated two exact unresolved readings:

1. Outer manufactured contour: support envelope derives as padding + frame (11mm default); belt is
   population-boundary topology.
2. Inner fabric surface: support envelope is 10mm against a distinct inset contour; this requires a
   new surface-contour seam.

No source authorises an arbitrary numeric belt depth. The ruling therefore rejected both numeric
replacement options and selected population topology.

## RED → GREEN

RED at base `0dd107ae`:

- diamond-shape 128mm / Standard 48 / Light retained the centre `[64,64]` because its contour
  distance was less than 48mm, despite that node being enclosed by the lattice population;
- the focused regression failed on `expect(light).not.toContainEqual([64,64])`.

GREEN after the minimal diff:

- the centre is removed and the four population-rim nodes remain;
- triangle 290mm retains all three sloped-edge population-rim holders near
  `[97,132]`, `[145,228]`, `[193,132]`;
- focused law regression: 1 passed / 33 skipped;
- cache contract: 136/136 passed.

## Before/after construction table

Probe authority: immutable base worktree `qa-9817` at `0dd107ae` versus current `grid-lab`. The
probe executed 193 base constructions and 190 current constructions; 7 shape/density/mode
configurations moved. Format is `label:sizeMM/seated`.

| Configuration | Before | After |
|---|---|---|
| square / light / diamond 48 | `ONE:22/1 S:192/5 M:288/13` | `ONE:22/1` |
| square / light / diamond 96 | `ONE:22/1 S:288/5` | `ONE:22/1` |
| triangle / light / auto | `ONE:40/1 S:136/4 M:260/4` | `ONE:40/1 S:136/4 M:260/5` |
| triangle / light / standard 96 | `ONE:40/1 S:260/4` | `ONE:40/1 S:260/5` |
| triangle / light / diamond 48 | `ONE:40/1 S:136/3 M:260/6` | `ONE:40/1 S:136/3 M:260/7` |
| diamond-shape / light / auto | `ONE:32/1 S:80/2 M:128/5 L:176/8 XL:224/4 2XL:272/6` | `ONE:32/1 S:80/2 M:128/4 L:176/6 XL:224/4 2XL:272/6` |
| diamond-shape / light / standard 48 | `ONE:32/1 S:80/2 M:128/5 L:176/8 XL:224/4 2XL:272/6` | `ONE:32/1 S:80/2 M:128/4 L:176/6 XL:224/4 2XL:272/6` |

All standard-density configurations are byte-identical. The complete square Standard/Auto canon is
unchanged. Triangle 260 gains exact population coordinate `(1,1)`: it lacks one immediate basis-axis
neighbour and is therefore rim topology; the old 48mm contour-depth test wrongly classified it as
interior.

## Verification log

- Focused topology RED → GREEN: passed.
- Cache contract: 136/136 passed; cache version 6 → 7.
- Full `grid.test.ts`: first run named the intentional triangle count movement; expectation corrected
  from the measured construction, second run 34/34 passed.
- Lint: exit 0, 214 pre-existing warnings.
- Typecheck attempt was contaminated by the three disposable `output/kai-9821-*probe.ts` scripts;
  they are not product artifacts and will be deleted after their results are preserved here, then
  typecheck will be rerun.
- Disposable probes deleted after preservation; typecheck rerun: exit 0.
- Full suite: 458 passed / 10 skipped, 47 files passed / 1 skipped.
- Production build: exit 0; Next 16.2.6 webpack build compiled, typed and generated all routes.
- Device performance: exit 0, WebKit 26.0 — canonical circle ladder 245ms cold / 1ms warm,
  dense real-AI plan 73ms / 0ms, small square 35ms / 1ms; T1/T2 PASS on all three.
- Visual gate on exact product commit `f527031c19e74271bca0f5764649f7ac267b55eb`:
  - server PID 19834, cwd `grid-lab`, HTTP 200 on
    `http://localhost:3970/effect-creator/grid-lab`;
  - profiled Chrome was attempted first; Chrome, extension and native host all validated, but the
    control connection returned zero browsers after its required retry;
  - declared Playwright fallback observed Diamond-shape M 128mm on the real bench:
    Light = four rim magnets / no centre; Standard = five magnets / centre retained;
  - console: 2 messages total, 0 errors, 0 warnings;
  - captures:
    `output/playwright/kai-9821-population-rim-f527031.png` and
    `output/playwright/kai-9821-full-grid-f527031.png`.

## Subsequent Dan ruling — sizing work remains separate

Dan subsequently ruled that frameless base size is padding edge-to-padding edge and the frame becomes
a separate additive admin-set buffer. This supersedes the earlier 11mm-as-base reading and is owned
by KAI-9844 after its SSOT text lands. KAI-9821 remains belt-only and contains no new 10/11 sizing
logic: coverage stays HOLD 48 and rim membership stays population topology.
