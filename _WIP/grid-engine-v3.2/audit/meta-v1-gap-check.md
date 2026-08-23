# v1 read — what the v3.4 contract is potentially missing

**Author:** s62-kai-meta · 2026-08-17
**Ask:** Dan — "check v1 here, read the code and see what current v3.4 plan is missing potentially —
this is the very first v1 latest final version before we switched to rebuilding it, has shapes logic
already."
**Read:** `.claude/worktrees/s59-grid-lab-main` @ `a2385323`. `src/lib/effect/grid-core.ts` (2,420 lines)
— export map, then §§ 860–1040 and 1674–1815 in full. Read-only; nothing executed, nothing edited.
**Indexed against:** `plans/v3.4 ---plan-and-contract.md` @ `54638fef`, 170 lines.

**Status of v1 as a source:** it is *code*, not canon. Nothing below is a requirement. Each item is
either (a) an asset that already exists so the contract need not build it, (b) a law v1 states that
canon also implies, or (c) a conflict to resolve. Marked accordingly.

---

## A — ASSETS THAT ALREADY EXIST. The contract says "add"; v1 already has them.

### A1. The five exam shapes are already drawn — `stdShapeContour()`, `:926-937`
```ts
export type StdShape = 'square' | 'rect' | 'circle' | 'triangle' | 'diamondShape'
```
Square, rectangle, circle, equilateral triangle, and the rotated-square diamond — **drawn directly in
millimetres, and the comment says "app + bench share these."**

That is Phase 1 (`square`, `rect`) and Phase 3 (`circle`, `triangle`, `diamondShape`) — **every fixture
in the exam ladder except the four LS §7 counterexamples.** The contract's Phase 1 table specifies
outlines at 24×24, 72×72, 120×120, 168×168, 24×72, 72×24, 72×120, 120×72; `stdShapeContour('square',
72)` and `stdShapeContour('rect', 24, 72)` produce exactly those.

**Consequence:** Phase 1 does not need to author fixtures. It needs to *call* these. Authoring a second
set of square contours is the parallel-implementation defect this whole audit has been about.

### A2. Circle tessellation is a solved problem — `circleTessellationPoints()`, `:915-923`
```ts
const required = Math.ceil(Math.PI / Math.acos(1 - MANUFACTURING_TOLERANCE_MM / radiusMM))
```
The exact inverse of the sagitta bound: how many polygon points a circle needs so its approximation
stays inside manufacturing tolerance, with a calibrated minimum.

**This is a real gap in Phase 3.** A circle exam is meaningless without it — a circle is a polygon, and
its answer depends on how many points it has. Canon rules circle counts (4 @ 92, 9 @ 160, 16 @ 228);
those are only testable against a tessellation whose error is bounded. The contract does not mention it.

---

## B — LAWS v1 STATES THAT THE CONTRACT DOES NOT

### B1. **No maximality rule (v1 law 3.24)** — quoted twice in the source
> *"growing to fit more magnets is the maximality rule 3.24 forbids"* (`:1809`)
> *"Deliberately not ranked — neither by coverage (S22) nor by magnet count (3.24, no maximality rule)"*
> (`:1785`)

The contract carries canon's P9 (*fewer magnets when support is equal*) and PB §10 (*no arbitrary
subsets to raise count*). **v1 states the stronger third form: never grow the SIZE to gain magnets.**
Those are three different prohibitions and the contract has two.

This also settles something I got wrong earlier today: I told Dan the contract was missing a
"fullest-population" rule. **v1 forbids exactly that**, and independently of canon. My criticism was
wrong twice over.

### B2. **Anchor-count changes inside one extent do not create product sizes** — `:975`
> *"Anchor-count changes inside one rectangular extent never manufacture extra product sizes."*

Bears directly on LS §1.2, which the contract carries as *"a band returns every genuinely different
layout its range unlocks."* v1 draws the line at the **extent**: two magnet counts at the same
rectangular extent are **one** product size, not two offers. The contract has *"the same seating listed
looser is not a second answer"* — the identity rule — but not the extent rule.

### B3. **Source may bound the offered range; it may never change construction** — `:878-884`
`GridSource = 'std' | 'preset' | 'gen' | 'magic'`, and `maxDesignMM(source)` bounds the range while the
comment states construction is untouched. That is the clean, general form of the contract's
"no hardcoded animals" — the caller's label may restrict what is *offered*, never what is *computed*.

### B4. **Free/AI-cut silhouettes are capped until physically tested** — `RANDOM_SHAPE_MAX_MM = 180`, `:877`
> *"LAW: random/AI-cut silhouettes are capped below the preset range until physically tested."*

The contract's bands run to 264 for free cutouts (Phase 4) with **no cap**. If this law is live, a free
cutout may not be offered above 180 mm regardless of what the engine finds. That changes what Phase 4
is allowed to offer.

### B5. **The deepest-point guarantee** — `:1709-1711`
> *"via per-node validity + the deepest-point guarantee, can place one fallback anchor in the deepest
> legal region of an irregular silhouette."*

A mechanism that guarantees one anchor where any exists. Bears on the B1 question (canon's *"one disc,
geometry admits nothing more"* and R3's unresolved "is B1 always possible") — **v1 has a working answer
to a question the other two tracks recorded as open.**

### B6. **Publication is on the next EVEN whole millimetre** — `publishedEffectSizeMM`, `:898-901`
The contract has a 12 mm step from 24, which is even throughout — consistent, but the rounding rule
itself is unstated. It matters the moment a snug seat lands on an odd millimetre.

---

## C — CONFLICTS TO RESOLVE

### C1. **Padding: v1 says 10 mm, canon says 12 mm.** Same defined quantity.
- v1 `:51` `PADDING_FLOOR_MM = 10`, and `SizeLaw.paddingMM` — *"mag-safe radius from magnet centre
  (default 10)"* (`:866`).
- Canon PB §2 — *"Safe radius from magnet centre | 12 mm"*, and the contract's Spec line carries 12.

Identical definition, different number. One of them is not the current product rule. **Dan's call** —
and worth settling before Phase 2 writes `spec.ts`, because it is a legality-deciding value.

### C2. **WITHDRAWN — I fabricated this gap. Dan corrected it.**

I claimed canon's diagonal families need a different grid pattern and were "not expressible." **Wrong,
and canon says so in the same sentence I had already quoted today:**

> LS §5.2, pill B2 — *"**diagonal pair** — **same lattice, no new grid** (~79–82)"*

A diagonal pair is two magnets at opposite corners of the ordinary 48 lattice — e.g. (−1,−1) and
(+1,+1) inside a 2×2 frame. A 3-chain is three points stepping diagonally across the same lattice.
Both are ordinary library entries.

**And the contract already names it** — `:16`: *"Diagonal pair is a Dan ruling for pill — keep, sourced
there."*

**My error:** I conflated v1's `GridPattern = 'diamond'` — a genuinely different 68 mm diagonal lattice,
used in the grid-lab for standard geometries — with canon's diagonal *seating* on the standard lattice.
Same word, different thing. That is the second gap I have fabricated today from asserting instead of
re-reading a line I had already read, after the 96 mm one this afternoon.

**What actually survives, and it is small:** the diagonal **3-chain** (LS §5.2 B3, ruled PREFERRED) is
not named in the contract's seating list. That is a library entry, and `:68` already rules that the
library grows when the fabric forms a coherent arrangement not yet in it. So it is covered by an
existing rule, not a gap.

**Nothing about v1's grid modes applies to this contract.** `standard` / `quincunx` / `diamond` are
selectable lattices on a different product surface. Dan's law 8.8c about manual grid selection governs
that surface, not the cutout engine.

### C3. **`maxTestedMM = 214` corroborates B5, and dates it.**
v1 `:867` — *"largest physically tested size → rungs above ship hidden (default 214)"*. The contract
says B5 (216–264) *"exists, not sold until you say so."* Same boundary, independently reached: 216 is
the first square rung above the tested ceiling. Not a gap — supporting evidence that B5's status is a
physical-testing fact, not a product whim.

---

## VERDICT

**No gap blocks a phase.** My C2 claim was fabricated and is withdrawn above — canon's diagonals sit on
the same lattice and the contract already names the pair.

**Two assets that should be consumed, not rebuilt:** the five standard shape contours (A1) and the
circle tessellation bound (A2). Phase 1 and Phase 3 both depend on them.

**One conflict to settle before `spec.ts` is written:** C1, 10 mm versus 12 mm.

**Three laws worth carrying if Dan confirms they are live:** no-maximality (B1), the extent rule (B2),
and the 180 mm cap on free cutouts (B4).

**Nothing here is canon.** v1 is code and its laws are cited to Dan's rulings by comment, not by the
three canon files. Every item above needs Dan's word before it enters the contract — that is the same
rule that voided my R3 findings this afternoon, applied to myself before making the mistake again.

— s62-kai-meta
