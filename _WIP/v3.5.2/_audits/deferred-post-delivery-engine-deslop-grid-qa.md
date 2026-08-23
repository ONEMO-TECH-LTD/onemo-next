# Deferred post-delivery engine deslop — Grid-QA

Author: `s62-grid-qa`  
Recorded: 2026-08-23  
Source audited: clean product commit `2c043257a57bcc4184f90081f6b0f3c3e4706eb0`

## Status and gate

This is a deferred cleanup input, not current build authority.

Do not simplify Centre or Wrap while the three-law engine is being completed. Re-open this audit only after Centre, Wrap and scaling are integrated, tested and accepted. Re-prove reachability and behaviour on the final engine before deleting anything; the observations below describe `2c043257`, not a future head.

## Finding

The clean engine contains substantial overbuilding in Wrap and smaller, bounded overbuilding in Centre.

### Wrap

The product law needs:

1. legal seating for every belt disc;
2. nearest supplied-boundary distance for every belt disc;
3. fixed whole-mm flap comparison;
4. the smallest whole-mm Auto allowance within the cap;
5. truthful binding contact evidence.

The current implementation additionally publishes and maintains:

- arbitrary-precision rational versions of every coordinate;
- algebraic square-root values;
- quadratic polynomials, root indices and 128-bit isolating intervals;
- a specialised algebraic comparator;
- a handwritten SHA-256 implementation;
- hashed contour and witness certificates;
- certificate records for every belt anchor and every co-nearest segment.

The useful exact kernel is smaller: squared point-to-segment distance at a boundary decision. With whole-mm allowances, fixed Wrap can compare `nearestDistanceSquared` with `(spotRadius + allowance)^2`. Auto can test integer allowances `0..cap` and retain the first passing value. Flap 0 remains exact because seating proves distance is at least the radius while Wrap proves it is at most the radius.

Post-delivery simplification candidate: retain the exact squared comparison and minimal binding witness; remove algebraic allowance publication, root isolation, polynomial certificates and cryptographic witness identity unless a final live consumer proves each necessary.

Source surfaces:

- `src/lib/magnetic-grid/compute/exact-real.ts`
- `src/lib/magnetic-grid/compute/contact-root.ts`
- `src/lib/magnetic-grid/compute/identity.ts`
- exact-value and witness records in `src/lib/magnetic-grid/spec.ts`

### Centre

The Centre policy core is appropriately small: compute the selected centre, generate four lattice placements, seat magnets and choose using the preserved policy order.

The existing 2 mm `safeSegments` measurement is a pragmatic donor for Core, Deep, Top and Masses. Do not replace it with exact inward-offset topology. Retain it while those product modes remain required.

Cleanup candidates after delivery:

- replace the parallel 0.001 mm integer-quantised seating engine with one shared seat predicate using a fast numeric prescreen and exact squared-distance fallback only at the decision boundary;
- determine whether marching-squares rings and Newton smoothing are still required by the final UI or only by optional diagnostic rendering;
- remove legacy/dead helpers after final reachability proof.

Observed dead or test/guard-only residue at `2c043257`:

- `parityHolds`;
- `TANGENT_GUARD_MM`;
- `maxPressMM`;
- `contactPointsMM`;
- `impliedFlapMM`.

`pressExcessMM` is live as a Centre placement tie-breaker and must not be deleted without an explicit final-policy disposition.

Source surfaces:

- `src/lib/magnetic-grid/compute/seat.ts`
- `src/lib/magnetic-grid/compute/centre-evidence.ts`
- `src/lib/magnetic-grid/logic.ts`
- `src/lib/magnetic-grid/engine.ts`

## Minimum future deslop target

- Preserve the accepted Centre modes and their outputs.
- Preserve genuine fixed-size seating and Wrap verdicts.
- Use one boundary-distance implementation for seat and Wrap.
- Keep exactness only at comparisons where float ambiguity changes a law verdict.
- Keep whole-mm flap inputs and outputs; do not publish sub-mm algebraic allowance objects.
- Remove dead legacy Wrap helpers and unused policy code.
- Preserve scaling behaviour and public results byte-for-byte where representation is not intentionally simplified.

## Required future proof

Before accepting the cleanup:

- compare all Centre policies before and after on the final fixture matrix;
- compare fixed and Auto Wrap verdicts, including genuine flap-0 contact, positive near-gap, holes and co-binding segments;
- compare B1-B4 ladders, count ownership and ties;
- verify the real worker and v3.5.2 tab;
- prove every deletion has no live product consumer.

Necessity: defer all cleanup until the engine is complete; later retain only machinery that changes a final product verdict or required evidence.

Sufficiency: this note identifies the known cleanup targets and the proof required to simplify without weakening Centre, Wrap or scaling.
