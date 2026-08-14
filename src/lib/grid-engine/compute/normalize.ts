// compute/normalize.ts — the one normalization the bench performed before the v1 engine (grid-lab
// page.tsx normBase, session 59): re-express any mm contour so its longest bounding-box side is
// exactly 1, aspect locked, origin at the bbox corner. The engine's uniform-contour recipes scale
// this unit contour back to real millimetres. Pure arithmetic; no values, no policy.

import type { Contour, Pt } from './types'

export function normalizeContour(contour: Contour): Contour | null {
  if (contour.outer.pts.length < 3) return null
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const [x, y] of contour.outer.pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const longest = Math.max(maxX - minX, maxY - minY)
  if (!(longest > 0)) return null
  const ring = (pts: ReadonlyArray<Pt>): Pt[] =>
    pts.map(([x, y]) => [(x - minX) / longest, (y - minY) / longest] as Pt)
  return {
    outer: { pts: ring(contour.outer.pts) },
    holes: contour.holes.map((hole) => ({ pts: ring(hole.pts) })),
  }
}
