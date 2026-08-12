# LEAD — CONTRACT SCOPING INPUT

### Twelve checkpoints against the deliverable. **Not the contract.**

> **Status.** @s62-grid-pixel owns and is drafting the contract. This file is @s62-lead's scoping
> pass, written on Dan's 12:21 instruction before that draft started — take from it, or discard it.
> The authority both must cite is [`grid-laws.md`](./grid-laws.md), now **fourteen** laws: **L14**
> is Dan's 12:34 success test and it closes the flap threshold, which had no author until then.

> **What this contract is for.** *Dan, 2026-08-11:*
>
> "the contract is about engine and its algorithm - and how it must be applied in practice and
> deliverables. It is not about entire v3 UI and the rest. The logic + engine algorithm."
>
> "We don't need irrelevant things listed in the contract if they are not built in the scope of engine
> and algorithm and if they do not deliver one thing size of shape in each band and magnet layout and
> coordinates to manufacture from. That is it the rest is not scope of the contract"

---

## THE DELIVERABLE

**For one locked shape, in each band: the size of the shape, the magnet layout, and the coordinates to
manufacture from.**

That sentence is the whole product. It is also the admission test for this document.

**The scope test — apply before adding anything, ever.**
Does this checkpoint change the **size**, the **layout**, or the **coordinates** that come out?
**No → it is not in this contract.** Not as a nice-to-have, not as a note, not as an appendix.

*(This document was 161 checkpoints. It is twelve. §OUT names every cut and where it went — nothing was
lost, it was moved to where a reader can act on it. The 161 happened because necessity and sufficiency
were both run per-item, and per-item review can only add: every item traced to something Dan said, so
every item passed. Neither procedure was ever asked the necessity law's first question — what would a
senior engineer delete.)*

---

## INPUT — C1

**C1.** The engine takes exactly three things and nothing else:

| | | |
|---|---|---|
| **the outline** | a closed polygon in its own units, aspect locked | scale is the only transform — **L1** |
| **the grid** | base pitch 48mm · populated pitch 48 or 96 · padding 12mm · ceiling 9 positions/axis | **L3, L7, L9** |
| **the band** | 2, 3 or 4 — or absent, in which case the bounding box picks the start | **L13** |

**There is no size input, and no size may be passed in under any name** — not a cap, not a target, not
a test size, not a hint. **L8.**

**No shape identity of any kind** — no name, no category, no previous result for the same outline.
The same outline must produce the same answer whether it has been seen before or never. **L8.**

**PASS** = the public entry point's signature admits no fourth argument, and a search of the unit finds
no size constant, no shape name and no cache keyed by anything but the three inputs above.

---

## OUTPUT — C2, C3

**C2 — what one candidate is.** Every candidate the engine returns carries all of:

| field | unit | why it is here |
|---|---|---|
| `band` | 2 \| 3 \| 4 | which band this answer belongs to |
| `sizeMM` | whole even mm | **the size of the shape** — the manufactured longest side |
| `scale` | ratio | what the outline was multiplied by to reach it |
| `pitchMM` | 48 \| 96 | which population the layout sits on |
| `registration` | per axis: gap \| point | **L6** — falls out of parity, never chosen |
| `arrangement` | pair-v \| pair-h \| 2×2 \| rect r×c \| L | **the layout** — discovered, not assumed (**L5, L13**) |
| `magnets[]` | mm, shape-local, origin at the shape's centre | **the coordinates to manufacture from** |
| `binding` | the outline edge + the magnet whose contact set `sizeMM` | the answer explains itself |
| `support[]` | mm, per magnet | signed distance from magnet centre to outline, ≥ 12 (**L2**) |
| `balance` | per side, per cell about the centre lines | **L12** — reported, never scored |

**Coordinates are millimetres in the shape's own frame**, origin at the shape's centre, y downward.
Not pixels, not canvas units, not viewBox-relative. They must be usable by a cutter with no knowledge
that a browser ever existed.

**PASS** = for a real cut-out, at one band, every field above is present and non-null, and the magnet
coordinates re-measured independently against the scaled outline reproduce `support[]` to 0.01mm.

**C3 — every lawful variation, no winner.** The engine returns **all** lawful candidates for the band,
never the first fit and never a ranked best. **L13**: "all variations of sizes and layouts in each
band". Nothing in the unit sorts by preference, weights coverage against balance, or marks a default.

**PASS** = for a shape with a known multi-candidate band, the returned count matches an independent
enumeration; and a search of the unit finds no comparator, no weighting constant and no `best`.

---

## THE RULES THE ANSWER MUST SATISFY — C4 to C9

**C4 — a magnet is lawful only if its whole 24mm disc sits on material.** Signed distance from magnet
centre to the outline ≥ padding, measured against the outline itself, not a bounding box and not a
centre-point-inside test. Tangency (exactly 12.000mm) is legal. **L2.**

**PASS** = a square publishes 72 / 120 / 168 exactly. A centre-point test publishes 74 / 122 / 170 —
the two are distinguishable in one measurement, so this cannot pass vacuously.

**C5 — the population is discovered, never assumed.** A band is a **range to be searched**, not a
square to be tested. The engine finds what the material supports inside it — a pair, a 2×2, a
rectangle, an L. **A pair is the floor**; a single magnet is never returned, because one magnet
pivots. **L4, L5, L13.**

**PASS** = a narrow shape returns a pair. An L returns an L or a pair, not "no answer". Reporting "no
lawful size" is only correct when *no* arrangement in the band is lawful — never when the square alone
failed. *(The previous implementation tested three fixed squares and reported no-answer for every
shape an L or a pair would have satisfied. This checkpoint exists because of it.)*

**C6 — parity decides registration.** Even count → shape centre falls in the **gap** between magnets.
Odd → a magnet at the centre. At 96mm the lattice is the same lattice with points hidden: **nothing
re-centres, and the resulting asymmetry is accepted**. **L6, L7.**

**PASS** = the 96mm magnet coordinates are a strict subset of the 48mm coordinates for the same shape
and size, on both axes. One shared position missing = FAIL.

**C7 — size is an output.** No millimetre ceiling exists anywhere in the unit; the limit is **9
positions per axis**, and the millimetre value follows from pitch and padding. Nothing is ever
rejected for being "too small". **L8, L9.**

**PASS** = raising the position ceiling from 9 to 11 changes the reachable sizes with no other edit; a
literal-scan of the unit finds no 310, 408 or any other frozen span.

**C8 — publication.** Sizes publish in whole even millimetres, **rounded up** — the shape must never
come out smaller than the grid it holds — and always to the first even value **inside** a lawful
interval, never blind-rounded out of legality. **L10.**

**PASS** = a case with a sub-2mm lawful window publishes inside it. Blind `ceil` fails this case, which
is what makes it a real test. *(Proved 08-11 on the concave harness; countersigned.)*

**C9 — escalation and the stop condition.** The bounding box selects the starting band. A band that
yields nothing lawful escalates to the next. The engine stops on **a match, or a proof that none
exists within the 9×9 ceiling** — never on a silent empty result. **L13.**

**PASS** = for an impossible shape the return states *no lawful arrangement in bands 2–4 at the
ceiling*, with the reason per band, not an empty list.

---

## PROOF — C10, C11

**C10 — applied on the real cut-outs, and seen.** Every band's candidates are applied to the real
outline at exactly the computed scale, registration, pitch and coordinates, drawn as **full 24mm
discs**, and looked at. The seven real cut-outs, both pitches, bands 2/3/4. A candidate that computes
but does not apply is not delivered — this is how the two blocking defects on the previous solver were
caught, both of which passed every headless check.

**PASS** = the drawn placement, re-measured off the rendered geometry, matches the returned
coordinates and `support[]`. Computed ≠ applied is a FAIL against this contract, not a rendering note.

**C11 — an independent oracle, constrained by the same laws.** A separate implementation, sharing no
code with the engine, enumerates candidates under **fixed band, lawful parity and registration, full-
disc containment, no maximality**. It must find **nothing the engine missed and nothing the engine
invented**.

The constraint is load-bearing: an unconstrained oracle optimises *maximum points captured*, which is
the maximality **L13** forbids, and it would reject lawful product behaviour as wrong.

**PASS** = symmetric difference empty across the corpus plus the concave attacks (sliver, L, hollow C,
deep notch, reversed winding).

---

## WHAT SHIPS — C12

**C12.** The deliverable is the **portable unit**: the engine (all compute, no values), the logic
(all values, no maths), and the single bridge between them. It runs **headless** — no DOM, no canvas,
no browser — and answers in millimetres.

The Grid Lab admin surface is the instrument that *looks* at the answers. It is not the deliverable
and is not governed by this contract.

**PASS** = the unit is exercised from a plain script with no browser, on a real cut-out, and returns
C2's fields.

---

## §OUT — what was cut, and where it went

Nothing below is wrong. It fails the scope test in C-head: none of it changes the size, the layout or
the coordinates. Deleting it from here is what makes the twelve above legible.

| cut | how many | where it belongs now |
|---|---|---|
| **Review procedure** — PASS/FAIL rules, who may inherit whose screenshot, matrix format, when a review is NOT CLEAR, QA vs Meta duties | ~21 | The global protocol. It already exists there, and it governs *reviewers*, not the engine. |
| **Performance** — pinch/pan/resize do no solving, cache, mobile Safari as the gate, no invented budget | ~14 | The **instrument's** technical design. Real requirements about the admin shell; they change how it feels, never what comes out. |
| **Rendering and interaction** — how candidates are drawn, browsed, applied on screen, canvas behaviour | ~11 | Instrument design. C10 keeps the only part that is a contract matter: applied must equal computed. |
| **Evidence bookkeeping** — artefact naming, commit citation, screenshot inventory per candidate | ~17 | Instrument design + the review procedure. The unbounded per-candidate visual record was the item nobody could have satisfied. |
| **Test schedule** — the corpus list, the fourteen synthetic attacks, per-case expectations | ~32 | The test suite itself, where it is executable rather than prose. C10 and C11 name the gate; the cases live in code. |
| **Exclusions and unruled items** — no rotation this round, no Cutout Lab integration, no default winner, unruled centre/precedence/thresholds | ~31 | The law book's **OPEN** section. Unruled means *unruled*; a contract cannot check what has no answer yet. |
| **Architecture** — the unit's file structure, the one guard, the canvas computing nothing | — | Technical design. C12 keeps the only load-bearing consequence: it must run headless and answer in millimetres. |

**161 → 12.** The document shrank because the law book shrank first: 86 clauses plus 119 silently
inherited from v1 became thirteen verified laws. A checkpoint per rule is honest; the rules were the
problem.

---

## VERDICT LINES — required on any review of this contract

**Necessity.** Every checkpoint must state which of *size · layout · coordinates* it protects. One that
cannot is unnecessary by construction — say "shrink: C-n", not "add".

**Sufficiency.** The twelve must, together, deliver the size, the layout and the coordinates for a real
locked shape in every band — or name what is missing.

Both lines, both clean, or it is **NOT CLEAR**.

---

**Authority:** [`grid-laws.md`](./grid-laws.md) — thirteen laws, each verified verbatim against
[`grid-brief.md`](./grid-brief.md) with timestamp and lane. Law references above (**L1**–**L13**) point
there. A checkpoint with no law behind it does not belong in this document.
