# Rigid Law Engine — rebuild plan (v3.5 grid-origin)

Dan's directive set (verbatim anchors, 2026-08-20): "there must be no scoring logic — all
rigid law; scoring on top only as an option to resolve conflicts" · "wrap/center/magnet count
all three are absolute requirements and voting just selects priority; options with equal
priorities" · "flap 0 means 0 — every control true" · "the centering algorithm must set the
center and place rigid on it or on the centering lines in pairs and other magnet numbers" ·
"vertical pairs must be preferred to horizontal due to the gravity law; a circle must rotate
to vertical" · count is the band step axis; rung per count at contact size; band slider =
manual scale within the band; auto flap = the adaptive mode; touch markers must be true.

## Why the current engine cannot be patched into this

- Voting's centre is CIRCULAR: the reported main centre comes from the winning layout's
  seats, so it is corrupted identically under every mode and governor (Dan's bot screenshots;
  Centre-rules alone shows the true centre because it derives the target before seats exist).
- Placement is a 2,304-slide search scored by weights — "preference under the hood" by
  construction. No weight tuning makes a weight a law.
- Gravity does not exist in the code at all.
- The contact dot carries a 1mm slack — it marks near-touch as touch. A lying instrument.

## The machine (per solve, in order — no scores anywhere)

1. CENTRE — derived first, seat-independent: centre mode + governor pick the governed point
   from the mass map alone. (Fixes the circularity; all modes/governors become observable.)
2. PLACEMENT — derived, never searched: the four parity candidates from the centre (node ON
   it or gap/pair-line ON it, per axis — canon §4/§6, default parity from the bbox axis
   classes). The grid sits rigidly on the centre or its centering lines. Nothing slides.
3. LAWS — three absolute requirements measured per candidate, each true to its dial:
   · COUNT — seats at this size (the band's step axis).
   · WRAP — the worst disc's gap past spot+allowance; 0 = touch, 1 = 1mm space.
   · CENTRE — satisfied by construction on the two lawful parities; any forced offset is a
     measured concession, never a silent drift.
4. GRAVITY — deterministic tie-break between otherwise-equal arrangements: vertical beats
   horizontal (the circle's pair rotates upright). A law, not a preference.
5. THE KEYSTONE (Dan, 2026-08-20: "enforce equally center = wrap = magnets within band
   variants"): inside a band the three laws are EQUAL and ABSOLUTE — size is the free
   variable that reconciles them. Per count: place the grid rigidly on the centre (parity),
   scale until every disc touches within the allowance. A rung EXISTS only where all three
   hold at once; a count no size can satisfy is not offered (honest fallback; AUTO adapts
   the allowance instead). No conflict resolution inside bands — none is needed.
6. CONFLICT RESOLUTION — Free mode only (size held by hand, so something may have to bend):
   the order (six permutations + BALANCED = minimize the largest concession) decides which
   law bends, by the minimum, and the bend is REPORTED ("centre conceded 3mm" / "wrap
   conceded 2mm"). Band slider stays continuous manual scale and reports concessions the
   same way while between rungs.

## Minimal diff (the whole deliverable, per file)

- spec: DELETE SEAT_WEIGHT/FLAP_WEIGHT/BALANCE_WEIGHT (scoring dies). ADD nothing numeric —
  no new magic values. VOTING_ORDER becomes the conflict-resolution order id (0-6, 6 =
  Balanced).
- compute: KEEP mass/segment map, edge index, seat predicates, maxPress/press measurements,
  contact points (slack parameter → 0.05mm GUARD — the dot only marks true tangency).
  ADD parityCandidates(centre, bbox, pitch) — pure geometry. DELETE the sweep helpers the
  door no longer calls.
- logic: REPLACE registrationScore/ORDERS with: laws as predicates + concession measures;
  resolveConflict(order, candidates) — pure policy, lexicographic per order, Balanced =
  min-max concession; gravity tie-break; governor/centre policies unchanged.
- door (computeGrid): the 6-step machine above. DELETE the two-pass sweep, phases ladder,
  fitsM memo (4 candidates need none of it). GridResult ADDS concessions {wrapMM, centreMM,
  countShort} + keeps contactsMM (truthful). Manual forcePhase path unchanged.
- worker: unchanged API; prefetcher likely SHRINKS (a solve becomes ~4 candidate checks —
  measure first, delete if redundant).
- page: order dropdown = 6 orders + Balanced; concession line in the status card; everything
  else (bands, chips, slider, rings, legend) untouched.

## What this is expected to change in behaviour (honest)

- Voting/Centre-rules split collapses into ONE law engine (Centre-rules IS the machine;
  "voting" survives only as the conflict order). The Positioning toggle is deleted.
- Placement count drops 2,304 → 4 per size: solves ~instant, mobile goal likely met
  without a worker pool. Measure before/after; the pool decision follows the numbers.
- Some current layouts WILL move — anything that owed its position to score trade-offs.
  The square standards must not move (24/72/120 tangent, centred by construction).

## Gates (each phase closes before the next)

1. PLAN — this document; Dan's word on: Balanced in? default order? Positioning-toggle
   deletion confirmed?
2. BUILD — guard extended first (new checks: no weight constants anywhere; parity
   placement determinism; gravity fixture: circle pair = vertical; truth-dot fixture:
   no contact point where gap > 0.05). Then the diff above, committed per step.
3. PROBES — squares 24/72/120 exact; bot + duck: centre = governed mass centre at 0.00mm
   in EVERY mode/governor; wrap gaps ≤ dial at every rung; ladders per count.
4. LIVE — bench screenshots per shape/band/order incl. concession lines; perf table
   (per-solve and per-walk, before/after).
5. QA — Meta adversarial pass (own checkout, equivalence + law probes), lead re-verifies,
   then Dan sees the verified report.

## Full-codebase audit deltas (2,558 lines read, 2026-08-20) — gaps the first draft missed

NECESSITY (more must die than the draft named):
- `centeringRef` (logic) — the seat-dependent centring reference IS the circularity Dan
  condemned; the governed target already exists seat-free (`governMass` over all masses).
  DELETE, and `centreMainMM` becomes the governed target always — every mode/governor
  observable, in every path.
- `pressExcessMM` (mean-press force) — a score in disguise; concessions need only
  `maxPressMM` + the centre offset. DELETE.
- `seatMarginMM` config — duplicates `flapMM` once the law engine folds margin into the wrap
  law. DELETE the field; the walk passes `flapMM` alone.
- The PLACEMENT-STEP dial + its enable (page) — nothing slides in the law engine; the dial is
  a sweep-era organ. DELETE (manual drag calibration stays).
- The POSITIONING toggle + persisted key, `votingOrder` 2-option dropdown → replaced by the
  single order control (orders + Balanced), Free-mode-scoped.
- Slider `wide` prop + `.gl-num-wide` CSS — orphaned by the weight-dial deletion. DELETE.

SUFFICIENCY (details the draft under-specified):
- `below` baseline (bandWalk) must test the SAME three-law rung predicate, not bare count —
  a count lawful only below the band belongs below.
- Auto flap: unchanged semantics on top of the law engine (scan allowances, per-allowance
  caches via `cacheFor`); free-mode implied readout stays.
- Rung quantization honesty: at snap step N the contact residual is < N mm by construction;
  the status line states the measured worst gap, and an optional sub-step bisection refine
  (size only, laws re-checked) is listed as a follow-up, not silently added.
- Manual paths (drag calibration, band manual-scale slider) solve under the same laws and
  REPORT concessions — the slider becomes the verification instrument Dan asked for.
- Rung counts stay post-belt (the belt is law-neutral; counts must match the canvas).
- Circle keeps its analytic seat predicate; gravity picks among parity candidates only when
  laws tie (canon parity still rules the axes).

GATES (added):
- CONTROL-TRUTH sweep: for every dial, a probe that proves the control does exactly what its
  name says (flap 0 vs 1 distinguishable; governor switch moves the centre; order switch
  changes only conflict outcomes) — Dan's "verify every control is true".
- CIRCULARITY check in the guard: centreMainMM identical across magnet plans/coverage for
  the same shape+mode (seat-independence proven, not asserted).

## Meta audit round 2 (verified by lead, 2026-08-20)

- G1 PROBE-CONFIRMED: wrap-law scope = THE PERIMETER BELT. Interior magnets of a Full-grid
  layout can never touch an edge by definition — the law binds every BELT disc; interior
  discs are exempt. (Lead re-probe: 120sq B3 at flap 0 — belt coverage rung [120/8], Full
  coverage EMPTY.) Guard gains the G1 fixture: Full-coverage square must still rung.
- G2: version the browser-dial namespace (grid-origin.v2.*) — stale persisted dials from the
  scoring era must not leak into the law engine. Reset-to-default migrates.
- G3: governor factory default → Dan question #4 (Smallest is still the spec default; the
  sliver-hijack keeps returning through it).
- G4: gravity's "otherwise equal" DEFINED: same magnet count, same wrap satisfaction, same
  parity class — only then does vertical beat horizontal.
- Shrinks adopted: pressExcessMM (already on the kill list) · all three worker caches are
  measure-then-delete once solves are 4-candidate · bandSnapPoints and compute's `dist`
  exports have zero external consumers — deleted with the sweep.
- Deslop: `v3.5-architecture.md` is stale on the surfaces Dan tests — refreshed and stamped
  as a BUILD-phase close-out task, before QA reads it.
