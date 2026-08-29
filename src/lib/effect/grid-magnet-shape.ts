// grid-magnet-shape.ts — THE SHAPE OWNER: a normalized contour, a size, and a stable identity.
//
// One job in three functions that were living in two different retiring aggregates: scale the
// stored unit contour to a real size, apply the outline offset, and key the result so a cache
// cannot confuse two shapes. Both the pipeline and the display adapter need exactly this, which is
// why it earns a home rather than being passed around as a closure.
//
// It exists because the pipeline's door must be DATA. A request carrying a `(mm) => Contour`
// function cannot be serialised, cannot cross a worker boundary as a value, and cannot be compared
// or replayed — so the door takes the base contour and the offset, and builds the sizer here.

import { insetRingMM } from './offset'
import type { Contour, Pt } from './types'

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  const scale = (pts: ReadonlyArray<Pt>): Pt[] => pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt)
  // Every supplied ring scales. Returning holes: [] here silently deleted a donut's hole.
  return { outer: { pts: scale(base.outer.pts) }, holes: base.holes.map((h) => ({ pts: scale(h.pts) })) }
}

/** Sizer for one base contour: real-mm contour at any longest side, outline offset applied. */
export function makeSizer(base: Contour, offsetMM: number): (mm: number) => Contour {
  return (mm: number): Contour => {
    const c = scaleContour(base, mm)
    if (!offsetMM) return c
    const o = insetRingMM(c.outer.pts, offsetMM, 'round')
    // A positive offset grows the outline and SHRINKS every hole by the same amount — a hole is a
    // boundary, so an inset moves it inward from the material's point of view.
    const holes = c.holes.map((h) => insetRingMM(h.pts, -offsetMM, 'round')).filter((h): h is Pt[] => !!h && h.length >= 3)
    return o && o.length >= 3 ? { outer: { pts: o }, holes: holes.map((pts) => ({ pts })) } : c
  }
}

/** Cache identity for a prepared shape: the exact rings and the offset, not a summary of them.
 *  A hash of ring counts collides — two different hole positions keyed the same and returned the
 *  wrong cached sizer. */
export function contourCacheKey(base: Contour, offsetMM: number): string {
  return JSON.stringify([
    offsetMM,
    base.outer.pts,
    base.holes.map((hole) => hole.pts),
  ])
}
