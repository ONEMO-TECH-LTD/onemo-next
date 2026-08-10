# GRID ENGINE v3 — SPEC
### The algorithm. What it takes, what it returns, and how. · 2026-08-10

> **Law:** [`grid-laws.md`](./grid-laws.md) — what it must obey and why.
> **Briefs:** [`grid-brief.md`](./grid-brief.md) — Dan's words, verbatim.
> This file is the *mechanism only*. Every clause below cites the law it implements.
>
> Every number in this document was measured against a running implementation, not asserted.

---

## 0 · The contract

```
IN    the shape's FORM      an outline. proportion only — it carries no size (§12.1)
      pitchMM               48, or 96 for the thinned population
      paddingMM             12 — the magnet's own clearance (LOCKED, law 10.6; the system's atom)
      maxPositions          9 — a COUNT, never a millimetre (§12.3)

OUT   the GRID MATCH        pairs per axis, centre or no centre, where the fold sits
      magnets[]             which nodes the shape holds
      binding               which (edge, magnet) pair closed the match (§11.6)
      ---
      dimensions            what that match measures, aspect locked — for the cutter (§12.2)
```

**GRID FIRST. shape + grid = final proportion and dimensions.** The match is the answer; the millimetres
are what the match happens to measure. They are a manufacturing readout, not a design object, and they are
never reasoned backwards from.

**Nothing about size crosses inward.** No cap, no target, no test size, no range. A shape is never
too small — it scales until it holds.

---

## 1 · The primitive — does a pair hold

Everything is built on one call. *(§11.1)*

```
pairHolds(shape, nodeA, nodeB):
    return holds(shape, nodeA) and holds(shape, nodeB)

holds(shape, p):
    return p is inside shape
       and distance(p, shape boundary) >= paddingMM
```

That is the whole test: **is there material at this node to capture the full 24mm circle.** The 24mm
thickness and 72mm length are not separate checks — they are what this means geometrically.

*Verified at the limit at the time of testing (10mm padding): `20 × 68` holds · `19.9 × 68` fails ·
`20 × 67.9` fails. The rule is 2×padding thick and pitch+2×padding tall, so under the locked 12mm it
reads 24 × 72. The limit behaviour is a property of the test, not of the value.*

**Use exact distance to the boundary, never a sampled/rasterised distance field.** A sampled field is
documented to fail along the centre-lines of limbs, which is exactly where clearance decisions happen.
Exact distance-to-segment is ~15 lines and has no such failure mode.

---

## 2 · The guaranteed area — the only thing the outline contributes

*(§11.5)*

```
guaranteed = shape reduced by paddingMM
```

The region where a magnet centre may sit. **Past this point the outline's form stops mattering; only
its guaranteed dimensions do.**

```
nodesAcross(span) = floor(span / pitchMM) + 1        measured on the guaranteed area
```

---

## 3 · Variants — enumerate, never search

*(§11.2, §11.4)*

For each axis independently, the guaranteed span gives a node count. Every `(a, b)` with `a·b >= 2` and
both under `maxPositions` is a variant. **One magnet is never a variant** — it lets the shape pivot (§11.3).

Each count decomposes into pairs and an optional centre:

```
pairs  = floor(n / 2)
centre = n is odd
fold   = through a magnet if centre, else between two      (§11.2)
```

**The fold is not chosen.** It is simply whether a centre exists.

No shape classification exists anywhere. An L-shape yields 1+2 on its own, because the fourth position of
a 2×2 has no fabric under it and drops out at §1. Nothing names an L, a triangle or a tower.

---

## 4 · Closing the match — one pass over (edge, magnet) pairs

*(§11.6 — edge-to-edge matching)*

The shape's edges close onto the magnets' discs. **The match closes when the tightest edge meets its
disc**; what that closure measures is the dimension. For a **convex** outline it is closed form — no
search, no bisection, no library:

```
for each edge i:  n_i = outward normal,  d_i = distance from shape centre to that edge at scale 1
for each magnet q:
    demand = (paddingMM + q · n_i) / d_i

closure = max(demand)          the tightest edge-to-disc contact closes the match
binding = the (edge, magnet) pair that produced it
```

What that closure measures, on the canon:

```
square 2×2 → 72.00      circle 2×2 → 91.88
square 3×3 → 120.00     circle 3×3 → 159.76
```

**The binding pair is the explanation.** When a reading looks wrong the engine names what caused it —
"this magnet against this edge closed the match." *(Note the direction: the pair closes the match, and the
millimetres are read off afterwards. Never the reverse.)*

### 4a · Non-convex outlines

The formula treats each edge as an infinite line, which is only valid when the shape is convex. On a shape
with limbs it would over-constrain badly. Two tiers:

- **convex** — the formula above, exact and instant.
- **limbs** — decompose into the few simple pieces the shape holds (§11.5), apply per piece.

---

## 5 · Centring — the fold, per axis

*(§9, §11.2)*

Each axis independently. Fold the shape at the magnet fold line and measure each half's reach.

```
scaleFor(axis) = (2 × reachNeeded) / (lo + hi)
scale          = max over both axes           aspect is locked, the binding axis wins
shift(axis)    = (hi·scale − lo·scale) / 2    half the difference, toward the short side
```

Verified on a lopsided shape (reach 70 / 90, target 82 each side): scale 1.025 → 71.75 / 92.25 →
shift 10.25 → **82.00 / 82.00 exactly**.

**The binding axis always lands exactly tight — zero slack.** That is "pressed against the edge with no
breathing space", and it is automatic; it is what *binding* means. **The other axis always has slack** and
it cannot be removed — with aspect locked, both axes are tight only if the shape's proportions happen to
match the grid's.

**Check the slack axis for crossing:** if its slack exceeds the gap to the next column, it gains a column
and the arrangement is no longer the one requested.

---

## 6 · Publication — what reaches the cutter

*(§3.23 inherited, §10.4)*

The solve returns the exact wrap. **Publication is a separate step** and rounds it **up to the next whole
even millimetre** — up, so the shape is never smaller than the grid it must hold; even, so the grid stays
centred; whole, because fabric cannot be cut on a fraction.

**Do not round the float.** Convergence noise turns a billionth of a millimetre into 2mm. Ask the legality
question in the integer domain instead:

```
E = 2 × floor(exactMM / 2)
while any magnet fails to clear at size E:  E += 2
publish E
```

This makes publication safe by construction — a size is published *because* it clears, so an illegal size
cannot be published even in principle.

```
                exact     ships    clearance
square 2×2      72.00      72       12.00
circle 2×2      91.88      92       12.06
circle 3×3     159.76     160       12.12
```

The square never produces a decimal — 48s and 10s are whole. Only the circle does, because a 48mm square's
diagonal is irrational. Rounding up can only *add* clearance.

---

## 7 · Density

*(§11.4, Dan 08-10: "for now we use full grid density")*

Full density. **No population selection exists** — a full rectangle, centred by the fold, is balanced by
construction. Nothing to score, nothing to detect, nothing to tune. That was the entire forty-version
problem and full density deletes it.

The one thing full density still forces is physical, not arithmetic: **a point with no material under it
was never placeable.** It drops at §1. Interior masking for manufacturing is a later, separate decision.

---

## 8 · What must never appear

Each of these has been in the build and been removed. They are listed so they are not reintroduced.

| Forbidden | Why |
|---|---|
| any size input — cap, target, range, test size | §12.1 |
| `maxSizeMM` in the spec | §12.1 — the ceiling is a grid count |
| a tolerance of any kind | §10.4 — exact sizing, nothing to soften the clearance |
| a view concept reaching engine arithmetic | §8.3 — zoom once moved the lattice 24mm |
| a registration default set by anyone | §6.5 — it is the engine's answer per shape |
| rounding performed in the shell | §5.3 — a surface holding a number the engine did not produce |
| a scan or bisection over size | §11.6 — the size is one pass over pairs |
| any shape name in the logic | §4.1 |
| **reasoning from a size toward a grid** | **the recurring failure.** Dan, 101st restatement: "we have grid first logic - shape + grid = final proportion and dimensions". Size-led thinking reappears as: tabulating sizes as if they were the deliverable · asking which size ships · treating a shape as "too small" · worrying that one cap yields different millimetres per outline. All four are the same defect. |

---

## 9 · Known limits, stated rather than discovered later

- **Shapes with holes are unsupported** — single outline only. A donut would fail.
- **The cap is a grid count and binds per pitch.** 9 across on the dense grid is not 9 across on the
  sparse one, so the cap may need to be stated per pitch. *(That the resulting millimetres differ per
  outline is not a problem to solve — it is what grid-first means.)*
- **The unsupported run between perimeter magnets is 48mm, or 96mm on the sparse grid.** Whether fabric
  holds across it is a physical answer, not a computed one. It is the only question in this spec that a
  calculation cannot settle.
