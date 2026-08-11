# Grid Engine Contract — Measured Cutout Variants

Status: contract for one engine deliverable
Authority: Dan, 2026-08-11, scoped to the portable logic + engine algorithm
Success: every applicable checkpoint below is positively confirmed by calculation and applied visual evidence on the frozen build.

## The one deliverable

The engine receives one locked-aspect cutout outline and produces its precisely measured grid-variant families. For bands 2, 3 and 4, each family proves the same cutout against both the 48mm population and its 96mm sparse population. It states each population's magnet layout, magnet quantity and exact coordinates, plus the corresponding proportional manufactured shape size.

The engine does not choose a product winner in this iteration. It returns the measured families so their fit can be proved and compared.

## Contract checklist

- [ ] **EC-01 · Locked shape.** The input is one traced cutout outline in millimetres. Its geometry and aspect ratio never change. Uniform scale is the only permitted shape transform; there is no stretch, deformation or rotation.

- [ ] **EC-02 · Fixed grid inputs.** Every solve uses the guarded 48mm base lattice, 12mm support radius around each magnet centre, the 96mm population as a thinning of the same unmoved lattice, and the released 9×9 ceiling expressed as a grid count.

- [ ] **EC-03 · All required ranges.** The proof instrument assesses the cutout independently in bands 2, 3 and 4. Every returned family contains measured answers for both 48mm and 96mm. A successful earlier band does not remove later bands from the proof instrument.

- [ ] **EC-04 · Population is measured, not assumed.** Inside each band the engine derives every distinct materially supported arrangement available to the locked shape. It must include a centred vertical pair, centred horizontal pair, rectangular arrangements and material-derived partial arrangements whenever lawful. The pair is the floor; each family reports whether four magnets at the outermost corners, fitted to the edge, are lawful and marks that named arrangement as `optimum` when they are. This label never ranks toward it, discards another arrangement or becomes a pass gate. Intermediate arrangements remain reported as intermediate. No score or ranking framework is introduced, and the engine must not assume that a band is always a complete 2×2, 3×3 or 4×4 square.

- [ ] **EC-05 · Pair floor in both populations.** Every passing family contains at least one non-pivoting vertical or horizontal pair at 48mm and at least one at 96mm. A result that supports a pair at only one population does not pass. A single magnet is never an offered result.

- [ ] **EC-06 · Complete material support, and the grid region inside the material.** The shape must **encapsulate the layout's grid region** — the union of the boxes of its adjacent magnet pairs, each box being the pair's extent grown by the padding. Containment is closed: the region's boundary may touch the outline. This is strictly stronger than per-magnet containment and is the engine's central computation — *Dan, 2026-08-11: "so the engine computing is essentially whether the bounding box fits inside the shape in set variants of layouts based on the grid".* Measured: it preserves the square canon exactly (72 / 120 / 168) and raises the circle by 10mm at every band (92→102, 160→170, 228→238) because a box corner must sit on fabric.

- [ ] **EC-06a · Complete material support.** Every selected magnet centre lies on the one lattice and its complete 24mm support disc lies inside cutout material. Centre-point containment alone fails. Unsupported lattice positions are not included in that material-derived family.

- [ ] **EC-07 · Precise manufactured answer.** Every family returns: band; centre method; parity-derived registration; uniform scale; manufactured width and height; and, separately for 48mm and 96mm, magnet quantity, complete magnet coordinate list, minimum disc clearance and the binding magnet/outline location that limits the fit. An even run registers in the gap and an odd run on a magnet; registration is never selected independently. Manufactured size publishes in whole even millimetres, upward and never downward: it is the first even value inside a lawful scale interval, never a blind ceiling outside one. The family also returns every side's unsupported reach, their exact spread and the disc/edge contacts that determine tightness.

- [ ] **EC-08 · Centring and balance evidence.** Every family follows EC-07's parity-derived registration and reports its relationship to each tested shape centre, every side reach, the side-reach spread and the limiting disc/edge contacts. The applied proof shows whether flap is evened out across the sides at the same time and the discs are enveloped towards the edge — evenness is the agreement of EC-09's four overhangs, so a square reading 0/0/0/0 and a circle reading 10/10/10/10 are both perfectly even. These are comparison evidence for the real-cutout corpus, never an equality, argmin or pass gate: a variant does not fail because another has a smaller spread. The engine invents no displacement threshold, tolerance, combined score or hidden default. Contested centre constructions remain visible test options.

- [ ] **EC-09 · Flap-limit test.** Flap is the shape's **overhang beyond the grid bounding box**, per side. The grid bounding box is the arrangement's magnet extent grown by the padding on every side — `[min qx − P, max qx + P] × [min qy − P, max qy + P]`. **Nothing inside that box is flap.** For each of the four sides the engine measures how far the outline reaches past the box edge, clamped at zero, and reports every material extremity with its side and overhang. **The 48mm and 96mm arrangements of one family have different extents and therefore different boxes and different overhangs, so this evidence lives inside each population; the family passes a switch only when both populations do.** For a layout that is not a full rectangle the region is the union of the boxes of its adjacent pairs — an L layout gives an L-shaped region, not the axis-aligned box of all its magnets. The flap limit is an explicit test switch with exactly two positions: 12mm and 24mm. Coverage passes for the selected switch only when all four overhangs are within it. An overhang beyond the selected limit fails that test unless EC-10 applies. No intermediate threshold or hidden default is permitted.

  *Ruled by Dan, 2026-08-11, after both the blueprint and Lead QA measured it as distance to the nearest magnet disc: "the flap is calculated from the edge of the grid bounding box to the outer edges of the shape cutout - the 4x48mm grid points have 72mm square boiunding box inside of it no flap must be recognised - the pair has 72x24 bounding box so on and so forth". Reproduces exactly: two points 48mm apart plus 12mm each side is 72mm; a pair is 72 × 24. Measured consequence — a square has flap 0 at every band because it IS the box; a circle gives 10 / 20 / 28mm at bands 2/3/4. The distance-to-nearest-disc reading made a plain square fail at 12mm, which is the sanity check it failed.*

- [ ] **EC-10 · Trivial-limb exception is explicit.** A reach beyond the tested flap limit may be presented only as an exception candidate for a trivial narrow limb, especially a bottom limb. The engine measures and reports the region, side and reach; it does not invent a numeric definition of `trivial`, silently approve the exception or hide it inside a score. Applied visual proof exposes every exception for confirmation.

- [ ] **EC-11 · Applied proof.** Every distinct arrangement can be applied to the real cutout using the exact returned scale, registration and coordinates. The canvas draws the complete 24mm discs, every side's unsupported reach and the limiting disc/edge contacts. Independently measured SVG geometry must reproduce the engine's centring, balance, coverage and tightness evidence. A table saying `fits` is not proof.

- [ ] **EC-12 · Responsive and complete delivery.** Solver work is never coupled to pinch, resize, pan, drag, camera movement or variant browsing. The frozen delivery includes: the portable engine answer; tests against an independent oracle; synthetic pair, concave, hollow, narrow and non-monotonic cases; all seven saved real cutouts; applied visual evidence for bands 2/3/4 at 48mm and 96mm; and a final statement of which algorithm parts are proven, require correction or must be rejected.

## Required answer shape

Each `MeasuredCutoutVariantFamily` contains:

```text
band
centreMethod
registration: derived from run parity
scale
widthMM
heightMM
publication: { lawfulScaleInterval, publishedEvenMM }
populations: {
  48: { magnets[]: { xMM, yMM, clearanceMM }, bindingContact },
  96: { magnets[]: { xMM, yMM, clearanceMM }, bindingContact }
}
sideReachMM: { left, right, top, bottom }
sideReachSpreadMM
tightnessContacts[]: { magnet, outlineLocation, clearanceMM }
unsupportedZones[]: { side, reachMM, classification }
flapLimitMM: 12 | 24
classification: floor | intermediate | optimum
status: lawful | failed | exception-pending
```

## Exclusions

- No automatic product winner, ranking framework or default centre method beyond EC-04's ruled optimum classification.
- No rotation.
- No mask or straight/dice/diamond pattern work.
- No manufacturing export.
- No production Cutout Lab integration.
- No UI redesign beyond applying and inspecting the measured variants.
- No global workflow, review-procedure or historical incident rules inside this engine contract.

## Closing confirmation

Builder, QA and Meta each return one compact matrix with `EC-01` through `EC-12`, `PASS` or exact failure, frozen snapshot and reproducible evidence. The algorithm is a keeper only if the real applied cutouts positively confirm precise support, centring and acceptable flap control across the required bands and populations.
