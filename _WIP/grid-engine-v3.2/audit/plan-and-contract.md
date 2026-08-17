# Contract — three modules, current engine, invented goes

The canon is the spec. Current 3.2 is the code. We strip what is not in the list. We do not restore a prior engine.

## Where the “old piece” was (and why it is not the plan)

It was the placement board from before 3.2 rewrote the judge. I treated that file as the product. The product is the three-module list in the briefs. That rollback is abandoned as the strategy.

## The job

Given the fixed magnet board, size the outline so it honestly sits on that board. Layouts are read off the fabric. Library shapes are exams.

## Three modules

**Spec — numbers only.** Cell 24, disc 24, 12 mm to the edge, pitch 48. Size bands as ranges. Leftover-edge bounds (tight / loose / limb). Even-flap tolerance. Approved seatings (single, pair, L, T, row, four corners…). Spec never measures and never picks.

**Compute — checks only.** Whole disc in fabric? Where may this seating sit? Leftover on each side? Where are the masses? No bands, no animals, no “prefer a pair.”

**Logic — behaviour only.** Box = capacity, not the layout. Hypothesise a frame, fabric may reduce it. Scale through the band. Read the pattern the lawful seats form. Pick: legal → cover masses → hold the top → less leftover (limb reported) → approved pattern → one per distinct mass → even leftover → fewer magnets if support is the same → snuggest size. Every distinct layout the band unlocks; mark the one you’d pick by eye.

## Current 3.2 against that list (frozen T8, this lane)

Already the three folders. Already no “this band is N magnets.”

**Keep (does the list):**
- Compute: exact disc check, safe land, continuous “where can this seating sit?”, wrap, structure measurements.
- Spec: 24 / 12 / 48, band ranges, seating library, leftover numbers sitting as values.
- Logic: scale every size on its own, call the new checker, start from the centred seat.

**Invented — goes:**
- Permission table is a one-to-one lock. 25 cells, each names exactly one frame. 19 engineering-derived, 6 deferred, 0 traced. Used as law.
- The brief already writes **one-to-many** (tall B3 is 1×3 **or** 2×3). Spec split each “or” into two cells keyed on box width vs height, so the ruled choice became box arithmetic.
- Circle / oval is a **ruled row** with sizes (single ~40, 2×2 at 92, 3×3 at 160, 4×4 at 228). It is simply missing from the 25 cells. **Free** is different: it is the step-6 material class (tapered / waisted / winged / …) — that is item 3, not this gap.
- 12 mm leftover as a hard no. Brief: leftover is scored against a 12–24 **switch** (mechanism ruled; the number is open). Shipping 12 as the only reject was recording an open value as decided. 24 is the position **under test**, not a new settled law.
- “Cover the masses” and “one per distinct mass” pointed at the same one blob. Compute does **not** already measure anatomy (head / body / wings). What it measures is how the safe land splits when eroded deeper. That is not the structural graph the briefs require (major vs thin, connectors, persistence when size changes). Re-pointing at a deeper erosion restarts the stop that emptied bat and pill. Re-pointing at the same shallow blob changes nothing.
- Centre-of-mass called balance. Balance is leftover even on all sides.
- The old placement board as a second engine. Not the path.

## Minimal diff (on current 3.2, not a clone)

1. **The cell frame is a ceiling. Material may reduce it, never inflate it.** Canon, verbatim: the class standard is the starting hypothesis; “the material may reduce it (L drops to 1+2 by itself), never inflate it.” Admit a seating only when it fits **inside** the hypothesis (across ≤, down ≤). Not exact match (today’s lock). Not “every approved seating” (that would grow past the hypothesis). A square-ish mid-band box is 2×2: a vertical pair (1×2) is in; a 3-wide is out. That is “a T in a square box still takes the pair.” Also restore: the ruled **or**s (1×3 / 2×3, etc.) as one cell, not two box-keyed cells; and the missing **circle / oval** row. Still measure time before and after on the seven — the set is a handful under the ceiling, not the whole library.
2. Leftover is a score on the ruled 12–24 switch, not a silent veto at 12. The default under test is 24 — open, to be measured, not ruled here. The 40 mm limb allowance already exists and already stamps the answer `tight` / `allowed` / `limb`. **It is not reported.** Nothing on the screen you look at reads that stamp. Spec claims “never silent”; that sentence is false. The report after this item must not repeat it. Either the existing screen shows the stamp (one field, already-built surface — not a screen rebuild), or this stays an open gap like item 3.
3. **Not a strip — a missing Compute duty.** The briefs require a structural map: real masses vs thin connectors vs tips, and whether those masses persist when the piece is scaled. That map is not in the engine. Coverage and “one per distinct mass” cannot work without it. A re-point is not a fix.
4. Stop after 1 and 2 unless Dan authorises 3. Report the public door and the real screen. Do not restore the pre-rewrite judge.

## Item 3 — Dan chooses (not a silent pick)

- **(a) Build it.** Compute derives the free class from the fabric (tapered / waisted / standing / blob / winged / diagonal). What each class takes in each band is already written in the brief’s free-class table. The work is recognition, not inventing answers. Own task, own size.
- **(b) Leave it silent.** Coverage and “one per distinct mass” stay unable to decide until that map exists. The gap is written down, not pretended fixed.

## Acceptance gate

The exam table in the logic spec, every ruled row, through the real “outline in, size and layout out” door. A change that moves a blessed family is a defect. That gate has never been built. Without it, 1 and 2 are graded by the same internal tests that stayed green while the pictures disappeared. Build the gate as part of proving 1 and 2 — as exams, not as answers to hardcode.

## Necessity

- **Necessity — no unnecessary elements** on the leftover strip (item 2). Item 1 is the ruled ceiling plus the missing circle/oval row and the collapsed “or”s — not a full library unlock. Item 3 is a build.
- **Sufficiency — partial** until Dan picks (a) or (b) for the mass map, until the limb stamp is shown or named as an open gap, and until the exam table runs through the real door.
