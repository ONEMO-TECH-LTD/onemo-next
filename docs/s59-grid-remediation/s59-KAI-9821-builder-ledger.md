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
  subsequently superseded by Dan for the separate KAI-9845 sizing change.
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

## QA rework — density may thin one construction, never select a 24mm-shifted phase

Designer falsified the first handoff at Diamond-shape 128mm:

- base Light and Standard were the same five-node cross;
- first implementation removed the centre but re-solved Light onto the four-node box at
  `[40,40] [40,88] [88,40] [88,88]`;
- the resulting Light phase was shifted 24mm from Standard.

The builder's first 12-case attribution claimed this case was unchanged. That claim was false and
was withdrawn immediately. The corrected isolated probe imports the immutable pre-rework module
graph directly and prints an unconditional comparison count.

Dan ruled the ambiguity: 24mm is the cancelled old atom and must not re-enter through a density
phase shift.

RED:

- strengthened the existing regression so every Light rim anchor must be a point in the Standard
  population;
- focused run failed at `[40,40]`;
- four rim-anchor comparisons were executed.

Rejected attempt:

- deleting the half-pitch candidate globally was too broad;
- it removed four lawful product rungs: visible Auto rungs `18 → 15`, rounded-square 70mm
  `4 → 2`, the lawful Circle two-anchor gravity tier disappeared, and the Circle ladder lost 3XL;
- this proved the candidate itself is used to reach legal registered phases. The defect was density
  re-solving after thinning, not the existence of the candidate.

Final minimal correction:

- score conformance, registration, coverage, extent, population count and balance on the legal
  construction population;
- deliver the population-boundary/thinned subset only after that phase is selected;
- no shape branch, new constant, alternate solver or UI path.

GREEN:

- Diamond-shape 128 Light is Standard's same cross minus centre:
  `[16,64] [64,16] [64,112] [112,64]`;
- Circle 224 and Diamond-shape 224 Light also inherit Standard's phase instead of their former
  24mm-shifted phases;
- direct attribution: 6/6 comparisons executed;
- regression sweep: four shapes and every delivered Light anchor compared against its Standard
  population; four cases and a non-zero anchor count execute.

Final staging-to-current movement, all under Light; every Standard-density configuration is
unchanged:

| Configuration | Staging | Final |
|---|---|---|
| square / standard 48 | XL `214/10`, 3XL origin `[11,35]` | XL `214/8`, 3XL origin `[11,11]` |
| square / diamond 48 | `ONE:22/1 S:192/5 M:288/13` | `ONE:22/1 S:118/4 M:214/8 L:310/12` |
| square / diamond 96 | `ONE:22/1 S:288/5` | `ONE:22/1 S:214/4` |
| circle / auto | XL `224/4` | XL `216/4` |
| circle / standard 48 | M `130/6` | M `120/4` |
| circle / standard 96 | M `224/4` | M `216/4` |
| triangle / auto | M `260/4` | M `260/5` |
| triangle / standard 96 | S `260/4` | S `260/5` |
| triangle / diamond 48 | M `260/6` | M `260/7` |
| diamond-shape / auto | M `128/5`, L `176/8` | M `128/4`, L `176/6` |
| diamond-shape / standard 48 | M `128/5`, L `176/8` | M `128/4`, L `176/6` |

The derived circle and admin-diamond size movements are not silent re-baselines: they are the first
covered constructions when density cannot buy a different phase. The square Standard 48 physical
sizes remain unchanged in this task. KAI-9845 separately supersedes those sizes with the frameless
padding-to-padding law.

Final rework gates:

- focused phase/topology regression: 1 passed / 33 skipped;
- complete grid law file: 34/34;
- edge-registration + device baseline + grid: 47/47;
- full suite: 458 passed / 10 intentionally skipped, 47 files passed / 1 intentionally skipped;
- typecheck: exit 0;
- lint: exit 0, 214 pre-existing warnings;
- device performance: exit 0, WebKit 26.0 — canonical circle 263ms cold / 1ms warm,
  dense real-AI plan 79ms / 17ms, small square 39ms / 1ms; T1/T2 PASS on all three;
- rectangle registration improved from two ONE-axis exceptions to zero across the 84-plan matrix;
- canonical circle performance fixture intentionally re-baselined:
  XL `224 → 216`, hash `f3135936… → 881dc1be…`;
- `git diff --check`: clean;
- full post-edit reads completed for all five changed files; no stale final-layout ranking claim
  remains in the changed engine block.

## Subsequent Dan ruling — sizing work remains separate

Dan subsequently ruled that frameless base size is padding edge-to-padding edge and the frame becomes
a separate additive admin-set buffer. This supersedes the earlier 11mm-as-base reading and is owned
by KAI-9845 after its SSOT text landed. KAI-9821 contains no new 10/11 sizing
logic: coverage stays HOLD 48 and rim membership stays population topology.

## Final runtime proof — phase inheritance rework

Product commit: `1af1f839ab63ac314057a214746598f764a477fd`.

- A clean detached worktree at that exact commit completed
  `npm run build -- --webpack`: compilation, type checking and all 20 static routes passed.
- The real bench ran on `http://localhost:3970/effect-creator/grid-lab` from PID 19834,
  whose cwd was this `grid-lab` worktree at the exact product commit.
- Chrome control had already failed its required retry, so the declared Playwright fallback
  exercised the live page.
- Diamond-shape M 128mm:
  - Light rendered exactly four outer cross nodes:
    `[16,64] [64,16] [64,112] [112,64]`;
  - Standard rendered those same four nodes plus centre `[64,64]`;
  - therefore density changed only delivery membership and did not select another phase.
- Circle XL rendered 216mm, tier 4pt / seated 4, confirming the disclosed `224 → 216`
  derived catalogue consequence on the user-visible surface.
- Browser console: 2 total messages, 0 errors, 0 warnings.
- Captures:
  - `output/playwright/kai-9821-population-phase-final-1af1f83.png`;
  - `output/playwright/kai-9821-standard-phase-final-1af1f83.png`.

Necessity: no new numeric policy, shape branch, solver, or UI path. The final rework changes only
which already-legal population is scored and then thinned.

Sufficiency: Light and Standard now inherit one construction phase, Light is population-boundary
only for every pattern, the cancelled 24mm atom cannot re-enter through density selection, and all
named code, regression, performance, production-build and visual gates executed.

## Meta rework — hidden rungs and every-pattern Light

Meta falsified the preceding final claim on hidden Diamond-shape 272mm. The visible-rung sweep had
executed 18 comparisons, but the hidden rung still let Light independently choose Standard/96 at
phase 40 while Standard chose Standard/48 at phase 16. Light was not a subset of Standard.

The rework probe printed its launcher witness before any result and then executed:

- 23 matched Auto extents: 15 density-dependent constructions before the fix, 0 after;
- 97 all-shape/all-mode/all-pitch rung comparisons: every Light and Standard rung now carries the
  same label, size, extent, visibility and parent construction;
- 97 Standard-delivery counts and 97 Light-delivery counts: every advertised `points` value equals
  its own delivered anchor count;
- 49 ordered rectangle pairs: 0 density-dependent constructions; Standard equals
  each full parent population and Light is its rim/thinned subset;
- 3 explicit freeform pattern comparisons: Standard, Diamond and Dice Light are all subsets of their
  full population and retain no enclosed interior node.

The original construction-delivery seam bypassed `finalize`, so storing one full construction could
not produce two densities. The minimal correction:

1. catalogue construction selection is density-neutral and 48-first;
2. each rung stores that full parent construction;
3. rectangle construction composes the same density-neutral parent from its two axis rungs;
4. exact-construction delivery validates the parent, then the existing finalizer keeps all nodes for
   Standard or derives the population rim/thinning for Light;
5. the Dice/quincunx full-grid exemptions are deleted both at density policy and engine delivery.

No second solver, mode branch, shape branch, state, policy constant or UI path was added.

### Auto before/after, exact head comparison

Authority: detached `qa-9817` at `59028ad` versus the working tree. Eight ladders and 46 rungs
executed on each side. Format is `label:size/advertised@extent,pitch`.

| Shape / density | Before | After |
|---|---|---|
| Square / Standard | `ONE:22/1@22,p48 S:70/4@70,p48 M:118/9@118,p48 L:166/16@166,p48 XL:214/25@214,p48 2XL:262/36@262,p48 3XL:310/49@310,p48` | unchanged |
| Square / Light | `ONE:22/1@22,p48 S:70/4@70,p48 M:118/4@118,p96 L:166/12@166,p48 XL:214/8@214,p96 2XL:262/12@262,p48 3XL:310/12@310,p96` | `ONE:22/1@22,p48 S:70/4@70,p48 M:118/8@118,p48 L:166/12@166,p48 XL:214/8@214,p48 2XL:262/12@262,p48 3XL:310/12@310,p48` |
| Circle / Standard | `ONE:24/1@22,p48 S:72/2@70,p48 M:120/5@118,p48 L:168/8@166,p48 XL:216/13@214,p48 2XL:262/18@262,p48 3XL:310/29@310,p48` | unchanged |
| Circle / Light | `ONE:24/1@22,p48 S:72/2@70,p48 M:158/4@118,p96 L:168/6@166,p48 XL:216/4@214,p96 2XL:262/6@262,p48 3XL:310/16@310,p48` | `ONE:24/1@22,p48 S:72/2@70,p48 M:120/4@118,p48 L:168/6@166,p48 XL:216/4@214,p48 2XL:262/6@262,p48 3XL:310/16@310,p48` |
| Triangle / Standard | `ONE:40/1@22,p48 S:136/4@118,p48 M:232/10@214,p48` | unchanged |
| Triangle / Light | `ONE:40/1@22,p48 S:136/4@118,p48 M:260/5@214,p96` | `ONE:40/1@22,p48 S:136/4@118,p48 M:232/5@214,p48` |
| Diamond-shape / Standard | `ONE:32/1@22,p48 S:80/2@70,p48 M:128/5@118,p48 L:176/8@166,p48 XL:224/13@214,p48 2XL:272/18@262,p48` | unchanged |
| Diamond-shape / Light | `ONE:32/1@22,p48 S:80/2@70,p48 M:128/4@118,p48 L:176/6@166,p48 XL:224/4@214,p96 2XL:272/6@262,p48` | `ONE:32/1@22,p48 S:80/2@70,p48 M:128/4@118,p48 L:176/6@166,p48 XL:224/4@214,p48 2XL:272/6@262,p48` |

### KAI-9788 consequence measurement

At 310mm, explicit freeform Light delivery yields:

- Standard/48: 12 rim anchors;
- Diamond/48: 12 rim anchors;
- Dice/96: 18 rim anchors.

Dice without its enclosed centres is still distinguishable from the plain Standard rim, so law 4.5
strips the Dice interior rather than removing explicit Dice from Light. All three sets are subsets of
their Standard-density parent population.

### Rework verification checkpoint

- RED: 36 focused tests, 2 failed — density-dependent Auto construction and Dice interior retention.
- GREEN: grid law 35/35.
- Cache identity: 7 → 8; performance/cache contract 136/136.
- Typecheck: exit 0.
- Full-suite first run: 458 passed / 10 skipped / 1 intentional baseline RED.
  `canonical-ladder` changed only at Circle M (`158 → 120`) and its fixture hash
  (`881dc1be… → f6b02654…`), matching the enumerated Auto table above; baseline updated explicitly.
- Device performance after the explicit baseline update: exit 0, WebKit 26.0;
  canonical circle 70ms cold / 0ms warm, dense real-AI 77ms / 1ms, small square
  37ms / 1ms; T1/T2 PASS on all three.
- Full suite after the baseline update: 459 passed / 10 intentionally skipped;
  47 files passed / 1 intentionally skipped.
- Lint: full repo exit 0; the first run exposed one new unused-parameter warning,
  removed before handoff; changed-file lint then exited 0 with zero warnings.

Necessity: no unnecessary element; the change reuses the existing construction, population-boundary
and finalization seams.

Sufficiency: the shared parent construction closes hidden and visible phase drift; density-specific
advertised counts remain truthful; every pattern/source inherits rim-only Light; the measured Dice
consequence is decided rather than assumed.

### Final sufficiency and deslop audit

- Rectangle construction no longer accepts a density input; its API structurally prevents a second
  density-specific solve. All 49 ordered rung pairs execute through one construction.
- Deleted: both Dice-full exemptions, the construction-delivery bypass around `finalize`, the
  density-specific rectangle pitch order and the duplicate construction-identity regression.
- Retained deliberately: `allowedPitches(light)` in the adaptive freeform/off-rung solver (law 4.7);
  the outer hull coverage implementation for the separately ordered KAI-9851 slice; existing
  padding/frame arithmetic owned by KAI-9845. None is part of this density-construction change.
- Search found zero remaining pattern-specific Light/full-grid exemption and zero unused
  density parameter on the rectangle constructor.
- Post-subtraction gates: grid law 35/35; cache/performance contract 136/136; full suite
  459 passed / 10 intentionally skipped; typecheck exit 0; changed-file lint exit 0; full-repo lint
  exit 0 with 214 pre-existing warnings; `git diff --check` clean.
- Final device run: WebKit 26.0, canonical 117ms/1ms, dense 82ms/1ms, small 37ms/0ms;
  T1/T2 PASS on all three.
- Full post-edit read completed for all five changed files after the rectangle correction and
  subtraction pass.

Necessity: no unnecessary element remains; every changed engine line either selects one parent
construction, derives its density delivery, or invalidates the resulting cache identity.

Sufficiency: delivers the complete KAI-9821 rework and KAI-9788 consequence—visible, hidden,
rectangular, geometric, explicit freeform and every legal pattern/pitch family are executable.

### Current-runtime visual gate

- Product commit: `0331ffb22b5d7ba0ee43eb2d95afede285900592`.
- Real bench: `http://localhost:3970/effect-creator/grid-lab`; PID 19834; process cwd
  `grid-lab`; HTTP 200; serving tree HEAD matched the product commit.
- Declared Playwright fallback, after the already-recorded profiled-Chrome control failure:
  - Diamond-shape M 128mm: Light rendered four rim magnets; Standard rendered the same four plus
    centre; both stayed Standard/48 and the readout changed truthfully from `4pt/4` to `5pt/5`.
  - Rectangle 214×118: Standard rendered 15 magnets; Light rendered 8 on the same Standard/48
    construction and preserved the same physical size.
- Console: 2 development messages, 0 errors, 0 warnings.
- Captures:
  - `output/playwright/kai-9821-light-parent-0331ffb.png`;
  - `output/playwright/kai-9821-standard-parent-0331ffb.png`;
  - `output/playwright/kai-9821-rectangle-light-0331ffb.png`.
