// Disc-fit only. Sites arrive from magnetsInRegion. No lattice of our own.

import type { PointMM } from './engine'
import type { GridSpec } from './spec'

export interface PreparedOutline {
  verts: Array<{ x: bigint; y: bigint }>
  minX: bigint
  maxX: bigint
  minY: bigint
  maxY: bigint
}

function toUm(mm: number): bigint {
  return BigInt(Math.round(mm * 1000))
}

export function prepareOutline(verts: ReadonlyArray<PointMM>): PreparedOutline {
  const out: Array<{ x: bigint; y: bigint }> = []
  for (const [x, y] of verts) {
    const p = { x: toUm(x), y: toUm(y) }
    const last = out[out.length - 1]
    if (last && last.x === p.x && last.y === p.y) continue
    out.push(p)
  }
  if (out.length > 1 && out[0].x === out[out.length - 1].x && out[0].y === out[out.length - 1].y) {
    out.pop()
  }
  if (out.length < 3) throw new Error('outline needs three vertices')
  let minX = out[0].x
  let maxX = out[0].x
  let minY = out[0].y
  let maxY = out[0].y
  for (const v of out) {
    if (v.x < minX) minX = v.x
    if (v.x > maxX) maxX = v.x
    if (v.y < minY) minY = v.y
    if (v.y > maxY) maxY = v.y
  }
  return { verts: out, minX, maxX, minY, maxY }
}

/** Strict interior via even-odd. Boundary centres fail the disc test (r > 0). */
function interior(p: PreparedOutline, qx: bigint, qy: bigint): boolean {
  let inside = false
  const vs = p.verts
  const n = vs.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = vs[i].y
    const yj = vs[j].y
    const xi = vs[i].x
    const xj = vs[j].x
    const cross = (yi > qy) !== (yj > qy)
    if (!cross) continue
    const den = yj - yi
    // x < (xj-xi)*(qy-yi)/den + xi
    const lhs = (qx - xi) * den
    const rhs = (xj - xi) * (qy - yi)
    if (den > 0n ? lhs < rhs : lhs > rhs) inside = !inside
  }
  return inside
}

function dist2Seg(qx: bigint, qy: bigint, ax: bigint, ay: bigint, bx: bigint, by: bigint): bigint {
  const vx = bx - ax
  const vy = by - ay
  const wx = qx - ax
  const wy = qy - ay
  const L = vx * vx + vy * vy
  if (L === 0n) return wx * wx + wy * wy
  const h = wx * vx + wy * vy
  if (h <= 0n) return wx * wx + wy * wy
  if (h >= L) {
    const dx = qx - bx
    const dy = qy - by
    return dx * dx + dy * dy
  }
  const cross = vx * wy - vy * wx
  return (cross * cross) / L
}

function minDist2(p: PreparedOutline, qx: bigint, qy: bigint): bigint {
  let best: bigint | null = null
  const vs = p.verts
  const n = vs.length
  for (let i = 0; i < n; i++) {
    const a = vs[i]
    const b = vs[(i + 1) % n]
    const d = dist2Seg(qx, qy, a.x, a.y, b.x, b.y)
    if (best === null || d < best) best = d
  }
  return best ?? 0n
}

/** Full disc fits: centre interior and boundary distance ≥ radius. Equality passes. */
export function discFits(prep: PreparedOutline, center: PointMM, radiusMM: number): boolean {
  const qx = toUm(center[0])
  const qy = toUm(center[1])
  if (!interior(prep, qx, qy)) return false
  const r = toUm(radiusMM)
  return minDist2(prep, qx, qy) >= r * r
}

export function discFitsGrid(prep: PreparedOutline, center: PointMM, grid: GridSpec): boolean {
  return discFits(prep, center, grid.paddingMM)
}

export function bboxCenter(prep: PreparedOutline): PointMM {
  return [Number(prep.minX + prep.maxX) / 2000, Number(prep.minY + prep.maxY) / 2000]
}

export function centroidMM(prep: PreparedOutline): PointMM {
  let twice = 0n
  let cx6 = 0n
  let cy6 = 0n
  const vs = prep.verts
  const n = vs.length
  for (let i = 0; i < n; i++) {
    const a = vs[i]
    const b = vs[(i + 1) % n]
    const cross = a.x * b.y - b.x * a.y
    twice += cross
    cx6 += (a.x + b.x) * cross
    cy6 += (a.y + b.y) * cross
  }
  if (twice === 0n) return bboxCenter(prep)
  const den = 3n * twice
  return [Number(cx6) / Number(den) / 1000, Number(cy6) / Number(den) / 1000]
}

/** Discrete pole of inaccessibility on a 16×16 sample. Anchor only — not a second solver. */
export function maxClearanceMM(prep: PreparedOutline): PointMM {
  const w = prep.maxX - prep.minX
  const h = prep.maxY - prep.minY
  const N = 16n
  let best: { x: bigint; y: bigint; d2: bigint } | null = null
  for (let i = 0n; i <= N; i++) {
    for (let j = 0n; j <= N; j++) {
      const x = prep.minX + (w * i) / N
      const y = prep.minY + (h * j) / N
      if (!interior(prep, x, y)) continue
      const d2 = minDist2(prep, x, y)
      if (!best || d2 > best.d2) best = { x, y, d2 }
    }
  }
  if (!best) return bboxCenter(prep)
  return [Number(best.x) / 1000, Number(best.y) / 1000]
}
