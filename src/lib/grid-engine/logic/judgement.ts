// logic/judgement.ts — the JUDGE. It drives the byte-verbatim v1 engine (compute/grid-core.ts)
// with the released values and states, per band, every size the shape can manufacture and the
// exact magnet layout each size seats.
//
// Separation, per the scaffold law:
//   • compute/ holds ALL the mathematics (the lifted v1 engine — untouched).
//   • spec.ts holds ALL the values (grid, magnets, calibration, bands).
//   • THIS file maps values → the engine's own inputs and shapes the engine's answers into the
//     product deliverable. It computes no geometry and holds no numbers of its own.
//
// The deliverable it serves (Dan, 2026-08-11, verbatim): "engine produces measured cutout shape
// variants — each assessed in the size band 2-3-4 and computed precise variants of magnet layout,
// quantity, coordinates + the corresponding shape proportional sizes with locked aspect ratio."

import {
  nearestAnchorPair,
  resolveGridPlan,
  scaleContour,
  semanticLadderFromRecipe,
  type Anchor,
  type GridPlanOptions,
  type ResolvedGridPlan,
  type SemanticRung,
  type SizeLaw,
} from '../compute/grid-core'
import { normalizeContour } from '../compute/normalize'
import type { Contour, Pt } from '../compute/types'
import type { BandSpec, CalibrationSpec, GridSystemSpec } from '../spec'

/** The v1 engine's SizeLaw, assembled from released values — never from literals here. */
export function lawFromSpec(spec: GridSystemSpec, calibration: CalibrationSpec): SizeLaw {
  return {
    paddingMM: spec.grid.paddingMM,
    frameMM: calibration.frameMM,
    maxTestedMM: calibration.maxTestedMM,
    maxRungMM: spec.grid.maxSizeMM,
  }
}

/** The v1 engine's plan options, assembled from released values. */
function optionsFromSpec(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
): Pick<GridPlanOptions, 'source' | 'mode' | 'density' | 'paddingMM' | 'plan' | 'center'> {
  return {
    // Cutout-lab silhouettes are the engine's freeform source: the full legal pattern search.
    source: 'magic',
    mode: calibration.mode,
    density: calibration.density,
    paddingMM: spec.grid.paddingMM,
    plan: calibration.plan,
    center: calibration.center,
  }
}

/** One manufacturable variant: a size the grid dictates, and the exact layout it seats. */
export interface SizeVariant {
  /** Published total longest side, millimetres (design plus outward margin). */
  sizeMM: number
  /** Longest side of the artwork itself before margin. */
  designSizeMM: number
  /** Outward margin per side the plan consumed. */
  marginMM: number
  /** Grid extent — the lattice-authority identity of this rung. */
  gridExtentMM: number
  /** Seated magnets: centre coordinates (mm, effect frame) and diameter each. */
  anchors: Anchor[]
  /** Interior spots dropped by the belt (faint on a surface, ignorable at manufacture). */
  candidates: Pt[]
  /** Flap-risk markers and total unheld outline length from the coverage oracle. */
  flaps: Pt[]
  uncoveredMM: number
  /** The lattice this rung runs on. */
  pitchMM: number
  pattern: string | null
  /** Closest seated pair, millimetres — the delivered-spacing readout. */
  nearestAnchorMM: number | null
  /** The engine's own verdict for this size. */
  ok: boolean
  issues: string[]
  /** The exact effect contour at this size (design plus margin), for drawing and manufacture. */
  effectContourMM: Contour
}

export interface BandAnswer {
  band: BandSpec
  /** Every grid-dictated size of this shape whose published size falls in the band's range. */
  variants: SizeVariant[]
}

export interface ShapeJudgement {
  /** The engine's size ladder for this shape — the raw grid-first authority. */
  rungs: SemanticRung[]
  /** The ladder cut into the released bands, each size delivered with its exact layout. */
  bands: BandAnswer[]
}

function variantFromPlan(rung: SemanticRung, plan: ResolvedGridPlan): SizeVariant {
  return {
    sizeMM: rung.sizeMM,
    designSizeMM: rung.designSizeMM,
    marginMM: rung.marginMM,
    gridExtentMM: rung.gridExtentMM,
    anchors: plan.grid.anchors,
    candidates: plan.grid.candidates,
    flaps: plan.grid.flaps,
    uncoveredMM: plan.grid.uncoveredMM,
    pitchMM: plan.pitchMM,
    pattern: plan.pattern,
    nearestAnchorMM: nearestAnchorPair(plan.grid.anchors)?.distanceMM ?? null,
    ok: plan.grid.ok,
    issues: plan.grid.issues,
    effectContourMM: plan.effectContourMM,
  }
}

/**
 * The whole deliverable for one cutout shape: normalize once, let the verbatim engine solve its
 * grid-first size ladder, then deliver every rung through the engine's exact catalogue path
 * (construction validated, never re-solved) and cut the ladder into the released bands.
 */
export function judgeShape(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
  contourMM: Contour,
): ShapeJudgement | null {
  const unitContour = normalizeContour(contourMM)
  if (!unitContour) return null

  const law = lawFromSpec(spec, calibration)
  const options = optionsFromSpec(spec, calibration)

  const rungs = semanticLadderFromRecipe(
    {
      kind: 'uniform-contour',
      unitContour,
      minMarginMM: 0,
      maxMarginMM: calibration.maxGrowMM,
    },
    law,
    calibration.mode,
    { source: options.source, density: options.density, center: options.center },
  )

  const deliver = (rung: SemanticRung): SizeVariant =>
    variantFromPlan(
      rung,
      resolveGridPlan(
        // The rung's design contour at its exact design size — the ENGINE scales the unit contour.
        scaleContour(unitContour, rung.designSizeMM),
        {
          ...options,
          baseMarginMM: rung.marginMM,
          construction: rung.construction,
        },
      ),
    )

  const bands: BandAnswer[] = calibration.bands.map((band) => ({
    band,
    variants: rungs
      .filter((rung) => rung.sizeMM >= band.minSizeMM && rung.sizeMM < band.maxSizeMM)
      .map(deliver),
  }))

  return { rungs, bands }
}
