# THE LAW ENGINE — final rebuild plan (v3.5 grid-origin)

Status: FINAL. Supersedes all earlier drafts (their audit history is in git). Strategy is
Dan's ruling: CLONE-COMPARE-DELETE — the new engine was built as a third positioning mode
("Law") beside Voting and Centre rules; the old modes are deleted only after Dan calls the
comparison proven. Phase 1 is DONE and live; this document is the contract for the rest.

## Dan's directive set (verbatim anchors, 2026-08-19/20)

- "There must be no scoring logic — all rigid law; scoring on top only as an option to
  resolve conflicts." · "Every control true — flap 0 means 0."
- "Wrap / center / magnet count all three are absolute requirements" · "enforce equally
  center = wrap = magnets within band variants."
- Centre rules mode is correct and kept as the base: "the centering algorithm must set the
  center and place rigid on it or on the centering lines in pairs and other magnet numbers."
- The two missing siblings: "(1) wrap — flap-managed tolerance to touching the edges, and
  (2) magnet-quantity based scaling — growing only to the next number that snaps and adds at
  least one more magnet." Each band = the range holding every instance, minimum to maximum
  magnets, in the wrapped-and-centered state.
- "Vertical pairs must be preferred to horizontal (gravity law); a circle must rotate to
  vertical." · Rigid law in normal mode (0 = touch impossible to violate; 1 = 1mm space);
  AUTO flap is the adaptive mode. · Touch markers must be true. · The band slider is a
  continuous manual scale within the band. · Mobile-first performance.
- Build strategy: "clone centering and build a 3rd mode that will become the final correct
  engine mode … as a separate module so we can compare, and delete centering and prior
  voting module only when we prove it works."

## The machine (as built — Phase 1, live at commit 28780df6 + cache fix)

Per solve, positioning mode 2 ("Law"):
1. CENTRE — derived seat-free: centre mode + governor pick the governed point from the mass
   map alone (`governMass` over all masses). `centreMainMM` IS this point, always.
2. PLACEMENT — derived, never searched: the four parity candidates on the governed centre
   (node ON it / pair-line ON it per axis, canon §4/§6, parity from the bbox axis classes).
3. RANK — pure lexicographic law, no weights: magnet count (post-belt, the band's step
   axis) → wrap (worst BELT disc's gap beyond spot + allowance; interior discs exempt — they
   can never touch, Meta G1) → gravity (vertical beats horizontal when count, wrap and
   parity all tie; tie quantized at a micron).
4. BANDS — Dan's keystone: a rung exists per count at the smallest size where the placed,
   counted layout also wraps (worst gap ≤ allowance + one walk-step of quantization). Size
   is the reconciler; no conflict logic inside bands. Counts lawful below the band belong
   below. AUTO flap scans the allowance upward instead (adaptive mode, unchanged).
5. CONCESSIONS — `GridResult.pressMM` carries the worst wrap gap; any shown layout past the
   allowance (manual slider, fallback) prints "wrap conceded N.Nmm". Nothing bends silently.
6. The walk and display under Law carry NO seat inflation (`seatMarginMM`) — the contact-law
   margin demanded gap ≥ allowance while the wrap law demands ≤; the knife edge emptied
   ladders (found live, fixed; prefetcher mirrors the same rule or it poisons caches).

Proven at build: squares 24→1 / 72→4 / 120→8, centre 0.0, press 0.00 at flap 0 · circle
pairs VERTICAL at 80/90mm · bot cutout(4) B2 honest — flap 0 fallback (its rigid-centred
pair physically needs 4mm), flap ≥4 rung 107/2⌾ press 0.00 · solve ~0.02s (mobile-class) ·
suite 438/438 · live bench gate screenshot delivered to Dan.

## Phase 2 — PROVE (current phase)

1. Truth dot: contact markers tighten from 1mm slack to the exact-tangency guard band
   (0.05mm, the seat predicate's own tolerance) — dots appear ONLY at true touches; Law
   rungs keep their dots (press 0.00), scored-mode near-misses lose theirs. Honest by
   construction.
2. Guard fixtures added BEFORE any deletion: Law determinism · square standards under Law ·
   gravity fixture (circle pair vertical) · truth-dot fixture (no dot where gap > 0.05) ·
   G1 fixture (Full-coverage square still rungs — belt-scoped wrap) · CONTROL-TRUTH sweep
   (one probe per dial proving each control does what its label says under Law).
3. Comparison matrix for Dan: same shapes (square, circle, duck, bot) × bands B1–B3 ×
   Law / Centre rules / Voting, screenshots with press + centre readouts — the instrument
   for his "proven" call.
4. Meta adversarial QA of the Law mode in its own checkout (equivalence probes on the four
   parity candidates, the belt-scoped gate, gravity, cache mirroring), lead re-verifies.

## Phase 3 — DELETE (only on Dan's "proven")

- Voting mode: the sweep, two-pass machinery, fits memo, `registrationScore`, `ORDERS`,
  `VotingOrder`, spec weights (SEAT/FLAP/BALANCE_WEIGHT, VOTING_ORDER), `pressExcessMM`,
  `centeringRef` (the seat-dependent centre — the corruption root), the Voting-law card.
- Old Centre-rules branch (subsumed by Law), the Positioning toggle (Law becomes the only
  engine; POSITIONING spec value dies), the placement-step dial + its enable.
- `seatMarginMM` config, `bandSnapPoints` + compute `dist` exports (zero consumers).
- Worker caches + prefetcher: measure at Law speeds, delete what no longer earns its place.
- Browser-dial namespace versioned (grid-origin.v2.*) so scoring-era persisted dials die.
- v3.5-architecture.md refreshed and stamped as the close-out, before final QA reads it.

## Phase 4 — CLOSE

Full suite + guard green · live matrix re-shot on the single-engine build · Meta closing
verdict (the engineering close) · Dan's product sign-off on the final behaviour.

## Open Dan decisions (pending, not blocking Phase 2)

1. Governor factory default (Smallest today; Top-small recommended — kills sliver rule).
2. Free-mode conflict layer: Balanced option + default order (Free holds size fixed, so a
   law may bend; bends always printed). Bands need none of this.
