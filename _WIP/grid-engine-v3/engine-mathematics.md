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
