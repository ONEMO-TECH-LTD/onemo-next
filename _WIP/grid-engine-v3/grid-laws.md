# GRID ENGINE v3 — LAW

### Eighteen laws. The engine and its algorithm. Nothing else.

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

## THE FIFTEEN

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

**L4a — A TWIN FIX CAPS AT 168mm. Two magnets cannot hold more.**
*Dan, 08-11 @lead*
> "ok the 168mm band 4 is the max size for twinfix shaped effects hence we can calculate anything
> fitting that range"

**The physical reason, in his words:** *"imagine 200mmx200mm used with 2 parts one on the surface of
garment another under it to snadwithch with magnetic force the garment and create hold - if tshirt has
magnetic grid built in larger sizes can be fit to it otherwise i woul limit sizes to smaller than
160"*, and *"i would not make twin fix shapes larger than 160-180mm… especially closer to square"*.

The fixing sandwiches the fabric between two parts. Two of them cannot hold a large panel — and a
near-square shape is the worst case, because the most material sits furthest from the pair's axis.

**The number is the lattice's own, not an invented threshold:** 168mm is band 4's span,
`(4−1)·48 + 2·12`. The band is hidden and non-operational (L8a); its *span* survives as this cap.

**Measured against the real corpus — which shapes can take a twin fix at all:**

| shape | aspect | smallest twin-fix size | under 168? |
|---|---|---|---|
| BOT | 1.35 : 1 | 132 | **yes** (132, 142, 152) |
| POKE1 | 1.18 : 1 | 130 | **yes** (130, 132, 164) |
| BUTTERFLY | 1.22 : 1 | 176 | no |
| PILL | **1.01 : 1** | 206 | no |

**PILL is his point proved.** It is the one near-square shape in the corpus, and **every one of its 28
twin-fix candidates exceeds the cap** — its smallest is 206mm. A near-square shape cannot take a twin
fix, exactly as he said.

*Applying the cap changes no selected winner on the corpus — the winners are 3- to 5-magnet layouts —
so this removes unusable options without disturbing the answer.*

**THE OVERHANG ALLOWANCE — and the corpus explains why his number is right.**
*Dan:* "the offset can be like 168+12-24mm space to stick out or accomodate shapes to 168 bounding box"

A twin fix's region is **72 × 24mm** — a 3:1 box. Measured, on rounded shapes of varying aspect:

| shape aspect | published size | overhang L/R | overhang T/B | max | flap 12 | flap 24 |
|---|---|---|---|---|---|---|
| 1.0 : 1 | 76mm | 2 | 26 | 26 | fail | fail |
| 1.5 : 1 | 82mm | 5 | 15 | 15 | fail | **pass** |
| **2.0 : 1** | 88mm | 8 | 10 | **10** | **pass** | **pass** |
| **2.5 : 1** | 94mm | 11 | 7 | **11** | **pass** | **pass** |
| 3.0 : 1 | 102mm | 15 | 5 | 15 | fail | **pass** |
| 3.5 : 1 | 112mm | 20 | 4 | 20 | fail | **pass** |
| 4.0 : 1 | 122mm | 25 | 3 | 25 | fail | fail |

**His 12–24mm allowance is exactly the natural range**: the twin fix's working window is roughly
**1.5:1 to 3.5:1**, and it is happiest at **2:1–2.5:1** where overhang is 10–11mm and it clears even
the strict limit. Every one of those sizes is 76–122mm, comfortably inside the 168mm cap — so the cap
and the allowance never fight.

*(Not 3:1 as the box's own ratio would suggest: a rounded outline's corners cut in, so the best match
to a 3:1 box is a ~2:1 shape.)*

**Why no real cut-out takes a twin fix, measured:** the corpus is 1.0–1.4:1 — blobby, not elongated —
and their best twin-fix overhangs run **49 to 100mm**. BUTTERFLY 79, POKE1 53, BOT 59, PILL 91,
POKE2 49. All far outside any 12–24mm allowance. That is L5 working exactly as written: *"If shape is
narrow it uses minimum 1column of 2rows if normal closer to square or circle 4 minimum"* — the corpus
is "normal", so it gets four, and the twin fix is for the narrow effects the corpus does not contain.

**OPEN, and his:** the built-in-garment-grid case. He says larger sizes fit *"if tshirt has magnetic
grid built in"*. Whether that is an engine input or a product rule outside the engine is unruled, and
L8 forbids a size input crossing inward — a garment capability is not a size, but the boundary needs
his word.

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

**L8a — ONLY BANDS 2 AND 3 ARE OPERATIONAL. 1 and 4 exist and are hidden.**
*Dan, 08-11 @lead — and he states he ruled it on 08-10*
> "yeah band 4 was never realistic anyway for custom cutouts unless they are more like geometric
> shapes - so i had defined it yesterday that while we have bands 1/2/3/4 - 1and 4 are hidden and not
> operational we only use 2/3"

**Band 1 is below the pair floor** (L4) and band 4 does not survive contact with real cut-outs.

*Provenance note, stated rather than smoothed over: this is NOT in the captured record. Every band
reference in the brief and in both law and contract reads "2/3/4", and the ruling appears in no lane's
transcript. It reached us only when he restated it here. Either the collector dropped it (§F) or it
was said somewhere unread — but the whole authority stack has been carrying 2/3/4 since, so this
correction propagates to the contract, the blueprint and every test fixture.*

**Measured consequence, and it is good news.** Band 4 was the band the real corpus could not reach —
420 to 606mm against a 408mm ceiling on all seven cut-outs. Removing it removes that problem entirely.
What remains live: BAT-WOMAN needs 434mm at band 3, still over the ceiling, and DUCK finds nothing at
either band on the bounding-box centre.

**L8b — THREE IN A ROW IS TWO LINKED PAIRS, SO ITS OUTER TWO ARE A LAWFUL SPARSE PAIR.**
*Dan, 08-11 @lead*
> "96mm is lawfull sparse pair and actually prefered and proven sufficient"
>
> "it cannot not be as it is 2 linked lawful pairs in line - = lawful sparse  ahahahaha"

I had raised the outer two magnets of `###` being 96mm apart as an arithmetic problem — not a lawful
48mm pair. It is not a problem. **Three in a row at 48mm is two overlapping lawful pairs, and its
outer two are 96mm apart, which is the sparse pitch.** The middle magnet can be hidden and what
remains is lawful *by construction*, on the population the lattice already offers (L7).

**The middle magnet is FREE TO REMOVE — measured, not argued.** Both layouts occupy the same
`120 × 24` region, so they publish at the same size:

| layout | pitch | region | tall triangle | wide triangle |
|---|---|---|---|---|
| three in a row `###` | 48 | 120 × 24 | 458mm | 218mm |
| sparse pair `#.#` | 96 | 120 × 24 | **458mm** | **218mm** |

Identical. Same size, one fewer magnet — which is why the sparse pair is **preferred**, and Dan states
it is **proven sufficient**.

*(Preference bears on L17's still-unruled selection ordering: where both populations answer, this says
the sparse one is preferred. It settles that pair, not the whole ordering.)*

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
asymmetric uncovered region, now bounded by a real number in **L14**.

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

*Relationship to L14a — recorded, not resolved by me.* On 08-11 Dan named a different yardstick for
the same intent: flap **evened out on all sides**, measured per side rather than per cell. L14a is
later, more specific, and he called it "the yardstick for balanced measure", so it is the operative
one and the contract measures per side. **L12 is not struck** — it is his ruling and the per-cell
question may yet catch something per-side evenness cannot (a cell hollowed out mid-side reads as even
reach at the edge). Whether they are the same measure is his to settle, not mine to collapse.

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

**L14 — THE SUCCESS TEST. Four conditions, all of them measurable.**
*Dan, 08-11 12:34 @lead — the final formulation of the deliverable*
> "the measureing success is to have minimum magnet pair (vertical/horizontal), in 48mm and 96mm
> sparse layout to be fit to shape inside it , centered to the shape and have no flap zones greater
> than 12-24mm on any side unless it is trivial limb especially at the bottom"

A variant passes when **all four** hold:

1. **A minimum magnet pair** — vertical or horizontal (**L4**).
2. **In both populations** — 48mm **and** 96mm sparse. Not one or the other: a variant that holds
   only at 48 is not a pass. *(This is stricter than anything previously written and it is the
   condition most likely to fail — a pair that survives 48mm thinning to 96mm needs material
   96mm apart.)*
3. **Fitted inside the shape and centred on it** (**L2** for "inside", **L6** for what "centred" means
   — parity, not choice). **Centred has a measurable definition** — see L14a.
4. **No flap zone greater than 12–24mm on any side** — unless the uncovered region is a **trivial
   limb**, and the bottom especially is where that exemption applies.

**On the number.** Dan gave a **range, not a point**, and both ends are lattice quantities: 12mm is
one padding, 24mm is one magnet spot. Treat the limit as a **switch between those two values, tested
on the real corpus** — never a third number picked in between. This is the same treatment O-1 and O-2
get, and it is Dan's own standing method: *"why do i need to rule if  i never tested the difference in
the real life - why noit add all options and test?"*

**L14a — CENTRED MEANS THE FLAP IS EVEN ON ALL SIDES AT ONCE.**
*Dan, 08-11 12:38 @meta — **CONFIRMED TWICE**: his input line in the meta lane's live pane, and his
own captured turn "confirm" at 12:46:30 against a verbatim restatement*
> "one thing to add the the mgnet assembly must be centered to prevent flap in the first place and
> this is the yardstick for balanced measure i suppose having flap evened out on all sides at the
> same time with all mag discs enveloped to the edge"

This is the criterion **L11 and L12 never had a number for, and it needs no invented threshold**:

- **Balance** = the unsupported reach is **evened out across all sides simultaneously**. Not a
  displacement bound, not a centroid distance — an evenness comparison between the sides themselves.
- **Coverage** = each side's reach sits within the active **L14** switch (12 or 24).
- **Tightness** = the discs are **enveloped out to the edge**.

The three stop being rivals needing a precedence ruling and become **one measurement family**, which
materially narrows **O-3**. Centring is now falsifiable: a bunched arrangement has uneven side flaps
by construction, so it fails without anyone defining "bunched".

> **Provenance — confirmed the hard way, and worth keeping as the record.** This clause and L15 are
> absent from every transcript in the vault. Both were held out of the book for that reason, and Dan
> directed the resolution: *"to verify read the tmux of the meta in case transcript in the vault is
> missing"*. His own input lines are there in the meta lane's scrollback and match the relay exactly.
> He then confirmed both in a vault-captured turn — `claude/s62/meta/2026-08-11/_day.md`, the
> verbatim restatement at lines 828 and 833, his own `confirm` at line 840, 12:46:30.
> **Two independent proofs. And the lesson: the vault is not the only evidence layer — a live pane is
> stronger when the vault has a hole.** See §F, where the hole is characterised.

**HOW FLAP IS MEASURED — ruled, after BOTH the blueprint and I measured it wrong.**
*Dan, 08-11 @lead*
> "the flap is calculated from the edge of the grid bounding box to the outer edges of the shape
> cutout - the 4x48mm grid points have 72mm square boiunding box inside of it no flap must be
> recognised - the pair has 72x24 bounding box so on and so forth"

**The grid bounding box is the arrangement's magnet extent grown by the padding on every side.**
Nothing inside it is flap, ever. Flap is the shape's **overhang beyond that box**, per side.

    box   = [min qx − P, max qx + P] × [min qy − P, max qy + P]
    flap  = per side, how far the outline reaches past the box edge, clamped at 0

Checked against his own two examples: two points 48mm apart plus 12mm each side = **72mm**; a pair is
**72 × 24**. Both reproduce exactly.

**What it gives, measured:**

| shape | band | size | box | flap per side | 12mm | 24mm |
|---|---|---|---|---|---|---|
| square | 2 / 3 / 4 | 72 / 120 / 168 | 72 / 120 / 168 | **0 / 0 / 0** | pass | pass |
| circle | 2 | 92 | 72 | 10 each side | pass | pass |
| circle | 3 | 160 | 120 | 20 each side | fail | pass |
| circle | 4 | 228 | 168 | 30 each side | fail | fail |

The square has **zero flap** — it *is* the box — which is the obvious sanity check both earlier models
failed. And L14a falls out for free: the four overhangs being equal **is** "flap evened out on all
sides at the same time".

**L18 — THE SHAPE MUST ENCAPSULATE THE GRID'S BOUNDING BOX. That containment IS the computation.**
*Dan, 08-11 @lead, immediately after the flap correction*
> "shape must encapsulate bounding box of the grid in whatever layout it is matching the shape - e.g.
> 2 points, 3 points (L shape, triangle piramid 1:2 shape) and the rest of the options with 3x3 and
> 4x4 and rectangular variations as well"
>
> "so the engine computing is essentially whether the bounding box fits inside the shape in set
> variants of layouts based on the grid"

**This is the algorithm, stated in one sentence.** Not per-magnet clearance solving — **scale the
shape until the layout's grid region fits inside it, for each layout the grid offers.**

**It is strictly stronger than per-magnet disc support**, because each magnet's disc lies inside its
own cell and every cell lies inside the region. So it can only ever raise a size, never lower one.
Measured:

| shape | band | disc support | encapsulation | why |
|---|---|---|---|---|
| square | 2 / 3 / 4 | 72 / 120 / 168 | **72 / 120 / 168** | identical — the binding contact is an edge |
| circle | 2 / 3 / 4 | 92 / 160 / 228 | **102 / 170 / 238** | +10 each — the binding contact is the box **corner** |

The square canon is preserved exactly. The circle grows by ten because a box corner must now sit on
fabric. *(Containment is CLOSED — the box boundary may touch the outline. A strict test rejects the
square's own canon at 72.)*

**THE REGION IS THE UNION OF THE ADJACENT PAIRS' BOXES — CONFIRMED BY DAN.**
*Verified first-hand in @s62-grid-pixel's pane: the rule was put to him as a question and his answer
was* **"yes"**. *He then generalised it himself:*
> "yes in fact this is so sensible that it can be actually applied by analogy to other complex shapes
> - measureing by joint pairs makes the model smarter"

**Every adjacent horizontal or vertical magnet pair contributes its own padded box; the layout's
required region is their union.** Rectangles stay rectangles. A three-point L gives an L-shaped region
with **no invented fourth corner**. The pair is already the unit of measure (L4) — now it is the unit
of *geometry* too, which is what makes it generalise to any arrangement rather than needing a rule per
shape of layout.

**Why it is safe for rectangles, measured rather than argued.** For a 2×2 the union is a *ring* — the
four pair boxes leave a 24×24 hole at the centre. It still gives the same answer as the full box on
any solid outline, because a ring lying inside a simple closed curve encloses its own middle, so
ring-inside implies box-inside. Verified on real traced cut-outs: BUTTERFLY 212 / 354, POKE1 180 / 300,
PILL 212 / 352 at bands 2 / 3 — **identical both ways**. (Holes are excluded by Dan's 08-10 ruling, so
every outline is solid and the implication always holds.)

**How this was nearly got wrong, kept as the lesson.** I derived this reading from measurement and
promoted it straight into the law book and the contract. Both peers caught it. Dan's own response is
the rule to keep: *"i didnt but what is the problem for you guys to agree with it and ask me to
confirm - even if i didnt choose i can still do that if you actually ask"* — **agree on the strongest
reading, show it plainly, and ask. Do not silently promote it, and do not freeze everything either.**

Dan
names 3-point layouts (the L, the 1:2 pyramid) as first-class. On an L cut-out with a 3-point L
layout:

- the **axis-aligned box of all three magnets** (72 × 72) — **NEVER FITS, at any scale.** That reading
  would make Dan's own named layout impossible on the shape it exists for.
- the **union of the layout's pair boxes** (72 × 24 ∪ 24 × 72, an L-shaped region) — **publishes
  72mm**, exactly matching per-magnet disc support.

So the region is the **union of the boxes of the layout's adjacent pairs**, which is the axis-aligned
box only when the layout is a full rectangle. That is the reading that makes his examples work.

**Per population, not per family.** The 48 and 96 arrangements of one family have different extents,
so different boxes and different overhangs. The evidence lives inside each population; the family
passes a switch only when both do. *(Raised by @s62-grid-pixel.)*

**Struck: distance-to-the-nearest-disc.** I reported the square as 14.83mm and told Dan nothing could
pass at 12mm. That measured the gap from the shape's edge to the nearest magnet, which is not flap and
never was. His answer: *"this is nonesense… so sanity fucking check on your interpretation."* It also
means the blueprint's Voronoi apparatus for reach is unnecessary — flap is four subtractions.

**WHAT FLAP IS — ruled, after a blueprint measured it the other way.**
*Dan, 08-11 @lead, on being shown that the blueprint counted the gap between magnets as flap:*
> "between magnets? flap= outer edges not supported by magnet connection and hold"

**Flap is material at the OUTER EDGE that no magnet holds.** It is not the space between magnets.
The unsupported run between two magnets is 48mm by construction (96mm sparse) — that is the lattice,
not a defect, and grid-spec §9 already recorded it as *"a physical answer, not a computed one"*.

The consequence is a hard one, and it is why this needed ruling: a measure that counts interior
material reports 21.941mm of "reach" at the centre of any four magnets on the 48mm lattice —
identical for bands 2, 3 and 4, because it is the cell and not the shape. That value exceeds the 12mm
switch, so **coverage could never pass at 12mm for any shape**, and one of the two positions Dan ruled
would be unselectable. A flap measure that cannot pass is not measuring flap.

**On the limb exemption.** "Trivial" has no number and none may be invented. The engine **measures**
every uncovered region — extent and side — and **reports** which ones the exemption was applied to.
An exemption that is visible can be overruled; one applied silently cannot. **This closes the only
previously unenforceable clause in the book:** the flap had no threshold and no author, so it was the
one failure condition that could never fail. It now can.

**L15 — THE ORDERED SCALE: THE PAIR IS THE FLOOR, FOUR CORNERS AT THE EDGE IS THE OPTIMUM.**
*Dan, 08-11 12:41 @meta — **CONFIRMED TWICE**, same two proofs as L14a*
> "also minimum is pair but optimal is 4 magnets in each outmost corner fitting to the edge"

This is the first time the book has had an **optimum**, and it is a named arrangement rather than a
score: **four magnets, one at each outermost corner, fitted to the edge.** It makes L11's "perfect
shape x grid match is 4 points balanced and symetrically centerd on the shape" concrete — the corners
are named, and so is the edge-fit.

It composes with L14a into one picture of the ideal: **four corner magnets · discs enveloped to the
edge · flap evened on all sides.**

**It is not a ranking and it does not conflict with L13's no-maximality.** Four-at-the-corners is a
*shape*, not "as many as fit". The engine **reports whether that arrangement is lawful** for a given
shape and marks it when it is; the pair stays the floor; everything in between is reported as what it
is. Nothing is scored, nothing is discarded.

**Every option across the range, restated by Dan the same minute:**
*08-11 12:47 @meta — a normal turn, vault-verifiable*
> "yeah i forgot to emphasise the pair is minimum but engine must caculate in the size band minimum
> pair and other options mag quantity and layout using range between bands"

That is **L13** confirmed in his own words a second time: inside each band's range, the minimum pair
**and** every other quantity and layout, across the range between bands.

---

**L16 — SOLVING NEVER RUNS ON A UI EVENT. Measured, not asserted.**
*Dan, 08-11 13:27 @lead — after hitting the freeze live on the bench*
> "there was a problem with computations of the centroid they froze the UI shel cause they were
> computing hundreds of variants for every ui change - it is no go"
>
> "also we need to make sure that current parts that we retain do n ot jit the performance and freeze
> the build"

**"No go" is a ruling, not a complaint** — the shape of that design may not come back, in any spelling.

**What it cost, measured on a 1,440-point trace (a real cut-out):**

| | |
|---|---|
| candidate sizes per method per band | **193** (24→408mm, even) |
| × 6 centre methods × 3 bands | **3,474 solves per UI event** |
| outline point re-scales | **5,002,560** |
| magnet-against-edge distance tests | **48,358,080** |
| wall time | **163.7ms** — against a 16.7ms frame. **~10 frames dropped per event.** |

**And the second half of the ruling is the one that gets forgotten:** the parts that SURVIVE must not
do it either. All six centre methods together cost **4.4ms** on the same outline — trivial once,
ruinous at sixty times a second, where they would eat a quarter of the frame budget before any
solving began. So: **computed once per frozen outline, cached by outline fingerprint, never during
pinch, resize, pan, drag, camera movement or variant browsing.** Browsing candidates is a lookup.

*(Contract EC-12 carries this. Recorded here because EC-12 is a checkbox and this is the reason
behind it — and because the first design to break it did so while satisfying every other law.)*

**L17 — THE BULLS EYE. One guaranteed answer per band, good enough that nobody touches it after.**
*Dan, 08-11 @lead — **provenance differs between the two quotes, and it matters***
>
> *The first arrived mid-turn to this lane and the collector did NOT capture it (§F). This lane is its
> first-hand receiver rather than a relay, and it was quoted back to Dan in a reply he did not correct
> — but it is not vault-verifiable and is booked as such. The second is a captured Dan turn at
> **14:07:16**, verified. The flap ruling above it is a captured turn at **14:02:54**.*
> "the eventual mechanism in the interaction will be just selecting the band so under the hood we need
> to make sure that within selected band user gets the optimal size and we guarantee it - otherwise
> they can get surprises on the expected sizes"
>
> "admin dash must allow us to move and review every increment defined by the engine and if we can we
> need to build the engine that hits the bulls eye so we dont have to create mystery sizing and user
> knows the size and confirmed by the system and we do not to polish the mnagnetic grid matching the
> shape manually post purchase by eye - theis will become real bottleneck for the production and bad
> UX"

**The interaction is one control: the user picks a band.** They then get one size, it is the optimal
one for that band, and it is guaranteed — same shape, same band, same answer, every time.

**Selection is not discarding, and that is what reconciles this with L13.** The engine still computes
and returns every lawful variation; it *marks* one as the guaranteed answer. Nothing is hidden, one
thing is named. The admin dash steps through **every** increment the engine defines — that is the
review surface, and it is why returning everything still matters.

**THE ACCEPTANCE BAR, and it is harder than any checkpoint:** the marked answer must be the one a
person would have chosen by eye, on real cut-outs. **If anyone has to nudge the placement after
purchase, the engine has failed** — Dan names that as a production bottleneck and bad UX, not a
tolerable finishing step. The seven real cut-outs stop being a test of whether the maths runs and
become a test of whether the CHOICE is right.

**UNRULED, and it must not be invented:** what "optimal" orders by. The recommendation on the table
uses only ruled law — L15's ordered scale picks the arrangement class (four outermost corners fitted
to the edge, down to the pair floor); L14a's evenness picks among sizes achieving it; L11's hug breaks
the remaining tie by tightest. **Awaiting Dan.** *(Measured obstacle: at the 12mm flap switch nothing
passes, not even a plain square — its mid-edge sits 14.83mm from support by pure lattice geometry at
every band — so "optimal" cannot be defined by coverage alone.)*

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


## §F — THE COLLECTOR GAP (why two true rulings were nearly struck)

**The transcript vault silently drops some of Dan's messages.** Characterised from this lane's own
traffic on 08-11, where the arrival mode of each message is known:

| Dan's message | how it arrived | in the day-file? |
|---|---|---|
| "pixel is drafting new contract" | interrupt | **yes** |
| "pixel has this brief" | interrupt | **yes** |
| "to verify read the tmux of the meta…" | interrupt | **yes** |
| "i sent pixel and meta… *the final formulation*" | mid-turn, no interrupt | **NO** |
| "We don't need irrelevant things listed in the contract…" | mid-turn, no interrupt | **NO** |

**The rule: an interrupt becomes a captured turn; a message injected into a running turn does not.**
Three captured, two dropped, in one lane in one hour — and one of the two dropped is the deliverable
formulation this entire contract is built on.

**Consequence for law-keeping.** "Not in the vault" is evidence of absence only for messages that
arrived as interrupts. For anything else, **check the receiving lane's live pane before striking a
clause** — that is what confirmed L14a and L15 after both failed the vault check. Until the collector
is fixed, a lane that receives a mid-turn ruling should echo it verbatim in its next reply, which
makes it vault-capturable.


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

**O-2a — the flap limit, 12mm or 24mm.** Ruled as a **range** in L14, so the two ends are switches to
test, not a gap to fill. What is a *trivial limb* is measured and reported, never enforced.
*(This was the book's only unenforceable failure condition until 08-11 12:34. It is now closed as a
test, not left open as a question.)*

*Reconciled with the contract's EC-09 (@s62-grid-pixel `ca5ee2c6`, agreed by @s62-meta): the engine
reports each zone's **measured reach**, which reads against both switch positions at once — ≤12 passes
either, 12–24 passes only the lenient one, >24 fails both. That is the two-switch comparison expressed
as one measurement, not a third threshold. Book and contract say the same thing.*

**O-3 — coverage versus balance precedence.** Both measures are named by L11/L12; which wins when they
disagree was never ruled, and two silent inventions of it have already been reversed. Reported
separately, never merged into a score.

**O-4 — curve identity.** Tessellation changes a discrete outcome (a 124- vs 240-point circle). Carried
from v1, unresolved, and affects generated shapes only — not traced cut-outs.
