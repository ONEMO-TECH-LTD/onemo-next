# WHAT WE TAKE FROM THE RESEARCH — tested, not summarised

**@s62-lead, 2026-08-11.** Every claim below was **run**, not read. Numbers are mine.

> **Dan:** *"read it in full, test and recommend what specifically we are taking from the research."*

**Read in full:** `grid-spec.md` (241 lines — the ratified algorithm spec, in our own tree, which I had
never opened) · `engine-technical-design.md` (381 lines — discarded, and I had accepted that without
opening it either) · the bench engine and `centre.test.ts` · the event-scale proof, re-run.

---

# THE HEADLINE

**`grid-spec.md` §4 — the closed-form size solve, the centrepiece of the ratified spec — is UNSOUND on
concave outlines. It publishes sizes at which the magnets are outside the shape.**

Its own §4a warns it "would over-constrain badly" on shapes with limbs. **That understates it in the
dangerous direction.** Tested against brute force on five concave fixtures:

| fixture | §4 says | truth | at §4's size, magnets supported |
|---|---|---|---|
| L-shape, band 2 | 360.0mm | 360.0mm | **4 / 4** — exact |
| plus / cross, band 2 | 211.8mm | 191.1mm | 4 / 4 — lawful but **11% loose** |
| deep notch, band 2 | 450.0mm | *no lawful size exists* | **0 / 4**, worst clearance **−12mm** |
| C-shape, band 2 | 240.0mm | *no lawful size exists* | **0 / 4**, worst clearance **−24mm** |
| crescent, band 2 | 180.0mm | *no lawful size exists* | **0 / 4**, worst clearance **−23mm** |

On three of five it returns a confident answer for an arrangement that **cannot exist at any scale**,
with every magnet off the material. That is worse than over-constraint — it is a false positive that
publishes a manufacturing size.

**It is exact where the document's own canon lives** — square 2×2 → 72.0000, 3×3 → 120.0000, circle
2×2 → 91.8825, 3×3 → 159.7647, all matching brute force to 0.000000. Convex shapes are fine. **Real
cut-outs are not convex.**

---

# TAKE — proven, and cheaper than re-deriving

### T1 · §1 the primitive, **and its warning**
```
holds(p) = p inside shape AND distance(p, boundary) >= paddingMM
```
Take it, and take the sentence with it: **"use exact distance to the boundary, never a
sampled/rasterised distance field"** — with the reason, that a sampled field fails along the
centre-lines of limbs, *which is exactly where clearance decisions happen*. That is a documented trap
worth more than the formula.

### T2 · §6 publication in the INTEGER domain — take this over my own proposal
```
E = 2 × floor(exactMM / 2)
while any magnet fails to clear at size E:   E += 2
publish E
```
**Tested, reproduces the documented table exactly:** square 2×2 → 72 (clearance 12.00) · 3×3 → 120
(12.00) · circle 2×2 → 92 (12.06) · 3×3 → 160 (12.12).

It is **better than "the first even value inside a lawful interval"**, which is what the contract and
my own draft say. This asks the legality question *in the integer domain*, so a size is published
**because it clears** — an illegal size cannot be published even in principle, and no float rounding
can turn a billionth of a millimetre into 2mm.

*It proved that property by accident: an early run of mine had a broken search bracket and fed it a
wrong exact value of 50mm. The loop climbed and still shipped 72 with 12.00mm clearance.*

### T3 · The event-interval size solve — because T-REJECT-1 leaves nothing else
Exact contact roots per (edge, position), intervals rather than thresholds, non-monotonicity by
construction. **Re-run: agrees with a dense brute-force scan to 0.0013mm across 15 cases** — the
scan's own resolution — with 164 interval, 45 rotation and 120 fuzz checks, and a stepped-limb case
where legality demonstrably enters *and leaves*. **And its fixtures already include a `pair`
arrangement, not only squares** — so it is proven for non-square magnet sets.

### T4 · Technical design §4.2 — adaptive refinement, over my epsilon
Terminate the maximum-clearance search when **another refinement produces the identical published
candidate**, not when a distance falls below a number. **This introduces no constant at all**, which is
strictly better than my proposal to declare an epsilon and return it. I withdraw mine.

### T5 · Technical design §4.1, §4.6, §6, §9, §11, §12
Prepare the outline once into immutable edge records · deduplicate by candidate identity without
deleting size variations · trigger only on fingerprint change, bounded cache, worker as a *measured*
escalation · the code shape · the deslop dispositions · the gated build order.

### T6 · §8 the forbidden list
Every line has been in the build and been removed. Take it — **minus one clause, see F1.**

### T7 · Already taken
The seven real cut-outs and the signed contract (`9f9bd8ee`, checksummed per file).

---

# DO NOT TAKE

### R1 · §4 the closed-form solve — **unsound, evidence above**
Every edge treated as an infinite line. On a reflex vertex that line cuts through the shape, and the
formula answers about a half-plane the material never occupied. Convex only, and the product is not
convex.

### R2 · §7 "full density — no population selection exists"
> *"a full rectangle, centred by the fold, is balanced by construction. Nothing to score, nothing to
> detect… That was the entire forty-version problem and full density deletes it."*

Superseded by Dan's 11:38 ruling on 08-11 — a band is a range, populations are **discovered**, a pair
is the floor. This is 08-10 thinking and taking it would rebuild the square-only assumption that made
five of six centre methods return nothing on an L.

### R3 · Everything in the bench solver
`compareCentres`, `centredBand`, `BandFit`, the matrix UI, the bench bridge centring path. Already
ruled; unchanged.

---

# FLAGS — not mine to settle

### F1 · §8 forbids "a scan or bisection over size" **citing the fabricated law**
The cited authority is old §11.6 — struck this morning as never said by Dan. **The prohibition may
still be correct** (a scan cannot name its binding pair, and it is the freeze), but it is currently
justified by a sentence nobody wrote. Re-justify it from L16 and the binding requirement, or drop it.

### F2 · **HOLES: the contract and a Dan ruling disagree.**
`grid-spec.md` §9 records Dan, 08-10: *"Our cutout lab does not produce shapes with holes… everything
we generate is more or less solid… it becomes a solid blob."* And it is **confirmed in code** — the
tracer returns a **single ring** (`Pt[] | null`), which is already the engine's outline type.

But **EC-12 demands hollow test cases**, and @s62-grid-pixel raised the missing material-region
topology as a blocker on that basis.

**Both cannot stand.** Either the hollow requirement leaves the contract, or Dan reopens holes. Until
he rules, building ring-plus-holes topology is building for a case he excluded — and *not* building it
leaves an EC-12 fixture unsatisfiable. **This is the one thing that should go to him before the
blueprint freezes.**

### F3 · §2 / §3 — the guaranteed area as the basis for counting nodes
`nodesAcross(span) = floor(span / pitch) + 1`, measured on the shape eroded by the padding. Clean on a
convex shape. On a limbed shape the eroded region can break into disconnected pieces, and a span
measured across the whole of it counts nodes that sit in the gap between limbs. **Untested by me** —
flagging rather than asserting, because it underpins §3's variant model.

---

# THE SHAPE OF THE RECOMMENDATION

Two documents in this project each contain a **different** algorithm for the same solve, and both were
ratified at some point:

- `grid-spec.md` §4 — one closed-form pass. **Exact on convex, unsound on concave.**
- the event-interval method — exact everywhere, and the only one that can say *"no lawful size
  exists"*, which is the correct answer for three of my five fixtures.

**Take the second, and take §6's integer publication on top of it.** That pairing is the strongest
combination available: the solve reports intervals honestly including their absence, and publication
cannot emit an illegal size even if the solve is wrong.

**Necessity — shrink:** R1 and R2 remove more than everything I propose adding. Nothing here is new
work except re-justifying F1 and settling F2.

**Sufficiency — partial by design:** this recommends what to take. M1, M2 and M4 remain @s62-grid-pixel's
blueprint to write, and nothing in the research supplies them.

— @s62-lead
