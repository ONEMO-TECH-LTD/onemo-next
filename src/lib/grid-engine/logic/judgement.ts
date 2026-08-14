// logic/judgement.ts — the JUDGE. It drives the byte-verbatim v1 engine (compute/grid-core.ts)
// with the released values and states, per band, the sizes the shape can manufacture and the
// exact magnet layout each size seats.
//
// Separation, per the scaffold law:
//   • compute/ holds ALL the mathematics (the lifted v1 engine + pure measures — untouched).
//   • spec.ts holds ALL the values (grid, magnets, calibration, bands, flap law).
//   • THIS file maps values → the engine's own inputs, compares the engine's numbers against the
//     released values, and orders the answers. It computes no geometry and holds no numbers.
//
// THE JUDGEMENT (Dan's canon, 2026-08-11/14, verbatim sources in _WIP/grid-engine-v3/grid-brief.md):
//   • "minimum magnet pair … fit to shape inside it, centered to the shape and have no flap zones
//     greater than 12-24mm on any side" — the FLAP LAW: per-side overhang beyond the padded grid
//     box, tight bound preferred, outer bound refused.
//   • "the magnet assembly must be centered to prevent flap … flap evened out on all sides" —
//     EVENNESS breaks ties.
//   • "gravity must not place magnets in the bottom and leave top unprotected" — TOP SUPPORT
//     outranks general tightness.
//   • "pair is minimum but optimal is 4 magnets" — each band carries its target count.
//   • "unless it is trivial limb especially at the bottom" — the LIMB EXCEPTION: the bottom side
//     alone carries a wider allowance, so hanging legs and bodies do not refuse a lawful hold.
//   • Both populations of the one lattice are judged — 48 dense and 96 sparse (the same lattice
//     thinned) — and the flap law picks between them. The engine's mathematics stays byte-verbatim;
//     its own phase search (centred, half-pitch, edge-registered) provides the placements. (No
//     shape-translation sweep exists: the engine registers the grid RELATIVE to the shape, so
//     translating the shape is physically the same placement.)

import {
  computeGrid,
  computePreparedGrid,
  nearestAnchorPair,
  scaleContour,
  type Anchor,
  type GridResult,
} from '../compute/grid-core'
import { prepareExactContour } from '../compute/grid-prepared'
import { normalizeContour } from '../compute/normalize'
import { placeTemplate } from '../compute/templates'
import { measureWrap, type WrapMeasures } from '../compute/wrap'
import type { Contour, Pt } from '../compute/types'
import {
  LAUNCH_PITCHES_MM,
  type BandSpec,
  type CalibrationSpec,
  type GridSystemSpec,
} from '../spec'

/** One manufacturable variant: a grid-dictated size and the exact layout that seats it. */
export interface SizeVariant {
  /** Published longest side, millimetres, even. */
  sizeMM: number
  /** Seated magnets: centre coordinates (mm, this variant's frame) and diameter each. */
  anchors: Anchor[]
  /** Interior spots dropped by the belt. */
  candidates: Pt[]
  /** Hold-oracle report at this size: unheld outline length and its markers. Report, not a gate. */
  flaps: Pt[]
  uncoveredMM: number
  pitchMM: number
  pattern: string
  nearestAnchorMM: number | null
  /** The flap-law measures this variant was judged on. */
  wrap: WrapMeasures
  /** 'tight' within the tight bound; 'allowed' within the outer bound; 'limb' rides the limb
   *  exception (some side hangs beyond the outer bound but within the limb allowance). */
  tier: 'tight' | 'allowed' | 'limb'
  /** The released template that produced this layout, when one did (the auto search sets none). */
  layout?: string
  /** The exact contour at this size and placement — for drawing and manufacture. */
  effectContourMM: Contour
}

export interface BandAnswer {
  band: BandSpec
  /** Best placements this band offers, judged order — first is the band's answer. */
  variants: SizeVariant[]
}

export interface ShapeJudgement {
  bands: BandAnswer[]
}

/** How many variants a band reports. WIDE OPEN by Dan's ruling (2026-08-14): "each band must
 *  provide different options … maximum amount of the options, no pairs no 4s, any count that
 *  fits — first we identify what works, then refine to prefer specific layouts." */
const VARIANTS_PER_BAND = 12

/** What makes two variants THE SAME ARRANGEMENT (Dan, 2026-08-14: variants are distinct
 *  layouts at their snug size — "not micro steps in millimetres"). Identity is the PHYSICAL
 *  arrangement — the anchors' relative lattice geometry — never the search path that found it:
 *  a vertical pair is one arrangement whether a template or the auto search proposed it. */
function layoutIdentity(variant: SizeVariant, halfPitchMM: number): string {
  let minX = Infinity
  let minY = Infinity
  for (const anchor of variant.anchors) {
    if (anchor.p[0] < minX) minX = anchor.p[0]
    if (anchor.p[1] < minY) minY = anchor.p[1]
  }
  // Half-pitch resolution: straight vs diagonal vs sparse arrangements stay distinct, while the
  // same arrangement found at neighbouring sizes collapses to its one snug record.
  return variant.anchors
    .map(
      (anchor) =>
        `${Math.round((anchor.p[0] - minX) / halfPitchMM)},${Math.round((anchor.p[1] - minY) / halfPitchMM)}`,
    )
    .sort()
    .join(';')
}

/** Judge one delivered grid against the flap law. Returns null when the law refuses it. */
function variantFrom(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
  band: BandSpec,
  contour: Contour,
  sizeMM: number,
  pitchMM: number,
  pattern: string,
  grid: GridResult,
  layout?: string,
): SizeVariant | null {
  // NO COUNT GATE (Dan 2026-08-14): any count that fits stays an option.
  if (grid.anchors.length < 1) return null
  const wrap = measureWrap(
    contour,
    grid.anchors.map((anchor) => anchor.p),
    spec.grid.paddingMM,
  )
  if (!wrap) return null
  // THE YARDSTICK LAW (Dan's four bat-woman canon frames, 2026-08-14 22:40): flap NEVER
  // refuses a placement — the canon B3/B4 central pair carries 57-86mm sides lawfully; the
  // brains hold the spine and the material hangs. Flap bounds survive only as the TIER
  // report. The gates are the engine's own clearance and ENFORCED CENTERING.
  if (Math.abs(wrap.left - wrap.right) / 2 > calibration.centerToleranceMM) return null
  const sideMax = Math.max(wrap.left, wrap.right)
  const verticalMax = Math.max(wrap.top, wrap.bottom)
  const tier: SizeVariant['tier'] =
    sideMax <= calibration.flapTightMM && verticalMax <= calibration.flapMaxMM
      ? 'tight'
      : verticalMax <= calibration.flapMaxMM
        ? 'allowed'
        : 'limb'
  return {
    sizeMM,
    anchors: grid.anchors,
    candidates: grid.candidates,
    flaps: grid.flaps,
    uncoveredMM: grid.uncoveredMM,
    pitchMM,
    pattern,
    nearestAnchorMM: nearestAnchorPair(grid.anchors)?.distanceMM ?? null,
    wrap,
    tier,
    layout,
    effectContourMM: contour,
  }
}

/** The judgement order — each comparison is one of Dan's rules, applied in precedence. */
function isCorners(v: SizeVariant, calibration: CalibrationSpec): boolean {
  if (v.anchors.length < 4) return false
  if (v.wrap.gridExtentXMM < 72 || v.wrap.gridExtentYMM < 72) return false
  if (v.wrap.maxSide > calibration.flapMaxMM) return false
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const a of v.anchors) {
    if (a.p[0] < minX) minX = a.p[0]
    if (a.p[0] > maxX) maxX = a.p[0]
    if (a.p[1] < minY) minY = a.p[1]
    if (a.p[1] > maxY) maxY = a.p[1]
  }
  const tol = 1e-6
  const at = (x: number, y: number) =>
    v.anchors.some((a) => Math.abs(a.p[0] - x) < tol && Math.abs(a.p[1] - y) < tol)
  return at(minX, minY) && at(maxX, minY) && at(minX, maxY) && at(maxX, maxY)
}

function better(
  a: SizeVariant,
  b: SizeVariant,
  band: BandSpec,
  calibration: CalibrationSpec,
): boolean {
  // THE GENERAL LAW (calibrated on the bat yardstick, validated across every canon shape —
  // NO shape- or band-specific counts anywhere):
  // 1. GRAVITY AS A GUARD, not a climb (Dan, 2026-08-14: the pill single drifted off-centre
  //    because "least top overhang" walked every layout as high as clearance allowed). The law —
  //    "gravity must not place magnets in the bottom and leave top unprotected" — is a constraint:
  //    a placement whose top overhang stays within the outer flap bound HOLDS the top; among
  //    holders, wrap and evenness centre the assembly.
  const holdsTopA = a.wrap.top <= calibration.flapMaxMM
  const holdsTopB = b.wrap.top <= calibration.flapMaxMM
  if (holdsTopA !== holdsTopB) return holdsTopA
  // 2. THE COLUMN LAW (Dan, this session: "narrow shape if scaled can fit 2 columns" — and
  //    "optimal is 4 magnets in each outmost corner"). CORNERS CLASS — outranks every
  //    spine/pair/single, but ONLY when the arrangement genuinely takes the shape's corners:
  //    four-plus magnets, all four corners of their own box occupied (an L holds 3 of 4 —
  //    not corners), real spread on both axes, and the shape reaching the block's edges
  //    (max side flap within the outer bound — the duck's quad wears 18mm sides, the bat's
  //    wings hang 45mm past any quad: a patch, not corners). Where no true corners seat
  //    (the bat), the class is silent and the spine family decides below.
  const cornersA = isCorners(a, calibration)
  const cornersB = isCorners(b, calibration)
  if (cornersA !== cornersB) return cornersA
  // 3. SPARSE SPREAD (Dan: "96mm is lawful sparse pair and actually preferred") — wider
  //    spacing wins; lifts the 96 spine over the crowded 48 family. Triangles live in this
  //    pool too: BALANCE below picks them only where the shape is genuinely three-cornered
  //    (Dan: "a T-shaped can act as triangle with 3 corners") — elsewhere the pair balances
  //    better and wins.
  const spreadA = a.nearestAnchorMM ?? 0
  const spreadB = b.nearestAnchorMM ?? 0
  if (spreadA !== spreadB) return spreadA > spreadB
  // 4. THE BALANCE RULE outranks tightness (Dan 2026-08-14 and his 2026-08-10 brief: "what may
  //    seem logical on paper and mathematically correct may miss the law of balance and
  //    symmetry"). Flap balanced across sides, BOTH axes counted, before any tightness compare.
  if (a.wrap.imbalanceSumMM !== b.wrap.imbalanceSumMM)
    return a.wrap.imbalanceSumMM < b.wrap.imbalanceSumMM
  // 4b. among equal balance, FEWER magnets — the spine is minimal ("brains only").
  if (a.anchors.length !== b.anchors.length) return a.anchors.length < b.anchors.length
  // 5. tight wrap — least total overhang
  if (a.wrap.total !== b.wrap.total) return a.wrap.total < b.wrap.total
  // 6. smaller manufactured size
  if (a.sizeMM !== b.sizeMM) return a.sizeMM < b.sizeMM
  // deterministic close: the denser population first
  return a.pitchMM < b.pitchMM
}

function judgeBand(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
  band: BandSpec,
  unitContour: Contour,
): BandAnswer {
  const kept: SizeVariant[] = []
  const consider = (variant: SizeVariant | null) => {
    if (!variant) return
    // ONE RECORD PER ARRANGEMENT — a band offers distinct layouts, each at its snug size,
    // never millimetre-step copies of the same one.
    const halfPitchMM = spec.grid.basePitchMM / 2
    const identity = layoutIdentity(variant, halfPitchMM)
    const twin = kept.findIndex((existing) => layoutIdentity(existing, halfPitchMM) === identity)
    if (twin >= 0) {
      if (better(variant, kept[twin], band, calibration)) kept[twin] = variant
      return
    }
    kept.push(variant)
  }

  const step = calibration.sizeStepMM
  const sweep = calibration.sweepStepMM
  // EVERY released template is proposed in every band — no count-based pruning.
  const templates = calibration.templates
  for (
    let sizeMM = Math.ceil(band.minSizeMM / step) * step;
    sizeMM < band.maxSizeMM;
    sizeMM += step
  ) {
    const contour = scaleContour(unitContour, sizeMM)
    // 1. The engine's own search — both released populations, straight AND diamond links
    //    (Dan, 2026-08-13: "diagonal is also correct it does not introduce separate grid").
    for (const pitchMM of LAUNCH_PITCHES_MM) {
      for (const pattern of ['standard', 'diamond'] as const) {
        const grid = computeGrid(contour, {
          pitchMM,
          pattern,
          paddingMM: spec.grid.paddingMM,
          plan: calibration.plan,
          perimeterOnly: true,
          center: calibration.center,
        })
        consider(variantFrom(spec, calibration, band, contour, sizeMM, pitchMM, pattern, grid))
      }
    }
    // 2. The released templates, proposed at swept positions and VALIDATED by the engine's own
    //    catalogue door (construction: padding, on-lattice and overlap checks are the engine's) —
    //    the search freedom Dan exercises by eye, with the verbatim mathematics untouched.
    const prepared = prepareExactContour(contour)
    const bb = prepared.bbox
    for (const template of templates) {
      // Small templates floating on large shapes sweep at half resolution — cost, not law:
      // their origin range is huge and the fine step over it quadrupled the solve. Large
      // templates have small ranges and keep the fine step.
      const stepMM = template.steps.length <= 3 && sizeMM > 120 ? sweep * 2 : sweep
      let stepsAcross = 0
      let stepsDown = 0
      for (const [across, down] of template.steps) {
        if (across > stepsAcross) stepsAcross = across
        if (down > stepsDown) stepsDown = down
      }
      const spanX = stepsAcross * spec.grid.basePitchMM
      const spanY = stepsDown * spec.grid.basePitchMM
      for (let x = bb.minX; x + spanX <= bb.maxX; x += stepMM) {
        for (let y = bb.minY; y + spanY <= bb.maxY; y += stepMM) {
          try {
            const grid = computePreparedGrid(prepared, {
              pitchMM: spec.grid.basePitchMM,
              pattern: 'standard',
              paddingMM: spec.grid.paddingMM,
              plan: calibration.plan,
              perimeterOnly: true,
              construction: placeTemplate([x, y], template.steps, spec.grid.basePitchMM),
            })
            consider(
              variantFrom(
                spec,
                calibration,
                band,
                contour,
                sizeMM,
                spec.grid.basePitchMM,
                'standard',
                grid,
                template.name,
              ),
            )
          } catch {
            // the engine refused this placement (padding/overlap/off-lattice) — lawful silence
          }
        }
      }
    }
  }

  kept.sort((a, b) => (better(a, b, band, calibration) ? -1 : 1))
  return { band, variants: kept.slice(0, VARIANTS_PER_BAND) }
}

/**
 * The whole deliverable for one cutout shape: normalize once, then per band search sizes and
 * placements, judge every lawful answer against the released flap/gravity/target laws, and
 * return each band's ordered variants. The verbatim engine does all the mathematics.
 */
export function judgeShape(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
  contourMM: Contour,
): ShapeJudgement | null {
  const unitContour = normalizeContour(contourMM)
  if (!unitContour) return null
  return {
    bands: calibration.bands.map((band) => judgeBand(spec, calibration, band, unitContour)),
  }
}
