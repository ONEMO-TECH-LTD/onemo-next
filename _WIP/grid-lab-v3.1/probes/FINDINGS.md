# Anchor-switch probe — 2026-08-13, s62-kai-lead

Question: does the exact engine find Dan's canon placements, or does it need a
normalisation/inner-box method to position the shape?

Method: the delivered part-1 kernel, run over the seven real traces at the canon sizes,
with the shape anchored by each of the three constructions grid-laws O-1 already names as
switches to test — bounding-box centre, material centroid, maximum-clearance point.
No offset invention: L6 rules registration by parity, "nothing is chosen, the count decides".

Scripts here: `anchor-switch-probe.mjs` (held sites per anchor), `max-clearance-location.mjs`
(where the maximum-clearance point sits in each trace).

## Result — the anchor switch changes the answer materially

held sites, box centre / centroid / maximum clearance:

    DUCK      @60mm     0 /  0 /  1
    DUCK      @152mm    2 /  2 /  1
    BAT-WOMAN @144mm    3 /  2 /  2
    BUTTERFLY @130mm    1 /  1 /  1
    POKE1     @123mm    3 /  3 /  2
    BOT       @144mm    2 /  2 /  1
    BOT       @236mm   10 / 12 /  8
    PILL      @138mm    3 /  3 /  2
    BUTTERFLY @214mm    5 /  6 /  4

## The decisive case

DUCK @60mm returns nothing under box centre and nothing under centroid, and exactly one
held site under maximum-clearance anchoring — in the upper half of the trace, clearance
~12.6mm at that size. That is the band-1 canon answer (single disc, top half, tight wrap)
produced by the exact engine from canon-legal inputs, with no invented offset and no box
method in the path.

## Conclusions

1. For FINDING placements the exact engine is sufficient, provided all three lawful anchor
   constructions are exercised. No normalisation, no inner-box solver, no sub-pitch offset
   enumeration.
2. Layer 3 compares and ranks candidates ACROSS the anchor-switch outputs.
3. Region descriptors for ranking must be discrete — held sites, component membership,
   clearance. A bounding box of held sites is not a proof of continuous legal space
   (counterexample: lobes joined by bridges outside their own bounding rectangle), so any
   rounded box is rendering only.
4. Correction recorded against this lane: an earlier sweep of 12mm origin offsets was both
   unlawful under L6 and invalidated by a units bug in the anchor rationals. Superseded by
   the numbers above.
