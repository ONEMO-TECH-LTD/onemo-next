// grid-magnet-class.ts — COMPUTE: what the shape IS, before anything is placed.
//
// Canon step 2 (Compute System §4): each bounding-box axis is classified independently, and the
// band is the larger of the two classes. The axis PAIR is the classification — "tall B3" is not
// one thing: a 1x3 holds a column of three and a 2x3 holds six with a mid row to skip.
//
// The frame that pair implies (canon §5) is the candidate node structure — CAPACITY, never a
// compulsory layout. Which of its nodes the material actually supports is a later question.

import type { Pt } from './types'

// Moved to units/classifier.ts and types.ts (S2 step 3). Re-exported so no consumer changes.
export { axisClassOf, classifyShape, classFloorMM, frameNodes, classFrameNodes } from './units/classifier'
export type { AxisClass, FrameKind, ShapeClass } from './types'
import { bbox } from './grid-magnet-compute'

/** The three primitive families (Dan, 08-24 23:26): SQUARE and its rectangles fill the frame;
 *  ROUND are their rounded versions — square counts, corner padding; TRIANGLE (triangle,
 *  diamond = double triangle, T, L, waisted) populate the frame PARTIALLY. */
export type ShapeFamily = 'square' | 'round' | 'triangle'

/**
 * Family from the material: fill ratio separates triangle (partial box) from full box; corner
 * occupancy separates square (material reaches its corners) from round (corners are padding).
 * Measured on the exemplars 08-24: triangle family fills ~50-65% of its box, square/round 70%+.
 */
export function shapeFamilyOf(outer: ReadonlyArray<Pt>): ShapeFamily {
  const bb = bbox(outer)
  const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY
  const boxA = Math.max(1e-9, w * h)
  let a2 = 0
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++)
    a2 += outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1]
  const fill = Math.abs(a2 / 2) / boxA
  if (fill < 0.68) return 'triangle'
  // corner occupancy: sample the four bbox corner cells for material
  const inside = (px: number, py: number): boolean => {
    let hit = false
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const xi = outer[i][0], yi = outer[i][1], xj = outer[j][0], yj = outer[j][1]
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  const dx = w * 0.08, dy = h * 0.08
  const corners = [
    [bb.minX + dx, bb.minY + dy], [bb.maxX - dx, bb.minY + dy],
    [bb.minX + dx, bb.maxY - dy], [bb.maxX - dx, bb.maxY - dy],
  ].filter(([x, y]) => inside(x, y)).length
  return corners >= 3 ? 'square' : 'round'
}
