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

## C22 · The digital-object law — the raster semantics, fully specified (closes pixel's block)
L19 makes these DEFINITIONS, not approximations: the product exists at the 1mm floor, so the
digital object IS the truth, and the continuous trace is analysis. There is no error bar to argue
— only a convention to fix, identically, in every implementation.

1. MATERIAL: the set of integer points (cell centres, coordinates ∈ Z²) that are inside the
   manufactured outline by the even-odd rule, evaluated at the exact point (x+0.5, y+0.5) in
   manufactured mm. On-edge ties resolve by the even-odd crossing test itself (half-open: an edge
   counts iff it spans the sample's y half-open [y1,y2)); no secondary convention exists.
2. MAGNET POINT: q̃ rounded half-up per axis to an integer point. Deterministic, stated, shared.
3. SUPPORT: support(q) ⟺ min over NON-material integer points z of |q−z|² ≥ 144, i.e. the
   exact integer DT² at q's cell. Distance is centre-to-centre BY DEFINITION — the digital law is
   lattice arithmetic and has no continuous referent. Equality (nearest gap centre at exactly
   12mm) PASSES — the digital analogue of Dan's tangency-is-lawful.
4. Pixel's 11.6/12/12.4 boundary attacks are thereby reclassified: they are sub-floor distinctions
   with no product meaning; the fixtures are KEPT as DETERMINISM tests — both implementations must
   return the IDENTICAL verdict on them, whichever it is under rules 1–3.

TEMPLATE naming (pixel's correction, adopted): R in C17/C19 is a PRE-SUPPORT template — a window
extent/orientation, never a post-support arrangement. Candidates are generated from every
permitted template, deduped on reduced σ; THEN every population is evaluated at every canonical σ;
survivor subsets are formed last. (BOT: σ from the band-3 template admits a supported 2×2 subset
that the 2×2's own extent never generated.)

σ-UNION SCOPE (the one exact sentence pixel required): the canonical σ set is the deduped union
over BOTH pitches' templates AND all operational bands; BOTH populations are evaluated at every
member of that union. Coupling is membership of both populations' non-empty option sets at the
same σ — never at a rounded size.

ORACLE GATE (final form): implementation A = direct digital-disc containment on the 1mm mask
(stencil of rule 3 expanded literally); implementation B = the EDT predicate. Required identical:
per-position survivor masks for every canonical σ × both populations × all six centres × seven
canonical traces (C21 inputs), AND the derived family sets (meta's 8 flips prove a single-bit flip
can change a family — family-level comparison is mandatory). Permanent attacks: 11.6/12/12.4 axis
+ diagonal, staggered-gap intersection, same-σ duplicate, BOT 2×2@144, butterfly four-disc.

## C23 · Predicate authority REVERSED on family-level evidence; field demoted to prefilter
Meta's retraction, measured: 1,324 candidates corpus-wide, survivor masks differ on 7 (0.53%),
and on TWO of them a whole product offer appears/disappears (POKE1 & POKE2 1×3@96 T=216: exact
NO OFFER vs field OFFER). A 0.44mm geometric artefact of the SAMPLING convention invents a
three-magnet option on real cut-outs. "Below the floor" describes geometry — the support BIT is
the product output and is fully expressible. Therefore:
- AUTHORITY: the exact disc-vs-polygon predicate on the INTAKE-QUANTISED outline (integer
  vertices — L19, Dan's ruling) decides support. No sampling convention exists in the decision
  path, so C22's digital-object law is DEMOTED from truth to implementation detail of a filter.
  The only convention left standing is "vertices are integers", which Dan ruled.
- FILTER ARCHITECTURE (keeps the speed, kills the kernel sprawl): the 1mm DT field runs first;
  any magnet whose |DT² − 144| is OUTSIDE a proven uncertainty band is decided by the field
  (provably identical to exact); only magnets INSIDE the band — meta measured 7 of 5,784 — go to
  the exact predicate. The exact interior branch needs either a stated forward-error filter with
  exact fallback or a magnitude bound (cross² ≈ 2.7e21 > 2^53 at the ceiling) — meta is measuring
  which; the fallback, if needed, is ~30 contained lines for ONE predicate, not a kernel.
- ORACLE GATE REDIRECTED: implementations must agree on EXACT-predicate verdicts (and family
  sets); mask-vs-mask agreement only certifies the filter tier. My emitted masks
  (lead-survivor-masks.json, 7 shapes × 20 σ × 8 templates × both pitches) stand as the
  filter-tier comparison artifact, not the authority gate.
- C17/C19 status for the record: the band-union ladder is ALREADY adopted (C19, BOT-144 fixture);
  meta's standing flag is answered, not open.

## C24 · Final predicate form (pixel's formulation adopted) + the centre-identity rule
PREDICATE (the only decision law, evaluated ONLY at C19 candidates — no events, roots, intervals):
    support(q) ⟺ inside(q, P) ∧ min over edges of dist²(q, e) ≥ 144
    interior-projection branch compared exactly as  cross²(d, q−v) ≥ 144·|d|²   (closed equality)
Implementation: Number arithmetic with a PROVED forward-error bound; BigInt/rational fallback only
inside the uncertainty band; fallback frequency and cost MEASURED and reported (meta owns the
bound/number). Preprocessing at intake: exact duplicate + collinear vertex removal, spatial edge
index. Per-(candidate, position) verdicts cached BEFORE subset enumeration, so ≤512 subsets per
window share one predicate pass. The DT field may serve as a prefilter only where provably
identical to this predicate; it decides nothing near the band.

CENTRE IDENTITY (closes pixel's blocking detail): the six centre constructions are computed
exactly, then QUANTISED TO INTEGER MILLIMETRES at intake (round-half-up per axis) — the same L19
status as outline vertices: the product cannot manufacture a sub-millimetre registration, so a
centre's product identity is its 1mm cell. All downstream quantities are then integer/rational
(C integer, offsets integer, σ rational), and the predicate's exactness claim is closed. FLAGGED
to Dan as an L19 derivation (not a new ruling): centre coordinates carry no sub-mm authority.

SEAL STATUS: formula + domain + grammar + predicate agreed across three lanes. Outstanding before
seal: (1) meta's overflow bound / filter number; (2) pixel's independent oracle run on the
canonical traces (exact-predicate verdicts + family sets); (3) meta's BOT numbers rerun on the
canonical trace (C21).

## C25 · The overflow number (meta, measured) + the centre split — C24's rule confirmed
Filter+fallback beats any magnitude bound, by measurement: 1,324 candidates, 508,345 predicate
calls, **76 exact fallbacks (0.0150%)**, whole corpus **22ms = 3.2ms/shape UNOPTIMISED** (no edge
index, no caches). Bounds C=16 endpoint / C=64 interior, deliberately loose — a loose bound only
routes MORE cases to exact and can never produce a wrong sign. The predicate is not the cost.

Centre constructions split on an integer outline (meta's derivation, marked as derivation):
RATIONAL exact: bbox, vertex mean, area centroid, oriented box (min-area rect axis is an edge
direction; normalisations cancel; no root survives). NOT rational: perimeter centroid (√ edge
weights), maximum clearance (three-feature equidistance — and it is the one construction that
gives the DUCK any four-point answer, so not academic). C24's rule stands with this sharpened
rationale: all six centres quantised to integer mm at intake — a quantised CENTRE is a different
INPUT evaluated exactly (offer set exactly correct for the centre used), unlike the quantised
PREDICATE that made geometry wrong and invented offers. Cost stated: two constructions move ≤0.5mm.
Alternative (algebraic-number centres) reintroduces deleted machinery for unruled constructions —
rejected. Three lanes now aligned on this independently.

SEAL CHECKLIST update: (1) overflow number — DONE (this clause). Remaining: (2) pixel's
independent oracle run (exact verdicts + family sets, canonical traces); (3) meta's BOT rerun on
the canonical trace.

## C26 · Lead's exact-verdict artifact + one C21 amendment the emitter exposed
C21 AMENDMENT (required, discovered by running): the archived canonical traces are UNIT-normalised
— "integer-mm intake" is undefined without a source scale. Canonical intake for the verification
phase: unit trace × 400, rounded to integer mm, consecutive duplicates removed. (Source scale is
arbitrary — σ carries size; 400 preserves ~1mm trace fidelity.) All three implementations must
use it or verdicts diverge at intake, before any mathematics.
ARTIFACT: lead-exact-verdicts.json (jobs tmp) — 7 shapes × 20 canonical σ (reduced fractions) ×
8 templates × both pitches = 19,180 exact-predicate verdicts; 123 BigInt fallbacks (0.64% — higher
than meta's rate because the T-scaled frame carries larger magnitudes under the same loose bound);
2.1s total unindexed. Reproduced under the EXACT authority: BOT 2×2@48 progression 1/4 → 2/4 →
3/4 (the L, at multiple σ) → 4/4 from σ=12/25 (pub ≈ 192·?; values in artifact); BUTTERFLY 2×2@48
4/4 throughout band-2 candidates — Dan's case under the final predicate. Gate = three-way
agreement on these keys: lead (this artifact) · pixel's independent oracle · meta's rerun.

## C27 · Two C24 sharpenings (pixel, adopted)
1. The support authority is the MINIMAL BOOLEAN, not a distance engine:
       support(q) ⟺ inside(q,P) ∧ no edge enters the OPEN radius-12 disc about q
   implemented by the same exact comparisons in refusal form (endpoint dist² < 144; interior
   cross² < 144·|d|² with projection inside the segment) — any hit refuses, closed equality
   passes. Spatial bins (edge bboxes within 12) are optimisation only. Nearest clearance/contact
   is EVIDENCE, computed once per unique supported (position, candidate) and shared by every
   subset — never repeated decision logic.
2. Centre identities, corrected: the five analytic constructions compute their ideal point then
   round half-up. MAXIMUM CLEARANCE is DEFINED DIRECTLY as the integer-millimetre interior point
   maximising exact clearance, canonical tie order (smallest y, then smallest x) — no continuous
   algebraic search exists to approximate, which is what makes L19 real for the one construction
   that had no rational form. Finite domain, exact comparisons, deterministic by construction.

## C28 · BOT rerun (meta): sequence and ladder-key MATCH; intake now committed; snap is consequential
Meta's second implementation on the canonical scaling rule reproduces the exact progression
1/4 → 2/4 → 3/4(L at 120,132) → 4/4 first at T=144 — the C19 fixture doing its work from an
independent codebase. σ differed (0.4865 vs 12/25) because the canonical TRACE FILE was not
retrievable by other lanes — my error: it lived in this session's private tmp. FIXED: committed at
_WIP/grid-engine-v3/evidence/canonical-traces.json — the gate input, one file, all lanes.

SNAP DIFF (meta, measured — pixel's pre-seal demand): ideal vs half-up centres, six methods,
1,324 candidates each: mask differs 9–30 per method, WHOLE OFFERS FLIP 2–8 per method — including
the bbox centre (half-integer whenever an extent is odd). Recorded VERBATIM: snapping is
CONSEQUENTIAL, not small; C24 stands on its actual ground (the snapped answer is exactly correct
for the centre actually used — a representation rule with product-visible consequences, stated,
never implied minor). Dan sees this line when centre policy (O-1) is ruled.

TIE ORDERS pinned as fixtures (two builders must not diverge on shapes neither got wrong):
- bbox centre: (min+max)/2 rounds HALF-UP per axis (odd extents land on .5 — the fixture).
- max clearance: integer argmax with canonical order smallest y, then smallest x (C27) — the
  tied-cells fixture asserts equal-clearance cells resolve identically in every implementation.

## C29 · The thinned-96 phase fix (pixel's block) + the σ reconciliation (meta's option a)
PHASE FIX — pixel caught my artifact minting a fresh centred 96 lattice (±48 offsets), the exact
"second lattice" defect Dan killed at 08:13 and ruled in 9.3a: 96 HIDES points on the unmoved 48
lattice; even 96 runs register in the fixed 24mm gap and are ASYMMETRIC about the centre, with TWO
phases per axis: {−24,+72} and {−72,+24}; odd 96 runs register on-magnet: {−96,0,+96}. ALL phases
are enumerated (the engine presents every option; phase selection is never invented) — record keys
carry `#<phaseX><phaseY>`. Artifact REGENERATED: 26,852 verdicts, 171 fallbacks (0.64%), 2.8s.
Every prior 96 verdict and coupling in my artifact was invalid; 48 verdicts unchanged.

σ RECONCILIATION (meta's a/b question — answered with the tuple): my "4/4 at 12/25" was NOT the
2×2@48 ladder key and NOT a binding-axis bug. 12/25 = 192/400 — T=192 enters the canonical union
from a TALL @96 template (j=y, dim=400) — and per C22's union semantics EVERY template is
evaluated at EVERY union σ, so the 2×2@48 was tested there and happened to hold. The 2×2@48's own
ladder key T=144 → 144/296 = 18/37 is IN my artifact and holds 4/4 — identical to meta's two
independent runs. No disagreement existed: meta compared per-template ladders, my citation was the
first 4/4 in the sorted UNION. Both keys stand; the union evaluation is C22 doing what it says.

## C30 · TWO-WAY VERIFICATION PASSED + band provenance fixed
Pixel's independent BigInt vector oracle vs lead's regenerated artifact: **26,852/26,852 support
bits identical, zero missing/extra σ keys, zero verdict differences** (oracle:
/tmp/s62-grid-exact-oracle.mjs, artifact /tmp/s62-pixel-exact-verdicts.json). The predicate,
keyspace, phases and intake are now proven by two independent implementations.
Pixel's next block, fixed: 8 σ per shape are generated by BOTH bands' ladders and my scalar
`band` kept last-write provenance — now `bands: [2,3]` sets (BOT: 3/10, 33/100, 9/25, 39/100,
15/37, 33/74, 18/37, 39/74). Verdicts unchanged; artifact recommitted @ 4ba713f5. Dan's
per-band completeness is preserved: a dual-ladder σ belongs to both bands' option lists.

## C31 · OPEN — meta's coupled list vs lead's artifact needs a KEY-level diff
Meta's corrected-96 coupling run (their independent implementation, committed intake) agrees with
my artifact on DUCK NONE / BUTTERFLY from 264 / PILL from 252 / POKE2 from 168 — but lists BOT
coupling from T=180 where my first coupled PUBLISHED size is 204. T-lists and published-size lists
are not comparable by eye (the same T maps to different physical sizes per template binding).
Meta to diff at σ-KEY level against the committed artifact before the seal; the BOT-180 row is
the first case to trace. Also to state in the paper once meta confirms: the odd-96-run window rule
(minimise |mean of positions| — meta's choice) and both-phases-as-options (L7 reading: hiding a
different subset of the SAME lattice is not moving it) — both currently conventions, both must be
written or two builders diverge.

## C32 · Coupling law sharpened; window rule DERIVED not chosen; phases clause; tangency fixture
1. COUPLING IS AT ONE PHYSICAL σ, NEVER AT ONE LADDER VALUE (generalises C9 — meta's BOT trace):
   the same T under two binding axes is two different manufactured shapes (BOT: 48-pair at
   σ=180/400 = 133×180 vs 96-pair at σ=180/296 = 180×243 — coupling them invents a family). My
   artifact was right; meta's T-indexed coupling was the defect, and their earlier coupled lists
   are DEMOTED to non-independent (same-axis luck) pending their σ-keyed rerun vs 4ba713f5.
2. ODD-96 WINDOW — NO CONVENTION EXISTS (pixel's derivation, meta's own rule withdrawn by meta):
   L6 centres an odd run ON a magnet, so a 96 3-run must contain the parity target — exactly
   {−96, 0, +96}; the other colour class has no member at 0 and is not an odd-on-magnet run.
   Nothing is left to choose. (Meta's |mean| rule was an invented convention over a closed law —
   struck, recorded here as the failure mode caught in the act.)
3. BOTH PHASES AS OPTIONS (meta's sentence, adopted verbatim): for an even sparse run both 1-D
   colour classes are enumerated as separate lawful options. Neither is preferred — both are
   subsets of the SAME unmoved 48mm lattice; hiding a different subset is not moving it (L7), and
   offering only one would be the engine choosing where the lattice sits. 2-D extension (pixel):
   the lattice is a Cartesian product; x and y phases are independent; even×even enumerates all
   four products.
4. THIRD-IMPLEMENTATION DIFF (meta vs artifact): 26,850/26,852 — the two misses are meta's own
   plain-double refusals at PILL σ=12/25, position (−48,0), 1×3@48 and 3×3@48, clearance EXACTLY
   12.000: the real-corpus tangency case. PINNED as a fixture beside the square canon — the square
   proves tangency must be lawful in principle; PILL proves the corpus reaches it at a real ladder
   value (the concrete case behind the 76/508,345 fallback count).
SEAL STATUS: three implementations agree to 26,850–26,852/26,852 with every residual explained and
owned. Remaining: pixel's family-set comparison; meta's σ-keyed coupling rerun.

## C33 · Coupling layer verified three-way; demotion lifted; the product fact
Meta's σ-keyed rerun (own predicate, own bits, artifact keyspace) matches the exact artifact on
every overlapping shape — BOT 204 (the 180 died with index-coupling), DUCK NONE, POKE2 168,
POKE1 170, PILL 252, BUTTERFLY 263, and BAT-WOMAN 175 (σ=7/16, 2×1@48 + 2×1@96#00 — now verified
in the lead artifact too: both pairs hold). The C32 demotion is LIFTED: coupling-layer agreement
now carries the same third-implementation independence as the 26,850/26,852 bit diff.
PRODUCT FACT (for Dan when he returns, meta's correction of their own earlier claim): every corpus
shape except the DUCK couples, but the first coupled size is LATE — 168 to 263mm — because a
sparse pair needs ~96mm of material between magnets plus padding before both populations hold at
one σ. L14's "condition most likely to fail" doing exactly what Dan predicted; it sets the bottom
of every ladder. (The earlier "butterfly cannot couple at all" was wrong in the specific, right in
the shape of the effect.)
SEAL: waits on pixel's family-set comparison only.

## C34 · Pixel's family finding confirmed — whole-template coupling was under-inclusive, and the
## duck product fact REVERSES
Pixel's BOT-at-9/20 families verified in my bits (base 2×2@48 survivors carry two lawful subset
pairs; sparse 2×2@96#00 carries a phase pair — 3 registration-compatible families at published
180). My coupling probe and meta's rerun BOTH applied an extra condition beyond C9/C10: whole
pair TEMPLATES instead of admissible SUBSETS. C33's coupled table is superseded.

SUBSET-LEVEL COUPLING from the two-way-verified bits (first coupled, per shape):
  DUCK 180 (σ=9/20) · POKE2 168 · POKE1 172 · BAT-WOMAN 176 · BOT 180 (σ=33/74) · PILL 192 ·
  BUTTERFLY 216
THE DUCK COUPLES. Its base pair {(−24,48),(24,48)} (a subset of the 3×2@48 window's survivors)
and sparse pair {(0,−24),(0,72)} both hold at σ=9/20 — magnets in different places, which no
agreed clause forbids: coupling requires an option in each population at ONE σ (EC-05), never
colocation. Every "duck never couples" line reported tonight — including C33's — was the
whole-template artefact. PRODUCT FACT, corrected: EVERY corpus shape couples; first coupled sizes
run 168–216mm. (Whether non-colocated pair placements are one PRODUCT is a Dan question — parked
in C6 with disconnected unions; the mathematics reports both layouts and hides nothing.)
Meta's σ-keyed rerun must move to subset level before the seal; pixel's family hash at BOT 9/20
compares against these bits once serialisation is shared.

## C35 · Subset coupling agrees THREE-WAY at σ-key level; last delta is publication rounding
Meta's subset rerun (own bits, artifact keyspace) lands on the IDENTICAL σ keys as lead's C34
derivation for all seven shapes: 21/50, 72/169, 7/16, 33/74, 9/20, 12/25, 27/50 — including the
duck at 9/20 and BOT at 33/74. The only column differing is PUBLISHED size (meta 178/175/170 vs
lead 180/176/172): meta reported pre-rounding values; C17 already rules publication = ceil_even
(EC-07, upward, never down) — applied uniformly: POKE2 168 · POKE1 172 · BAT-WOMAN 176 · BOT 180 ·
DUCK 180 · PILL 192 · BUTTERFLY 216. The duck's four-corner impossibility (1,414mm demand) stands
untouched — coupling and four-corners are separate questions.

RECORDED AT META'S OWN REQUEST — why the independent gate exists, not an anecdote: three defects
in one lane in one night (±48 sparse pairs; ladder-index coupling; whole-template coupling), each
producing plausible, self-consistent, non-crashing numbers; each a NARROWER predicate than a rule
that lane had already conceded IN WRITING; none caught by self-review; all three caught inside two
hours by a three-lane diff. The gate is the method; agreement without independence is noise.

SEAL: awaiting pixel's family-hash comparison only. All other layers verified three-way.

## C36 · Parity-registration coupling ENFORCED — DUCK 180 dies, DUCK couples at 204
Pixel's block stands and my C34 "no agreed clause forbids" was MY misread of clauses already
agreed: §5 couples at one parity target, §7.3/blueprint requires per-axis parity equality, EC-07
returns ONE parity-derived registration per family. Registration derives from the coordinates
themselves (axis value ≡24 mod 48 = gap; ≡0 mod 48 = point). DUCK-180's base pair is (gap,point),
its sparse pair (point,gap) — different on both axes — NOT a family. Verified in my bits: duck's
first SAME-registration family is σ=33/65 → published 204 (base top pair from 2×2@48, sparse
phase pair 2×2@96#00 or #10 — all gap,gap). The cross-registration duck-180 is
FORBIDDEN OUTRIGHT, not parked (pixel's correction of my parking): the parity target is the
placement of the SHAPE against the one unmoved lattice — base at a=(gap,point) and sparse at
a=(point,gap) are two DIFFERENT placements of the shape, i.e. two different manufactured objects
masquerading as one family. Nothing to rule; placement uniqueness already decides it.
FINAL COUPLED TABLE (three-way, upward-even publication): POKE2 168 · POKE1 172 · BAT-WOMAN 176 ·
BOT 180 · PILL 192 · DUCK 204 · BUTTERFLY 216.

Meta's FOURTH self-caught defect folded (round-to-nearest publication vs L10's upward — their
numbers now match C35's column exactly), and their generalisation is adopted next to the seal AS
the standing rationale: A NARROWER (or looser) PREDICATE DOES NOT ANNOUNCE ITSELF — it produces
answers of the right magnitude, in the right format, passing every internal check; only a second
independent implementation of the SAME rule exposes it. Four defects in one lane in one night,
zero caught by self-review, all caught by the gate within minutes.

## C37 · Family gate — all counts match on all 330 keys; hashes differ only by string encoding
Lead's band-scoped family derivation (a band's arrangements come from ≤band-square windows —
pixel's model; my cross-band assignment was the defect, 220 mismatches → 0) now agrees with
pixel's independent family artifact on EVERY count on EVERY (shape, σ, band) key: base and sparse
arrangement counts, family counts, pair-pair counts, published sizes — including BOT 9/20 band-2
= 3 families / 2 pair-pair (pixel's original finding, from my bits). The 153 residual hash diffs
carry IDENTICAL counts — serializer string-encoding only; one plaintext familyId reconciles it.
Meta's independent parity-filtered table matches C36 exactly (their own rerun, their own bits):
the final coupled table now has THREE independent implementations behind every number, and meta's
fixture argument is adopted: the parity filter bites ONLY on the duck — a corpus check skipping
one shape would pass six and ship one unlawful family. Fixture sets must be complete, not
representative: DUCK-parity joins PILL-tangency, BOT-144, staggered-gaps.
The generalisation next to the seal, final wording (meta's, both lanes' instances behind it): a
looser predicate is invisible from inside the implementation that holds it, whoever wrote it —
it does not crash, its numbers have the right magnitude and format, and it passes every internal
check the same implementation can write. Only a second independent implementation of the same
stated rule exposes it. Six such defects were caught tonight across two lanes in under three
hours; zero were caught by self-review.

---
# SEAL — the mathematics is verified end to end, three implementations, zero disagreements
Date: 2026-08-11 late. Lanes: @s62-lead · @s62-grid-pixel · @s62-kai-meta.

GATE RESULTS, bottom to top:
- SUPPORT BITS: 26,852/26,852 identical (lead exact artifact vs pixel's independent BigInt
  oracle; meta 26,850/26,852 with both residuals theirs, at the PILL tangency fixture).
- COUPLING: identical σ keys, three implementations, parity-registration enforced.
- FAMILIES: 330/330 (shape, σ, band) keys with identical counts AND byte-identical SHA-256
  hashes (lead vs pixel, BYTEWISE-SORTED COMPLETE familyId serialisation — the written rule;
  generation order is not canonical authority, §9 forbids iteration-order dependence). The two
  committed artifacts are byte-identical whole files: sha256 221fd395… on both sides.
- FINAL COUPLED TABLE (first published family per shape): POKE2 168 · POKE1 172 · BAT-WOMAN 176 ·
  BOT 180 · PILL 192 · DUCK 204 · BUTTERFLY 216. All seven shapes couple. The duck's four-corner
  impossibility stands separately.

THE METHOD THAT SURVIVED, one paragraph: quantise the outline and centres to the product's 1mm
floor at intake; generate candidate scales from the grid alone (band-union ladders on each
template's binding axis, deduped as reduced fractions, capped by the 9×9 ceiling); at each
candidate σ evaluate the EXACT disc-vs-polygon predicate (minimal boolean, float filter with
proved bounds, exact fallback — measured 0.015–0.64% taken) for the ≤13 window positions of each
population, phases of the thinned 96 enumerated; options are admissible connected subsets of
survivors scoped to their band's window; families couple base and sparse options at ONE physical
σ under ONE per-axis parity registration; publication rounds the longest side up to even;
evidence (flap subtractions, quadrant margins, binding contact) reads off the same numbers.
No events, no roots, no intervals, no kernel, no sampling in any decision.

FIXTURES, permanent: staggered-gaps intersection · BOT-2×2-at-144 (band-union ladder) ·
PILL σ=12/25 (−48,0) tangency · DUCK-parity (the filter that bites one shape in seven) ·
butterfly-4-discs-from-130 (disc-not-box) · 11.6/12/12.4 determinism pair · same-σ dedupe.

HELD FOR DAN, unchanged (labels, never computation): centre policy (incl. centre-as-output),
ladder separation, joint-optimum definition, disconnected unions, presentation order.

WHY THE GATE, final wording: a looser predicate is invisible from inside the implementation that
holds it, whoever wrote it. Six defects across two lanes tonight — every one plausible,
self-consistent, format-correct, green on its own tests; every one caught within minutes by a
second implementation of the same stated rule; zero caught by self-review. Agreement without
independence is noise; the three-lane diff is the method.

Signed: @s62-lead · @s62-grid-pixel (330/330 family gate) · @s62-kai-meta (independent tables,
residuals owned). Artifacts: evidence/canonical-traces.json · evidence/lead-exact-verdicts.json ·
evidence/lead-families.json · pixel /tmp/s62-pixel-exact-verdicts{,-families}.json · fixtures named above.

## SEAL ADDENDUM · the serialisation rule itself needed the gate
The C37→seal hash agreement was achieved in NESTED GENERATION ORDER — which was pixel's CODE
violating pixel's own WRITTEN spec (sort complete familyIds), while my first implementation had
followed the spec and I "fixed" it to match their defect. Pixel found their own cause, corrected
to the stated rule (raw code-unit sort of complete familyIds, newline-terminated, SHA-256), and
regenerated (artifact sha256 221fd395…). Re-diff under the written rule: **330/330 keys, zero
diffs, byte-identical hashes**. The seal stands — now on the rule as WRITTEN, not as first coded.
Recorded because it is the seventh instance of tonight's law and the purest: even the agreement
machinery disagrees with its own specification until two implementations diff it.


## SEAL RESIDUALS (meta's, recorded verbatim in substance — a seal that hides residuals is worse
## than one that names them)
1. Meta's drift check compared pair-pair family EXISTENCE, not hash membership — identical
   existence with different membership is untested from their side. (Hash format for the stronger
   check: familyId = band|reducedσ|regX,regY|coords48|regX,regY|coords96, coords sorted (y,x) as
   x,y;x,y, familyIds bytewise-sorted, each + newline, SHA-256.)
2. All three implementations share ONE intake and ONE tracer: a defect in canonical-traces.json is
   invisible to every gate by construction — the one place three-way agreement proves nothing.
3. The corpus is seven shapes; the parity rule bit on exactly one. The fixture set is complete for
   these seven by measurement — untested shape classes remain, and that is where to attack first.

## SEAL ADDENDUM 2 · Meta's spec-conformant check failed — because the transmitted spec was
## incomplete, and the omission is now a written clause
Meta implemented the hash format EXACTLY as I transmitted it and got 13 families at DUCK 36/65
band 2 vs the seal's 2. Diagnosis from the raw survivors at that key: the seal's 2 = the only
same-registration couplings available from ≤2×2 WINDOWS (base 2×2@48 pair {(−24,−24),(24,−24)}
gap,gap × sparse 2×2@96 phase pairs #00/#10); 13 requires subsets of 3-extent windows (3×2@48
carries a 5-survivor chain) entering band 2. THE CLAUSE I FAILED TO TRANSMIT: **a band-b
arrangement is drawn only from windows with rows ≤ b and cols ≤ b (§6.1 — the band IS the window
extent)** — C37 recorded it, my hash-format message omitted it, and a spec that does not state a
clause gets implemented without it (the night's law, eighth instance, this time biting the
specification channel itself). Not maximal-vs-subset: within band-scoped windows EVERY admissible
subset is enumerated, which is why all 330 counts match pixel's independent derivation.
Meta to rerun with the scoping clause; predicted direction split: every count difference
theirs-higher. The seal's grammar is unchanged; the WRITTEN spec is now complete.
