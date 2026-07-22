// Shared polygon containment primitives for the pure-mm effect engines.

import type { Contour, Pt } from './types'

/** Ray-casting point-in-polygon (even-odd rule). Ring has no duplicated closing point. */
export function pointInPolygon(p: Pt, ring: ReadonlyArray<Pt>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = (yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Material containment: inside the outer ring and outside every cut-out/hole. */
export function pointInContour(p: Pt, contour: Contour): boolean {
  return pointInPolygon(p, contour.outer.pts)
    && !contour.holes.some((hole) => pointInPolygon(p, hole.pts))
}
