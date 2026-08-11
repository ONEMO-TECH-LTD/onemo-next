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

- [ ] **EC-04 · Population is measured, not assumed.** Inside each band the engine derives every distinct materially supported arrangement available to the locked shape. It must include a centred vertical pair, centred horizontal pair, rectangular arrangements and material-derived partial arrangements whenever lawful. It must not assume that a band is always a complete 2×2, 3×3 or 4×4 square.

- [ ] **EC-05 · Pair floor in both populations.** Every passing family contains at least one non-pivoting vertical or horizontal pair at 48mm and at least one at 96mm. A result that supports a pair at only one population does not pass. A single magnet is never an offered result.

- [ ] **EC-06 · Complete material support.** Every selected magnet centre lies on the one lattice and its complete 24mm support disc lies inside cutout material. Centre-point containment alone fails. Unsupported lattice positions are not included in that material-derived family.

- [ ] **EC-07 · Precise measured answer.** Every family returns: band; centre method; registration; uniform scale; manufactured width and height; and, separately for 48mm and 96mm, magnet quantity, complete magnet coordinate list, minimum disc clearance and the binding magnet/outline location that limits the fit. It also returns every side's unsupported reach, their exact spread and the disc/edge contacts that determine tightness.

- [ ] **EC-08 · Centring and balance yardstick.** A family is centred and balanced when unsupported reach is evened out across all sides simultaneously: `max(sideReach) - min(sideReach) = 0` under exact geometry. It is tight when the supported assembly reaches its limiting outline contacts and no uniformly smaller lawful size preserves the same layout, coverage and balance. The engine reports the individual side reaches, their spread and the limiting contacts; it invents no displacement threshold, tolerance or combined score. Centre constructions remain visible test options, but they are judged by this same yardstick and none becomes a hidden default.

- [ ] **EC-09 · Flap-limit test.** For every side and material extremity, the engine measures unsupported reach to the nearest supporting magnet disc. The flap limit is an explicit test switch with exactly two positions: 12mm and 24mm. Coverage passes only when every side is within the selected limit; centring passes only when the side reaches satisfy EC-08's evenness yardstick. Reach beyond the selected limit fails that test unless EC-10 applies. No intermediate threshold or hidden default is permitted.

- [ ] **EC-10 · Trivial-limb exception is explicit.** A reach beyond the tested flap limit may be presented only as an exception candidate for a trivial narrow limb, especially a bottom limb. The engine measures and reports the region, side and reach; it does not invent a numeric definition of `trivial`, silently approve the exception or hide it inside a score. Applied visual proof exposes every exception for confirmation.

- [ ] **EC-11 · Applied proof.** Every distinct arrangement can be applied to the real cutout using the exact returned scale, registration and coordinates. The canvas draws the complete 24mm discs, every side's unsupported reach and the limiting disc/edge contacts. Independently measured SVG geometry must reproduce the engine's evenness, coverage and tightness measurements. A table saying `fits` is not proof.

- [ ] **EC-12 · Responsive and complete delivery.** Solver work is never coupled to pinch, resize, pan, drag, camera movement or variant browsing. The frozen delivery includes: the portable engine answer; tests against an independent oracle; synthetic pair, concave, hollow, narrow and non-monotonic cases; all seven saved real cutouts; applied visual evidence for bands 2/3/4 at 48mm and 96mm; and a final statement of which algorithm parts are proven, require correction or must be rejected.

## Required answer shape

Each `MeasuredCutoutVariantFamily` contains:

```text
band
centreMethod
registration
scale
widthMM
heightMM
populations: {
  48: { magnets[]: { xMM, yMM, clearanceMM }, bindingContact },
  96: { magnets[]: { xMM, yMM, clearanceMM }, bindingContact }
}
sideReachMM: { left, right, top, bottom }
sideReachSpreadMM
tightnessContacts[]: { magnet, outlineLocation, clearanceMM }
unsupportedZones[]: { side, reachMM, classification }
flapLimitMM: 12 | 24
status: lawful | failed | exception-pending
```

## Exclusions

- No product winner or default centre method.
- No rotation.
- No mask or straight/dice/diamond pattern work.
- No manufacturing export.
- No production Cutout Lab integration.
- No UI redesign beyond applying and inspecting the measured variants.
- No global workflow, review-procedure or historical incident rules inside this engine contract.

## Closing confirmation

Builder, QA and Meta each return one compact matrix with `EC-01` through `EC-12`, `PASS` or exact failure, frozen snapshot and reproducible evidence. The algorithm is a keeper only if the real applied cutouts positively confirm precise support, centring and acceptable flap control across the required bands and populations.
