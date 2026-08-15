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
import { prepareExactContour, distanceToPreparedContour, pointInPreparedContour } from '../compute/grid-prepared'
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
  /** Horizontal distance from the assembly's centre to the shape's MASS AXIS (the deepest-material
   *  point) — the figure's own axis, which on a winged shape is not the bounding box's centre. */
  massAxisOffMM?: number
  /** The shallowest anchor's true distance to the outline — the STRONG-REGION measure (Dan's
   *  canon walkthrough: magnets belong in the mass; "limbs carry the hold" only where the limb
   *  is itself a full mass region). */
  minDepthMM?: number
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
/** Does the shape mirror about its vertical axis? Every scanline's centre must sit within
 *  tolFrac of the width from the shape's own axis. Pure geometry, tolerance from spec. */
/** The unit shape's deepest-material point — the mass centre a placement should align to.
 *  Pure sampling over the exact distance field; scales linearly with the shape. */
function unitMassCentre(unit: Contour): Pt | null {
  const prepared = prepareExactContour(unit)
  const bb = prepared.bbox
  let best: Pt | null = null
  let bestD = -Infinity
  const N = 40
  for (let i = 1; i < N; i++) {
    for (let j = 1; j < N; j++) {
      const p: Pt = [
        bb.minX + ((bb.maxX - bb.minX) * i) / N,
        bb.minY + ((bb.maxY - bb.minY) * j) / N,
      ]
      if (!pointInPreparedContour(p, prepared)) continue
      const d = distanceToPreparedContour(p, prepared)
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
  }
  return best
}

function contourIsMirrorSymmetric(contour: Contour, tolFrac: number): boolean {
  const pts = contour.outer.pts
  if (pts.length < 3) return false
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const cx = (minX + maxX) / 2
  const width = maxX - minX
  if (width <= 0) return false
  const SAMPLES = 24
  for (let i = 1; i < SAMPLES; i++) {
    const y = minY + ((maxY - minY) * i) / SAMPLES
    let rowMin = Infinity
    let rowMax = -Infinity
    for (let j = 0; j < pts.length; j++) {
      const [x1, y1] = pts[j]
      const [x2, y2] = pts[(j + 1) % pts.length]
      if (y1 === y2) continue
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const x = x1 + ((y - y1) / (y2 - y1)) * (x2 - x1)
        if (x < rowMin) rowMin = x
        if (x > rowMax) rowMax = x
      }
    }
    if (rowMin > rowMax) continue
    if (Math.abs((rowMin + rowMax) / 2 - cx) > tolFrac * width) return false
  }
  return true
}

/** Is the arrangement itself mirror-symmetric — every anchor reflected about the block's own
 *  vertical centre lands on another anchor? Lattice points reflect exactly; no tolerance games. */
function anchorsAreMirrorSymmetric(v: SizeVariant): boolean {
  let minX = Infinity, maxX = -Infinity
  for (const a of v.anchors) {
    if (a.p[0] < minX) minX = a.p[0]
    if (a.p[0] > maxX) maxX = a.p[0]
  }
  const cx = minX + (maxX - minX) / 2
  const tol = 1e-6
  return v.anchors.every((a) =>
    v.anchors.some(
      (b) => Math.abs(b.p[0] - (2 * cx - a.p[0])) < tol && Math.abs(b.p[1] - a.p[1]) < tol,
    ),
  )
}

/** THE STRUCTURE LAW (Dan's ruled canon, selection-examples): the shape's own build names its
 *  arrangement class — "a TRIANGULAR shape takes a triangular hold"; the duck's waist is spanned
 *  by corners with the mid row skipped; the bot's "narrow standing mass" takes the tight column;
 *  "diagonal for diagonal". Measured from the outline with the same scanline machinery as the
 *  symmetry law; thresholds are spec values. */
type ShapeStructure =
  | { kind: 'diagonal'; sign: 1 | -1 }
  | { kind: 'tapered' }
  | { kind: 'waistedY' }
  | { kind: 'waistedX' }
  | { kind: 'uniform'; tall: boolean; narrowMass: boolean }

function profile(
  pts: ReadonlyArray<Pt>,
  axis: 0 | 1,
  lo: number,
  hi: number,
): { span: number; centre: number }[] {
  const out: { span: number; centre: number }[] = []
  const N = 24
  for (let i = 1; i < N; i++) {
    const c = lo + ((hi - lo) * i) / N
    let mn = Infinity
    let mx = -Infinity
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j]
      const b = pts[(j + 1) % pts.length]
      const a1 = a[axis], b1 = b[axis]
      if (a1 === b1) continue
      if ((a1 <= c && b1 > c) || (b1 <= c && a1 > c)) {
        const other = axis === 0 ? 1 : 0
        const x = a[other] + ((c - a1) / (b1 - a1)) * (b[other] - a[other])
        if (x < mn) mn = x
        if (x > mx) mx = x
      }
    }
    if (mn <= mx) out.push({ span: mx - mn, centre: (mn + mx) / 2 })
  }
  return out
}

function waistRatio(rows: { span: number }[]): number {
  const third = Math.floor(rows.length / 3)
  if (third < 1) return 1
  const midMin = Math.min(...rows.slice(third, rows.length - third).map((r) => r.span))
  const endMax = Math.max(
    ...rows.slice(0, third).map((r) => r.span),
    ...rows.slice(rows.length - third).map((r) => r.span),
  )
  return endMax > 0 ? midMin / endMax : 1
}

function shapeStructure(unit: Contour, calibration: CalibrationSpec): ShapeStructure {
  const pts = unit.outer.pts
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const rows = profile(pts, 1, minY, maxY)
  const cols = profile(pts, 0, minX, maxX)
  if (rows.length < 4 || cols.length < 4) return { kind: 'uniform', tall: true, narrowMass: true }
  // diagonal: the row centres drift linearly across the height
  const n = rows.length
  const ys = rows.map((_, i) => i / (n - 1))
  const cxs = rows.map((r) => r.centre)
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  const meanC = cxs.reduce((a, b) => a + b, 0) / n
  let cov = 0, varY = 0, varC = 0
  for (let i = 0; i < n; i++) {
    cov += (ys[i] - meanY) * (cxs[i] - meanC)
    varY += (ys[i] - meanY) ** 2
    varC += (cxs[i] - meanC) ** 2
  }
  const slope = varY > 0 ? cov / varY / (maxX - minX) : 0
  if (Math.abs(slope) > calibration.structureDiagSlope)
    return { kind: 'diagonal', sign: slope > 0 ? 1 : -1 }
  // tapered: width grows steadily toward the base
  const spans = rows.map((r) => r.span)
  const meanS = spans.reduce((a, b) => a + b, 0) / n
  let covS = 0, varS = 0
  for (let i = 0; i < n; i++) {
    covS += (ys[i] - meanY) * (spans[i] - meanS)
    varS += (spans[i] - meanS) ** 2
  }
  const taperCorr = varS > 0 ? covS / Math.sqrt(varY * varS) : 0
  if (taperCorr > calibration.structureTaperCorr) return { kind: 'tapered' }
  if (waistRatio(rows) < calibration.structureWaistRatio) return { kind: 'waistedY' }
  if (waistRatio(cols) < calibration.structureWaistRatio) return { kind: 'waistedX' }
  // the uniform split: a MILD waist marks the limbed standing mass (the bot, 0.68 — arms and
  // legs off a narrow torso: column hold); no waist at all marks the full blob (the poke,
  // 0.97: corner-square hold).
  return {
    kind: 'uniform',
    tall: maxY - minY >= maxX - minX,
    narrowMass: waistRatio(rows) < calibration.structureMassRatio,
  }
}

/** A FILLED BLOCK: the anchors are every combination of their distinct columns and rows —
 *  a pair-in-line, a rect, a square. A diagonal shares the box but not the block. */
function isFilledBlock(v: SizeVariant, halfPitchMM: number): boolean {
  const q = (n: number) => Math.round(n / halfPitchMM)
  const xs = new Set(v.anchors.map((a) => q(a.p[0])))
  const ys = new Set(v.anchors.map((a) => q(a.p[1])))
  if (xs.size * ys.size !== v.anchors.length) return false
  const have = new Set(v.anchors.map((a) => `${q(a.p[0])}:${q(a.p[1])}`))
  for (const x of xs) for (const y of ys) if (!have.has(`${x}:${y}`)) return false
  return true
}

/** How well an arrangement answers the shape's structure: 2 = spans/embodies it, 1 = aligned
 *  with its axis, 0 = neither. Compared before spread — the class outranks the spacing. */
function structureScore(
  v: SizeVariant,
  structure: ShapeStructure,
  basePitchMM: number,
): number {
  const xs = v.anchors.map((a) => a.p[0])
  const ys = v.anchors.map((a) => a.p[1])
  const extX = Math.max(...xs) - Math.min(...xs)
  const extY = Math.max(...ys) - Math.min(...ys)
  const half = basePitchMM / 2
  const n = v.anchors.length
  const eps = 1e-6
  if (structure.kind === 'diagonal') {
    if (n < 2) return 0
    // every anchor pair steps as far across as down — a diagonal line/chain of the lattice
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = v.anchors[j].p[0] - v.anchors[i].p[0]
        const dy = v.anchors[j].p[1] - v.anchors[i].p[1]
        if (Math.abs(Math.abs(dx) - Math.abs(dy)) > half) return 0
        if (Math.sign(dx * dy) !== (structure.sign > 0 ? 1 : -1)) return 0
      }
    return 2
  }
  if (structure.kind === 'tapered') {
    if (n === 3) {
      const sorted = [...v.anchors].sort((a, b) => a.p[1] - b.p[1])
      const topRow = v.anchors.filter((a) => Math.abs(a.p[1] - sorted[0].p[1]) < half).length
      const baseRow = v.anchors.filter((a) => Math.abs(a.p[1] - sorted[n - 1].p[1]) < half).length
      if (topRow === 1 && baseRow === 2) return 2
    }
    if (extX < half && extY > eps) return 1
    return 0
  }
  if (structure.kind === 'waistedY') {
    const rowsSpanned = extY >= 2 * basePitchMM - eps
    const midRowFree = !v.anchors.some(
      (a) => a.p[1] > Math.min(...ys) + half && a.p[1] < Math.max(...ys) - half,
    )
    if (n >= 2 && rowsSpanned && midRowFree) return 2
    if (extX < half && extY > eps) return 1
    return 0
  }
  if (structure.kind === 'waistedX') {
    const colsSpanned = extX >= 2 * basePitchMM - eps
    const midColFree = !v.anchors.some(
      (a) => a.p[0] > Math.min(...xs) + half && a.p[0] < Math.max(...xs) - half,
    )
    if (n >= 2 && colsSpanned && midColFree) return 2
    if (extY < half && extX > eps) return 1
    return 0
  }
  // uniform, narrow mass (the bot): the tight column/rect along the long axis — a FILLED
  // block only (the diagonal shares the narrow box but is no column).
  if (structure.narrowMass) {
    if (!isFilledBlock(v, half)) return 0
    if (structure.tall) return extX <= basePitchMM + eps && extY > eps ? 1 : 0
    return extY <= basePitchMM + eps && extX > eps ? 1 : 0
  }
  // uniform, full mass (the poke blob): the corner square, widest first; below four magnets
  // the pair follows the shape's own axis ("vertical for standing shapes" — canon B2).
  if (n >= 4 && extX >= 2 * basePitchMM - eps && extY >= 2 * basePitchMM - eps) return 2
  if (n >= 4) return 1
  if (!isFilledBlock(v, half)) return 0
  if (structure.tall) return extX < half && extY > eps ? 1 : 0
  return extY < half && extX > eps ? 1 : 0
}

function isCorners(v: SizeVariant, calibration: CalibrationSpec): boolean {
  if (v.anchors.length < 4) return false
  if (v.wrap.gridExtentXMM < 72 || v.wrap.gridExtentYMM < 72) return false
  if (v.wrap.maxSide > calibration.flapLimbMM) return false
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
  shapeSymmetric: boolean,
  structure: ShapeStructure,
  basePitchMM: number,
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
  // 1b. VERTICAL HOLD: the bottom may hang only as a limb (within the limb allowance) — a
  //     placement leaving more below the block ranks under everything that holds its material
  //     (the butterfly's sparse top pair left 86mm of lower wing unheld and still outranked
  //     the tight six on spread alone — that is the failure this bars).
  const holdsBottomA = a.wrap.bottom <= calibration.flapLimbMM
  const holdsBottomB = b.wrap.bottom <= calibration.flapLimbMM
  if (holdsBottomA !== holdsBottomB) return holdsBottomA
  // 1c. THE STRIP LAW (v1's own hold physics: rim pairs bond material only up to the sparse
  //     pitch — its coverage oracle bounds pair strips at 96mm): magnets spaced beyond it are
  //     disconnected islands, not an arrangement (the poke's 136mm corner-to-corner diagonal
  //     measured perfect bbox wraps while 301mm of edge hung unheld — eyes-on, 2026-08-15).
  const stripCapMM = Math.max(...LAUNCH_PITCHES_MM)
  const connectedA = a.anchors.length < 2 || (a.nearestAnchorMM ?? 0) <= stripCapMM + 1e-6
  const connectedB = b.anchors.length < 2 || (b.nearestAnchorMM ?? 0) <= stripCapMM + 1e-6
  if (connectedA !== connectedB) return connectedA
  // 1d. THE BAND COUNT LAW (canon walkthrough titles: "Band 1 · one magnet", "Band 2 · two
  //     magnets" — every ruled example; bands 3/4 are free, the structure decides there).
  if (band.targetMagnets > 0) {
    const offA = Math.abs(a.anchors.length - band.targetMagnets)
    const offB = Math.abs(b.anchors.length - band.targetMagnets)
    if (offA !== offB) return offA < offB
  }
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
  // 2b. THE SYMMETRY LAW: a mirror-symmetric shape (the bat, the bot, the butterfly) demands a
  //     mirror-symmetric arrangement — a diagonal pair breaks the figure's axis and ranks below.
  //     Asymmetric shapes (the duck, the tilted pill) take whatever seats best.
  if (shapeSymmetric) {
    const symA = anchorsAreMirrorSymmetric(a)
    const symB = anchorsAreMirrorSymmetric(b)
    if (symA !== symB) return symA
  }
  // 3. SPARSE SPREAD (Dan: "96mm is lawful sparse pair and actually preferred") — wider
  //    spacing wins; lifts the 96 spine over the crowded 48 family. Triangles live in this
  //    pool too: BALANCE below picks them only where the shape is genuinely three-cornered
  //    (Dan: "a T-shaped can act as triangle with 3 corners") — elsewhere the pair balances
  //    better and wins.
  // 2c. THE STRUCTURE LAW (Dan's ruled canon): the arrangement matching the shape's build wins —
  //     triangle on the tapered bat, waist-spanning corners on the duck/butterfly/poke, the
  //     narrow column on the standing bot, diagonal on the tilted pill. (A depth-based
  //     strong-region key was measured and rejected: canon-good and canon-bad seats carried
  //     identical depths.)
  const structA = structureScore(a, structure, basePitchMM)
  const structB = structureScore(b, structure, basePitchMM)
  if (structA !== structB) return structA > structB
  //    Spread credit CAPS at the released sparse pitch (Dan's law: 96 is the sparse spacing
  //    "proven sufficient" — not "the further the better"): an extreme diagonal pair flung
  //    corner-to-corner (135mm) must not outrank layouts that hold the mass (poke1 B4, eyes-on
  //    sweep 2026-08-15).
  const spreadCapMM = Math.max(...LAUNCH_PITCHES_MM)
  const spreadA = Math.min(a.nearestAnchorMM ?? 0, spreadCapMM)
  const spreadB = Math.min(b.nearestAnchorMM ?? 0, spreadCapMM)
  if (spreadA !== spreadB) return spreadA > spreadB
  // 3b. THE MASS AXIS (Dan, 2026-08-15: the pair must be "centered AND fit to shape" — and his
  //     centre is the FIGURE's axis, not the box the wings span). A seat aligned to the deepest
  //     material outranks one dragged toward an asymmetric wing. Coarse steps, like balance.
  //     CANONICAL REGISTRATION (GPT PRO v3.3 spec §6, adopted 2026-08-15): the centred seat is
  //     the first test — off-centre must WIN, never tie. Quarter-tight steps where the axis is
  //     EXACT (the mirror axis); the deepest-point axis of an asymmetric shape is a blob
  //     estimate — half-tight steps there, or its noise drags seats loose (the pill regressed
  //     82 -> 98 under uniform sharpness, measured).
  const axisStepMM = shapeSymmetric ? calibration.flapTightMM / 4 : calibration.flapTightMM / 2
  const axisA = Math.round((a.massAxisOffMM ?? 0) / axisStepMM)
  const axisB = Math.round((b.massAxisOffMM ?? 0) / axisStepMM)
  if (axisA !== axisB) return axisA < axisB
  // 4. THE BALANCE RULE outranks tightness (Dan 2026-08-14 and his 2026-08-10 brief: "what may
  //    seem logical on paper and mathematically correct may miss the law of balance and
  //    symmetry"). Flap balanced across sides, BOTH axes counted, before any tightness compare.
  //    TIGHT BEFORE EVEN (Dan, repeatedly: "could be tighter", "if tight option possible the
  //    engine makes space", "my B2 is 2 disks" — centred AND fit to shape): with centering
  //    enforced and the mass axis already holding the figure's line, the snug seat wins; evenness
  //    is the tiebreak, both in coarse steps so millimetre noise never decides.
  const tightStepMM = calibration.flapTightMM
  const tightA = Math.round(a.wrap.total / tightStepMM)
  const tightB = Math.round(b.wrap.total / tightStepMM)
  if (tightA !== tightB) return tightA < tightB
  const balanceStepMM = calibration.flapTightMM / 2
  const balA = Math.round(a.wrap.imbalanceSumMM / balanceStepMM)
  const balB = Math.round(b.wrap.imbalanceSumMM / balanceStepMM)
  if (balA !== balB) return balA < balB
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
  shapeSymmetric: boolean,
  unitMassX: number | null,
  offeredBelow: Set<string>,
  sizeFloorMM: number,
  structure: ShapeStructure,
): BandAnswer {
  const kept: SizeVariant[] = []
  const preparedBySize = new Map<number, ReturnType<typeof prepareExactContour>>()
  const preparedFor = (variant: SizeVariant) => {
    let prep = preparedBySize.get(variant.sizeMM)
    if (!prep) {
      prep = prepareExactContour(variant.effectContourMM)
      preparedBySize.set(variant.sizeMM, prep)
    }
    return prep
  }
  const consider = (variant: SizeVariant | null) => {
    if (!variant) return
    const prep = preparedFor(variant)
    let minDepth = Infinity
    for (const anchor of variant.anchors) {
      const d = distanceToPreparedContour(anchor.p, prep)
      if (d < minDepth) minDepth = d
    }
    variant.minDepthMM = Number.isFinite(minDepth) ? minDepth : 0
    if (unitMassX !== null && variant.anchors.length) {
      let sumX = 0
      for (const anchor of variant.anchors) sumX += anchor.p[0]
      variant.massAxisOffMM = Math.abs(sumX / variant.anchors.length - unitMassX * variant.sizeMM)
    }
    // ONE RECORD PER ARRANGEMENT — a band offers distinct layouts, each at its snug size,
    // never millimetre-step copies of the same one.
    const halfPitchMM = spec.grid.basePitchMM / 2
    const identity = layoutIdentity(variant, halfPitchMM)
    const twin = kept.findIndex((existing) => layoutIdentity(existing, halfPitchMM) === identity)
    if (twin >= 0) {
      if (better(variant, kept[twin], band, calibration, shapeSymmetric, structure, spec.grid.basePitchMM)) kept[twin] = variant
      return
    }
    kept.push(variant)
  }

  const step = calibration.sizeStepMM
  const sweep = calibration.sweepStepMM
  // EVERY released template is proposed in every band — no count-based pruning.
  const templates = calibration.templates
  // BAND SEPARATION (Dan, 2026-08-15): the band's candidates START one 24mm step above the
  // previous band's answer — bounding the search itself, so every layout family re-seats above
  // the floor instead of being collapsed to a below-floor snug seat and then filtered away.
  const startSizeMM = Math.max(band.minSizeMM, sizeFloorMM)
  for (
    let sizeMM = Math.ceil(startSizeMM / step) * step;
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

  kept.sort((a, b) => (better(a, b, band, calibration, shapeSymmetric, structure, spec.grid.basePitchMM) ? -1 : 1))
  // THE OFFER IS A VERDICT (Dan, 2026-08-15: "look how many results"): only variants that pass
  // every hold law are offered at all — top held, bottom hanging at most as a limb, and the
  // assembly on the shape's axis. The band then presents its few best, not the raw search.
  const stripCapMM = Math.max(...LAUNCH_PITCHES_MM)
  const lawful = kept.filter(
    (v) =>
      v.wrap.top <= calibration.flapMaxMM &&
      v.wrap.bottom <= calibration.flapLimbMM &&
      (v.anchors.length < 2 || (v.nearestAnchorMM ?? 0) <= stripCapMM + 1e-6) &&
      // eyes-on calibration sweep, 2026-08-15: every asymmetric arrangement on a symmetric
      // figure read wrong (bat diag pair off the face, L/T into the ear and wing edges,
      // butterfly cross-wing diagonals) — on a mirror shape they are not options at all
      (!shapeSymmetric || anchorsAreMirrorSymmetric(v)),
  )
  // ONE OFFER PER FOOTPRINT (the sparse law, operationalised — Dan: "96mm pair preferred and
  // proven sufficient"): variants whose padded blocks occupy the same box at the same size are
  // the same physical hold; the ranked-best (fewest magnets, by the sparse ordering above)
  // keeps the chip, the rest are redundant middles.
  const seen = new Set<string>()
  const offered: SizeVariant[] = []
  const half = spec.grid.basePitchMM / 2
  for (const v of lawful) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const anchor of v.anchors) {
      if (anchor.p[0] < minX) minX = anchor.p[0]
      if (anchor.p[0] > maxX) maxX = anchor.p[0]
      if (anchor.p[1] < minY) minY = anchor.p[1]
      if (anchor.p[1] > maxY) maxY = anchor.p[1]
    }
    const key = [v.sizeMM, Math.round(minX / half), Math.round(maxX / half), Math.round(minY / half), Math.round(maxY / half)].join(':')
    if (seen.has(key)) continue
    seen.add(key)
    offered.push(v)
  }
  // THE BAND-GIFT LAW, reverse clause (Dan's calibration sweep, 2026-08-15: the band-2 single
  // and band-3 48-pair were "not necessary" — each was a lower band's answer re-listed bigger
  // and looser): a band offers what its size range UNLOCKS. A non-default variant whose layout
  // already earned a chip in a lower band is an echo, not an option.
  const halfPitch = spec.grid.basePitchMM / 2
  // THE STEPPING LAW (canon band-4: "only the lattice step grows"): a stepped band may not
  // re-offer a lower band's arrangement at all — not even as its default. Other bands keep
  // their default exempt (the band's best answer stands even when a lower band shares it).
  const fresh = offered.filter(
    (v, i) =>
      (!band.stepUp && i === 0) || !offeredBelow.has(layoutIdentity(v, halfPitch)),
  )
  let final = fresh.slice(0, calibration.optionsPerBand)
  // EVERY BAND ANSWERS (Dan, 2026-08-15: "each band must have at least one optimal layout"):
  // when the offer filters empty a band, its ranked-best size-separated placement stands in —
  // an imperfect answer beats a silent band.
  if (!final.length && kept.length) final = [kept[0]]
  for (const v of final) offeredBelow.add(layoutIdentity(v, halfPitch))
  return { band, variants: final }
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
  const shapeSymmetric = contourIsMirrorSymmetric(unitContour, calibration.symmetryTolFrac)
  const structure = shapeStructure(unitContour, calibration)
  // THE AXIS (L13: "fitting and centering in the shape"): on a mirror-symmetric shape the mass
  // axis IS the mirror axis — the deepest blob may sit in a wing and would drag the assembly
  // off the figure (the butterfly single, Dan 2026-08-15 20:13).
  let massX: number | null = null
  if (shapeSymmetric) {
    let minX = Infinity
    let maxX = -Infinity
    for (const [x] of unitContour.outer.pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    massX = (minX + maxX) / 2
  } else {
    const massCentre = unitMassCentre(unitContour)
    massX = massCentre ? massCentre[0] : null
  }
  const offeredBelow = new Set<string>()
  const bands: BandAnswer[] = []
  let sizeFloorMM = 0
  for (const band of calibration.bands) {
    const answer = judgeBand(
      spec,
      calibration,
      band,
      unitContour,
      shapeSymmetric,
      massX,
      offeredBelow,
      sizeFloorMM,
      structure,
    )
    if (answer.variants[0]) sizeFloorMM = answer.variants[0].sizeMM + calibration.bandSizeStepMM
    bands.push(answer)
  }
  return { bands }
}
