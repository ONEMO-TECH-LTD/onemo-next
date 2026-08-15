// compute/structure.ts — pure shape/arrangement MEASURES for the judge. No product values, no
// thresholds, no classification: every function returns numbers or value-free predicates; the
// logic layer compares them against released calibration values. (Moved here from the judge —
// QA build-audit 2026-08-15: geometry belongs in compute/, the judge only ranks.)

import { prepareExactContour, distanceToPreparedContour, pointInPreparedContour } from './grid-prepared'
import type { Contour, Pt } from './types'

/** Scanline profile across one axis: per sample line, the outermost span and its centre. */
export function scanProfile(
  pts: ReadonlyArray<Pt>,
  axis: 0 | 1,
  lo: number,
  hi: number,
  samples: number,
): { span: number; centre: number }[] {
  const out: { span: number; centre: number }[] = []
  for (let i = 1; i < samples; i++) {
    const c = lo + ((hi - lo) * i) / samples
    let mn = Infinity
    let mx = -Infinity
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j]
      const b = pts[(j + 1) % pts.length]
      const a1 = a[axis]
      const b1 = b[axis]
      if (a1 === b1) continue
      if ((a1 <= c && b1 > c) || (b1 <= c && a1 > c)) {
        const other = axis === 0 ? 1 : 0
        const x = a[other] + ((c - a1) / (b1 - a1)) * (b[other] - a[other])
        if (x < mn) mn = x
        if (x > mx) mx = x
      }
    }
    if (mn <= mx) out.push({ span: mx - mn, centre: (mn + mx) / 2 })
  }
  return out
}

/** Sampled material area strictly above a horizontal line (y-down frame: y < yLine).
 *  All spans per scanline (paired crossings), not just the outermost — concave rows count
 *  their true material only. Pure measurement; the caller owns any bound. */
export function areaAboveLine(
  pts: ReadonlyArray<Pt>,
  yLine: number,
  samples: number,
): number {
  let minY = Infinity
  for (const p of pts) if (p[1] < minY) minY = p[1]
  if (!(yLine > minY) || samples < 1) return 0
  const dy = (yLine - minY) / samples
  let area = 0
  for (let i = 0; i < samples; i++) {
    const c = minY + (i + 0.5) * dy
    const xs: number[] = []
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j]
      const b = pts[(j + 1) % pts.length]
      if (a[1] === b[1]) continue
      if ((a[1] <= c && b[1] > c) || (b[1] <= c && a[1] > c)) {
        xs.push(a[0] + ((c - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
    }
    xs.sort((m, n) => m - n)
    for (let k = 0; k + 1 < xs.length; k += 2) area += (xs[k + 1] - xs[k]) * dy
  }
  return area
}

/** Middle-third minimum span over end-third maximum span — the waist measure. */
export function waistRatio(rows: ReadonlyArray<{ span: number }>): number {
  const third = Math.floor(rows.length / 3)
  if (third < 1) return 1
  const midMin = Math.min(...rows.slice(third, rows.length - third).map((r) => r.span))
  const endMax = Math.max(
    ...rows.slice(0, third).map((r) => r.span),
    ...rows.slice(rows.length - third).map((r) => r.span),
  )
  return endMax > 0 ? midMin / endMax : 1
}

export interface ShapeFeatures {
  /** Linear drift of row centres across the height, as a fraction of the width. */
  diagSlopeFrac: number
  /** Pearson correlation of row span with vertical position (+1 = widens downward). */
  taperCorr: number
  /** Waist ratios along each axis. */
  waistY: number
  waistX: number
  /** Worst row-centre deviation from the vertical axis, as a fraction of the width. */
  mirrorDeviationFrac: number
  tall: boolean
}

/** All scanline-derived shape features in one pass. Pure measurement — no thresholds. */
export function shapeFeatures(contour: Contour, samples: number): ShapeFeatures | null {
  const pts = contour.outer.pts
  if (pts.length < 3) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const width = maxX - minX
  if (!(width > 0)) return null
  const rows = scanProfile(pts, 1, minY, maxY, samples)
  const cols = scanProfile(pts, 0, minX, maxX, samples)
  if (rows.length < 4 || cols.length < 4) return null
  const n = rows.length
  const ys = rows.map((_, i) => i / (n - 1))
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  const cxs = rows.map((r) => r.centre)
  const meanC = cxs.reduce((a, b) => a + b, 0) / n
  let cov = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    cov += (ys[i] - meanY) * (cxs[i] - meanC)
    varY += (ys[i] - meanY) ** 2
  }
  const diagSlopeFrac = varY > 0 ? cov / varY / width : 0
  const spans = rows.map((r) => r.span)
  const meanS = spans.reduce((a, b) => a + b, 0) / n
  let covS = 0
  let varS = 0
  for (let i = 0; i < n; i++) {
    covS += (ys[i] - meanY) * (spans[i] - meanS)
    varS += (spans[i] - meanS) ** 2
  }
  const taperCorr = varS > 0 ? covS / Math.sqrt(varY * varS) : 0
  const cx = (minX + maxX) / 2
  let mirrorDeviationFrac = 0
  for (const r of rows) {
    const d = Math.abs(r.centre - cx) / width
    if (d > mirrorDeviationFrac) mirrorDeviationFrac = d
  }
  return {
    diagSlopeFrac,
    taperCorr,
    waistY: waistRatio(rows),
    waistX: waistRatio(cols),
    mirrorDeviationFrac,
    tall: maxY - minY >= width,
  }
}

/** The deepest-material point (sampled pole of inaccessibility) over an NxN field. */
export function deepestPointSampled(contour: Contour, samples: number): Pt | null {
  const prepared = prepareExactContour(contour)
  const bb = prepared.bbox
  let best: Pt | null = null
  let bestD = -Infinity
  for (let i = 1; i < samples; i++) {
    for (let j = 1; j < samples; j++) {
      const p: Pt = [
        bb.minX + ((bb.maxX - bb.minX) * i) / samples,
        bb.minY + ((bb.maxY - bb.minY) * j) / samples,
      ]
      if (!pointInPreparedContour(p, prepared)) continue
      const d = distanceToPreparedContour(p, prepared)
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
  }
  return best
}

/** Every point reflected about the set's own vertical centre lands on another point. */
export function pointsMirrorSymmetric(points: ReadonlyArray<Pt>): boolean {
  let minX = Infinity
  let maxX = -Infinity
  for (const [x] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  const cx = minX + (maxX - minX) / 2
  const tol = 1e-6
  return points.every(([x, y]) =>
    points.some(([bx, by]) => Math.abs(bx - (2 * cx - x)) < tol && Math.abs(by - y) < tol),
  )
}

/** The points are every combination of their distinct columns and rows — a filled block. */
export function pointsFillBlock(points: ReadonlyArray<Pt>, cellMM: number): boolean {
  const q = (n: number) => Math.round(n / cellMM)
  const xs = new Set(points.map(([x]) => q(x)))
  const ys = new Set(points.map(([, y]) => q(y)))
  if (xs.size * ys.size !== points.length) return false
  const have = new Set(points.map(([x, y]) => `${q(x)}:${q(y)}`))
  for (const x of xs) for (const y of ys) if (!have.has(`${x}:${y}`)) return false
  return true
}

/** Single-linkage connectivity: every point reaches every other through links <= capMM. */
export function pointsOneComponent(points: ReadonlyArray<Pt>, capMM: number): boolean {
  const n = points.length
  if (n < 2) return true
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = points[i]
      const b = points[j]
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= capMM + 1e-6) parent[find(i)] = find(j)
    }
  const root = find(0)
  for (let i = 1; i < n; i++) if (find(i) !== root) return false
  return true
}
