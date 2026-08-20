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

## Phase 2 — PROVE · the contract (current phase)

2.1 TRUTH DOT — DONE with Phase 1's reopen (see F4 above): dots measure edge tangency
    (spot only, TANGENT_GUARD_MM), never the allowance ring.
2.2 LAW GUARD. New `src/lib/effect/__tests__/grid-origin-law.test.ts`, fixtures:
    a. determinism — two identical Law solves, JSON-equal anchors+phase;
    b. standards — square 24/72/120 → 1/4/8, `centreMainMM` = origin, `pressMM` = 0;
    c. gravity — circle at a pair size: |ax−bx| < 0.6 (vertical);
    d. G1 — Full-coverage 120 square still rungs in B3 (wrap is belt-scoped);
    e. truth dot — non-tangent square yields `contactsMM.length === 0`;
    f. CONTROL-TRUTH sweep — flap 0 vs 4 produce different B2 rung sets on the bot base;
       governor 0 vs 3 move `centreMainMM` on a two-mass fixture; mass-depth 12 vs 24
       changes the mass count. One probe per dial, each proving its label.
2.3 COMPARISON MATRIX (Dan's instrument): scripted bench screenshots — square, circle,
    duck cutout(5), bot cutout(4) × B1–B3 × Law / Centre rules / Voting, each frame showing
    press + centre readouts. Delivered as images, not a doc.
2.4 FREE-MODE CONCESSIONS (closes Meta C2): the GOAL's printed-bend promise, built —
    page shows "wrap conceded N.Nmm" / "centre conceded (parity)" from `pressMM` /
    `parityTrue` in Free and manual paths, not band mode only.
2.5 PERF BAR (pins the mobile claim): Law solve < 50ms and a cold band walk < 1s on
    desktop, measured and recorded in the matrix; phones verified on the deployed preview.
2.6 META QA of the driver in its own checkout (parity candidates vs spec, belt scoping,
    gravity ties, cache mirroring); lead re-verifies every finding before Dan sees it.
Gate: all of 2.1–2.4 green → Dan judges the matrix → his word "proven" opens Phase 3.

## Phase 3 — DELETE THE OLD ENGINES · the contract (only on Dan's "proven")

Each numbered step lands as its own commit with guard + suite + a live gate.
3.1 (closes Meta C1 — each step must compile alone, so consumers die before their spec
    values) Page first: DELETE the Positioning toggle, Voting-law card, placement-step row
    + enable, and the four spec imports they carry; persisted namespace → `grid-origin.v2.*`.
3.1b `grid-origin-spec.ts`: DELETE `SEAT_WEIGHT`, `FLAP_WEIGHT`, `BALANCE_WEIGHT`,
    `VOTING_ORDER`, `POSITIONING`, `PHASE_STEP_MM`, `PHASE_STEP_FLOOR_MM`.
3.2 `grid-origin-logic.ts`: DELETE `registrationScore`, `ORDERS`, `VotingOrder`,
    `centeringRef` (the seat-dependent centre — the corruption root).
3.3 `grid-origin.ts`: DELETE the voting branch, the old centre-rules branch, `phases()`,
    the two-pass counts + `fitsM` memo; `GridConfig` loses `positioning`, `phaseStepMM`,
    `seatMarginMM`, `votingOrder`. Law becomes the only path.
3.4 `grid-origin-compute.ts`: DELETE `pressExcessMM`; `dist` and `bandSnapPoints` exports
    go private/die (zero external consumers, verified).
3.5 Worker: measure Law-speed solves; caches/prefetcher survive ONLY if a measured
    interaction exceeds ~100ms without them — otherwise deleted with the numbers cited.
3.7 `v3.5-architecture.md` refreshed and stamped as close-out, before final QA reads it.

## Phase 4 — CLOSE

Full suite + guard green · matrix re-shot on the single-engine build · Meta closing verdict
(the engineering close) · Dan's product sign-off on final behaviour.

## Open Dan decisions (pending, non-blocking for Phase 2)

1. Governor factory default (Smallest today; Top-small recommended — ends sliver rule).
2. Free-mode conflict layer: the Balanced option + default order (bands never need it).

## Necessity / sufficiency (self-verdict, for Meta to attack)

- Necessity: every Phase-3 deletion is consumer-traced; Phase-2 adds only fixtures and one
  exported tolerance constant — no new machinery, no speculative options.
- Sufficiency: every clause of the GOAL maps to a numbered contract step; nothing of Dan's
  directive set is uncovered (centre 1→Phase 1.1, wrap 2→1+2.2f, scaling 3→walk law+2.2f,
  gravity→2.2c, truth controls→2.2f, truth dot→2.1, clone-compare-delete→phase gates).
