# SCOPE THE RESEARCH EXPOSED — proposed contract amendments

**For review. No code written.** Raised by @s62-lead against `engine-contract.md` at `5ae33a47`.

> **Dan, 2026-08-11:** carry zero Pixel code; the branches are research and evidence only; **"before
> code, identify every missing scope the research exposed and add it explicitly to the contract for
> review"**.

**Zero new checkpoints.** Eleven gaps, folded into the six checks that already own them, plus one item
that belongs in OPEN rather than the contract. The contract stays at twelve. Adding eleven checks is
how the last one reached 161, and the necessity law's first question — what would a senior engineer
delete — has an obvious answer if this arrives as EC-13 through EC-23.

**Every amendment below changes the SIZE, the LAYOUT or the COORDINATES**, except G1, which amends a
check that is already about delivery rather than the answer. Anything that failed that test is not
here.

**How each was found:** by running the research lane, not by reading it. Numbers are mine, measured
today on the bench and proof worktrees.

---

## EC-01 — Locked shape · four gaps, all of them size-changing

**G1 · What the longest side is measured FROM is unstated.**
The engine scales the outline to a manufactured size, but nothing says the source measurement is the
**outline's own bounding box** rather than the source image. Real cut-out PNGs carry transparent
margin — the research has a test for exactly this case, so it is a known live trap, and it is
silent: every published size comes out proportionally wrong and every check still passes.
**Proposed:** *"Scale is relative to the traced outline's own longest side. Transparent margin in the
source image is not part of the shape and never enters the measurement."*

**G2 · Degenerate input has no defined behaviour.**
Fewer than three points, zero area, self-intersecting, or several disjoint limbs. The research code
throws below three points; the contract says nothing, so a fresh build may legitimately invent a
centre for a two-point "outline". *(Verified: it throws on 0, 1 and 2 points.)*
**Proposed:** *"An outline of fewer than three points, or of zero area, is refused explicitly. It is
never completed, repaired or approximated into an answer."*
*Self-intersection and disjoint limbs are NOT ruled here — see OPEN below.*

**G3 · Winding direction is not required to be irrelevant.**
Nothing says a clockwise and an anticlockwise trace of the same shape must give identical answers. It
is cheap to violate — one sign in a shoelace sum — and it would silently mirror every coordinate.
*(Verified across all six centre methods on a 720-point concave outline: identical to 1e-9.)*
**Proposed:** *"Reversing the outline's winding changes no returned value."*

**G4 · Uniform scale is stated; the reference point is not.**
Scaling about the bounding-box centre and about the chosen shape centre give different placements.
**Proposed:** *"Scale is applied about the family's own tested centre, so the centre is a fixed point
of the transform."*

## EC-04 / EC-08 — Centre methods · the largest gap in the document

**G5 · The six centre methods are used but never defined.**
EC-07 returns `centreMethod`; EC-08 keeps "contested centre constructions" as visible options. Neither
names them or says what they mean. Two implementations will differ and both will pass.

This is not pedantry — **measured on a concave outline, box-centre and area-centroid land 14.8mm
apart.** At band 2 that is more than half a magnet spot: it changes which magnets are supported, so
it changes the layout, the coordinates and the published size.

**Proposed — name and define all six, in the contract:**

| name | definition |
|---|---|
| box | centre of the axis-aligned bounding box |
| oriented box | centre of the minimum-area bounding box over the convex hull |
| area | polygon area centroid (shoelace) |
| perimeter | centroid of the boundary, edge-length weighted |
| vertices | arithmetic mean of the outline points |
| maximum clearance | the interior point of greatest distance to the outline (pole of inaccessibility) |

*(Verified: on a square, triangle and 2000-point circle all six agree with analytic truth exactly.
They are standard definitions — which is the point. Naming them costs nothing and removes the only
place where two correct builds can disagree.)*

**G6 · Maximum clearance is iterative and its convergence is unstated.**
It is the only one of the six that is a search rather than a formula. It needs a termination
condition, and the research carried an unexplained one — a resolution written as
`paddingMM / 2 / 2 / 2 / 2` (0.75mm), with no author. **That is precisely the class the tolerance
incident established as forbidden: a number with no author is not law.**
**Proposed:** *"The maximum-clearance search states its termination as a resolution DERIVED from a law
value, reports the resolution with the answer, and refines until the centre moves less than it. No
constant may be introduced without a derivation."*

## EC-05 — Both populations · one gap, and it decides the answer

**G7 · "A pair at 48 and at 96" does not say whether it is the SAME published size.**
Read one way, a family passes if it finds *some* size holding a pair at 48 and *some other* size
holding one at 96 — which is two answers, not one manufacturable product. Nothing in the research
computed the 96 population at all, so this was never exercised.
**Proposed:** *"Both populations are proved at the family's single published size and single scale. A
pair that holds at 48 only at one size and at 96 only at another is not a passing family."*

## EC-07 — The answer · two gaps

**G8 · There is no defined shape for "nothing was lawful".**
`status` allows `failed`, but the contract never says what a band returns when no arrangement is
lawful at any size. An empty list and a stated impossibility are different deliverables, and only one
of them is auditable.
**Proposed:** *"A band with no lawful arrangement returns an explicit statement of that, per band, with
the reason — never an empty result and never silence."*

**G9 · Monotonicity must not be assumed.**
EC-12 lists non-monotonic cases as a test fixture, but no check forbids the implementation that fails
them. A bisection over scale satisfies every word of EC-04 and silently misses lawful islands. **The
research proved these islands are real**: on a stepped-limb shape, legality enters and leaves as the
shape grows.
**Proposed:** *"Legality is not assumed monotonic in scale. Every lawful interval is found, including
those that open after an unlawful one closes."*

## EC-12 — Delivery · one amendment, Dan's L16

**G10 · "Solver work" does not obviously include the centre computation, and it must.**
EC-12 forbids coupling *solver* work to interaction. Centre computation is not obviously solver work,
and it is not free.

Measured, 1440-point trace: **all six centre methods 4.4ms** — against a 16.7ms frame, a quarter of
the budget before any solving starts. The rejected scan was **163.7ms**, ~10 frames per event; that is
the dominant freeze, but the keepers are not exempt.

**Proposed:** *"Centre computation is bound by this clause exactly as solving is. Both are computed
once per frozen outline and cached; neither runs during pinch, resize, pan, drag, camera movement or
variant browsing. Browsing a cached result performs no computation."*

**G11 · Caching has no invalidation rule, and without one it breaks the blindness law.**
The moment a result is cached, "change an input and everything re-derives" depends entirely on the
cache key. Key it on the outline alone and changing the padding silently serves a stale answer — a
wrong manufacturing size, produced by the very optimisation added to make the build usable.
**Proposed:** *"The cache key is the outline together with every law value that reaches the engine. Any
change to any of them invalidates the result. A cached answer is never returned for inputs that did
not produce it."*

---

# NOT PROPOSED — belongs in OPEN, not the contract

**Tessellation stability.** The same PNG traced at different resolutions produces different point
counts, and a discrete lawful/unlawful boundary can move with it. This is the law book's O-4, carried
from v1 and never ruled. **A contract cannot check what has no answer**, so the proposal is only that
the engine **report** the outline's point count with each family, so the effect is visible on the real
corpus before anyone rules on it.

**Self-intersecting outlines and disjoint limbs.** G2 refuses the clearly degenerate. What a
self-intersecting trace or a shape in two separate pieces should DO is a product question — reject,
take the largest limb, or treat them together — and inventing it is the failure this whole cleanup
was about.

---

# VERDICT LINES

**Necessity — no unnecessary elements.** Zero new checkpoints. Eleven amendments, each folded into the
check that already owns the subject. Nine change the size, the layout or the coordinates directly; G10
and G11 amend a check that is already about delivery. Two candidates were **refused** and sent to OPEN
rather than written as checks.

**Sufficiency — partial by design, and the gap is named.** This closes every scope the research
exposed. It does not close the unruled product questions, and it must not.

— @s62-lead
