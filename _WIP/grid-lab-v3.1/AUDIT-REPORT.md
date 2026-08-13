# Grid engine v3.1 — audit report

**Author:** @s62-kai-lead · **Date:** 2026-08-13 · **Branch:** `session62-task/s62-kai-lead-grid-engine-v3.1`
**Scope:** the three-part engine built in the forked GPT Pro chat, its assembly here, and everything
this lane has and has not proved about it.

**Independently audited by @s62-pixel-grid-pixel**, which formed its verdict before reading this
report and then refuted two of its claims: the integrity claim (now F7) and the scale load figure
(F3). Both were reproduced here and corrected in place rather than footnoted. Its remaining verdict:
mechanism complete, canon acceptance unproved, integrity sufficient only under an explicit
trusted-upstream contract.

Every claim below is a check run in this lane. Where a thing is unproven it says so.

---

## 1. What exists

| part | what it is | source | state |
|---|---|---|---|
| 1 — geometry kernel | polygon + sizes + lattice parameters in, per-position held / exact clearance / limiting witness out; plus the straight-capsule fact | fork delivery `magnetic-grid-measurement-kernel v1.0.0` | delivered, verified, **unmodified** |
| 2 — candidate enumerator | kernel facts + explicit grammar in, every lawful arrangement out; five families, two populations | fork delivery `magnetic-grid-candidate-enumerator v1.0.0` | delivered, verified, **one local patch** (`single` family) |
| 3 — product logic | candidate + measurement documents + caller judgements in, ranked tiers out | fork delivery `magnetic-grid-product-logic v1.0.0` | delivered, verified, **not wired to anything** |

Assembled kernel + enumerator run as one pipeline at `_WIP/grid-lab-v3.1/engine/`. Part 3 is booked
at `gpt-pro/part-3-product-logic/delivery/` and is **not** part of that pipeline yet.

The fork itself is clean: it branches at GPT's first uninfluenced answer, and the three build prompts
are the only instructions in it. The biased history that produced five failed builds is not in that
chat.

## 2. What has been verified, and how

**Part 1 —** manifest hashes verify; 18/18 golden tests pass here; grep for band / rank / select /
winner / tier / gravity / wrap / policy / sparse returns nothing; floats appear only in one labelled
display helper; the caller supplies lattice origin, source measure and both anchors, so no centring
rule is baked in.

**Part 2 —** package manifest verifies; the kernel inside it is a byte-identical recursive match to
part 1 with its 18 goldens still green; 13/13 enumerator tests pass. Its two genuine ambiguities
(run spacing, whether a 1×1 window exists) were surfaced as mandatory caller data rather than
silently chosen. **Local patch:** `single` was missing as a family — its position was reachable only
as a `full-window` 1×1, which candidate identity treats as a different record. Patched here in ~10
minutes rather than a GPT round trip; kernel untouched, 13/13 and 18/18 still green, peer-audited by
@s62-pixel-grid-pixel against the pristine delivery (only fix-required changes present), and one
false claim in my own patch notes was caught by that audit and corrected.

**Part 3 —** 43/43 manifest; 15/15 tests; zero preference vocabulary in source; no float in any
decision path (the four `Number()` calls are bounds-checked array indices); no upstream
implementation bundled. It authenticates the **geometry provenance** of every candidate position — a
position that does not resolve to a kernel fact with `fits: true`, or whose copied index/centre
differs from that fact, is rejected — and it throws `NonTierableOrderingError` rather than inventing
a tier when supplied rulings contradict each other. Full detail:
`gpt-pro/part-3-product-logic/VERIFICATION.md`.

> **Correction (independent audit, @s62-pixel-grid-pixel).** An earlier draft of this report said a
> fabricated or drifted candidate "cannot pass through this layer silently". **That was false and is
> withdrawn** — see F7. Geometry provenance is authenticated; grammar and identity are not.

## 3. Findings

### F1 — The acceptance oracle was never supplied *(owner: this lane)*
The part-3 prompt asserted "attached are decided examples". Nothing was attached and no mechanism
existed to attach anything; GPT reported the absence rather than pretending. **No decided placement
has ever been checked against the ordering.** Part 3's 15 tests use synthetic fixtures with hand-set
judgements — they prove the mechanism, never conformance to canon.

### F2 — Part 3 relocates the unsolved problem rather than reducing it *(owner: this lane + Dan)*
Every candidate needs a gravity boolean, a tight-wrap value and a regional-support value or the call
throws. Nothing can be ordered until "upper material", "wraps most closely" and "a mass of the
shape" are concrete enough to emit one value per candidate. That is correct under the brief and it
is now the whole remaining product problem, in one place.

### F3 — Ordering is quadratic, but the real load is small *(owner: this lane)* — **CORRECTED**
Ordering cost, measured: 100 candidates 12 ms · 300 → 41–71 ms · 600 → 139–281 ms · 1000 →
394–739 ms. The all-pairs structure is real and confirmed independently.

**The load figure in the first draft was wrong.** I reported "1,346 candidates for BOT at 236 mm at
one anchor and one origin". The independent audit caught that `canon-membership.mjs` initialises
`candidateTotal` once per case and then sums `doc.candidates.length` across 3 anchors × 4 origins —
so 1,346 is **twelve enumerations aggregated**, never a single product-logic input. I re-measured
the true per-document boundary:

| shape / size | largest single enumeration document | mean across the four origins |
|---|---|---|
| POKE1 @217 | **136** | 119 |
| BOT @236 | 130 | 94 |
| BUTTERFLY @214 | 59 | 46 |
| PILL @138 | 20 | 14 |
| DUCK @152 | 10 | 5 |

**Largest single document measured: 136 candidates**, which orders in roughly 15–20 ms. So the
quadratic cost is structural but not currently binding, and the earlier "cannot sit on an
interaction path" was an overstatement built on a bad number. Scoping per size and registration
already happens by construction — one measurement document is one size at one origin. Revisit only
if a real integration document approaches four figures.

### F4 — The canon descriptions contain false geometry *(owner: this lane)*
`selection-examples/band-3/description.md` and `grid-laws.md` L20 both state the butterfly at 130 mm
and poke1 at 123 mm as four corners **96 mm apart**. Measured from Dan's own frames: butterfly
130 × 107 mm at 4.8 px/mm with discs 215–230 px apart = **48 mm**; poke1 104 × 123 mm at 5.07 px/mm
with discs 244 px apart = **48 mm**. Both are adjacent 2×2 squares — which is exactly what Dan said
("band 2 grid in the band 3 shape"). 96 mm was also impossible for the butterfly: 96 + 24 = 120 mm of
vertical material against a 107 mm-tall shape. The engine produces the real placement; my text made
a correct engine look wrong. **Every geometric claim in the four description files and L20 must be
reconciled against its frame before any engine is judged.**

### F5 — Dan's accepted placements come from a panned lattice *(owner: Dan — a law question)*
His frames show the lattice panned, so his registrations are not necessarily reachable from the four
half-pitch origins of a bbox / centroid / refined-sample anchor. L6 rules registration by parity and
O-1 makes the centre construction a switch to test, but neither settles the origin domain the engine
should sweep. Three of the ten canon cases are currently not found within the tested anchors.

### F7 — Candidate-document integrity is provenance only *(owner: this lane)* — from the independent audit
Product logic authenticates each candidate **position** against a held kernel fact. It does **not**
authenticate the enumerator's grammar or identity: family cardinality, step/position consistency,
population membership and canonical candidate identity are unchecked.

Reproduced here rather than accepted on report: taking the package's own fixture and rewriting
candidate 0 to `family: "run"` with **one** position and `steps: (999, 999)` — a record the grammar
cannot produce — `applyProductLogic` **accepts it and returns it unchanged**.

Consequence for the wiring: the enumerator document must be treated as a **trusted upstream** whose
validity is established before this layer, or the seam must re-run the enumerator's own validator.
Layer 3 proves geometry provenance and nothing more. This does not affect any ordering result from a
genuine enumerator document; it affects what we may claim about the seam.

### F6 — Escalation is globally binding *(owner: this lane)*
A promotion means its target outranks **every** candidate in the source band and is applied before
all other rules; any conflict raises `NonTierableOrderingError`. Escalation inputs must be globally
consistent, not locally reasonable.

## 4. What is NOT proven

- That any of the three engines reproduces Dan's canon. The membership harness currently reports
  **2 confirmed · 1 needs the eye · 3 not found within tested anchors · 4 untestable** — and
  "not found" is never a proven engine failure while the anchor domain is non-exhaustive (F5) and
  the claims are unreconciled (F4).
- That part 3 orders as Dan would (F1).
- That the assembled pipeline runs fast enough on a phone (F3 measures the ordering layer only, and
  its load figure was corrected downward after independent audit).
- That a candidate document is well-formed: part 3 checks geometry provenance, not grammar (F7).
- Anything about track 2 (C++/Boost) or the grok MVP beyond code review; neither has faced the
  shapes either.

## 5. Follow-on work, in dependency order

1. **Reconcile the canon** — every geometric claim in the four `description.md` files and L20 against
   its screenshot and Dan's verbatim words. Dan's numbers govern where he gave them; measurement
   settles only what he did not state. *Blocks everything downstream.*
2. **Settle the origin domain** (F5) — Dan's ruling on which shape-to-grid registrations are lawful,
   then sweep exactly those.
3. **Re-run the membership harness** against reconciled claims and the settled domain — this is the
   first moment any engine can be judged.
4. **Define the three judgements** (F2) — a computable rule for upper material, wrap and mass, per
   candidate, in our spec layer. This is the product decision the whole chain has been deferring.
5. **Write the acceptance oracle** (F1) — Dan's decided cases as required tier relations, run through
   part 3 with judgements from step 4.
6. **Wire the raw candidates to the page** — Dan's visual gate on the running surface, which is the
   acceptance that five previous builds never got.
7. **Decide the seam contract** (F7) — either declare the enumerator document trusted at the bridge,
   or re-run its validator there. Small, but it decides what we may claim about the seam.

## 6. Verdict

Parts 1 and 2 are accepted, verified and assembled. Part 3 is accepted on its own terms and unproven
against canon. The engine chain is complete as *mechanism* and untested as *product*, and the three
things standing between here and a decidable comparison are all ours or Dan's, not GPT's: reconcile
the canon, settle the origin domain, define the three judgements.
