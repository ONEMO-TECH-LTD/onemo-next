# Engine mathematics — working paper for three-lane convergence
Author: @s62-lead (draft 1). Reviewers/co-authors: @s62-kai-meta, @s62-grid-pixel.
Purpose per Dan: "collaborate/research more and figure out the math, identify potential inputs and
knowns and unknowns and come up with method and formulas." This paper is the shared artifact —
findings and corrections go INTO it, not into replies.

## 1 · Problem statement
One traced shape, aspect locked. The fixed lattice (12mm cells, magnets 48mm apart; 96mm = the same
lattice thinned). For each band and centre construction: which grid layouts does the material hold,
at which grid-dictated sizes — with layout, magnet count, exact coordinates for BOTH populations at
one published size, flap per side, and the binding contact named. All options returned; nothing
selected.

## 2 · Inputs and knowns (everything in cells; c = 12mm)
| symbol | value | meaning |
|---|---|---|
| c | 12mm | the atom; disc radius r = 1c; spot = 2c |
| p | 4c / 8c | pitch 48 dense, 96 sparse (same lattice, thinned) |
| b | 2, 3 | operational bands (1, 4 hidden) |
| G(b,p) | (b−1)p + 2c | band span: 72/120 dense, 120/216 sparse |
| ceiling | 8·48 + 2c = 408 | 9×9 count-derived |
| flap switch | {12, 24} = {1c, 2c} | two positions, nothing between |
| a | (0 or p̂/2) per axis | parity target; p̂ = 24 half-step. Odd run → on-magnet, even → gap |
| P | polygon, mm | traced outline, longest side L, bbox W×H, read at the 1mm floor (L19) |
| C | per construction | centre candidates — all six remain visible test options (O-1) |

Knowns settled by Dan (verbatim in laws/briefs): sizes are grid-dictated, never shape-derived;
material test is the DISC, not the box interior (butterfly ruling — shapes may cut through the grid
bounding box and still land magnets); arrangements follow the material (an L emerges when the 4th
disc has no fabric); pair is the floor; both populations must hold at one published size; flap =
overhang beyond the padded magnet extent, per side; everything returned, optimum decided manually.

## 3 · The core formula — the support margin
Everything the engine decides is the sign of one number; everything it reports is its value.

    m(q, E) = d(q̃, ∂P) · E/L − r          [mm of slack]
    q̃      = C + (q − a) · L / E          [magnet mapped into the shape's own frame]

d(x, ∂P): distance to the outline, negative outside (sign from point-in-polygon, magnitude from
min point-segment distance). Magnet lawful ⟺ m ≥ 0 (closed: touching counts).

One number, four readings:
- lawfulness: sign(m)
- clearance evidence: value of m
- binding contact: argmin m over the layout's magnets + the outline edge achieving d
- refusal explanation: a failed candidate reports WHICH magnet and HOW MANY mm of fabric are missing

Why the shape is never scaled: q̃ divides by E instead — the outline is read once, in its own frame,
and no rescaled geometry ever exists. All decisions are subtraction + comparison.

## 4 · Candidate domain — generated from the grid before the shape is seen
Grid quantities, per layout R (rows×cols rectangle template, both orientations, pairs included):

    span_x(R,p) = (cols−1)p + 2c ;  span_y(R,p) = (rows−1)p + 2c

Ladder per band window (one pitch wide, stepped by the cell):

    D(b,p) = { G(b,p) + k·c : k = 0 … p/c − 1 }      → 4 values dense, 8 sparse

BINDING-AXIS rule (meta's measured correction — stepping the wrong axis jumps in 16mm lumps and
overshoots the true minimum): the ladder value binds the axis the grid span constrains; the OTHER
dimension follows from the locked aspect; the PUBLISHED size is the longest side, rounded UP to the
next even integer (EC-07 unchanged). The grid number stays exact on its axis; the published number
is the aspect's consequence — the only non-grid number in the system, and it is an output.

Domain size: 2 bands × 2 pitches × ladders × layouts ≈ 10² candidates per centre. Known before any
shape exists.

## 5 · Assembly — arrangements from the material (grammar unchanged)
For each (C, b, p, ladder value):
    S = { q ∈ window(b,p) : m(q,E) ≥ 0 }                    survivors
    edges = { (q,q′) ⊆ S : |q−q′| = p, axis-aligned }        no diagonals
    arrangements = connected components with ≥ 1 edge         the L emerges by itself; singletons never offered
Coupling: a family exists at E ⟺ an arrangement holds at 48 AND at 96, same E, same parity target.

## 6 · Evidence — constant time, no outline passes
Shape extent at E: bbox(P−C)·E/L + a (bbox computed once).
    flap_side  = max(0, extent_side − (magnet_extent_side + r))     four subtractions
    evenness   = max(flap) − min(flap)
    switch pass ⟺ all four ≤ selected switch; over-limit → exception-pending, never approved
Quadrant balance (Dan's method, formalised): split bbox(P) at C into 4 quadrants; each quadrant's
outermost magnet must have m ≥ 0; degree of balance = spread of those four m values. Same margin
function, per-quadrant reading.
Twin-fix: |arrangement| = 2 → twin, size-eligible ⟺ published < G(4,48) + max(switch) = 192.

## 7 · Determinism and cost
No floats in any DECISION: candidates are integers; m comparisons reduce to integer-scalable
arithmetic at the 1mm floor (multiply through by E and L to clear divisions where exactness at the
boundary matters: d(q̃,∂P)·E ≥ r·L with all quantities integer-scaled). Cost: |candidates| × ≤9
magnets × one distance query ≈ 10³–10⁴ distance evaluations per centre. Direct evaluation:
sub-millisecond at 1mm trace fidelity; one distance map per (shape, centre) turns each query into a
lookup if traces stay large. Mobile-safe by construction.

## 8 · Unknowns — held open, never defaulted
- O-1 centre construction policy (all six computed; which offers)
- separation / user ladder thinning (EC-11b unresolved)
- "optimum" across populations: per-population four-corner optima exist; the joint definition never
  fires on the corpus — Dan to define
- disconnected components (two wings = one product?) — Dan
- presentation order — Dan

## 9 · Open mathematical questions for the three lanes (this round)
Q1 (pixel): does m(q,E) ≥ 0 fully replace disc-in-material for ALL simple polygons — including a
notch narrower than the disc approaching q from outside the shape? (Claim: yes — d is distance to
the FULL boundary, any intrusion within r flips the sign. Attack it.)
Q2 (meta): binding-axis ladder — confirm against your running rebuild that stepping the constrained
axis reproduces your corrected BOT minimum (80×108, not 84×113) for every layout class.
Q3 (both): coupling at "the same E" — with the binding-axis rule the published size is aspect-
derived; define precisely which value the 48/96 coupling equates (proposal: the exact binding-axis
grid value pair must map to the SAME published even integer; state a counterexample if one exists).
Q4 (pixel): integer-exact form of d(q̃,∂P)·E ≥ r·L — bound the magnitudes and specify where (if
anywhere) 64-bit doubles are insufficient at the 1mm floor. (Claim: nowhere; verify.)
Q5 (meta): quadrant balance vs per-side flap spread — do they ever disagree on ranking a layout's
evenness? If yes, both are reported; if provably never, one is redundant and dies.

---
# CONVERGENCE DRAFT 1 — after round-1 cross-attacks (lead ⇄ meta ⇄ pixel)

## C1 · The canonical formula (pointwise form wins; ray form derived)
    m(q, S) = d( C + (q−a)·L/S , ∂P ) · S/L − 12   ≥ 0     (closed; touching lawful)
d = SIGNED full-nearest-boundary distance (negative outside; magnitude = min point-segment
distance over ALL outline edges). This settles three round-1 breaks at once:
- pixel's v=0: q=a puts the magnet at C for every S — pointwise form has no division; lawful ⟺
  S ≥ 12·L/d(C,∂P). Only the ray form ρ(t)/t degenerates at t=0; it is DERIVED, not canonical.
- pixel's off-ray notch: d is full-boundary clearance, never ray-polygon intersection. ρ(t) is
  DEFINED as d evaluated at ray points — with that definition the notch binds correctly.
- meta's star-shape worry: nothing assumes star-shapedness. The magnet's normalised position
  slides along its ray; d is a total function of position; every re-entry is just m changing sign
  again. Completeness needs no proof beyond d's own definition.

## C2 · Combination is INTERSECTION of size-sets, never max-of-minima (unanimous)
Per magnet: lawful S form disjoint bands (waists). Per layout: ∩ over its magnets. Assembly
inverts the loop (meta's inversion = pixel's masks = lead's survivors): compute each of the ≤13
window positions' lawfulness per candidate ONCE; a layout is whatever survives — components of
axis-aligned pitch pairs. The L emerges; partials are free; nothing is enumerated per rectangle.

## C3 · Domain reconciliation (pixel's break 3 — grid-dictated vs meta's 136)
Both are right, on different axes. Candidates are GRID values on the BINDING AXIS: the dimension
the grid span constrains steps the ladder G(b,p)+k·12 — generated before the shape exists (Dan's
ruling). The published size is the LONGEST side, which follows from the locked aspect and rounds
UP to even (EC-07): a non-grid number, but an OUTPUT, never a candidate. Meta's 136 for BOT is a
published long side; its binding-axis value sits on the ladder. Coupling (Q3 answered): one
candidate fixes one physical scale σ = ladder/bindingSide; BOTH pitches are tested at that same σ;
family ⟺ both non-empty; published = ceil_even(σ·L).

## C4 · No crossings are ever solved (unanimous after round 1)
The engine evaluates sign(m) at candidates only — integer-exact at the 1mm floor by clearing the
division: d(·)·S ≥ 12·L. Meta's ρ-curve remains the ANALYSIS/diagnostic form (names the exact
crossing); pixel's per-magnet bitmasks (4 bits per band at 48, 8 at 96) are the engine's runtime
form; they are the same information. Blind atom round-up is dead: publication selects candidates
already inside the intersected lawful set (pixel's break 2).

## C5 · One S-axis carries everything (meta's synthesis, adopted)
Support = sign changes on S. Flap is LINEAR in S (extent = S × normalised extent; grid box fixed),
so each flap switch is one more threshold on the same axis; ceiling is a cap; 48/96 coupling is an
intersection. A shape's complete answer = a handful of intervals on one number line → the
"fingerprint": ≤13 positions × per-candidate bits + two extents ≈ hundreds of BYTES per shape
(vs 27–112MB). Library precomputes to nothing; a phone solves a fresh shape in ~13 distance walks.

## C6 · Flagged for Dan, not decided (unchanged + one new)
Centre policy (O-1) — NEW framing from meta: the formula prices any centre, so the centre could be
an OUTPUT (minimise the worst quadrant's demand) instead of a menu; product call, parked. Ladder
separation; joint-optimum definition; disconnected components; presentation order.

## C7 · Verification plan for the agreed formula
- pixel's brute-force disc oracle at 1mm (independent implementation) over the seven cutouts:
  identical survivor masks per candidate, all six centres.
- meta's C-fixture class: a layout whose magnets have disjoint lawful bands with staggered gaps —
  proves intersection-not-max in code, kept as a permanent fixture.
- BOT L-at-120/132, butterfly 4-disc-from-130: the two Dan-named cases as acceptance fixtures.

---
# ROUND 2 — pixel's attacks, adjudicated into the draft

## C8 · Q4 was FALSE as written — the integer form is the distance transform, not cleared division
Pixel's refutation stands: point-segment distance carries projection/division/sqrt; two centres
(perimeter, max-clearance) are irrational; d·S ≥ 12·L does not integerise, and squared
cross-multiplication can exceed 2^53. ADOPTED replacement (product-native, no kernel):
per candidate, rasterise the manufactured shape at the 1mm floor (fixed deterministic raster rule),
take the exact integer squared Euclidean distance transform, and support is
    DT²(q) ≥ 144        (12² — constant, because the mask is at manufactured scale)
All integers, no sqrt, no division, no exact kernel, ~96 small DTs per shape ≈ tens of ms worst
case, and it IS L19: the computation happens at the resolution the product exists at. The margin
value m = √DT² − 12 remains available as evidence (float for display only, never for decisions).

## C9 · Coupling is by σ, never by rounding (Q3 closed)
Equal ROUNDED published sizes can join two different exact scales — refuted by pixel. A family is
one manufactured object: ONE candidate σ, both pitches tested at it, identical manufactured
bbox/scale by construction. Publication rounds the longest side up to even for display and
manufacture labelling; it never participates in coupling.

## C10 · The grammar break — options are admissible SUBSETS, not just maximal components
Components-of-survivors hides lawful sub-layouts when more magnets hold — and Dan has ruled the
product wants them (the triangle: "mid bottom point can be hidden to leave 3 points only"; the
engine presents ALL options). ADOPTED: an option is an admissible subset of the survivors — every
selected magnet has a pitch-adjacent selected partner (pair floor, no isolated magnet), connected
(disconnected unions stay parked in C6). ≤512 subsets at a 3×3 window; trivial at this scale.
Maximal components remain as the default view; subsets are the complete option space.

## C11 · Q5 closed: flap spread and quadrant-margin spread are NOT redundant
Counterexample (pixel): symmetric bbox with an internal notch — flap spread 0, quadrant margins
unequal. Both measures stay, reported separately (no blending; precedence is Dan's O-3).

## C12 · Verified this round
Q1 holds (disc ⊆ P ⟺ inside ∧ full-boundary d ≥ r — off-ray notches included by min-over-edges).
Lead/meta formula equivalence confirmed by pixel after t = |q−a|·L/E substitution.

---
# ROUND 3 — meta's AGREE + counterexample; the formula is sealed

## C13 · Intersection-not-max, proven in code (meta's fixture — permanent regression property)
Staggered-gaps fixture (100×100 frame, mouth from the right, notch off the top, deliberately
asymmetric): per-magnet lawful sets UL 72–600 · UR 72–300,600 · LL 120–600 · LR 72,600.
Intersection = {600} only. Max-of-minima = 120 — a size where LR has NO fabric under it, missing
the truth by 480mm. CRITICAL FIXTURE PROPERTY: the gaps must be STAGGERED — the symmetric variant
(sets 72–120 ∪ 360–600 aligned) passes a max-of-minima implementation and hides the defect. Any
regression test for this clause must use staggered gaps.

## C14 · The ladder steps the axis the LAYOUT binds (meta's correction, owed to Dan by meta)
"136 for BOT" was a threshold, not a manufacturable size — 144 (band 3, third ladder value) is the
answer; the stepper was right and four-per-band was never too narrow. What survives: the ladder
steps the axis the LAYOUT's span constrains (BOT 1×2: step the height), never the shape's smaller
side by default.

## C15 · The ray form is analysis-only (meta withdraws it from the engine)
A direct DT query already returns the binding magnet, binding edge and an integer margin.

---
# THE AGREED FORMULA — one page, three lanes signed
INPUTS (all guarded): outline P at the 1mm floor, aspect locked; cell 12; pitch 48/96 (one lattice,
thinned); disc radius 12; bands 2,3; ceiling 9×9 (=408); flap switch {12,24}; centre constructions
(all six, policy open); parity target a per axis (odd run → 0, even → 24).
KNOWNS: everything above + band ladders D(b,p) = G(b,p)+k·12 (4 values at 48, 8 at 96), generated
before any shape exists; the ladder steps the LAYOUT-bound axis; published size = longest side via
locked aspect, rounded UP to even — an output, never a candidate, never used for coupling.
UNKNOWN SOLVED: which (layout, candidate σ) are lawful, with coordinates and evidence.
METHOD:
  per candidate σ (≈96 per centre):
    1. rasterise the manufactured shape at 1mm (fixed deterministic rule)
    2. exact integer squared distance transform DT²
    3. survivor magnets: DT²(q) ≥ 144           ← THE formula; sign only, integers only
    4. options = admissible connected subsets of survivors (every magnet has a pitch-adjacent
       partner; ≤512 at 3×3); maximal components = default view
    5. family ⟺ both pitches have an option at this σ (coupling by σ, never by rounding)
    6. evidence: flap = 4 subtractions from the padded magnet extent (linear in σ); evenness =
       flap spread; quadrant balance = spread of per-quadrant min margins (NOT redundant — C11);
       binding contact = argmin DT² magnet + its nearest boundary cell; twin-fix cap 192
UNKNOWNS HELD FOR DAN (labels, never computation): centre policy (incl. centre-as-output idea),
ladder separation, joint-optimum definition, disconnected unions, presentation order.
COST: ≈96 candidates × (1mm raster + DT + ≤13 lookups) ≈ tens of ms worst case, mobile-safe;
library shapes precompute to a per-shape fingerprint of hundreds of bytes.
VERIFICATION: pixel's independent 1mm brute-force disc oracle — identical survivor masks per
candidate; meta's staggered-gaps fixture (C13); butterfly-from-130 and BOT L-at-120/132 as
acceptance fixtures (Dan-named cases).
Signed: @s62-lead (author) · @s62-kai-meta (AGREE, round 3) · @s62-grid-pixel (attacks folded C8–C12; final sign-off requested)

## C16 · Pixel's clause verdict — two sharpenings adopted, rest already folded
- C3 definition (adopted verbatim): the canonical candidate set is the DEDUPED UNION of every
  grid/template/binding-axis ladder value, expressed as physical scales; both populations are
  tested at each identical scale. Rounded E never couples (restates C9).
- C5 correction (adopted): flap is linear in σ only WITHIN a fixed arrangement; across survivor
  changes it is piecewise — evidence is computed per (arrangement, candidate), never extrapolated.
- C2/C4 verdicts were already C10/C8 (subsets ≥2 with induced degree ≥1; DT² int32-exact, max
  squared distance < 333k). C1 agreed by all three lanes.
- Status: meta AGREE (round 3) · pixel building the independent 1mm mask oracle before signing —
  the sign-off gate is identical survivor masks per candidate across both implementations.

## C17 · The candidate-scale equation — exact, two-builder-deterministic (answers pixel's C3 gap)
For layout R with grid spans (gx, gy) at pitch p, source bbox (W, H) integers at the 1mm floor:

    binding axis  j  = argmax( gx/W , gy/H )        tie → x   (computed as gx·H ≥ gy·W, integers)
    candidates    σ_k = ( span_j(R,p) + 12k ) / dim_j        k = 0 … p/12 − 1
                        span_j = gx if j=x else gy;  dim_j = W if j=x else H

The ladder starts from the LAYOUT's own span on its binding axis — not from the band's square span
G(b,p); G is the special case where R is the full band square. The window is one pitch wide
(k < p/12) because at span_j + p the next run-length takes over on that axis: 4 candidates at 48,
8 at 96, per layout. The manufactured dimension on axis j is span_j + 12k EXACTLY (the grid
number); the other dimension is σ_k × its source dimension (locked aspect); the published size is
ceil_even(σ_k · L) — display/labelling only.

σ_k is a ratio of two integers (span_j + 12k, dim_j) — the deduped union (C16) dedupes on the
REDUCED FRACTION, exactly, no float keys. Butterfly falsifier resolved: wide shape (W > H),
horizontal pair (72,24): 72·H vs 24·W with W ≈ 1.22H → 72H > 24W → j = x, manufactured WIDTH ∈
{72,84,96,108}. Vertical pair (24,72): j = y, manufactured HEIGHT ∈ {72,84,96,108}, width follows
the aspect. Two builders now generate identical dimension sets from these two lines.

C4 authority (pixel's hold, accepted): the MASK DT² is the sole decision authority; any
vector-geometry distance is display evidence only and never participates in a lawfulness decision.

## C18 · Execution evidence — the sealed method run as a 40-line scratch script (lead)
Mask + exact integer DT² + C17 candidates, seven real traces (~/.claude/jobs/…/method-probe.mjs):
- BUTTERFLY 2×2@48: 0/4, 0/4, 1/4, **4/4 at published 132** — Dan's case: all four discs on the
  wings at the size the box-interior rule rejected until 212.
- BOT: survivor masks SHOW the partials — 2/4 (pair) at 130, **3/4 (the L) at 146**; the pair 2×1
  first holds at **108**, meta's corrected binding-axis number exactly.
- DUCK 2×2@48: at most 1/4 at any candidate — the no-four-corners fact reproduced.
- Whole corpus, 2×2 both pitches: **752ms unoptimised scratch** (mask rebuilt per layout;
  production shares one mask per σ across all layouts → the ~tens-of-ms budget stands).
Survivor bitmasks per candidate are exactly pixel's runtime form; this output is the format the
mask-oracle sign-off compares against.

## C19 · C17 corrected — the ladder is the BAND union, layout-independent (meta's BOT fixture)
C17's "ladder from the layout's span" was a DEFECT, not a wording nuance: it caps a 2×2 at
72–108 forever, making BOT's four-corner answer at 144 unreachable — exactly Dan's "the easiest
shape to fit and you couldn't" failure, reinstated. Corrected: the candidate values on the binding
axis are the UNION over operational bands of the band ladders,
    T ∈ ⋃_b { G(b,p) + 12k : k = 0 … p/12−1 }      = {72…108} ∪ {120…156} at 48 (8 values)
                                                      = {120…204} ∪ {216…300} at 96 (16 values)
and EVERY layout is tested at every value; the layout's spans serve ONLY to pick the binding axis
(integer cross-compare, unchanged). BOT-2×2-at-144 is the permanent fixture for this clause.

## C20 · Predicate adjudicated on measurement (meta): the 1mm field IS the predicate
Exact vector distance vs 1mm clearance field, whole corpus, every candidate: 5,784 verdicts,
8 disagreements (0.14%), largest true margin at any disagreement 0.44mm — all inside the floor
Dan ruled does not exist, none outside. The field decides; the exact vector form is retained as
the ORACLE that proves the bound. "Integer-exact by clearing the division" is struck (interior
branch overflows doubles, cross² ≈ 2.7e21 ≫ 2^53); the only integer-exact claims that stand are
the mask DT² (< 333k, int32) and the binding-axis cross-compare (small integers).

## C21 · OPEN — tracer reconciliation before the oracle gate can mean anything
Lead's C18 (corpus real.json trace) and meta's own tracer disagree by one candidate on BOT's L
(3/4 at pub 146 vs 2/4 at 108×146, 3/4 first at 120×162). An oracle agreeing with a builder one
candidate off agrees confidently and falsely. RULE for the verification phase: all three lanes run
the SAME canonical trace inputs (the archived corpus real.json), the same raster rule (even-odd,
cell-centre sampling), the same magnet cell rounding (round-half-up per axis), and the same centre
(bbox) — then the mask-oracle gate compares survivor bitmasks. Tracer variance is a separate,
later question (it is input fidelity, not engine math).
