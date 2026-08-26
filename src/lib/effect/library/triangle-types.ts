// library/triangle-types.ts — THE PRODUCT TAXONOMY. What a person calls the shape they are
// looking at. Geometry (triangle-geometry.ts) is pure and stays out of naming; naming reads the
// PRESENTED view, because how a shape sits is what is being looked at, not how it is stored.

import type { TriangleGeometry } from './triangle-geometry'

/** Dan's own naming list (08-26), one word each. Peak / Wedge / Sail as a THREE-name grouping is
 *  retired vocabulary and must not reach the UI; 'wedge' and 'sail' survive as two of the ten.
 *
 *  Each name is his description made measurable on the presented view:
 *    Wedge     — the balanced squared corner: equal legs on a level side and an upright side
 *    Needle    — symmetric on a level base, at least twice as tall as it is wide
 *    Arrowhead — symmetric on a level base, taller than wide
 *    Pyramid   — symmetric on a level base, exactly as wide as it is tall
 *    Mountain  — symmetric on a level base, wider than tall
 *    Slice     — symmetric with no level side to stand on
 *    Pennant   — leaning, long and low
 *    Ramp      — leaning on a level base, wider than tall
 *    Sail      — leaning and taller than wide
 *    Fin       — leaning, anything else */
export type TriangleProductType =
  | 'wedge' | 'needle' | 'arrowhead' | 'pyramid' | 'mountain'
  | 'slice' | 'pennant' | 'ramp' | 'sail' | 'fin'

export const TRIANGLE_TYPES: TriangleProductType[] = [
  'pyramid', 'arrowhead', 'mountain', 'needle', 'slice',
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

/** WHY A RIGHT ANGLE ALONE DOES NOT MAKE A WEDGE. Dan ruled the 2x2 a Wedge and rejected both
 *  2x3s from that tab, and a right angle alone cannot tell them apart. Two things do:
 *
 *  HOW the right angle is presented — the 2x2 stands on a level side with an upright side
 *  beside it, so the squared corner is what you see. The isosceles 2x3 rests on its hypotenuse
 *  and its right angle sits up at the apex, where it reads as a mountain, not a corner.
 *
 *  WHETHER THE LEGS ARE EQUAL — the scalene 2x3 also stands on level and upright sides, but its
 *  legs differ, so it reads as a long low shape with a squared end, not as the balanced corner
 *  Dan accepted. A Wedge is the BALANCED squared corner; every other right angle is incidental
 *  and the shape is named by its silhouette like any other. */
/*  The proportion boundaries are RELATIONAL, not tuned numbers: wider / exactly square / taller /
 *  twice as tall. Earlier cut-offs of 0.8 and 1.25 were mine and arbitrary; the lattice only ever
 *  presents symmetric aspects of 0.25, 0.5, 0.75, 1, 1.5 and 2, so the words decide by themselves. */
export function triangleProductType(
  g: TriangleGeometry, shown: TriangleShown,
): TriangleProductType {
  if (g.angleClass === 'right' && g.sideClass === 'isosceles' && shown.level && shown.upright) return 'wedge'
  const w = Math.max(1, shown.cols - 1), h = Math.max(1, shown.rows - 1), a = h / w
  if (g.sideClass === 'isosceles') {
    if (!shown.level) return 'slice'
    return a >= 2 ? 'needle' : a > 1 ? 'arrowhead' : a === 1 ? 'pyramid' : 'mountain'
  }
  if (a <= 0.5) return 'pennant'
  if (a > 1) return 'sail'
  return shown.level && a < 1 ? 'ramp' : 'fin'
}
