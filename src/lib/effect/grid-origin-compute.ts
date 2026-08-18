// grid-origin-compute.ts — COMPUTE: all geometry, formulas and arithmetic. No policy, no values
// of its own (they arrive from spec or the caller), no product words beyond the shared vocabulary.

import type { Contour, Pt } from './types'
import { pointInPolygon } from './attachment'
// The exact predicate — integer arithmetic, tangency legal by equality. The offset-polygon erosion
// it replaced was approximate: at ZERO margin (a 24mm shape whose only legal centre is exactly
// tangent) the shrunken polygon collapses and a lawful answer is refused. holds() cannot lose it.
import { holds, prepare } from '@/lib/grid-engine/compute/geometry'
import { FIELD_POSITIONS_PER_AXIS } from './grid-origin-spec'

export type GridPattern = 'standard' | 'quincunx' | 'granular'

export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

export function dist(a: Pt, b: Pt): number { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

/**
 * The spot — the padding IS its radius, measured FROM THE MAGNET CENTRE (grid law 2.1). The magnet
 * body sits inside it; the body's radius bounds how small the padding may go, never adds to it.
 */
export function spotRadiusOf(padMM: number): number {
  return padMM
}

/** The full field's span — the steps across plus one spot either side. 408 at 48/12. */
export function fieldSpanMM(pitchMM: number, padMM: number): number {
  return (FIELD_POSITIONS_PER_AXIS - 1) * pitchMM + 2 * spotRadiusOf(padMM)
}

/** Node positions along an axis at fixed `step` with a phase offset, spanning [min, max]. */
function axisFrom(min: number, max: number, step: number, phase: number): number[] {
  if (step <= 0 || max <= min) return [(min + max) / 2]
  const res: number[] = []
  let x = min + (((phase % step) + step) % step)
  while (x - step >= min - 1e-6) x -= step
  for (; x <= max + 1e-6; x += step) if (x >= min - 1e-6) res.push(x)
  return res
}

/** Lattice across a region at PHASE (ox, oy). Pattern is a parity variant of the half-pitch atom. */
export function latticeAt(bb: BBox, pitch: number, pattern: GridPattern, ox: number, oy: number): Pt[] {
  const atom = pitch / 2
  const out: Pt[] = []
  const cross = (xs: number[], ys: number[]) => { for (const x of xs) for (const y of ys) out.push([x, y]) }
  if (pattern === 'granular') {
    cross(axisFrom(bb.minX, bb.maxX, atom, ox), axisFrom(bb.minY, bb.maxY, atom, oy))
  } else if (pattern === 'quincunx') {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox + pitch / 2), axisFrom(bb.minY, bb.maxY, pitch, oy + pitch / 2))
  } else {
    cross(axisFrom(bb.minX, bb.maxX, pitch, ox), axisFrom(bb.minY, bb.maxY, pitch, oy))
  }
  const seen = new Set<string>(); const uniq: Pt[] = []
  for (const p of out) { const k = p[0].toFixed(2) + ',' + p[1].toFixed(2); if (!seen.has(k)) { seen.add(k); uniq.push(p) } }
  return uniq
}

/** The field over any region on a given phase — the same generator the search itself uses. */
export function latticeOver(
  region: BBox,
  pitch: number,
  pattern: GridPattern,
  phase: Pt,
): Pt[] {
  return latticeAt(region, pitch, pattern, phase[0], phase[1])
}

/**
 * The seat predicate for one outline: is a centre at least `spotRadiusMM` from every boundary
 * point, tangency passing by equality. Quantized to microns for exact integer arithmetic. Returns
 * null for a degenerate outline — the caller refuses loudly rather than guessing.
 */
export function makeSeatPredicate(
  outer: ReadonlyArray<Pt>,
  spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  let prep: ReturnType<typeof prepare>
  try { prep = prepare(outer, QUANTUM) } catch { return null }
  const rQ = Math.round(spotRadiusMM / QUANTUM)
  return (pt: Pt) => holds(prep, [Math.round(pt[0] / QUANTUM), Math.round(pt[1] / QUANTUM)], rQ)
}

/** Silhouette vertices further than `reach` from the nearest magnet (uncovered/flap-risk edge). */
export function flapVerts(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): Pt[] {
  const out: Pt[] = []
  for (const v of outer) {
    let nd = Infinity
    for (const a of seated) { const d = dist(v, a); if (d < nd) nd = d }
    if (nd > reach) out.push(v)
  }
  return out
}

/** Perimeter split: a node is INTERIOR when it has seated neighbours on all four sides. */
export function splitPerimeter(seated: ReadonlyArray<Pt>, step: number): { belt: Pt[]; interior: Pt[] } {
  const R = step * 1.45
  const belt: Pt[] = [], interior: Pt[] = []
  for (let i = 0; i < seated.length; i++) {
    const p = seated[i]
    let l = false, r = false, u = false, d = false
    for (let j = 0; j < seated.length; j++) {
      if (j === i) continue
      const dx = seated[j][0] - p[0], dy = seated[j][1] - p[1]
      if (Math.hypot(dx, dy) > R) continue
      if (dx > 1) r = true; else if (dx < -1) l = true
      if (dy > 1) u = true; else if (dy < -1) d = true
    }
    if (l && r && u && d) interior.push(p); else belt.push(p)
  }
  return { belt, interior }
}

/** Neighbour distance for the belt test, by pattern. */
export function neighbourStep(pitch: number, pattern: GridPattern): number {
  return pattern === 'granular' ? pitch / 2 : pattern === 'quincunx' ? pitch / Math.SQRT2 : pitch
}

/**
 * GAPS: lattice slots with material under them that couldn't seat (padding blocked) yet are
 * flanked by ≥2 seated neighbours — an unbalanced hole.
 */
export function countGaps(
  outer: ReadonlyArray<Pt>,
  lattice: ReadonlyArray<Pt>,
  seated: ReadonlyArray<Pt>,
  pitch: number,
): number {
  if (!seated.length) return 0
  const seatKeys = new Set(seated.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)))
  const nR = pitch * 1.2
  let gaps = 0
  for (const n of lattice) {
    if (seatKeys.has(n[0].toFixed(1) + ',' + n[1].toFixed(1))) continue
    if (!pointInPolygon(n, outer)) continue // no material → not a gap
    let nb = 0
    for (const s of seated) if (dist(n, s) <= nR) nb++
    if (nb >= 2) gaps++
  }
  return gaps
}

/** Scale a normalized contour (longest side = 1mm) to a real longest-side size in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}
