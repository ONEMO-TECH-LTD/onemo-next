// Neutral seat/lattice measurements. No product law or candidate selection.

import type { BBox, Contour, Pt } from '../spec'

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

/** Axis positions at `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across a region at phase (ox, oy). */
export function latticeAt(bb: BBox, pitch: number, ox: number, oy: number): Pt[] {
  const out: Pt[] = []
  for (const x of axisFrom(bb.minX, bb.maxX, pitch, ox))
    for (const y of axisFrom(bb.minY, bb.maxY, pitch, oy)) out.push([x, y])
  return out
}

/** The same lattice generator over an arbitrary region. */
export function latticeOver(region: BBox, pitch: number, phase: Pt): Pt[] {
  return latticeAt(region, pitch, phase[0], phase[1])
}

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}

const mod = (value: number, pitch: number) => ((value % pitch) + pitch) % pitch

export function parityPhases(target: Pt, bounds: BBox, pitch: number, xBand: number, yBand: number): ReadonlyArray<{
  phaseMM: Pt
  canonAxes: 0 | 1 | 2
  xRelation: 'node' | 'gap'
  yRelation: 'node' | 'gap'
}> {
  const xBase = target[0] - bounds.minX
  const yBase = target[1] - bounds.minY
  const half = pitch / 2
  const xNode = xBand % 2 === 1
  const yNode = yBand % 2 === 1
  const xCanonical = xNode ? xBase : xBase + half
  const yCanonical = yNode ? yBase : yBase + half
  const xOther = xNode ? xBase + half : xBase
  const yOther = yNode ? yBase + half : yBase
  return [
    { phaseMM: [mod(xCanonical, pitch), mod(yCanonical, pitch)], canonAxes: 2, xRelation: xNode ? 'node' : 'gap', yRelation: yNode ? 'node' : 'gap' },
    { phaseMM: [mod(xOther, pitch), mod(yCanonical, pitch)], canonAxes: 1, xRelation: xNode ? 'gap' : 'node', yRelation: yNode ? 'node' : 'gap' },
    { phaseMM: [mod(xCanonical, pitch), mod(yOther, pitch)], canonAxes: 1, xRelation: xNode ? 'node' : 'gap', yRelation: yNode ? 'gap' : 'node' },
    { phaseMM: [mod(xOther, pitch), mod(yOther, pitch)], canonAxes: 0, xRelation: xNode ? 'gap' : 'node', yRelation: yNode ? 'gap' : 'node' },
  ]
}
