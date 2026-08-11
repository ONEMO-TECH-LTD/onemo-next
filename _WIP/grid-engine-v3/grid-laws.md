# GRID ENGINE v3 — LAW

### Thirteen laws. The engine and its algorithm. Nothing else.

> **Scope.** *Dan, 2026-08-11:* "the contract is about engine and its algorithm - and how it must be
> applied in practice and deliverables. It is not about entire v3 UI and the rest. The logic + engine
> algorithm." This book obeys that scope. Shell, canvas, zoom, conduct and session steering are not
> law and are not here — see §B, §C, §D below.
>
> **Provenance.** Every law carries Dan's own line, its **timestamp and lane**, verified against the
> transcript vault before it was written here. A clause with no verifiable line is not law.
>
> **Dates.** *Dan, 2026-08-11:* "By now we have enough briefs and laws in 9/10/11 Aug to have this
> project self sufficient and also filter noise as well. So prior briefs and laws from before 9aug
> must probably be removed unless they are fundamental still." Pre-09-08 material is presumed dead
> and survives only where §E rescues it by name.
>
> Companion: [`grid-brief.md`](./grid-brief.md) — his directives verbatim, with timestamps.

---

## THE THIRTEEN

**L1 — THE SHAPE IS UNTOUCHABLE. Scale is the only transform, aspect locked.**
*Dan, 08-10 18:39 @meta ·  08-09 23:25 @lead*
> "locked proportions only scaling  was repeated 100 times today"
>
> "margin offset is cosmetically wrong - scale is the only part must be applied"

Never deformed, stretched, redrawn, eroded or offset. The clearance region may be **measured** — it
is never constructed, drawn, exported or handed to a drawing library.

**L2 — A MAGNET IS LAWFUL ONLY IF ITS WHOLE DISC SITS ON MATERIAL.**
*Dan, 08-10 16:06 @meta · restated 08-11 10:00 @grid-pixel*
> "Pair means shape must be minimum 20mm thick and 68 mm tall. And at those node points 48mm apart
> each shape must have material on the inside to capture 20mm circle. Period"
>
> "the magnets sit on the 12mm cell intersections = 24mm padding disc holds magnet in the center so
> the whole disc must find material support to be integrated"

*Stated at 10mm padding; under the locked 12mm (L3) it reads 24mm thick, 72mm tall, capturing a 24mm
disc. The rule is unchanged — 2×padding thick, pitch+2×padding tall — only the value moved.*

**L3 — PADDING IS 12mm.** *Dan, 08-10 17:31 @meta*
> "decided for 12mm padding - locked decision change the logic in laws and briefs and in the code"

So the spot is 24mm, exactly half the 48mm pitch.

**L4 — THE PAIR IS THE UNIT OF MEASURE, AND THE FLOOR.** *Dan, 08-10 16:04 @meta*
> "pair is the unit of measure here"

Below a pair there is one magnet, and one magnet lets the shape pivot. Every product holds at least
one pair.

**L5 — THE ARRANGEMENT FOLLOWS THE SHAPE'S OWN FORM.** *Dan, 08-10 16:00 @meta*
> "If shape is narrow it uses minimum 1column of 2rows if normal closer to square or circle 4 minimum
> L shape by definition will have 1 + 2 - as well as any triangle"

No shape is ever named in the logic. An L drops to 1+2 by itself, because the fourth position has no
fabric under it.

**L6 — PARITY DECIDES REGISTRATION, AND NOTHING ELSE.** *Dan, 08-10 13:54 @lead*
> "however the 4 parts of 4x4 48mm points are not in the center so we need to adapt to each grid to
> make the shape center to the 4x4 or at least 1 column x 2 rows single 2 point"

An even run centres in the **gap** between magnets; an odd run centres **on** a magnet. Nothing is
chosen — the count decides.

**L7 — AT 96mm NOTHING IS RE-CENTRED. Points hide; the lattice stays put.**
*Dan, 08-11 08:35 @meta*
> "no need force  centering - the view remains same just some points are hidden to show sparse grid
> no complication"

The consequence — an even match at 96mm sits nearer one visible magnet than the other — is accepted,
not corrected.

**L8 — GRID FIRST. Shape + grid = the dimensions. No size input exists.**
*Dan, 08-10 16:17 · 16:10 · 16:11 @meta*
> "we have grid first logic - shape + grid= final proportion and dimensions"
>
> "No size inputs may exist"
>
> "Size is final value we manufacture form as dimension of the shape with locked aspect"

Size is the **output**. No cap, target, range or test size crosses into the unit. There are no fail
sizes — a shape is never "too small"; it scales until it holds.

**L9 — THE CEILING IS A GRID COUNT, NEVER A MILLIMETRE.** *Dan, 08-10 16:13 @meta*
> "Sizes in terms of max can be defined by max grid columns and rows covered by a shape in our case
> we create engine to match our 9x9 grid as max grid after we validate stable engine works we cap the
> grid to specific number"

9×9 for now.

**L10 — PUBLICATION ROUNDS UP TO THE NEXT EVEN MILLIMETRE.** *Dan, 08-10 17:04 @meta*
> "fine circle can be 92 but we dont really care as we have grid led shape sizing and rounding system
> to the next even number that can be divided by 2"

Up, never down — the shape must not come out smaller than the grid it holds. **On a concave outline a
lawful window can be narrower than 2mm, so publication takes the first even value INSIDE a lawful
window; it never blind-rounds out of legality.** *(DERIVED — proved 08-11 by @grid-pixel, harness
`9e167809`, re-run and countersigned by @meta. Marked derived because Dan ruled the rounding, not the
interval method.)*

**L11 — BALANCE AND SYMMETRY DECIDE BEFORE TIGHTNESS.** *Dan, 08-10 12:34 @lead*
> "what may seem logical on paper and mathematically correct may miss the law of balance and
> simetry" · "the grid 2x2 must be centered and symetrical from each side of the shape plus follow
> logic of where material is and is not available" · "the gravity rules of magnets having support on
> the top side to hold top side and not make only 1 row at the bottom" · "centering and balancing so
> there is no  flap and assymetric free uncovered by magnets surface" · "perfect shape x grid match is
> 4 points balanced and symetrically centerd on the shape"

Four bindings, each live: **centred and symmetrical on every side** · **material-aware** — magnets go
where material is · **gravity** — the top must be held, not only the bottom · **no flap** — no large
asymmetric uncovered region.

**Tightness is the objective only after balance.** *Dan, 08-10 12:16 · 14:07 @lead:* "look how close
the edges of shape to gug the grid 2x2 - so in that case close to optimal is 162mm size" · "it must
hug 48mm x4 points". A tighter size that is unbalanced is rejected.

**L12 — SYMMETRY BALANCE IS JUDGED PER CELL, ABOUT THE CENTRE LINES.**
*Dan, 08-10 20:03 · 20:08 @lead*
> "By gold I meant the center lines vertically and horizontaly dividing a shape to judge each cell on
> the coverage of the magnet."
>
> "My proposal was center the shape each of 4 sides will have cells - identify if the outmost cells
> covered by material if not scale this segment till covered repeat for each segment combine scale %
> and average this will give you overall scaling for fine tuning your scale by this number and center
> the shape - my hypothetical solution."

**The second quote is Dan's stated HYPOTHESIS, in his own word — not a ruling.** The measure it
defines is law: judge each cell about the centre lines for material coverage. The averaging step is a
proposal to be tested, not a rule to implement.

**L13 — A BAND IS A RANGE TO BE SEARCHED, NOT A SQUARE TO BE TESTED.**
*Dan, 08-11 11:38 @grid-pixel · with 08-10 18:37 · 18:38 @meta · 08-11 11:28 @grid-pixel*
> "wait the algorithm must analise shape and bands in each band range it must provide answers what
> combinations fit precisely grid+ shape proportions aspect ratio locked and scalled to fine tune the
> fit in the band - if the band is not possible to apply minimum using a pair (2 vertical or
> horizontal p[oints fittin and centering in the shape ) what is the next band and magnet quantity
> fits ?"
>
> "the method is > user defines locked shape > our grid engine under the hood produces the best sizing
> in the chosen band range > we tell user the size of the shape exactly on this basis but we need to
> be dead sure 100% mathematical certainty"
>
> "the band is auto determined by the bounding box first  > after that we need placement with engine
> providing the coordinates"
>
> "and thi smust be in steps like all variations of sizes and layouts in each band"

**Order:** the bounding box picks the starting band → the population is **discovered**, not assumed →
the shape scales, aspect locked, to fine-tune the fit → **every** lawful variation is returned, never
the first fit → if nothing in a band is lawful, escalate to the next band → stop at a found match or
a proof that none exists within L9's ceiling.

**No maximality.** *Dan, 08-11 charter, three separate lines:* “As many magnets as fit” is
forbidden. · Magnet count is not the optimisation objective. · Interior magnets do not compensate for
unsupported tips, sides or extremities.

---

## §B — ARCHITECTURE (true, but design — not law the algorithm obeys)

The portable unit is **engine + logic**, driven through **one bridge**; the admin shell is separate and
computes nothing. Engine holds all compute and no values; logic holds values and the bridging, and no
maths. Every write to a law value passes **one guard**. Blindness: no prior sizes, no shape names, and
changing an input re-derives every result.
*Dan, 08-10 12:25 · 12:28 · 13:58 · 11:32 · 14:17.* Belongs in the technical design.

## §C — CLOSED STEERING (one-off, done — not law)

402×402 viewport · notepad at 5%, two levels · zoom centre-preserving and touching nothing · canvas
clean of controls · the field must visibly end · sealed values with lock/unlock · the size control on
the shell. All from 08-10, all specific to the instrument, all delivered.

## §D — CONDUCT (the global protocol, not grid law)

Design before build · ask before acting · every QA runs necessity and deslop · the lane does its own
research · verification is code **and** eyes · a default is not the builder's to set · nothing is
approximated where real maths exists · the basic geometries are not the work · nothing is proven until
a real cut-out is on screen.

## §E — INHERITED FROM v1, BY NAME ONLY

*The former blanket clause — "inherits it in full… nothing repealed except where a clause says so" —
imported 1,644 lines and 119 clauses from session 59 unread. It is struck.* Rescued as still
fundamental, because they are physical facts a project rename cannot change:

- **the 48mm lattice**, and 96mm as the same lattice populated sparsely — no 24mm or 72mm pitch;
- **publication in whole even millimetres** (v1 3.23, restated here as L10);
- **mask / spacing / pattern are separate controls**, none inferring another.

Nothing else from v1 is law. It remains readable history at
`onemo-ssot-global/.claude/worktrees/s59-grid-law-main/_ssot-workbench/_briefs/grid-laws.md`.

---

# STRUCK — fabricated, and quoted as Dan for two days

Machine-checked 2026-08-11: all 152 quotes in the previous book were tested against every s62 and s59
transcript. Three were not his.

- **old 11.6** — *"The size is determined by edge to edge optimal matching"* + "One pass, no search."
  **Exists nowhere.** It is a reworded v1 zero-flap rule (07-29, about what *optimal* means) restamped
  `DAN, 08-10`. It was then used as the principal argument for rejecting a contract.
- **old 3.1f** — *"The fold was used as hypothetical folding the shape in half to determine center
  lines vertically."* **Exists nowhere.** Dan's actual words (08-10 15:37 @meta) were about symmetry
  and scaling: "it is folding the shape mid point 24 or 48mm… each side is mirror that can be
  individually treated". A brainstorm was converted into a ruling.
- **old 10.4** — *"tolerance is not required, it affects nothing, we have no tolerance, everything
  must sit on the exact sizing."* **Exists nowhere.** What he said was four words: "tolerance 0.05mm -
  who invented this?" *(The intent stands under L-none: a number with no author is not law. The
  sentence was invented.)*

Also corrected: the charter quote in the previous 14.2 was **real** but had been re-flowed from Dan's
bullet list into a running sentence while the file claimed verbatim.

---

# OPEN — nothing here may be decided by inference

**O-1 — the centre.** Box centre, material centroid and maximum-clearance give different placements
(measured 17mm apart on a lopsided concave shape; 216mm vs 138mm on an L). All three land on air for a
crescent. **Settled by switch, not ruling** — *Dan, 08-11 10:33:* "why do i need to rule if  i never
tested the difference in the real life - why noit add all options and test?"

**O-2 — the bounding-box → band thresholds.** No numbers exist. Same treatment as O-1.

**O-3 — coverage versus balance precedence.** Both measures are named by L11/L12; which wins when they
disagree was never ruled, and two silent inventions of it have already been reversed. Reported
separately, never merged into a score.

**O-4 — curve identity.** Tessellation changes a discrete outcome (a 124- vs 240-point circle). Carried
from v1, unresolved, and affects generated shapes only — not traced cut-outs.
