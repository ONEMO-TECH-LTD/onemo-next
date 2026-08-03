# KAI-10105 — remove the hold/won't-hold guard · strike law 5.3

Builder ledger. Appended as each fact is established, not written at the end.

## The directive

Dan, 2026-08-03, on `HOLD_REACH_MM = 48`:

> "the 48mm around itself is invented law by agents - do my briefs have this? or laws?"

His briefs answer it twice, both rejections:

> "i do not care about hold or wont hold guard - **i never asked for it** as well as i never asked to
> move sizes to admin panel 2xl and 3xl range - i still dont understand where it is was drawn from."
> — briefs.md:1249

> "what is this redd system - wont hold relkiably - **false** - 6 magnets oin the 83mm is the solid"
> — briefs.md:197

The second quote is the one law 5.3 cites as its own provenance. Dan saying the warning is false was
written into the book as proof the warning should exist. He then said "yes" to striking it.

Law **8.2** already carries the first quote and rules: *"holds / won't hold is not a product state …
It is a signal to Dan at calibration time."* 5.3 and 8.2 have contradicted each other in the same book.

## What the guard is, exactly

One constant feeds one measurement that does three different jobs. Only two of them are the guard.

| Job | Sites | Verdict |
|---|---|---|
| **Gates publication** — a size with any uncovered outline is refused | `grid-core` 1128, 1167, 1353, 1560, 1634 | **DELETE** — this is the guard |
| **Warns the customer** — "could lift" issue + red outline + legend | `grid-core` 836 · `GridWorkbenchRenderer` 92, 130, 171 | **DELETE** — this is the red system Dan called false |
| **Ranks placement** — prefers the phase whose magnets sit nearest the outline; picks a fallback when nothing seats | `grid-core` 774/800, 1572-1584, 1636-1645 | **DELETE** — see below; my first reading of this row was wrong |

**This table's third row is corrected, and it was the most important thing I got wrong.** I planned to
KEEP the ranking as a diagnostic, on the argument that a preference never deletes a size. Grid QA showed
the value sat **ahead of population in the phase key**, so it was still choosing the delivered
construction — a chooser, not a diagnostic. All three jobs are therefore deleted, and `flaps` /
`uncoveredMM` leave the result entirely rather than staying as fields. Coverage survives only as
`exactPerimeterCoverage`, a pure function whose radius the caller supplies, which is what 8.2 preserves
for calibration.

## Before-census — every published ladder at head `1a80eede`

Read through the production entry `semanticLadderFromRecipe`, `visible` rungs only, `size/magnets`:

```
square  standard 48   68/4 116/9 164/16 212/25 260/36 308/49
square  standard 96   116/4 212/9 308/16
square  light    48   68/4 116/8 164/12 212/16 260/20 308/24
square  light    96   116/4 212/8 308/12
circle  standard 48   68/2 116/5 164/8 308/29
circle  standard 96   156/4
circle  light    48   68/2 116/4 172/8 236/8
circle  light    96   156/4
triangle standard 48  92/2 146/5
triangle standard 96  (none)
triangle light   48   92/2
triangle light   96   (none)          ← Dan's drawn three-corner panel, produced then refused
diamond standard 48   78/2 126/5 174/8
diamond standard 96   (none)
diamond light    48   78/2 126/4 174/6 222/8 270/10
diamond light    96   (none)
```

The measured cost of the guard, recorded before the cut: the 220mm equilateral at 96mm Light **produces
Dan's three corner magnets and then refuses the size**, 346mm of its 660mm perimeter judged unheld,
gap points 63–87mm from the nearest magnet against a 48mm reach.

## What Grid QA changed about this cut

Four blockers, all taken. Recorded because each one made the change smaller or more lawful, and the
first two refute what I had written above.

1. **The "keep" was still a chooser.** I intended to keep `uncoveredMM` as a ranking signal. QA showed
   it sat *ahead of population* in the phase key, so the invented 48mm value still selected the
   delivered construction — a guard, not a diagnostic. Removed from every selection path. The constant
   is deleted outright rather than renamed: a renamed 48 is the invented law kept cosmetically.
2. **My replacement was itself an invented law.** With coverage gone I let magnet count decide the two
   fallbacks. Law **3.24** is explicit — *"There is NO maximality rule. Do not reintroduce one"*, Dan:
   *"we do not have as many as can fit law"*. I argued 5.11 authorised population as a phase tie-break;
   3.24 refutes that reading by name (*"an earlier reading turned 5.11 into 'cram in every magnet that
   fits' … Dan rejected that outright"*). Verified at source, and `-population.length` is gone from the
   phase key as well as from both fallbacks. **Nothing replaces the guard** — the search stops choosing.
3. **Retiring 5.3 alone was insufficient.** 5.12, 3.19, 3.24a, 7.11(b) and 8.10 each re-authorise a
   coverage verdict independently. Six clauses, not one.
4. **Board state.** 10105 was moved to Building and the other two returned to their queues.

## After-census — the same query, after the cut

```
                       BEFORE                          AFTER
square  standard 48    68/4 116/9 164/16 …             unchanged  ── byte-identical
square  standard 96    116/4 212/9 308/16              unchanged
square  light    48    68/4 116/8 164/12 …             unchanged
square  light    96    116/4 212/8 308/12              unchanged

circle  standard 48    68/2 116/5 164/8 308/29         + 212/13  260/22
circle  standard 96    156/4                           116/2 212/5 308/8
circle  light    48    68/2 116/4 172/8 236/8          68/2 116/4 164/2 212/4 260/6 308/4
circle  light    96    156/4                           116/2 212/4 308/2

triangle standard 48   92/2 146/5                      84/2 132/4 180/6 228/10 276/14
triangle standard 96   (none)                          132/2 228/4
triangle light   48    92/2                            84/2 132/3 180/4 228/5 276/6
triangle light   96    (none)                          132/2 228/3      ← NOT his panel: base-only/3
diamond standard 48    78/2 126/5 174/8                + 222/13 270/18
diamond standard 96    (none)                          126/2 222/5
diamond light    48    78/2 126/4 174/6 222/8 270/10   unchanged
diamond light    96    (none)                          126/2 222/4
```

**The square is byte-identical across all four columns** — the shape Dan published numbers for did not
move. **All four `(none)` columns now publish.** Every other change is a size the guard had been
suppressing.

**CORRECTION.** An earlier draft of this section claimed "Dan's three-corner Light triangle is in the
catalogue at 228mm". That was written from the census alone and is **false** — the visual gate below
refuted it the same session. The 228mm rung exists, but its three magnets sit **along the base with the
apex bare**. The column publishing is not the same fact as his construction publishing, and this ledger
must not carry the stronger claim.

## Two things this cut did NOT fix, stated rather than buried

**1. The circle's Light ladder is now non-monotonic: 116/4 → 164/2 → 212/4 → 260/6 → 308/4.**
Not caused by the guard's removal — *exposed* by it. Measured directly on the rim:

```
circle 164mm  seats 8 rim anchors, depths [14.1 ×4, 34.0 ×4]  → the shell filter keeps 4
circle 308mm  seats 16 rim anchors, depths [10.0 ×4, 18.2 ×4, 46.6 ×8] → the shell filter keeps 4
```

`standardShapePerimeterAnchors` keeps only anchors within 1mm of the shallowest, which on a circle
throws away most of the rim. Coverage used to refuse those sizes, so the scan climbed to one where the
shell happened to be richer and nobody saw the defect. It is the open 8.8 item already recorded in the
source, and **KAI-10078 structurally removes it** — once the size is computed *from* the population, a
2-magnet rim is published at its own wrap size instead of masquerading as the 164mm rung.

**2. The standing audit reads 11, up from 9 — in a metric that is itself wrong.** Measured, not
recalled: the baseline was taken by stashing this diff and re-running on `f32ada2e`. All are
`min-link` — a layout delivered under the straight pattern whose closest delivered pair is 68mm.
Removing the count objective (blocker 2) changed which phases win, so six appeared and four vanished.

**Grid QA's correction, which I accept: the delivered nearest link is not pattern identity.** Light is
a mask over a lawful straight lattice, and deleting interior nodes can leave the closest *surviving*
pair on a diagonal while every point still projects exactly onto the straight basis. **Dan's own
accepted square Light 68/4 is the smallest witness** — four corners of a 48×48 lattice cell, 68mm apart
diagonally, and unquestionably lawful. So this audit check flags lawful masked populations, and the
9→11 movement is drift in a broken instrument rather than two new defects. Repairing that check against
lattice projection (**9.5**) is **KAI-9828**'s subject, and it is why this number is reported here
rather than chased.

I tested the obvious "fix" and rejected it. Computing conformance on the **delivered** population
instead of the pre-mask one takes the audit to **0 violations, all laws pass** — one expression. It is
false green twice over: it silences the broken check rather than repairing it, and it distorts the
product:

```
diamond light 48   78/2 126/4 174/6 222/8 270/10   →   78/2 188/3 190/6 284/5 286/10
diamond light 96   126/2 222/4                     →   126/2            ← loses a rung
circle  light 96   116/2 212/4 308/2               →   116/2 236/4 308/2
```

Evenly-spaced rungs become 188-and-190, 284-and-286, and a size disappears — lawful masked populations
emptied to buy a green number. The measurement goes to **KAI-9828** (repair the check against lattice
projection) and **KAI-10076** (conformance on the delivered set, if it survives that repair), rather
than riding in on a ticket about deleting a guard.

## The placement invariant — measured, not asserted

Grid QA caught a contradiction in my own acceptance wording: I had written "padding behaviour is
byte-identical: no magnet moves", while also removing coverage from the phase key — which selects
where magnets go. Both could not be true by assertion. So it was measured, across the full
shape × mask × spacing matrix, comparing every published construction's anchor coordinates:

```
rungs present BEFORE and AFTER      32
  … with byte-identical anchors     32        ← zero anchor moves
rungs ADDED by the cut              32
rungs REMOVED by the cut             7

minimum anchor clearance   before 9.9946mm    after 9.9506mm
                           (released padding 10mm, less the representation epsilon)
```

**The claim survives, in its precise form: not one magnet moved.** Every size that exists in both
catalogues seats exactly the same anchors at exactly the same coordinates. Padding, spacing and mask
mechanics are untouched. What the cut changes is **which sizes exist** — which is the whole point.

### The 7 rungs the cut removed — and the one that matters

```
circle   light    48    172mm/8    236mm/8
circle   light    96    156mm/4
circle   standard 96    156mm/4
triangle light    48     92mm/2
triangle standard 48     92mm/2   146mm/5      ← DAN'S DRAWN STANDARD PANEL
```

**`triangle standard 48 → 146mm/5` is Dan's own worked example** — the 1-1-3 apex·centre·three-along-
the-base panel that **3.24a** records as binding acceptance and as "reproduces today". After the cut
that column reads `84/2 · 132/4 · 180/6 · 228/10 · 276/14`: **no five-magnet rung at all.**

This is not the guard being missed. It is the **size scan** underneath, now unmasked. The scan accepts
the *first* millimetre size that matches a lattice extent; coverage used to reject the smaller
candidate and push it on to 146mm, where the 1-1-3 population seats. With coverage gone, 132mm/4 takes
the slot and the 1-1-3 never gets one. The same mechanism removed the circle's 8-magnet Light rungs.

**KAI-10078 restores it structurally, and this is now its sharpest justification.** Under the wrap law
the size is computed *from* the population — the 1-1-3 construction wraps at its own size and cannot be
displaced by a different population that happens to share a scalar extent. Dan's panel comes back as
arithmetic rather than as a side effect of a guard.

**Stated plainly: shipping this ticket alone leaves a binding 3.24a acceptance unmet.** It is disclosed,
not deferred quietly, and 10078 is the next ticket in the sprint.

## Visual gate — and the acceptance criterion it FAILS

**Provenance:** `lsof -nP -iTCP:3990` → pid 49638 → cwd
`onemo-next/.claude/worktrees/s59-grid-lab-main`. Next dev server on the live working tree, i.e. `f32ada2e`
plus this uncommitted diff. Profiled Chrome, the real page.

**Observed and passing:**
* The legend no longer carries **"flap risk"**, and no red outline is drawn on any shape. The red system
  Dan called false is gone from the surface he looks at.
* Square · Light · 48 → 68mm, 4 magnets, unchanged.
* **Triangle · Light · 96 now offers sizes at all** — S (132mm/2) and M (228mm/3). That column read
  "shape unavailable" before this cut. The suppression is visibly gone.

**FAILING — the construction is not Dan's.** At 228mm the three magnets sit **along the base**: 8mm at
each base corner and a 6mm mid-base. **The apex is empty.** Dan drew apex · base-left · base-right.

```
228mm Light 96  →  seated 3, all on the base row, apex unmagnetised
```

So `triangle light 96` publishes, but **the acceptance line "Dan's Light triangle publishes its
three-corner construction" is NOT met.** Reported as failed rather than counted as passed because the
column is no longer empty.

**Why, measured:** with the guard gone there is no rule left that *selects* the corner population.
Coverage used to prefer it, and the count objective used to prefer the phase seating three over one
seating two — and 3.24 required both to be removed ("There is NO maximality rule"). 3.24 names what
should decide instead: "**3.24a's worked examples and the mode mask**". Those worked examples exist in
the law book as *acceptance tests*, and nothing in the engine consumes them as a *selection rule*. That
gap is real and it is **KAI-10078**'s: once the size is computed from the population, the apex-and-base
construction wraps at its own size and is published on its own terms instead of competing for a slot.

Unconstrained, the engine now returns a vertical pair on this shape at every size from 214–228mm — so
the corner population is not merely losing a ranking, it is not being enumerated.

## Gates

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| Catalogue regenerated | 8 catalogues, cache version 18 |
| Standing audit | 11 (baseline 9, measured by stash) — in a check QA showed is the wrong instrument |
| Anchor-move probe | 32/32 surviving rungs byte-identical; min clearance 9.9946 → 9.9506mm |
| Vitest | grid suites paused by Dan's order (KAI-10090) |
| Visual | bench observed on 3990 — red system gone, triangle Light publishes, **construction wrong** |

## The occupancy rule — three candidates, three falsifications

The audit history the law book must not carry (Authority §2 — whether code obeys the book is an audit and
belongs elsewhere). Recorded here so nobody re-derives a dead rule.

The gap itself is registered as **O3** in the law book's open list: *how an X/Y population step determines
ragged occupancy and registration, before any physical size exists.*

| # | Candidate | Falsified by |
|---|---|---|
| 1 | **Shallowest-depth shell** — keep only anchors within 1mm of the shallowest, as the perimeter | Grid QA over 80 freeform contours × Light × pitch {auto,48,96}: **35/240 differed**, lawful rungs silently deleted (a valid 162mm/4-anchor rung dropped). Reverted; it survives in-source as the open 8.8 item |
| 2 | **Fixed point** — *s* is a rung iff `wrap(induced(s)) == s` | Runs **size → population → size**, reversing 3.24's direction. Still needs a size search to locate fixed points, which may be zero or many, and leaves the phase/population chooser untouched. The reverse program under a mathematical name |
| 3 | **Row-count drives scale** — the family's normalised height profile fixes the scale from `ny`, columns follow from the profile width at each row | **Breaks orientation symmetry**: the same contour rotated 90° yields a different population. Also still size-induced on X, and gives no component-admission or tie-break policy for a concave row with disjoint interior intervals |

A claimed side-benefit of the guard removal — "the wrap is now bisectable, because the disjoint islands came
from the coverage predicate" — is **also false** and withdrawn. Signed clearance under uniform scaling is
non-monotone on a concave or crescent outline, independently of coverage. That is why O3's closure bar
requires an unseen asymmetric concave contour rather than the four convex worked families.

**Two further regression witnesses** for whatever finally implements O3, both found by Grid QA force-running
the paused suites, and neither a scan pin nor a coverage fossil:

* exact 68mm rounded-square at 10mm tangency resolves **1 anchor instead of the lawful four corners**
* the circle's two-anchor tier exists in the ladder, but resolving a plan at that rung returns **1 anchor**

Both are the same root as the triangle: with coverage and the count objective removed, nothing decides
occupancy.

## Verdict I am handing to QA

Stated precisely, because these are two different claims and the first does not imply the second:

**The REMOVAL DIRECTIVE is implemented.** The guard is gone from every acceptance, selection and ranking
path, nothing replaced it, and no magnet moved — measured, not asserted.

**The TICKET DELIVERABLE is not.** Dan's three-corner Light triangle does not publish, his 1-1-3 Standard
triangle rung was lost, and the circle's 8-magnet Light rungs were lost. None of these is a reason to keep
an invented guard, and none of them is fixed by this ticket.

**They are NOT simply "KAI-10078".** That was an overclaim in an earlier draft. 10078 replaces the size
scan with population-first sizing — necessary, and **not sufficient**: it cannot select Dan's ragged
construction until the occupancy and registration rule exists, which is registered as **O3** in the law
book and waits on his ruling. Sequencing 10078 before O3 is answered would rebuild the same gap.

