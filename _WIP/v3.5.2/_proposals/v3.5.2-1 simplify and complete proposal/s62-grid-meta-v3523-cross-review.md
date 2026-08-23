# Grid-Meta cross-review of every v3.5.2-3 correction

Bound to plan commit `3fdce16b`, master SHA-256 `0f49b077a455f244ec0033c0d6783242be1b0f6e3443d0b2e1122791fcade2c1`, and Lead reconciliation ledger SHA-256 `c494a246c8c489ce5309007113940808dfce33970bd95f65d06ea3b0e62b683b`.

I full-read the 197-line master, 32-line sub-plan, README, all ten saved proposal versions, Grid-QA's last-corrections file, the 3,043-line product runtime at `2c043257`, and both reconciliation ledgers.

## Row dispositions

| Row | Grid-Meta disposition |
|---|---|
| A1 | Accept superseded/staged disposition. Nearest-versus-up remains the one product ruling; a final master cannot retain both. |
| A1b | Accept rejection. The product returns measured whole-mm air, so a squared yes/no loop is not the final data shape. |
| A2 | Accept applied. |
| A2b | Accept applied. |
| A3 | Accept adapted, subject to the signed-ruler correction below; diamond 34 follows the locked ruler. |
| A4 | Accept applied. |
| A5 | Accept applied. |
| A6 | Accept applied. |
| A6b | Accept superseded. |
| B1 | Correct with replacement I1 below; raw seat sign is not yet consistent with fixture 2. |
| B2 | Accept applied. |
| B3 | Accept applied. |
| B4 | Correct with replacement I1; one final all-seated measurement must apply the same signed ruler. |
| B5 | Accept only with I2; current stored layouts are not render-complete. |
| B6 | Replace master `v3.5.2 tab` wording with `isolated Law tab, visibly labelled v3.5.1 until Dan directs otherwise`. Preserve worker request identity and storage namespace. Documentation versioning is not product rename authority. |
| B7 | Accept the coordinate witness shape. No id registry exists or is needed. Require all co-nearest points under F3. |
| B8 | Accept `wrapMeasurement` name. |
| B9 | Accept applied. |
| B10 | Keep F2 as a check only: `After F1, compare completed rungs against frozen Centre; if a material Centre-caused change is measured, stop and write a separate bounded amendment. F2 authorizes no repair in this build.` |
| B11 | Accept the proposed additions: fixture 2 must pin Coverage/MagnetPlan invariance; fixture 4 must prove `bandWalk` is the only size loop. |
| B12 | Accept applied except F2, settled by B10 above. |
| C1 | Accept staged disposition. |
| C2 | Accept applied. |
| D1 | Accept superseded. |
| D2 | Withdraw exact squared boundary comparison from the final contract. Dan's whole-mm law supersedes it; signed ruler I1 is the replacement. |
| D3 | Add `parityHolds` to the dead-helper deletion row and absence guard. It has no final consumer. |
| D4 | Accept applied: preserve live `pressExcessMM` Centre tie-breaker. |
| D5 | Accept adapted: preserve the 0.001 prescreen for frozen Centre phase selection, regenerate that selected lattice, then use I1 for final Law admission. |
| D6 | Accept rejection; Centre visualization/performance bodies remain unchanged. |
| E1 | Confirm applied. |
| E2 | Confirm adapted: `requiredFlapMM` belongs only inside the `WrapMeasurement` union; duplication on `PlacementCandidate` would permit disagreement. |
| E3 | Confirm adapted: conversion stays inline in `measureWrap`; no single-use `roundToRulerMM` export. Replace its unsigned expression with I1. |
| E4 | Confirm applied. |
| E5 | Confirm applied. |
| E6 | Confirm applied. |
| E7 | Confirm applied. |
| E8 | Confirm applied. |
| E9 | Confirm applied. |
| F1 | Confirm applied. |
| F2 | Confirm applied as the check-only B10 sentence. |
| F3 | Require co-nearest witnesses. Replace the end of §5.2 with J2 below. Fixture 2's square-24 four witnesses makes this load-bearing. |
| F4 | Confirm applied. |
| F5 | Replace raw-sign final legality with I1. |
| F6 | Confirm applied. |
| F7 | Confirm applied. |
| G1 | Confirm applied. |
| G2 | Confirm applied. |
| G3 | Confirm applied. |
| G4 | Confirm applied to frozen Centre only; I1 governs final Law measurement. |
| G5 | Confirm applied. |
| G6 | Confirm applied. |
| G7 | Confirm applied. |
| H1 | Accept nearest as Lead's recommendation, but it remains a Dan product lock. |
| H2 | Accept only as frozen Centre selection machinery. |
| H3 | Accept. |
| H4 | Replace with I2; current Rung/layout types cannot render a selected co-lawful placement without recomputation. |
| H5 | Keep as: `On the existing reference machine used for the baseline, each complete band solve must finish in under 2 s on the squircle and one named real cutout.` It is a usability gate, not an algorithm mandate. |
| H6 | Delete the `Lines` and `Size` columns and the net `-650/+130` estimate. They are unverified estimates and do not direct implementation. Keep only named files, actions and gates. |

## I1 — signed whole-mm clearance, one final seat/Wrap law

Replace §1 ruler geometry text, §2.2, §5.2 and W1 consistently with:

```md
Compute measures signed material clearance for every seated disc: `rawClearanceMM = pointInMaterial(anchor) ? nearestOutlineDistance - spotRadius : -(nearestOutlineDistance + spotRadius)`. It converts that value once to the whole-mm ruler: `clearanceMM = Math.floor(rawClearanceMM + 0.5)`. `[-0.5, 0.5)` reads 0, `[0.5, 1.5)` reads 1 and `[-1.5, -0.5)` reads -1. Final Law seat legality requires `clearanceMM >= 0`. Wrap measures only belt discs and returns `requiredFlapMM = max(0, ...beltClearanceMM)`. The frozen 0.001 mm Centre prescreen remains only the accepted Centre placement measurement; it is not the final Law seat verdict.
```

`invalid-seat` is returned only when a seated disc's ruled clearance is negative. Fixture 2 keeps squircle 72 lawful in every Centre mode and adds a mutation restoring raw `d >= r`; that mutation must fail. Geometry refusals still carry null allowance evidence.

Evidence: the current `2c043257` engine returns Weight squircle 72 as `invalid-seat` while the other five modes are lawful; the difference is below the ruler. The current master simultaneously requires all six lawful and lets raw sign decide, so it is not executable without this replacement.

## I2 — stored result must be render-complete

Replace the layout/rung declarations and engine signatures with:

```ts
export interface PlacementCandidate {
  sizeMM: number
  placement: { xHalf: boolean; yHalf: boolean }
  phaseMM: Pt
  lattice: Pt[]
  canon: number
  seated: Pt[]
  belt: Pt[]
  anchors: Anchor[]
  magnetCount: number
  parityTrue: boolean
  centreErrorMM: number
  wrapMeasurement: WrapMeasurement
}

export interface LawfulLayout {
  candidate: PlacementCandidate
  wrap: Extract<WrapEvaluation, { status: 'lawful' }>
}

export interface Rung {
  band: 1 | 2 | 3 | 4
  sizeMM: number
  magnetCount: number
  layouts: LawfulLayout[]
}

export interface BandSolveResult {
  bands: BandLadder[]
  gridsBySize: ReadonlyMap<number, GridResult>
}

export interface GridResult {
  anchors: Anchor[]
  pitchCentreMM: number
  lattice: Pt[]
  phaseMM: Pt
  panMM: Pt
  spotRadiusMM: number
  contactsMM: Pt[]
  segments: SafeSegment[]
  centresMM: Pt[]
  centreMainMM: Pt
  wrap: WrapEvaluation
  parityTrue: boolean
  centreErrorMM: number
  concessions: ('CENTRE' | 'WRAP')[]
  candidates: PlacementCandidate[]
}

export function solveBands(sized: (evenSizeMM: number) => Contour, cfg?: GridConfig): BandSolveResult
export function fitSizeInBand(solved: BandSolveResult, bandId: 1 | 2 | 3 | 4, rungIndex: number, layoutIndex: number): GridResult
```

`solveBands` receives the bridge's existing size function so outline offset remains part of every sized contour; it computes each even size once and stores its `GridResult`. Logic attaches the lawful Wrap verdict to each retained layout. `fitSizeInBand` reads the cached size result and overlays `phaseMM`, `lattice`, `anchors`, `wrap`, `parityTrue`, `centreErrorMM` and `contactsMM = wrap.witnesses.map(w => w.outlinePointMM)` from the stored lawful layout. Common `pitchCentreMM`, `spotRadiusMM`, Centre evidence and candidates stay from the one cached size result; `concessions: []` because a published rung passed all three laws. It calls no geometry, Centre, Wrap, Coverage, contour-scaling or Logic code. Delete `GridConfig.solveCache`; cache state belongs to `BandSolveResult`/worker, not policy config.

Add the gate: selecting every co-lawful layout changes the rendered stored phase/anchors while an instrumented compute-call counter stays unchanged.

## J2 — co-nearest witnesses

Replace the end of §5.2 with:

```md
For each belt disc, emit every distinct outline point tied for the minimum distance under the same double computation. Exact native equality identifies a tie; no tolerance creates one. Preserve stable ring/segment traversal order and deduplicate identical projected coordinates. Duplicate binders never change `requiredFlapMM`.
```

## J3 — Centre check is a stop, not a build phase

Remove F2 from the build-step table. Append after F1:

```md
After F1, compare the completed rungs against frozen Centre. If a material Centre-caused change is measured, stop and write a separate bounded amendment; this contract authorizes no Centre repair. With no measured Centre-caused failure, Centre remains unchanged and the delivery closes at F1.
```

## J4 — population invariance and one walk

Add to fixtures 2/3:

```md
Full and Perimeter Coverage produce their ruled output populations while `seated`, `belt` and every Wrap clearance/witness remain identical. MagnetPlan changes only assigned diameters; positions, populations, counts, Wrap evidence and rung ownership remain identical.
```

Add to fixture 4:

```md
The owner guard proves `solveBands` is the only production loop over `BANDS`/`SIZE_STEP_MM`; worker, UI, fixed inspection and rung selection contain no second size walk. An instrumented solve visits each even size at most once per configuration.
```

## Proposal-version reconciliation

I accept every disposition in `v3.5.2-3-three-way-reconciliation.md` after changing its item 3 to preserve the Dan-ruled `v3.5.1` visible tab identity. Exact-root/adapter/FieldSqrt/1 µm/0.001-policy versions are superseded by Dan's later whole-mm/even-size ruling; their accepted-count, distinct-population, gravity, B1-B4, worker-storage and anti-overbuild content remains represented above.

Necessity — delete unverified size estimates and dead `parityHolds`; add only signed-ruler consistency and render-complete stored layouts. No exact/root/certificate platform returns.

Sufficiency — after I1, I2, the row replacements above and Dan's rounding lock, the contract fully specifies frozen Centre selection, one whole-mm seat/Wrap law, even-size next-count scaling, stored co-lawful rendering, worker/UI delivery and the final audit trail.
