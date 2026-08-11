# Grid Engine Contract — Measured Cutout Variants

Status: contract for one engine deliverable
Authority: Dan, 2026-08-11, scoped to the portable logic + engine algorithm
Success: every applicable checkpoint below is positively confirmed by calculation and applied visual evidence on the frozen build.

## The one deliverable

The engine receives one locked-aspect cutout outline and produces its precisely measured grid-variant families. For the operational bands 2 and 3, each family proves the same cutout against both the 48mm population and its 96mm sparse population. It states each population's magnet layout, magnet quantity and exact coordinates, plus the corresponding proportional manufactured shape size.

The engine does not choose a product winner in this iteration. It returns the measured families so their fit can be proved and compared.

## Contract checklist

- [ ] **EC-01 · Locked shape.** The input is one traced cutout outline in millimetres. Its geometry and aspect ratio never change. Uniform scale is the only permitted shape transform; there is no stretch, deformation or rotation.

- [ ] **EC-02 · Fixed grid inputs.** Every solve uses the guarded 48mm base lattice, 12mm support radius around each magnet centre, the 96mm population as a thinning of the same unmoved lattice, and the released 9×9 ceiling expressed as a grid count.

- [ ] **EC-03 · Operational bands.** The proof instrument assesses the cutout in the operational bands 2 and 3. Bands 1 and 4 are not offered: band 1 is below the pair floor, and band 4 was ruled non-operational for custom cut-outs. Band 4's 168mm span survives only as the twin-fix base span in EC-13. Every returned family contains measured answers for both 48mm and 96mm, and a successful earlier band never removes a later band from the proof instrument.

- [ ] **EC-04 · Population is measured, not assumed.** Inside each band the engine derives every distinct materially supported arrangement available to the locked shape. From every band-scoped window it returns every connected subset of supported lattice positions that contains at least two magnets and gives every selected magnet a horizontal or vertical neighbour one population pitch away. It must therefore return a centred vertical pair, centred horizontal pair, rectangles, runs, L arrangements and every other lawful connected partial independently; it may not return only the maximal surviving component. The pair is the floor. Each family reports whether it is the ruled four-magnet outermost-corner arrangement and labels that topology `four-corner`; the engine does not decide which applied family is optimal. This label never ranks, discards another arrangement or becomes a pass gate. Intermediate arrangements remain reported as intermediate. No score or ranking framework is introduced, and the engine must not assume that a band is always a complete 2×2 or 3×3 square. Connected-only membership is the current `DERIVED-AND-REPLACEABLE` boundary: separated pair components remain separate arrangements unless Dan later rules that their union is one product.

- [ ] **EC-05 · Pair floor in both populations.** Every passing family contains at least one non-pivoting vertical or horizontal pair at 48mm and at least one at 96mm. A result that supports a pair at only one population does not pass. A single magnet is never an offered result.

- [ ] **EC-06 · Exact complete-disc support.** Every selected magnet centre lies on the one lattice and its complete 24mm support disc lies inside cutout material. Centre-point containment alone fails. Support is the closed exact predicate: the centre is inside or on the outline and no outline edge enters the open radius-12mm disc. Boundary tangency is lawful. The decision is evaluated only at the finite grid-derived candidate scales; no sampled mask, tolerance, pair-box containment, continuous event solve or interval scan may replace it. Pair and grid boxes are extent/flap evidence only. Unsupported lattice positions are absent from that arrangement.

- [ ] **EC-07 · Precise manufactured answer.** Every family returns: band; centre method; parity-derived per-axis registration; exact reduced candidate scale; manufactured width and height; and, separately for 48mm and 96mm, magnet quantity, complete magnet coordinate list, minimum disc clearance and the binding magnet/outline location that limits the fit. An even run registers in the gap and an odd run on a magnet; the sparse population is a thinning of that same placement and both populations of one family share the same x/y registration. A family couples only at one identical physical scale, never by ladder index or rounded size. The longest side publishes as the smallest whole even millimetre not below its exact value; the other dimension follows the locked aspect and is never independently rounded. Publication labels an already-lawful grid candidate and never creates or searches for another scale. Each population also returns its four overhangs, spread, extremities and disc/edge contacts.

- [ ] **EC-08 · Centring and balance evidence.** Every family follows EC-07's parity-derived registration and reports its relationship to each tested shape centre, both populations' four overhangs and spreads, and the limiting disc/edge contacts. The applied proof shows whether flap is evened out across the sides at the same time and the discs are enveloped towards the edge — evenness is the agreement of EC-09's four overhangs, so a square reading 0/0/0/0 and a circle reading 10/10/10/10 are both perfectly even. These are comparison evidence for the real-cutout corpus, never an equality, argmin or pass gate: a variant does not fail because another has a smaller spread. The engine invents no displacement threshold, tolerance, combined score or hidden default. Contested centre constructions remain visible test options.

- [ ] **EC-09 · Flap-limit test.** Flap is the shape's **overhang beyond the grid bounding box**, per side. The grid bounding box is the arrangement's magnet extent grown by the padding on every side — `[min qx − P, max qx + P] × [min qy − P, max qy + P]`. **Nothing inside that box is flap.** For each of the four sides the engine measures how far the outline reaches past the box edge, clamped at zero, and reports every material extremity with its side and overhang. **The 48mm and 96mm arrangements of one family have different extents and therefore different boxes and different overhangs, so this evidence lives inside each population; the family passes a switch only when both populations do.** Pair boxes may describe the arrangement's extent or topology, but neither a pair box nor their union is required to lie inside material; EC-06 alone decides support. The flap limit is an explicit test switch with exactly two positions: 12mm and 24mm. Coverage passes for the selected switch only when all four overhangs are within it. An overhang beyond the selected limit fails that test unless EC-10 applies. No intermediate threshold or hidden default is permitted.

  *Ruled by Dan, 2026-08-11, after both the blueprint and Lead QA measured it as distance to the nearest magnet disc: "the flap is calculated from the edge of the grid bounding box to the outer edges of the shape cutout - the 4x48mm grid points have 72mm square boiunding box inside of it no flap must be recognised - the pair has 72x24 bounding box so on and so forth". Reproduces exactly: two points 48mm apart plus 12mm each side is 72mm; a pair is 72 × 24. Measured consequence — a square has flap 0 at every band because it IS the box; a circle gives 10 / 20 / 30mm at bands 2/3/4. The distance-to-nearest-disc reading made a plain square fail at 12mm, which is the sanity check it failed.*

- [ ] **EC-10 · Trivial-limb exception is explicit.** A reach beyond the tested flap limit may be presented only as an exception candidate for a trivial narrow limb, especially a bottom limb. The engine measures and reports the region, side and reach; it does not invent a numeric definition of `trivial`, silently approve the exception or hide it inside a score. Applied visual proof exposes every exception for confirmation.

- [ ] **EC-11 · Applied proof.** Every distinct arrangement can be applied to the real cutout using the exact returned scale, registration and coordinates. The canvas draws the fixed-aspect outline, complete 24mm discs, per-population grid boxes, every side's overhang and the limiting disc/edge contacts. Independently measured SVG geometry must reproduce the engine's support, centring, balance, flap and tightness evidence. A table saying `fits` is not proof.

- [ ] **EC-11b · Raw families for manual review.** The canonical answer contains every lawful family in canonical order, and the admin surface steps through that order without omission. This engine builds no selector, auto-picker, winner or thinned user ladder. Optimal choices are made manually from the complete applied evidence. Any later auto-picker or offering ladder is a separate product step and may only index these immutable families; it may never rewrite engine truth.

- [ ] **EC-12 · Responsive and complete delivery.** Solver work is never coupled to pinch, resize, pan, drag, camera movement or variant browsing. The frozen delivery includes: the portable engine answer; tests against an independent oracle; synthetic pair, concave, hollow, narrow and non-monotonic cases; all seven saved real cutouts; applied visual evidence for the operational bands 2 and 3 at 48mm and 96mm; and a final statement of which algorithm parts are proven, require correction or must be rejected.

- [ ] **EC-13 · Twin-fix classification and its size limit.** For each population independently, an arrangement of exactly two retained magnets is `twin-fix`; three or more is `multi-fix`. At published longest side `m`, a twin fix is size-eligible exactly when `m < bandSpan(4) + max(flapLimitsMM)` — 192mm under the released spec — derived from guarded values at solve time and never stored as an engine literal. No aspect-ratio, elongation or shape-name condition may qualify or disqualify a twin fix. The limit does not bound `multi-fix`, which remains bounded by the count-derived field. The built-in-garment-grid regime is outside this engine: it takes no garment input and may not infer one. **A twin fix at or above the limit is REPORTED as `twin-fix` with `sizeEligible: false` and its measured longest side — never silently dropped** — because on the real corpus 23 to 28 twin-fix candidates per shape exceed it, and an answer that omits them cannot be audited against the ones it kept.

## Required answer shape

Each `MeasuredCutoutVariantFamily` contains:

```text
band
centreMethod
registration: derived from run parity
scale
widthMM
heightMM
candidateScale: { numerator, denominator }
publication: { longestSideEvenMM }
populations: {
  48: {
    magnets[]: { xMM, yMM, clearanceMM, bindingContact },
    gridBoxMM,
    overhangMM: { left, right, top, bottom },
    overhangSpreadMM,
    extremities[],
    unsupportedZones[]
  },
  96: {
    magnets[]: { xMM, yMM, clearanceMM, bindingContact },
    gridBoxMM,
    overhangMM: { left, right, top, bottom },
    overhangSpreadMM,
    extremities[],
    unsupportedZones[]
  }
}
tightnessContacts[]: { magnet, outlineLocation, clearanceMM }
flapOutcomes[]: { limitMM: 12 | 24, passed }
classification: floor | intermediate | four-corner
status: lawful | exception-pending
```

## Exclusions

- No automatic product winner, ranking framework, optimum assignment or default centre method.
- No rotation.
- No mask or straight/dice/diamond pattern work.
- No manufacturing export.
- No production Cutout Lab integration.
- No UI redesign beyond applying and inspecting the measured variants.
- No global workflow, review-procedure or historical incident rules inside this engine contract.

## Closing confirmation

Builder, QA and Meta each return one compact matrix with `EC-01` through `EC-13`, `PASS` or exact failure, frozen snapshot and reproducible evidence. The algorithm is a keeper only if the real applied cutouts positively confirm precise support, centring and acceptable flap control across the required bands and populations.
