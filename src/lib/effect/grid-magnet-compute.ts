// grid-magnet-compute.ts — COMPUTE: geometry and arithmetic. Values come from spec or the caller.

import type { Contour, Pt } from './types'
import { edgeDistMM } from './foundation/geometry'

// Moved to foundation/geometry.ts (S2 step 1). Re-exported so no consumer changes in the move.
export { bbox } from './foundation/geometry'
export { makeSeatPredicate, makeCircleSeatPredicate } from './units/layout'
export { spotRadiusOf, fieldSpanMM, latticeAt, latticeOver } from './units/layout'
export { centroidOf } from './units/centring'

// Moved to units/segment.ts (S2). Re-exported so every existing consumer is untouched by the move;
// callers are repointed at the unit in a later commit, not this one.
export type { SafeMass, SafeSegment } from './types'
// Moved to units/segment.ts (S2 step 2). Re-exported so no consumer changes in the move.
export { safeSegments } from './units/segment'

export type { BBox } from './types'


/** Where discs actually touch: for each seated disc within `slackMM` of its margined edge,
 *  the nearest point on the outline — drawn so tangency is visible, never guessed. */
export function contactPointsMM(
  outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number, slackMM: number,
): Pt[] {
  const out: Pt[] = []
  for (const s of seated) {
    if (edgeDistMM(outer, s) - reach > slackMM) continue
    // nearest outline point: brute over segments (few contacts per solve — cost immaterial)
    let best: Pt = outer[0], bd = Infinity
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const [ax, ay] = outer[j], [bx, by] = outer[i]
      const dx = bx - ax, dy = by - ay
      const len2 = dx * dx + dy * dy
      let t = len2 > 0 ? ((s[0] - ax) * dx + (s[1] - ay) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const px = ax + t * dx, py = ay + t * dy
      const d = Math.hypot(s[0] - px, s[1] - py)
      if (d < bd) { bd = d; best = [px, py] }
    }
    out.push(best)
  }
  return out
}

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  const scale = (pts: ReadonlyArray<Pt>): Pt[] => pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt)
  // Every supplied ring scales. Returning holes: [] here silently deleted a donut's hole.
  return { outer: { pts: scale(base.outer.pts) }, holes: base.holes.map((h) => ({ pts: scale(h.pts) })) }
}
