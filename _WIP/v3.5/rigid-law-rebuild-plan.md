# THE LAW ENGINE — final plan and execution contract (v3.5 grid-origin)

## THE GOAL (Dan's intent, stated as the product truth this plan must make real)

The magnetic grid engine is a **three-rule driver**. Three rules, equal and absolute, drive
everything the customer ever sees:

1. **CENTRE** — the shape's governed centre is found first, from the shape alone, and the
   grid is placed rigidly ON it: a magnet on the centre, or the centring line of a pair /
   frame through it. The centre never comes from where magnets happened to land.
2. **WRAP** — every belt magnet's disc touches the shape's edge within the flap tolerance.
   0 means touch; 1 means up to 1mm of space. The dial is a law, not a preference: in
   normal mode a layout that violates it is not shown; AUTO mode adapts the tolerance.
3. **MAGNET-QUANTITY SCALING** — size is the reconciler and the step axis: the shape grows
   only to the next size that seats at least one more magnet while still centred and
   wrapped. Each band is the range holding every such instance, minimum to maximum count.

**EXACTNESS (Dan, ruled 2026-08-20): the dial value is the number, exactly — 0 means
0.000000…, 1 means 1.000000…** No tolerance is enforced anywhere: a rung exists at the size
where the binding disc's outer line COINCIDES with the outline (at flap 0), or with the
outline offset by exactly the dialled allowance. The engine's exact integer seat arithmetic
(micron unit, tangency by equality) is the instrument; no epsilon, no granted slack, no
policy constant stands between the dial and the geometry.

No scoring, no weights, no hidden preference anywhere in the driver. Conflict between the
rules is impossible inside bands (size resolves it); where a human holds the size fixed
(Free mode / manual), any bend of a rule is minimal and printed on screen in words.

Build strategy (Dan): CLONE-COMPARE-DELETE. The driver was built as a third positioning
mode ("Law") beside Voting and Centre rules; the old modes are deleted only after Dan calls
the live comparison proven — the same route centering itself was introduced by.

## Phase 1 — BUILD THE DRIVER · DONE (reopened on Meta's plan-QA F1-F3, fixed same day)

Meta's verification falsified three Phase-1 claims; all three were lead-re-proven and fixed:
- F1 wrap is belt-scoped IN THE WALK too (gate now measures the belt whatever the coverage
  display; Full-coverage 120 square rungs [120/9]).
- F2 the centre law is a LAW: a candidate is lawful only when each axis's seated line-count
  parity matches its placement (odd→node ON centre, even→gap ON centre); lawful candidates
  outrank everything — wrap can never trade the centre away. Unlawful winners surface as
  parityTrue=false (free-mode concession); the walk refuses them (size reconciles).
  Evidence: 0.6-ellipse@73 single now ON centre; rungs survive across shapes/flaps
  (0.6@B2 flap6 [75/2], @B3 flap0 [132/4], circle B2 [92/4]).
- F3 the rung-click display carries no seat inflation under Law — clicked rungs render the
  exact qualifying layout.
- F4 resolved by Dan's standing ruling (the dot lies): the TRUTH DOT marks edge tangency
  only — spot radius, exact-tangency band (TANGENT_GUARD_MM 0.05). At flap>0 discs at the
  allowance ring earn NO dot (probe: ellipse75 flap6 press 0.00, dots 0); the amber ring
  carries the margin story. Tangent standards keep their dots (72 square: 4).

As built, `grid-origin.ts` `computeGrid`, branch `positioning === 2`:
- Centre: `governMass(allMasses, governor, midY)` → `ruleTarget`; `centreMainMM = ruleTarget`
  unconditionally (seat-independence by construction).
- Placement: 4 parity candidates from `ruleTarget` (node/pair-line per axis, class-derived).
- Rank (lexicographic, no weights): post-belt count → `maxPressMM(outer, belt, reach)` →
  gravity (`vertical` from the seat bbox; ties quantized at `QUANTUM_KEY_MM`).
- `GridResult.pressMM` = worst belt gap beyond allowance; page prints "wrap conceded N.Nmm".
- Walk + display + worker prefetcher carry NO `seatMarginMM` under Law (the contact-law
  inflation demanded gap ≥ allowance against wrap's ≤ — the knife edge that emptied
  ladders; found live, fixed, and the prefetcher mirrors it or it poisons shared caches).
Evidence on record: squares 24→1 / 72→4 / 120→8, centre 0.0, press 0.00 at flap 0 · circle
pairs VERTICAL (80/90mm) · bot cutout(4) B2: flap 0 honest fallback, flap ≥4 rung 107/2⌾
press 0.00 · solve ~0.02s · suite 438/438 · live bench screenshot delivered.

### Phase-1 round 2 — pixel's INDEPENDENT full evaluation (goal + code, not my claims)

Four code defects nobody had named, each re-probed by the lead and fixed:
- F1 manual calibration reported `parityTrue` regardless — a hand-forced grid could sit
  anywhere and the result claimed the centre law held. Parity is now MEASURED for forced
  phases via one shared `parityHolds()` predicate (single source of the centre law).
- F2 flap 0 was not touch: the band gate granted the walk's step (1mm) as hidden slack
  (rungs observed up to 0.4999mm off contact). First repair introduced a 0.1mm tolerance —
  REJECTED by pixel's closing verdict as unruled policy slack, and by Dan's exactness
  ruling. CLOSED IN PHASE 2.0 below: no tolerance at all; the size refines to exact
  coincidence at the engine's arithmetic unit. Diagnosis that made it possible (lead
  probes, this round): tangency IS exactly attainable — square lands 0.000000mm, and a
  circle lands 0.000055mm (float noise floor) WHEN the centre is exact. The 0.069mm
  residue came solely from the governed centre being a 2mm-MESH SAMPLE; Box/Weight modes
  (analytic centres) hit zero on the same shape, and outline resolution was ruled out
  (256→4096-gon changed nothing).
- F3 Auto was neither minimal nor consistent: the band scanned in 2mm steps (granting 2
  where 1 sufficed) and Free's readout used the FIRST disc to touch while the wrap law
  needs the WORST. Scan step → 1mm; `impliedFlapMM` → worst-disc semantics.
- F5 `computeGrid`'s public default padding was the slider FLOOR (10), not the released 12
  — the standards only passed because callers happened to pass 12 explicitly.
Evidence after fixes: squares 24/72/120 exact (press 0.00) · circle B1 24.0/1 (p0.015),
B2 92.0/4 (p0.064) · manual off-centre now reports parityTrue=false · suite 438/438.

## Phase 2 — PROVE · the contract (current phase)

2.0 EXACTNESS (Dan's ruling — the first build item; closes F2 with no unruled value).
    Two instruments, each named, each certified — no epsilon, no policy constant:

    a. THE CENTRE, deterministic and refined (replaces the 2mm mesh sample; my earlier
       `snapToIso` reference was WRONG — that step converges to a level BOUNDARY, and the
       clearance maximum has zero gradient, so a boundary-Newton cannot find it):
       implement POLE OF INACCESSIBILITY by hierarchical cell subdivision (polylabel):
       priority-queue cells by upper bound `clearance(centre) + halfDiagonal`, subdivide the
       best cell, stop when the bound margin is below the representable unit. Certified:
       the bound proves no unexplored cell can beat the answer. Deterministic tie-break:
       lowest (x, y) in the engine's integer unit wins; ties beyond that are impossible
       because the unit is the resolution. Mass/island `centreMM` becomes this point.
       (Modes with an ANALYTIC centre — Box, Weight — already return exact points and are
       untouched; the probe that isolated the defect used them as the control.)

    b. NO ACCEPTANCE TEST EXISTS (pixel round-3 B1 — my own contract contradicted itself:
       an exact micron-integer equality cannot certify a root that does not lie on the
       micron grid). Solving removes the need: a candidate is never compared against a
       threshold, so there is no predicate to satisfy, quantize or certify. Correctness
       comes from the CONSTRUCTION — the size is the tangency root — and the exact integer
       machinery keeps exactly one job it can do soundly: deciding SEAT LEGALITY (disc
       inside, tangency counted as inside), which is a >= question on the engine's own
       grid. Float measures (`pressMM`) are REPORTING only, in the law and in the UI.

    c. THE RUNG SIZE IS SOLVED, NEVER SEARCHED (Dan, 2026-08-20 — and the correction that
       dissolved the whole tolerance question): tangency is an EQUATION, not a test. For a
       placement, the binding contact is one disc against one outline element, so the scale
       at which they coincide is a closed-form root: for a segment, the quadratic in the
       scale s of `dist(anchor(s), segment(s)) = spot + allowance`; for an analytic arc, the
       same equation in radial form. Solve it per candidate element, take the smallest root
       that keeps the count and the parity law, and THAT root IS the rung's size. The disc
       touches by construction — nothing is accepted against a threshold, so no tolerance,
       no bracketing and no acceptance band exists anywhere in the engine.
       Proven before writing this clause (lead probes): SOLVED gives gap 0.000e+0 for the
       circle 2×2 (size 91.882250993909) and for a polygon edge; SEARCHING the same case on
       a micron grid gives 3.7e-4 — the residue was always the method, never the geometry.
       The only remaining inexactness is writing the root down (~1e-13 mm in the number
       system, 10^10 times finer than the engine's micron unit) and it is representation,
       not granted slack.
       REGIMES, CERTIFIED (pixel B2 + closing blocker: erosion is a FIXED 12mm while the
       shape scales, so the mass map and governed centre move non-affinely, the parity class
       flips when a bbox side crosses a band boundary, and the binding element changes —
       one quadratic is not the law. And neither sampling nor monotonicity may be assumed:
       a sampled sweep can step over a narrow regime, and endpoint-sign bisection misses a
       pair of roots that share their end signs. Either error deletes a lawful rung.)
       The law is solved piecewise with completeness PROVEN, not sampled:
         i.   REGIME BOUNDARIES ARE SOLVED, NOT SAMPLED. Every transition is itself an
              event equation, so enumerate their roots directly: a count change is a disc
              reaching legality (the same tangency equation); a parity-class flip is the
              size where a bbox side equals a band edge (closed form); a binding-element
              change is the size where two elements are equidistant from a disc; a
              mass-topology change is where the clearance field's extremum crosses the mass
              depth; and — the case that unchanged topology hides (closing QA) — a
              CENTRE-IDENTITY change, where the governor's own comparison flips with the
              same masses present: two masses equal in area (Smallest), two extrema equal in
              depth (Deepest), a mass crossing the upper-half line (Top-small), or two local
              maxima of the clearance field exchanging rank. Each is an equality equation
              and is enumerated the same way. Sort the event sizes; the regimes are the
              intervals between them. No regime can be stepped over because none is found by
              stepping, and no regime contains a jump in the anchor path — which is what
              makes the Lipschitz bound in (ii) valid rather than assumed.
         ii.  ALL ROOTS INSIDE A REGIME ARE ISOLATED, WITHOUT ASSUMING MONOTONICITY. Under
              uniform scaling the geometry is Lipschitz in the scale with a computable
              constant (outline points move by |p|/s per unit scale; the centre's drift is
              bounded by the same field), so certified isolation applies: subdivide the
              regime, and prune any subinterval where |contact(s)| exceeds L × halfWidth —
              such an interval provably holds no root. What survives isolates every root,
              double roots and equal-end-sign pairs included. Bisection is then used only
              INSIDE an isolated bracket, where a sign change is proven to exist.
         iii. EXISTENCE IS CERTIFIED, AND MULTIPLICITY-AWARE (closing QA: pruning proves
              absence only; and the Krawczyk/interval-Newton inclusion needs a NONSINGULAR
              derivative, which a tangential double root does not have — f'(r) = 0 there, so
              the standard test cannot certify it and a lawful double-contact rung would be
              lost to UNDECIDED). Two tests, chosen by what the interval shows:
                · SIMPLE ROOT — the derivative's interval enclosure excludes zero, so the
                  Krawczyk test applies: `K(X) ⊆ X` proves a unique root exists in X.
                · TANGENTIAL (DOUBLE) ROOT — the derivative's enclosure contains zero, so
                  the problem is DEFLATED one order: certify a root s* of the DERIVATIVE
                  (where it is itself simple, so Krawczyk applies), then evaluate the
                  contact function in interval arithmetic at s*. This separates the three
                  cases the law must distinguish, without conflating them:
                    – enclosure of f(s*) contains zero and its width is at the
                      representation's limit → CERTIFIED TANGENTIAL CONTACT; it rungs.
                    – enclosure of f(s*) strictly excludes zero → CERTIFIED NEAR-MISS; no
                      rung, and it is not undecided — the engine knows.
                    – enclosure straddles zero wider than the limit → UNDECIDED.
              Certified intervals are then refined to the representation's limit (Newton
              inside, bisection as fallback).
              FAIL-CLOSED: only the third case is undecided — the engine shows no rung for
              that count, never invents one, never silently drops it; the undecided verdict
              is surfaced like a concession, with the count and band named.
         iv.  The rung is the EARLIEST root, in increasing size, that satisfies the count and
              parity laws; a count with no such root in any regime of the band has no rung —
              an explicit answer, never a silent omission.
       Consequence: `bandWalk`'s size loop is DELETED, not demoted — event solving replaces
       it entirely; each rung's size is a certified, isolated, refined root.

    d. `grid-origin-spec.ts` — DELETE `CONTACT_TOLERANCE_MM`, and `TANGENT_GUARD_MM` loses
       its gate role: the truth dot is drawn from the SAME exact contact predicate (b), so
       one definition of touch serves both the law and the picture. No tolerance constant
       survives anywhere in the engine.

    e. Fixtures: every rung's size equals the solved root and its binding gap is 0 at the
       number system's own resolution (square 24/72/120 and circle B1/B2 — the circle's
       2×2 must land 91.882250993909, gap 0.000e+0, NOT a micron-grid neighbour); the same exactness holds at
       flap 1, 4, 12 — the allowance shifts the coincidence line, never widens it; and the
       centre refinement (a) is deterministic across repeated runs and mesh origins;
       a NON-MICRON root case (the circle 2×2, root 91.882250993909) is carried and rendered
       as the root itself, never snapped to a grid; and a REGIME-CHANGE case (a shape whose
       mass map gains a mass across the band, and one whose parity class flips at a band
       boundary) yields the correct per-regime roots with no missed count.
       And the completeness cases the closing QA named, each asserted explicitly:
         · NARROW REGIME — a regime whose width is orders below any sampling step is still
           found (boundaries are solved, not sampled) and its rung appears.
         · TWO ROOTS, EQUAL END SIGNS — both roots isolated; the earliest lawful one rungs.
         · BRANCH SWAP UNDER UNCHANGED TOPOLOGY — two masses cross in area with the mass map
           unchanged, so the governor switches which rules: the regime split occurs there and
           the per-regime roots are correct.
         · CERTIFIED TANGENTIAL DOUBLE ROOT — a contact curve that touches zero without
           crossing rungs, certified through the deflation path, NOT reported undecided.
         · NEAR-ZERO NO-ROOT CONTROL — a contact curve approaching zero without reaching it
           yields NO rung AND NO undecided verdict (certified near-miss).
         · UNDECIDED SURFACING — a synthetic case at the representation's limit reports the
           count as undecided, visibly, and rungs nothing.

2.1 TRUTH DOT — dots are drawn from the exact contact predicate (2.0b): a dot means the
    disc's outer line coincides with the outline, never the allowance ring, never a
    tolerance band. Phase 1 already moved the dot off the allowance ring; 2.0d removes its
    remaining guard constant so law and picture share one definition of touch.
2.2 LAW GUARD. New `src/lib/effect/__tests__/grid-origin-law.test.ts`, fixtures:
    a. determinism — two identical Law solves, JSON-equal anchors+phase;
    b. standards — square 24/72/120 → 1/4/8, `centreMainMM` = origin, `pressMM` = 0;
    c. gravity — circle at a pair size: |ax−bx| < 0.6 (vertical);
    d. G1 — Full-coverage 120 square still rungs in B3 (wrap is belt-scoped);
    e. truth dot — non-tangent square yields `contactsMM.length === 0`;
    f. CONTROL-TRUTH sweep — flap 0 vs 4 produce different B2 rung sets on the bot base;
       governor 0 vs 3 move `centreMainMM` on a two-mass fixture; mass-depth 12 vs 24
       changes the mass count. One probe per dial, each proving its label.
    g0. MANUAL TRUTH (F1) — a forced off-centre phase yields `parityTrue === false`, and a
       forced lawful phase yields true.
    g1. EXACT GATE (F2) — every rung satisfies the exact contact predicate (2.0b); a
       layout one representable unit loose is NOT a rung, at flap 0 and at flap 1/4/12.
    g2. AUTO MINIMAL (F3) — auto's chosen allowance is the smallest whole mm whose ladder is
       non-empty; Free's implied allowance equals the worst-belt requirement, not the first
       disc's gap.
    g. SCALING LAW (the third driver — pixel Meta M2/M3): across two adjacent bands on a
       fixture shape, the ladder carries UNIQUE, STRICTLY INCREASING counts; each rung is
       the FIRST size where its count seats lawful (parity-true) + wrapped; and no count
       lawful in the band below reappears above worn loose. Duplicate, skipped-first-size
       and cross-band-repeat cases each asserted.
2.3 COMPARISON MATRIX (Dan's instrument): scripted bench screenshots — square, circle,
    duck cutout(5), bot cutout(4) × B1–B5 (all five product bands — pixel full-eval F7:
    B4/B5 must not be unseen when Dan authorises deletion) × Law / Centre rules / Voting,
    each frame showing press + centre readouts. Delivered as images, not a doc.
2.3b WORKER CONTRACT (pixel full-eval F6) — new fixtures over the worker's own logic, which
    no existing gate covers: shape-signature identity (two different shapes never share a
    cache), Law prefetch mirrors the walk config exactly, clicked-rung re-render equals the
    qualifying solve, Auto selection matches `autoFlapInBand`. The separation guard's
    MODULE_FILES gains the worker so its imports stay one-way.
2.4 FREE-MODE CONCESSIONS (closes Meta C2): the GOAL's printed-bend promise, built —
    page shows "wrap conceded N.Nmm" / "centre conceded (parity)" from `pressMM` /
    `parityTrue` in Free and manual paths, not band mode only.
2.5 PERF BAR (pins the mobile claim): Law solve < 50ms and a cold band walk < 1s on
    desktop, measured and recorded in the matrix; phones verified on the deployed preview.
2.6 META QA of the driver in its own checkout (parity candidates vs spec, belt scoping,
    gravity ties, cache mirroring); lead re-verifies every finding before Dan sees it.
Gate: 2.0 first (exactness — nothing downstream is judged on a tolerant engine), then
2.1–2.6 green → Dan judges the B1–B5 matrix → his word "proven" opens Phase 3.

## Phase 3 — DELETE THE OLD ENGINES · the contract (only on Dan's "proven")

Each numbered step lands as its own commit with guard + suite + a live gate, and each
compiles alone — consumers always die BEFORE the exports they consume (pixel-QA item 5):
3.1 PAGE: DELETE the Positioning toggle, the Voting-law card, the placement-step row and
    its enable, and the spec imports they carry; persisted namespace → `grid-origin.v2.*`
    (scoring-era dials die); Reset-to-default migrates.
3.1b WORKER (pixel full-eval F4): drop `cfg.positioning` branching and every `seatMarginMM`
    emission — the worker consumes exactly the `GridConfig` fields 3.2 deletes, so it must
    stop consuming them first or 3.2 cannot compile.
3.2 DOOR (`grid-origin.ts`): DELETE the voting branch, the old centre-rules branch,
    `phases()`, the two-pass counts + `fitsM` memo; `GridConfig` loses `positioning`,
    `phaseStepMM`, `seatMarginMM`, `votingOrder`. Law becomes the only path. This removes
    the door's imports of `registrationScore`, `VotingOrder`, `centeringRef`,
    `PHASE_STEP_MM`, `POSITIONING`, `VOTING_ORDER`.
3.3 LOGIC: DELETE `registrationScore`, `ORDERS`, `VotingOrder`, `centeringRef` (the
    seat-dependent centre — the corruption root). This removes logic's imports of
    `SEAT_WEIGHT`, `FLAP_WEIGHT`, `BALANCE_WEIGHT`, `VOTING_ORDER`.
3.4 SPEC: DELETE `SEAT_WEIGHT`, `FLAP_WEIGHT`, `BALANCE_WEIGHT`, `VOTING_ORDER`,
    `POSITIONING`, `PHASE_STEP_MM`, `PHASE_STEP_FLOOR_MM` — zero consumers remain by 3.3.
3.5 COMPUTE + RESULT: DELETE `pressExcessMM`; DELETE `GridResult.panMM` and the `bestKx/
    bestKy` state behind it (zero consumers — pixel full-eval F8); `dist` and `bandSnapPoints` exports go private/die
    (zero external consumers, verified).
3.6 WORKER CACHES: measure Law-speed solves; caches/prefetcher survive ONLY if a measured
    interaction exceeds ~100ms without them — otherwise deleted with the numbers cited.
3.7 `v3.5-architecture.md` refreshed and stamped as close-out, before final QA reads it.

## Phase 4 — CLOSE

Full suite + guard green · matrix re-shot on the single-engine build · Meta closing verdict
(the engineering close) · Dan's product sign-off on final behaviour.

## Open Dan decisions (pending, non-blocking for Phase 2)

1. Governor factory default (Smallest today; Top-small recommended — ends sliver rule).
2. Free-mode conflict layer: the Balanced option + default order (bands never need it).

## Necessity / sufficiency (self-verdict, for Meta to attack)

- Necessity: every Phase-3 deletion is consumer-traced; Phase 2 adds fixtures plus exactly
  two instruments Dan's exactness ruling requires (a certified centre maximiser, an exact
  contact predicate) and DELETES both tolerance constants — no speculative options.
- Sufficiency: every clause of the GOAL maps to a numbered contract step; nothing of Dan's
  directive set is uncovered (centre 1→Phase 1.1, wrap 2→1+2.2f, scaling 3→walk law+2.2f,
  gravity→2.2c, truth controls→2.2f, truth dot→2.1, clone-compare-delete→phase gates).
