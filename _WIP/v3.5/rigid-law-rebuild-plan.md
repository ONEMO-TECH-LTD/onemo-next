# THE LAW ENGINE — final rebuild plan (v3.5 grid-origin)

Status: FINAL · consolidates every ruling through 2026-08-20 · supersedes all earlier drafts
(the drafts' audit trails live in git history). Verified by: lead full-codebase read (2,558
lines), Meta adversarial audit round 1 (4 gaps folded), Meta verification of this final
(pending below).

## Dan's governing rulings (verbatim anchors)

- "There must be no scoring logic — all rigid law; scoring on top only as an option to
  resolve conflicts."
- "Wrap / center / magnet count all three are absolute requirements … enforce equally
  center = wrap = magnets within band variants."
- "Flap law must be enforced rigid … 0 = no touch impossible, 1mm possible with 1mm space.
  Auto mode may allow adapting."
- "The centering algorithm must set the center and place rigid on it or on the centering
  lines in pairs and other magnet numbers."
- "Magnet-quantity based scaling — growing only to the next number that snaps and adds at
  least one more magnet … each band is the range where you identify every instance where
  minimum and maximum magnets fit the shape in wrapped and centered state."
- "Vertical pairs must be preferred to horizontal due to the gravity law."
- "Every control is true — flap 0 means 0."
- "Build as a separate module so we can compare, and delete centering and prior voting
  modules only when we prove it works — like we did when adding the centering."
- Band slider = continuous manual scale within the band. Touch markers must be true.
  Mobile-first performance.

## The engine (per solve — four steps, no scores)

1. CENTRE — derived from the mass map alone (centre mode + governor), before any magnet
   exists. Never seat-derived (the voting engine's centre was; that circularity is the
   root Dan caught on the bot).
2. PLACEMENT — the grid sits ON the centre by canon parity: odd magnet count → node on the
   centre; even → the centre on the pair-line/gap. Four lawful placements; nothing slides,
   nothing is searched.
3. THE THREE EQUAL LAWS — measured per placement, each true to its dial:
   · MAGNETS — seat count after the perimeter belt (the band's step axis).
   · WRAP — the worst BELT disc's gap past spot+allowance (0 = touch, 1 = 1mm). Belt-scoped:
     interior discs of a Full-grid layout can never reach an edge (Meta G1, probe-proven).
   · CENTRE — held by construction; never a score.
4. GRAVITY — between placements equal on count, wrap and parity class (micron-quantized),
   vertical beats horizontal. The circle's pair stands upright.

BANDS (the keystone): the three laws are equal and absolute; SIZE reconciles them. Per
magnet count, the rung is the smallest size where the centred placement carries the count
with every belt disc inside the allowance. A count with no such size is not offered.
Counts lawful below the band belong to the band below. Auto flap = the adaptive mode
(scans the allowance up within the dial). Fallback stays explicit and labelled.

FREE MODE / MANUAL: same laws at the held size; whatever cannot hold is REPORTED as a
measured concession ("wrap conceded N.Nmm") — nothing bends silently. The conflict-order
option (orders + Balanced = minimize the largest concession) applies here only; bands
never need it.

## Build phases — clone, prove, delete

PHASE 1 — BUILT (commits 28780df6 + cache fix). The LAW mode ships as positioning mode 2,
beside Voting and Centre rules, sharing compute primitives, zero scoring in its path:
count → wrap → gravity lexicographic over the four parity placements. `pressMM` concession
in the result; status line prints concessions; walk gates on the wrap law (seat-inflation
decoupled — the contact-law margin and the wrap law were a knife edge, fixed; the worker
prefetcher mirrors the Law walk so caches can't be margin-poisoned).
Probes already green: squares 24→1 / 72→4 / 120→8 at press 0.00, centre exact; circle
pairs VERTICAL; bot B2 honest (flap 0 fallback — physically needs 4mm; 107mm/2⌾ press
0.00 from flap 4).

PHASE 2 — PROVE (next):
- Truth dot: contact markers tighten from 1mm slack to the exact-tangency guard band
  (0.05mm — the seat predicate's own GUARD; no invented value). Dots then appear only on
  true touches, in every mode.
- Guard fixtures added to the suite: Law square standards · gravity (circle pair vertical)
  · Law determinism · centre seat-independence (same centre across magnet plans/coverage)
  · G1 (Full-coverage square still rungs) · truth-dot (no dot where gap > guard).
- CONTROL-TRUTH sweep: one probe per dial proving each control does what its label says
  under Law (flap 0 vs 1 distinguishable; governor moves the centre; mass depth changes
  masses; padding moves seats).
- Proof matrix for Dan: same shapes (square, circle, duck, bot, cutout 9) × B1–B3 ×
  Law vs Centre rules vs Voting, screenshots side by side, concessions visible.
- Meta adversarial QA of the Law build in its own checkout; lead re-verifies; then Dan
  judges on the matrix.

PHASE 3 — DELETE (only on Dan's "proven"):
- Voting branch + registrationScore/ORDERS/weights (SEAT/FLAP/BALANCE_WEIGHT, VOTING_ORDER
  repurposed or dropped) + two-pass sweep + phases ladder + fitsM memo + pressExcessMM +
  centeringRef + placement-step dial & enable + Positioning toggle (Law becomes the only
  engine; the button row dies) + seatMarginMM config + dead exports (bandSnapPoints, dist).
- Versioned dial namespace (grid-origin.v2.*) so scoring-era browser dials cannot leak.
- Worker caches + prefetcher: measure at Law speeds (~0.02s solves), delete what no longer
  earns its place.
- Guard gains the no-weights check (no scoring constant anywhere).
- v3.5-architecture.md refreshed and stamped to the final engine before QA reads it.

PHASE 4 — CLOSE: full suite + guard · live gates on the bench · Meta closing verdict
(engineering close per the peer chain) · then the deferred product items (default governor,
Balanced default, mobile deploy) go to Dan as decisions.

## Open Dan decisions (parked, not blocking phases 2–3)

1. Governor factory default (Smallest today; Top-small recommended — the sliver-hijack
   returns through Smallest).
2. Free-mode conflict order default (Magnets > Wrap > Centring recommended) and whether
   BALANCED ships in the order list.
3. The word "proven" — Dan calls it after the proof matrix; deletion waits for it.
