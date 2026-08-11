# THE CONTRACT HAS NO MATHEMATICS

**Audit of `engine-contract.md` @ `5ae33a47`, on Dan's challenge. @s62-lead.**

> **Dan, 2026-08-11:** *"so if the contract that is concerned the algorithm has no mathematics then
> what the actual fuck - what the contract is building? … without me mentioning that you didnt even
> flag that contract is missing math - fundamental part of the engine that computes !!!!! audit the
> contract again"*

**He is right. The finding stands and it is the largest defect in the document.**

---

## THE MEASUREMENT

**Not one equation. Not one formula. Not one derivation.** Every number in the contract is a law value
being *named* — 48, 12, 24, 96, 9 — and not one of them is ever computed *with*.

The contract states, in every clause, what must be **true of an answer**. It never once states how an
answer is **produced**. Two builders can satisfy all twelve checks with different mathematics and
publish different sizes for the same shape.

Concretely, each of these is asserted and never defined:

| the contract says | the mathematics it does not give |
|---|---|
| "its complete 24mm support disc lies inside cutout material" | the support test — signed distance from magnet centre to outline ≥ padding |
| "the first even value inside a **lawful scale interval**" | what an interval is, or how one is found |
| "the binding magnet/outline location that limits the fit" | the contact condition that produces it |
| "derives **every distinct materially supported arrangement**" | which sets of lattice positions are arrangements at all |
| "every side's **unsupported reach**, their exact spread" | what a side is, or how reach is measured |
| "**parity-derived** registration" | the offset arithmetic |
| "the 96mm population as a **thinning**" | the thinning rule |

## WHY I MISSED IT — and it is a method failure, not an oversight

I audited the contract **twice** and passed it both times, because both audits asked the wrong
question.

The first asked: *does every law have a checkpoint?* The second asked: *does every checkpoint change
the size, the layout or the coordinates?* Both are **constraint-completeness** tests, and a contract
made entirely of constraints passes both perfectly.

Neither audit asked the only question that matters for a document a builder builds from: **could
someone implement this?** They could not. I was auditing a specification as if it were a checklist,
which is exactly what it is — and the checklist was never the deliverable.

The eleven gaps I raised are all real and all still stand. Every one of them is a **constraint**. Not
one is a computation. That is the shape of the blind spot.

---

# THE MATHEMATICS, IN THREE PARTS

Dan: *"if pixel created true math algorithm that is actually correct and usable and must be recreated
we dont need to recreate we can bring it over of course."*

## PART 1 — PROVEN in the research lane. Bring it over.

**The contact-event solver — this is the actual algorithmic core, and it is genuinely proven.**
Instead of trying sizes, it solves directly for the scale at which a given outline edge first touches
a given magnet's disc, partitions the scale axis into lawful and unlawful intervals, and reads the
answer off the partition — which is also how the binding (edge, magnet) pair names itself.

Evidence, from re-running the proof myself, not from the handoff:

| check | result |
|---|---|
| exact event roots vs a dense brute-force scan, 15 shape/band cases | **worst disagreement 0.0013mm** — and that is the dense scan's own resolution |
| interval partition checks | **164** |
| rotation invariance checks | **45** |
| fuzz checks | **120** |
| non-monotonic case | legality **enters and leaves** — 2 transitions on a stepped limb |

**Also proven, verified by me against analytic truth rather than against their tests:**

- **signed point-to-outline distance** — exact to 1e-9 on square, circle, inside, outside, on-edge and
  corner-adjacent cases. This is the single function EC-06 rests on.
- **the six centre constructions** — exact on square, triangle and a 2000-point circle; winding-
  invariant to 1e-9; refuse degenerate input.
- **convex hull** — discards interior points correctly.

## PART 2 — PROVEN, already in the build tree

Lattice positions from pitch and registration · registration offset from parity · band span
`(n−1)·pitch + 2·padding` · the 96mm thinning as a strict subset · the minimum span · publication
rounding to whole even millimetres. All covered by the existing suite.

## PART 3 — EXISTS NOWHERE. This is the engine that has never been built.

**Three pieces of mathematics do not exist in any tree, in any branch, in any proof.**

**M1 · THE ARRANGEMENT GRAMMAR.** Which sets of lattice positions constitute a candidate arrangement.
The bench builds `for x < count, for y < count` — squares only, nothing else. Nothing anywhere
enumerates a pair, a rectangle, an L, or a material-derived partial set.

This is the whole of Dan's 11:38 ruling and it is the single largest hole in the project. Every "no
lawful size" the bench ever reported means only *"the square did not fit"*.

**M2 · SIDE REACH AND FLAP.** Absent from both v3 trees — the string does not appear. What delimits a
"side", how unsupported reach is measured from material to the nearest supporting disc, and how
evenness across sides is computed. This is L14's fourth condition and L14a's entire yardstick — the
success test — and there is no mathematics for it anywhere.

**M3 · THE MATERIAL REGION.** *(Raised by @s62-grid-pixel in review; accepted.)* EC-12 requires hollow
test cases, but nothing defines what material *is*. Proposed model: **one outer closed ring plus zero
or more hole rings, with support required against every boundary** — so a magnet inside a hole is
unsupported by construction. Disconnected components stay OPEN, as a product question.

---

# WHAT THIS CHANGES

**The contract is not wrong — it is half a document.** It is a sound conformance checklist and it must
stay one. What is missing is the other half: **the algorithm specification** the checklist checks.

The proposal is therefore **not** to stuff equations into the twelve checks. It is a companion —
*the mathematics, stated once, per computation* — that the contract cites. Twelve checks stay twelve.

**And it re-scopes "build the engine".** It is not translating a contract into code. It is:

1. specifying **M1, M2 and M3**, which have never been written down by anyone;
2. bringing over the **proven** solver mathematics rather than re-deriving it;
3. wiring both to the contract's answer model.

Item 1 is the real work, and no amount of contract review substitutes for it.

---

**Necessity — shrink:** nothing here adds a checkpoint. One companion document, three specifications
that do not exist, no new gates.

**Sufficiency — partial, and now the gap is named.** The eleven constraint gaps still stand. This adds
the computational half that neither my audits nor anyone else's asked for.

— @s62-lead
