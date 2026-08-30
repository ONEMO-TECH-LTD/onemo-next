# Dan's ask — verbatim, and what is actually done

Written down because holding it in my head lost an item: I scoped a QA gate from my own
diff instead of from this, so the gate could not catch what I had left out.

RULE: the QA dispatch scope is THIS FILE, never the diff. Nothing is reported done while an
item is unticked. Partial is reported as partial, with the missing item named.

## The ordering (Dan, 2026-08-30)

> "i would make it toggles on off and test the results like a filter indeed but first we need to
> actually make the canon wired properly - in this case we need to decide if we add toggle as well
> measurting by outter box or inner - i prefer testing both / and we need to decide if we wire in
> the clipper 2 unprotected area defender that will enforce the filters above as step 2"

| # | item | state |
|---|---|---|
| 1 | canon wired properly — suggested layout is the search's STARTING POINT, no parallel path | DONE · QA-CLEAR at 2c7e4286, bounded |
| 2 | outer/inner classifier ruler toggle — "i prefer testing both" | BUILT + COMMITTED · headless gated · LIVE GATED: butterfly B3 legal=no optimal, outer=optimal 123.26/3 |
| 3 | Clipper2 unprotected-area defender + the four preferences, as toggles | BUILT · QA-rejected twice, nine defects repaired · **PARTIAL**: rule 2 is behaviourally REDUNDANT (wrap already holds the extremes); combined-toggle ordering UNRULED; no live gate since the repairs |

## Step 2's content, verbatim

> "one rule we need to implement as filter as well and enforcer is the unprotected area and also
> unprotected area holding preferences - means that in order of the general to more specific :
> 1. the perimeter side holds are prefered to centers
> 2. extreme apart sides must be held in preference to closest sides top and bottom of the
>    rectangle for instance in portrait and right left in landscape
> 3. corners are prefered to sides
> 4. top unprotected area is prefered to side - gravity law
> basically even distruibution with less unprotected areas further from the the protected area than
> 24-48mm is better to be protected and aligned to it especially top side cause the top will by
> gravity will unstick the effect with no magnets."

Answered by Dan: it is a FILTER, with on/off toggles, tested by result.

## Open — waiting on Dan, not on me

- may the canon come from a LOWER band than requested? duck/butterfly at B3 carry a clean 2x2,
  which is a B2 record; the lookup refuses to cross the band line, so those return nothing while
  max finds the 2x2 by itself
- **the four preferences: strict order or weighted?** STILL OPEN, and the code must not be read as
  having answered it. One toggle on is unambiguous. With several on, the code falls back to Dan's
  listed sequence as a tie-break chain because that is the least-invented reading — it is a
  fallback, not a ruling. QA F6 flagged that the checklist called this open while the code had
  quietly chosen; that contradiction is what this line now records.
- gravity needs an "up": is the shape's top as drawn always the top as worn?
