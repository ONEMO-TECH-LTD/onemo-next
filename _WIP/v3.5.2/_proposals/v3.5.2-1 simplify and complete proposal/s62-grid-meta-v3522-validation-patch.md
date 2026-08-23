# v3.5.2-2 team validation patch

Target reviewed: plan commit `cb1a2704`; master SHA-256 `aa76a353c56b0d845cc6e81714e7af53d5ff0cc28eeba6dbf0fbf956180aef47`.

The even-size walk is the necessary mechanism. The following replacements remove the remaining exact-root language and close two executable seams without adding a module, phase or proof platform.

## 1. Replace master §1 scaling paragraph

```md
3. **MAGNET-QUANTITY SCALING** — candidate shape sizes are the even millimetres 24, 26, 28 … . Within each band the engine evaluates every such size and publishes each next available magnet count once, at the smallest even size where that count has a centred and wrapped layout. Counts are strictly increasing; a jump larger than one is valid. A count accepted in a lower band never appears again. Evaluating every even size makes size coverage complete by construction. The scaled contour, governed centre and lattice coordinates may remain fractional internally; only size and law measurements are ruled to whole millimetres.
```

Reason: an even longest-side size does not make an arbitrary contour centroid, bbox midpoint or bbox-anchored 2 mm mesh sample integral.

## 2. Replace master §6.1 `PlacementCandidate`

```ts
export interface PlacementCandidate {
  sizeMM: number                 // ruled even whole millimetre
  placement: { xHalf: boolean; yHalf: boolean }
  seated: readonly PointMM[]     // complete seat population
  belt: readonly PointMM[]       // Wrap population only
  anchors: readonly Anchor[]     // post-Coverage output population
  magnetCount: number
  requiredFlapMM: number         // non-negative whole-mm ruler result
  parityTrue: boolean
  wrapMeasurement: WrapMeasurement // measurement/evidence, not a pre-rounded policy verdict
}
```

Reason: the existing `WrapEvaluation` judges the unrounded exact allowance. Carrying it here would make fixed inspection refuse the same 0.06 mm air that the scaling reducer accepts at ruler value 0.

## 3. Replace master §6.2 one-geometry block and API

```md
**One geometry for seat and Wrap.** Scale the supplied outer ring and holes once for an even `sizeMM`. The same prepared contour and the same selected anchors feed both checks. Seat legality is evaluated for every member of `seated`, including hole clearance. Wrap air and witnesses are evaluated only for `belt`. The float seat predicate may reject obvious failures cheaply, but it may never admit a candidate without the complete outer+holes seat check.

```ts
export function scaleContour(base: Contour, evenSizeMM: number): Contour
export function measureCentreBranches(segments, boxCentre, weightCentre): CentreMeasurements // unchanged
export function measureCentrePlacements(bb, pitch, candidates, fits, outer, reach): CentrePlacementMeasurement[] // unchanged; all four returned
export function measureWrap(
  prepared: PreparedContour,
  seated: readonly PointMM[],
  belt: readonly PointMM[],
  spotRadiusMM: number,
): WrapMeasurement
export function roundToRulerMM(airMM: number): number
```

`measureWrap` refuses when any seated disc is illegal against the prepared outer+holes contour, then measures the worst belt air and nearest-outline witnesses. `roundToRulerMM` is the single law conversion: reject non-finite input; clamp negative reporting noise to zero; return `Math.floor(Math.max(0, airMM) + 0.5)`. Therefore `[0,0.5)` is ruler 0 and `[0.5,1.5)` is ruler 1. All fixed, Auto, manual and band paths use this same integer before policy comparison. A witness marks the nearest outline point for a belt disc; it is not described as literal contact when positive air merely rounds to zero.
```

## 4. Replace master §6.3 opening rule

```md
Logic receives self-contained measurements and returns decisions. Scaling law inputs are the integer `sizeMM`, integer `requiredFlapMM`, parity evidence, populations and identities. Native integer comparison is authoritative for size/flap because the ruler conversion has already happened in Compute. Existing exact comparison remains confined to the retained Wrap measurement kernel and does not select a sub-millimetre scaling result.
```

Also replace reducer step 3–4 with:

```md
3. fixed flap: compare the candidate's whole-mm `requiredFlapMM` with the whole-mm configured allowance;
4. Auto flap: among otherwise-lawful candidates for the count, retain the minimum whole-mm `requiredFlapMM`, or return the typed cap refusal;
```

## 5. Replace master §7.1 final paragraph

```md
The admitted boundary primitive is the supplied line segment, outer plus holes. Scaling evaluates only even integer sizes; it does not solve an event scale. The retained exact Wrap kernel may measure segment distance and nearest points, but algebraic roots, isolating intervals and contact equations never enter size discovery, rung ownership or any below-ruler decision.
```

## 6. Replace master §7.1b heading/body

```md
### 7.1b Even-millimetre candidate sizes

The candidate longest-side size is an even whole millimetre. At each size, the unchanged numeric Centre branch and all four parity placements run exactly as they do in the cleared baseline. Their internal coordinates may be fractional. No exact Centre reconstruction, affine adapter or event-root model exists.
```

## 7. Replace master §8 rows

```md
| Band B1-B4 | owns its listed even candidate sizes | every band exercised; no cross-band repeat or boundary double-owner |
| Flap fixed | maximum whole-mm worst-belt air | ruler 0 accepts air below 0.5 mm after complete seat legality; 0.5 mm reads 1 |
| Flap Auto | smallest whole-mm required allowance, capped | a ruler need of 1 returns 1, never 2 |
```

## 8. Replace T3 build wording everywhere

```md
- **Wrap first:** preserve the cleared distance/witness measurement, but make fixed, Auto and manual policy consume the single whole-mm ruler result. Flap 0 means every seated disc is legal and every belt disc's air rounds to 0; it does not claim literal zero-distance contact.
- Before scaling, demonstrate one flap-0 ruler-zero layout and one air-at-least-0.5 mm refusal in the running Law tab.
```

Replace the stop/build-completion and optional-audit phrases `exact contact`, `certified contact`, `exact required allowance`, `exact solved scale`, `earliest accepted exact scale`, and `exact next-count scaling` with respectively `ruler-zero witness`, `stored nearest-outline witness`, `whole-mm required allowance`, `earliest accepted even size`, and `even-size next-count scaling`.

## 9. Replace sub-plan stale lines

```md
Status: execution authority is v3.5.2-2, revised 2026-08-23.

Performance is in scope only for the complete even-size walk and its existing fixed-size measurement.

G1 is superseded because scaling evaluates no continuous Centre site. No selected-coordinate reconstruction exists or returns.

B2 transports the stored even size, whole-mm required flap, nearest-outline witnesses and refusals unchanged. It does not retain an exact event scale.

F1 requires strictly increasing counts at earliest accepted even sizes, whole-mm Wrap evidence, explicit refusals/ties, every even size evaluated, comparator hashes unchanged and the real UI truthful.

F2: master §7.1b is the even-size walk rule, not an exact coordinate adapter and not Centre-repair authority.

Necessity — the plan graduates the existing walk directly on the 1 mm ruler and builds one live engine→worker→UI path. It adds no root, adapter, affine, recursive or proof platform.

Sufficiency — the plan delivers frozen Centre, one shared seat/Wrap geometry, fixed/Auto Wrap on the whole-mm ruler, next-count B1-B4 scaling at even sizes, typed direct/worker/manual results, stored lookup, truthful UI, completed-system proof and conditional Centre repair.
```

## Necessity and sufficiency

Necessity — no new mechanism is required beyond these corrections; delete the stale exact-event claims rather than implementing them.

Sufficiency — after these replacements, the contract executes the full three-law result on even sizes and the 1 mm ruler. Before them, fixed/manual versus rung Wrap can disagree and an interior disc overlapping a hole can remain falsely seated.
