// compute/wrap.ts — pure wrap/flap measurements over the verbatim engine's outputs.
//
// Dan's flap law (2026-08-11, verbatim): "the flap is calculated from the edge of the grid
// bounding box to the outer edges of the shape cutout" and success is "no flap zones greater than
// 12-24mm on any side"; balance is "flap evened out on all sides". These functions MEASURE those
// quantities exactly — per-side overhang of the shape beyond the padded magnet bounding box, and
// its evenness. They judge nothing; the logic layer compares the numbers against released values.

import type { Contour, Pt } from './types'

export interface WrapMeasures {
  /** Overhang of the shape beyond the padded magnet box, per side, millimetres. */
  left: number
  right: number
  top: number
  bottom: number
  /** Largest single-side overhang. */
  maxSide: number
  /** Sum of all four overhangs — the tightness number (smaller = tighter wrap). */
  total: number
  /** Largest pairwise imbalance (|left−right|, |top−bottom|) — the worst-axis evenness. */
  imbalance: number
  /** BOTH axes' imbalance summed — the evenness the judge orders by. The worst-axis number
   *  alone masked the other axis: every same-size placement shared one axis's imbalance, so
   *  a centred and an off-centre seat scored identically (Dan's bat pair, 2026-08-14). */
  imbalanceSumMM: number
}

function bbox(pts: ReadonlyArray<Pt>) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, maxX, minY, maxY }
}

/** Per-side overhang of the shape's outline beyond the anchors' padded box. */
export function measureWrap(
  contour: Contour,
  anchors: ReadonlyArray<Pt>,
  paddingMM: number,
): WrapMeasures | null {
  if (!anchors.length || contour.outer.pts.length < 3) return null
  const shape = bbox(contour.outer.pts)
  const grid = bbox(anchors as Pt[])
  const left = Math.max(0, grid.minX - paddingMM - shape.minX)
  const right = Math.max(0, shape.maxX - (grid.maxX + paddingMM))
  const top = Math.max(0, grid.minY - paddingMM - shape.minY)
  const bottom = Math.max(0, shape.maxY - (grid.maxY + paddingMM))
  return {
    left,
    right,
    top,
    bottom,
    maxSide: Math.max(left, right, top, bottom),
    total: left + right + top + bottom,
    imbalance: Math.max(Math.abs(left - right), Math.abs(top - bottom)),
    imbalanceSumMM: Math.abs(left - right) + Math.abs(top - bottom),
  }
}

/** Rigid translation of a contour — how the judge sweeps grid placements: under the rigid-lattice
 *  law, shifting the SHAPE by (dx, dy) is exactly the grid panned by (−dx, −dy). */
export function translateContour(contour: Contour, dx: number, dy: number): Contour {
  const ring = (pts: ReadonlyArray<Pt>): Pt[] => pts.map(([x, y]) => [x + dx, y + dy] as Pt)
  return {
    outer: { pts: ring(contour.outer.pts) },
    holes: contour.holes.map((hole) => ({ pts: ring(hole.pts) })),
  }
}
