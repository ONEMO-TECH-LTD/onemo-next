// library/triangle-types.ts — THE PRODUCT TAXONOMY. What a person calls the shape they are
// looking at. Geometry (triangle-geometry.ts) is pure and stays out of naming; naming reads the
// PRESENTED view, because how a shape sits is what is being looked at, not how it is stored.

import type { TriangleGeometry } from './triangle-geometry'

/** Dan's own naming list (08-26), one word each. Peak / Wedge / Sail as a THREE-name grouping is
 *  retired vocabulary and must not reach the UI; 'wedge' and 'sail' survive as two of the ten.
 *
 *  Each name is his description made measurable on the presented view:
 *    Wedge     — a squared corner: the right angle stood on a level side and an upright side
 *    Needle    — symmetric on a level base, at least twice as tall as it is wide
 *    Arrowhead — symmetric on a level base, taller than wide
 *    Pyramid   — symmetric on a level base, exactly as wide as it is tall
 *    Mountain  — symmetric on a level base, wider than tall
 *    Pennant   — leaning, long and low
 *    Ramp      — leaning on a level base, wider than tall
 *    Sail      — leaning and taller than wide
 *    Fin       — leaning, anything else */
export type TriangleProductType =
  | 'wedge' | 'needle' | 'arrowhead' | 'pyramid' | 'mountain'
  | 'pennant' | 'ramp' | 'sail' | 'fin'

export const TRIANGLE_TYPES: TriangleProductType[] = [
  'pyramid', 'arrowhead', 'mountain', 'needle',
  'wedge', 'ramp', 'pennant', 'sail', 'fin',
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
/*  The proportion boundaries are RELATIONAL, not tuned numbers: wider / exactly square / taller /
 *  twice as tall. Earlier cut-offs of 0.8 and 1.25 were mine and arbitrary; the lattice only ever
 *  presents symmetric aspects of 0.25, 0.5, 0.75, 1, 1.5 and 2, so the words decide by themselves. */
export function triangleProductType(
  g: TriangleGeometry, shown: TriangleShown,
): TriangleProductType {
  if (g.angleClass === 'right' && shown.level && shown.upright) return 'wedge'
  const w = Math.max(1, shown.cols - 1), h = Math.max(1, shown.rows - 1), a = h / w
  if (g.sideClass === 'isosceles') {
    // 08-26 Dan, on the tilted symmetric shapes: "remove slice it is same as basic triangles
    // just turned". Every one of them is retired from the product, so this branch is not
    // reachable from the active catalogue; a symmetric shape that cannot stand flat reads as a
    // leaning shape, and the per-member sweep fires loudly if one is ever made active again.
    if (!shown.level) return 'fin'
    return a >= 2 ? 'needle' : a > 1 ? 'arrowhead' : a === 1 ? 'pyramid' : 'mountain'
  }
  if (a <= 0.5) return 'pennant'
  if (a > 1) return 'sail'
  return shown.level && a < 1 ? 'ramp' : 'fin'
}
