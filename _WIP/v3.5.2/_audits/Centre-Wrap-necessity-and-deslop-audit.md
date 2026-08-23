# Centre and Wrap necessity/deslop audit

Source audited: product `2c043257`, `src/lib/magnetic-grid/**` runtime, 1,910 lines. This audit concerns the final engine state, not scaling alone.

## Product boundary

- Candidate shape sizes: even whole millimetres.
- Law measurements and flap: whole millimetres on the 1 mm ruler.
- Centre: preserve the accepted Centre-rules behaviour unless the completed three-law engine proves a named material defect.
- Wrap: every seated disc must be legal against the supplied outer ring and holes; belt discs additionally produce nearest-outline air/witnesses; fixed, Auto, manual and rung paths use one whole-mm verdict.

## Centre

### Keep

- `centre-evidence.ts safeSegments`: the 2 mm sampled safe-region measurement used by Core, Deep, Top and Masses.
- `centroidOf` and `measureCentreBranches`: direct Box/Weight/Core/Deep/Top/Masses measurements.
- `logic.ts governMass`, centre-mode meanings and four parity placements.
- `seat.ts` lattice generation, phase measurements, perimeter split, coverage measurements and contour scaling where live.

Deletion consequence: Core/Deep/Top/Masses or the accepted Centre comparison behaviour disappears.

### Keep only while visibly consumed

- Marching-squares rings, midpoint densification and Newton `snapToIso` in `centre-evidence.ts`: required only for the legal-area/mass visualization. They do not select Box/Weight and are not needed to return the sampled component centres/areas/depths.
- `seat.ts` edge bucket/BFS index: performance infrastructure for the repeated numeric Centre mesh queries. Keep only if the live cutout budget proves the direct segment scan too slow.

### Remove after characterization/equivalence

- `seat.ts TANGENT_GUARD_MM`: exported but has no production consumer.
- Old float Wrap helpers `maxPressMM`, `contactPointsMM`, `impliedFlapMM`: no live production consumer after fixed-size Wrap moved to `contact-root.ts`.
- Any comment describing these helpers as the governing Wrap law.
- The Law-only `circle`/`makeCircleSeatPredicate` branch: it judges an analytic circle while Wrap judges the supplied segments, violating the one-geometry rule. The frozen comparator may retain it; final Law may not.

### Final-state constraint

Do not rebuild Centre. Run the complete engine first. If no required rung/verdict changes materially in the named 2 mm residue/sliver cases, retain Centre byte-for-byte. If visualization rings are retained, keep them in Centre evidence only; they never become seat, Wrap or scaling law geometry.

## Wrap and seat legality

### Keep

- Structural outer+holes boundary traversal.
- Exact or deterministic point-to-segment squared distance and nearest projection.
- Complete seat legality for **every seated anchor**, including hole containment/clearance.
- Belt-only worst-air reduction.
- Nearest-outline witness points, including co-nearest boundary elements where the UI truth dots require them.
- Typed invalid-boundary, invalid-seat, fixed-flap and Auto-cap refusals.
- One shared measurement result for fixed, Auto, manual and band paths.

Deletion consequence: holes, illegal seats, belt truth, Auto minimum or truthful UI evidence breaks.

### Remove from the final public law surface

- `AlgebraicReal` allowance publication, quadratic allowance polynomial, root index and 128-bit isolating interval from `exact-real.ts`/`contact-root.ts`.
- Polynomial equation/root certificate fields in `ContactWitness`.
- Per-witness cryptographic `certificateId` and the handwritten SHA-256 implementation in `identity.ts`, unless a proven external/cache consumer requires collision-resistant witness identity. Stable contour/cache identity may use the existing application identity owner; witness identity may be a canonical structural key.
- Exact event-scale language and any scale root/refinement API. Candidate size is the already-ruled even integer.
- Any sub-millimetre value in Logic, rung ownership, cache selection or UI law copy.
- The filename `contact-root.ts` after roots are removed. Rename the same owner to `wrap.ts` or `wrap-measurement.ts`; retaining a root-named module with no root is stale architecture, not reuse.

These elements prove/report below-ruler irrational values. Removing them does not remove outer+holes geometry, squared-distance seat legality, nearest witness points, whole-mm air or typed refusals.

### Collapse duplicate legality paths

Current product has two partially overlapping systems:

1. `seat.ts makeSeatPredicate`: 0.001 mm quantized, outer-only admission used during Centre placement.
2. `contact-root.ts measureWrap` + `exactSeatIsLegal`: supplied-bit rational geometry over outer+holes, currently called only for belt anchors.

Final state:

1. The numeric outer-only predicate remains a cheap discovery/rejection prescreen for the frozen Centre path.
2. One final prepared-contour measurement validates **all seated anchors** against outer+holes.
3. The same measurement supplies belt air/witnesses.
4. The candidate is refused if any seated anchor is illegal.
5. Compute measures signed material clearance as `pointInMaterial(anchor) ? nearest distance - radius : -(nearest distance + radius)` and converts it once to the ruler with `floor(rawClearanceMM + 0.5)`; `[-0.5,0.5)` → 0, `[0.5,1.5)` → 1, `[-1.5,-0.5)` → -1.
6. Final Law seat requires non-negative ruled clearance; Wrap uses `max(0, ...beltClearanceMM)`; Logic compares only whole integers with fixed allowance/Auto cap.

The frozen Centre prescreen may retain its existing 0.001 mm numeric kernel to preserve Centre placement selection, but its answer is not the final Law seat verdict. Final all-seated legality and belt Wrap use the same signed whole-mm clearance. No raw sign, tolerance or sub-mm magnitude enters Logic or ranks candidates.

This prevents Free/manual/rung disagreement and prevents an interior anchor from overlapping a hole while Wrap checks only its belt.

## Scaling

Keep only:

- Four bands: 24–70, 72–118, 120–166, 168–214.
- Every even size evaluated.
- All four Centre placements evaluated before the Free-display collapse.
- Complete seat legality + whole-mm Wrap verdict.
- Earliest accepted even size per available strictly-greater count.
- Cross-band first-acceptance ownership, co-lawful ties and gravity after equality.
- Stored worker ladder and truthful tab result.

Remove/forbid:

- Bisection, refinement, contact/event roots, exact coordinate adapter, affine reconstruction, regime/topology/expression/RUR machinery, sub-millimetre discovery and recursive stability proof.

## Minimal final implementation sequence

1. Amend the master/T3/sub-plan so Centre, Wrap and scaling describe this same final state; regenerate packets.
2. Characterize the cleared Centre + Wrap baseline, including holes and fixed/manual/rung agreement.
3. Collapse seat/Wrap to one final all-seated legality + belt-air measurement and one ruler conversion; delete exact allowance/certificate machinery with its old tests.
4. Graduate `bandWalk` to every even size/all four placements and reduce in Logic.
5. Wire the stored ladder into the existing worker/tab.
6. Run the complete three-law live gate; only then consider the bounded Centre repair or visualization-only shrink.

## Necessity and sufficiency

Necessity — shrink the algebraic allowance/certificate layer, duplicate legality paths, dead float Wrap helpers and stale exact-event contract language. Preserve the Centre behaviour and only the geometry/visualization bodies with proven consumers.

Sufficiency — this final state covers Centre, complete seat legality, outer+holes Wrap, whole-mm fixed/Auto/manual/rung agreement, even-size next-count scaling, worker storage, truthful UI, typed refusals and conditional Centre repair.
