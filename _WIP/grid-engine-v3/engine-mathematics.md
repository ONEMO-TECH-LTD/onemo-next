# LEAD REFERENCE — THE MATHEMATICS

### Input to @s62-grid-pixel's blueprint. **Not the deliverable.**

> **Ownership.** Dan assigned the architecture, technical blueprint and algorithm to
> **@s62-grid-pixel**; @s62-lead supervises and QAs, @s62-meta double-checks. This file is what I had
> derived independently before that assignment. It is offered as input — take it, correct it, or
> discard it. **It is not a rival specification**, and I will QA the blueprint against the CONTRACT and
> the LAW BOOK, not against this. Gating a peer's work against my own checklist would be a closed
> loop.

**No code written.** @s62-lead, 2026-08-11.

> The contract (`engine-contract.md` @ `5ae33a47`) contains no equation, formula or derivation. It
> states what must be **true of an answer** and never how an answer is **produced**. This document is
> the other half. The contract stays twelve checks and cites this; nothing moves into it.

**Zero Pixel source is carried.** The proven work is used as **evidence that a method is sound** and
as an **oracle to check against** — never as an implementation. Every definition below is stated from
first principles so it can be implemented without reading any prototype.

**Notation.** `P` = padding (12mm) · `s` = populated pitch (48 or 96) · `b` = base pitch (48) ·
`n` = band (2, 3, 4) · `N` = positions per axis (9) · `σ` = scale · `M` = the material region.

---

# M3 · THE MATERIAL REGION

Everything else rests on this, so it is defined first.

**Definition.** A traced cut-out is a set of closed rings: one **outer ring** `R₀` and zero or more
**hole rings** `R₁…R_k`. Each ring is a simple polygon (no self-intersection); rings do not cross;
every hole lies strictly inside `R₀`.

    M  =  interior(R₀)  \  ⋃ᵢ₌₁..ₖ interior(Rᵢ)

**Normalisation (required, and it delivers G3 winding-irrelevance).** On input, each ring is oriented
canonically — `R₀` counter-clockwise, holes clockwise — by testing the sign of its shoelace area and
reversing when negative. **All downstream mathematics is therefore winding-invariant by construction**
rather than by care.

    2·Area(R) = Σⱼ ( xⱼ·yⱼ₊₁ − xⱼ₊₁·yⱼ )

**Membership.** `p ∈ M` iff `p` is inside `R₀` and outside every `Rᵢ`, by the even–odd crossing rule.

**Signed clearance** — the one primitive the whole engine stands on:

    d(p, R)  =  minⱼ  dist( p , segment(vⱼ, vⱼ₊₁) )        distance to a ring
    c(p)     =  + min( d(p,R₀), …, d(p,R_k) )   if p ∈ M
                − min( d(p,R₀), …, d(p,R_k) )   otherwise

Point-to-segment distance is the standard clamped projection; no library is required.

**The support predicate (law L2, the whole 24mm disc on material):**

    supported(q)  ⟺  c(q) ≥ P

Holes need no special case: a magnet centre `P` from a hole boundary has clearance `< P` and fails.

**Refused, not repaired (G2).** Fewer than three points, or `|Area(R₀)| = 0` → refuse explicitly.
**OPEN:** two or more disjoint outer rings — a product question, not ours.

---

# M1 · THE ARRANGEMENT GRAMMAR

*Exists in no tree, in no branch. The bench builds `for x < n, for y < n` — squares only. Every "no
lawful size" it ever reported means "the square did not fit".*

**The lattice.** With registration offset `o` (M4 §2) the populated positions are

    q(i,j) = ( o + i·s ,  o + j·s ) ,   i,j ∈ ℤ

**The band window.** Band `n` admits the `n × n` block of positions centred on the family's centre.

**The grammar — one rule generates every arrangement Dan named.**

> **An arrangement is the set of SUPPORTED positions inside an axis-aligned `r × c` sub-window of the
> band window**, for `1 ≤ r, c ≤ n`, at every placement of that sub-window within the band window.

That single rule yields, with nothing special-cased:

| Dan's name | how it arises |
|---|---|
| **vertical pair** | `r=2, c=1`, both supported |
| **horizontal pair** | `r=1, c=2`, both supported |
| **2×2 / rectangle** | `r=c=2` … `r×c`, all supported |
| **the L (1+2)** | `r=c=2` with one position unsupported — "the fourth has no fabric under it" |
| **material-derived partial** | any `r×c` with some positions unsupported |

**Count — finite and small.** Sub-windows of an `n×n` window:

    W(n) = Σ_{r=1..n} Σ_{c=1..n} (n−r+1)(n−c+1) = [ n(n+1)/2 ]²
    W(2) = 9      W(3) = 36      W(4) = 100

**Admissibility.** An arrangement is a candidate iff **at least two positions are supported** (L4, the
pair is the floor — a single magnet pivots and is never offered) and it is not a duplicate of another
window's supported set.

**The optimum (L15)** is the named arrangement `r = c = n` whose four **outermost corner** positions
are supported. It is labelled, never ranked toward, never a gate.

**Completeness argument.** Every subset of the band window that is the supported set of some
rectangular sub-window is enumerated exhaustively, by construction. **Deliberately excluded:** subsets
that are *not* the supported set of any rectangle — e.g. two diagonally opposite magnets with a
supported position between them omitted. Excluded because omitting a *supported* position is a choice
the engine has no rule to make, and offering it would be the "bunched into one lobe" layout L11
rejects. **This exclusion is a stated restriction, not an oversight** — overturn it by ruling, not by
implementation.

---

# M4 · THE COMPOSITION

*The deterministic pipeline. Raised by @s62-grid-pixel; the piece that makes M1–M3 an engine rather
than three functions.*

### 1 — Freeze the outline
Normalise rings (M3), refuse degenerate input, record the point count (OPEN O-4 visibility).
**Scale reference (G1):** the source longest side is the longest side of the **outline's own bounding
box** — never the source image. Transparent margin is not the shape.

### 2 — Centre and registration
For each of the six centre constructions `κ` (M5) compute `centre(κ)`. **Once per frozen outline,
cached (L16).** Scaling is about that centre, so the centre is a fixed point of the transform (G4).

Registration follows parity of the run (L6), never selection:

    o  =  0        for an odd run   (a magnet on the centre)
    o  =  b / 2    for an even run  (the centre in the gap)

The offset uses the **base** pitch `b`, never the populated pitch — that is what makes 96mm a strict
subset of 48mm with nothing re-centred (L7).

### 3 — Lawful scale intervals, exactly, per position
Scaling the outline by `σ` about the centre scales every distance linearly, so for a **fixed** lattice
position `q`:

    c_σ(q)  =  signed clearance of q against the outline scaled by σ

`c_σ(q)` is piecewise-smooth in `σ`, and **`supported(q)` changes only where `c_σ(q) = P`**. Those
crossings are the **contact events**: the scales at which one outline feature first touches `q`'s disc.

For an edge `(v, w)` scaled about the origin-shifted centre, the condition `dist(q, σ·[v,w]) = P` is a
quadratic in `σ` — solved in closed form, per (edge, position) pair. Vertex contacts give
`|σ·v − q| = P`, also quadratic. **Collect every real root.**

    E(q) = { σ > 0 : c_σ(q) = P }        the event set for position q

`E(q)` partitions `(0, ∞)` into intervals on which `supported(q)` is **constant**. Evaluate one
interior point per interval to label it. **Non-monotonicity is handled by construction (G9)** —
nothing assumes support, once gained, is kept; intervals may alternate, and all lawful ones survive.

*Evidence this method is sound, from the research lane, used as an oracle and not as code: exact roots
agreed with a dense brute-force scan to **0.0013mm** across 15 shape/band cases — the scan's own
resolution — with 164 interval checks, 45 rotation checks, 120 fuzz checks, and a stepped-limb case
where legality demonstrably **enters and leaves**.*

### 4 — Elementary intervals: the step that makes enumeration exhaustive
Let `Q` be every lattice position reachable within the ceiling (`≤ N² = 81` per centre and pitch).

    Σ  =  sorted( ⋃_{q ∈ Q} E(q) )

Between consecutive events the **supported set is constant**. So on each elementary interval
`(σ_t, σ_{t+1})` the supported set `S_t ⊆ Q` is fixed, and therefore **every arrangement of M1 is
determined** — no search over scale is required, and none is permitted (L16).

### 5 — Publication, per elementary interval
Manufactured size `= σ · longestSide`. Within an interval's size range take the **first even
millimetre inside it** — upward, never a blind ceiling that can land outside a lawful window narrower
than 2mm (L10). An interval containing no even millimetre yields no published candidate and **says so**.

### 6 — Coupling the two populations (G7)
A family is proved at **one published size and one scale**. Compute steps 3–5 for `s = 48` and
`s = 96` and keep only sizes where **both** populations hold at least one lawful pair (EC-05). A pair
at 48 at one size and at 96 at another is two answers, not a product.

### 7 — Measure, classify, return
Apply M2 to each published candidate; classify `floor | intermediate | optimum`; set
`lawful | failed | exception-pending`. **Return every candidate. Rank nothing, discard nothing.**
A band with no lawful arrangement returns an explicit statement with the reason, per band (G8).

### Complexity, stated rather than hoped
Roots: `|Q| · edges · 2` per (centre, pitch) → `81 × 1440 × 2 ≈ 233k` closed-form solves, `× 12`
(6 centres × 2 pitches) ≈ **2.8M root computations, once per frozen outline**. Interval labelling is
`O(|Σ| · |Q|)`. Arrangement enumeration is `≤ 100` windows per band. **All of it is computed once and
cached (L16, G10); browsing performs no computation and interaction performs none (G11 cache key =
outline + every law value reaching the engine).**

---

# M2 · SIDE REACH, FLAP AND EVENNESS

*Exists in no tree — the string does not appear. This is L14's fourth condition and the whole of
L14a's yardstick.*

**The centre lines** are the vertical and horizontal lines through the family's centre (L12).

**A side's territory.** For side `∈ {left, right, top, bottom}`, let `x_min, x_max, y_min, y_max` be
the extreme **supported** magnet centres of the arrangement. Then

    M_left   =  { p ∈ M : p.x < x_min }        M_right  =  { p ∈ M : p.x > x_max }
    M_top    =  { p ∈ M : p.y < y_min }        M_bottom =  { p ∈ M : p.y > y_max }

— the material lying **beyond** the outermost magnet in that direction. Empty territory ⇒ reach 0.

**Reach — the unsupported distance to the nearest holding disc:**

    r(p)        =  min_{q ∈ A} ( |p − q| − P )   , clamped at 0
    reach(side) =  max_{ p ∈ M_side }  r(p)

**Computed exactly, not sampled.** A sampling resolution would be a constant with no author — the
class the tolerance incident forbids. The maximum of `r` over a polygonal region against a set of
discs is attained at one of finitely many places:

1. a **vertex** of `M_side` (including where a centre line cuts a boundary edge);
2. on a boundary **edge**, at the point farthest from a single disc centre — the projection of `q`
   onto the edge's supporting line, reflected, or an endpoint;
3. at a point **equidistant from two disc centres** on a boundary edge — the edge's intersection with
   the perpendicular bisector of `q₁q₂`;
4. at a **vertex of the discs' farthest-point Voronoi diagram** lying inside `M_side`.

Every one is closed-form. Evaluate `r` at that finite candidate set and take the maximum.

**Evenness (L14a) and coverage (L14):**

    spread  =  max_side reach(side)  −  min_side reach(side)
    coverage passes  ⟺  reach(side) ≤ limit  for every side,  limit ∈ {12, 24}

`spread` is **evidence, never a gate** — a candidate does not fail because another has a smaller
spread (EC-08). `limit` is the two-position switch (L14, O-2a) — never a third value.

**The trivial-limb exemption** is **measured and reported, never applied**: any `M_side` component
whose reach exceeds the limit is returned with its side, its reach and its area, so the exemption is
visible and overrulable. `trivial` gets no numeric definition here (L14, and none may be invented).

---

# M5 · THE CENTRE CONSTRUCTIONS

Six, defined so two correct builds cannot disagree. *(Measured: box and area-centroid land **14.8mm**
apart on a concave outline — more than half a magnet spot, so this changes coordinates.)*

| name | definition |
|---|---|
| `box` | centre of the axis-aligned bounding box of `R₀` |
| `oriented-box` | centre of the minimum-area bounding box over `hull(R₀)`, by rotating calipers |
| `area` | polygon area centroid: `Cₓ = (1/6A) Σ (xⱼ+xⱼ₊₁)(xⱼyⱼ₊₁ − xⱼ₊₁yⱼ)`, `A` from the shoelace |
| `perimeter` | edge-length-weighted mean of edge midpoints |
| `vertices` | arithmetic mean of the ring's points |
| `maximum-clearance` | the interior point maximising `c(p)` — the pole of inaccessibility |

**Maximum clearance is the only one that is a search, so its termination is specified (G6).** Refine by
quadtree subdivision over the bounding box, discarding any cell whose upper bound
`c(centre) + halfDiagonal` cannot beat the incumbent. **Terminate when the cell half-diagonal falls
below `ε`, and RETURN `ε` WITH THE ANSWER.** `ε` is a declared input, not a hidden constant; the proof
obligation is that halving `ε` moves the answer by less than `ε` on the real corpus. No constant is
introduced without a derivation.

---

# THE INDEPENDENT ORACLE

A second implementation sharing no code, used only in tests, constrained by the same laws (fixed band,
lawful parity, full-disc containment, **no maximality** — an unconstrained oracle optimises the
objective L13 forbids and would reject lawful product behaviour).

**Method:** brute force. Step every even millimetre from `2P` to the ceiling; at each, test every
lattice position with a direct point-to-polygon clearance; enumerate every rectangular sub-window;
record every arrangement with ≥2 supported positions.

**Obligation:** on the fixture set, the oracle and the engine produce **the same set of published
candidates** — nothing missed, nothing invented. The oracle is unusably slow by design; that is why it
cannot be the engine, and exactly why it can check it.

**Fixtures:** square · circle · diamond · L · hollow ring · deep notch · sliver · stepped limb (the
non-monotonic case) · reversed winding · transparent margin · the seven real cut-outs.

---

# VERDICT LINES

**Necessity — no unnecessary elements.** No new checkpoint. One companion document. M1, M2 and M3 exist
nowhere and are specified here; M4 composes them; M5 removes the only place two correct builds can
disagree.

**Sufficiency — partial, and the gap is named.** This specifies the computation. It does **not** rule
the open product questions — disjoint outer rings, tessellation stability, coverage-versus-balance
precedence — and must not.

**A correction I owe.** I called the contact-event solver "the actual algorithmic core". @s62-grid-pixel
is right that it is not: it solves scale legality for a **given** magnet set and answers nothing about
which sets exist. It is one step of M4 §3. The engine is M1–M5 composed, and most of that has never
been written down by anyone.

— @s62-lead
