// library/triangle-types.ts — THE PRODUCT TAXONOMY. What a person calls the shape they are
// looking at. Geometry (triangle-geometry.ts) is pure and stays out of naming; naming reads the
// PRESENTED view, because how a shape sits is what is being looked at, not how it is stored.

import type { TriangleGeometry } from './triangle-geometry'

/** Dan's own naming list (08-26), one word each. The retired three-name grouping must not reach
 *  the UI; current product labels are defined below.
 *
 *  Each name is his description made measurable on the presented view:
 *    Wedge     — a squared corner: the right angle stood on a level side and an upright side
 *    Needle    — symmetric on a level base, at least twice as tall as it is wide
 *    Arrowhead — symmetric on a level base, taller than wide
 *    Pyramid   — symmetric on a level base, exactly as wide as it is tall
 *    Mountain  — symmetric on a level base, wider than tall
 *    Flag      — leaning: no two sides equal, so it points off to one side
 *
 *  The retired leaning labels were four names for one family, split by proportion. A
 *  proportion is a number, not a thing anyone recognises, so the same shape read as a Ramp at
 *  one size and a Fin at another, and each tab collected whatever splinters fell in its band.
 *  Dan, 08-26: "remove ramp penant sail and fin ... these must go in one tab flag". */
export type TriangleProductType =
  | 'wedge' | 'needle' | 'arrowhead' | 'pyramid' | 'mountain' | 'flag'

export const TRIANGLE_TYPES: TriangleProductType[] = [
  'pyramid', 'arrowhead', 'mountain', 'needle', 'wedge', 'flag',
]

/** How a shape sits, measured on the view it is presented in. */
export interface TriangleShown {
  cols: number
  rows: number
  /** has a horizontal side */
  level: boolean
  /** has a vertical side */
  upright: boolean
}

/** A WEDGE IS A SQUARED CORNER, equal legs or not. What decides is HOW the right angle is
 *  presented, not the angle alone: standing on a level side with an upright side beside it, the
 *  corner is the whole shape. Resting on its hypotenuse, the same triangle's right angle sits up
 *  at the apex where nobody reads it as a corner — that is a Mountain.
 *
 *  I narrowed this to equal legs earlier today, which sent the unequal-legged squared corners
 *  into Ramp and Pennant. Dan, looking at the rendered shapes: "ramp has wedge option" and, of
 *  the 159x79 corner sitting under Pennant, "how is the first pennant?". Both are squared
 *  corners and both belong here. His earlier "2x3 is not wedge" was read off a CHIP LABEL — he
 *  had a 3x4 selected and never saw either shape — and that label is now the size in mm. */
/*  The symmetric proportions are RELATIONAL, not tuned numbers: wider / exactly square / taller /
 *  twice as tall. Earlier cut-offs of 0.8 and 1.25 were mine and arbitrary; the lattice only ever
 *  presents symmetric aspects of 0.25, 0.5, 0.75, 1, 1.5 and 2, so the words decide by themselves.
 *  Nothing splits the leaning family by proportion any more — that was the invention. */
export function triangleProductType(
  g: TriangleGeometry, shown: TriangleShown,
): TriangleProductType {
  if (g.angleClass === 'right' && shown.level && shown.upright) return 'wedge'
  if (g.sideClass === 'isosceles') {
    const w = Math.max(1, shown.cols - 1), h = Math.max(1, shown.rows - 1), a = h / w
    // 08-26 Dan, on the tilted symmetric shapes: "remove slice it is same as basic triangles
    // just turned". Every one of them is retired from the product, so this branch is not
    // reachable from the active catalogue; a symmetric shape that cannot stand flat reads as a
    // leaning shape, and the per-member sweep fires loudly if one is ever made active again.
    if (!shown.level) return 'flag'
    return a >= 2 ? 'needle' : a > 1 ? 'arrowhead' : a === 1 ? 'pyramid' : 'mountain'
  }
  return 'flag'
}
