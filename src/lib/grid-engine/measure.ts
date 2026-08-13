// Disc-fit only. Sites arrive from magnetsInRegion. No lattice of our own.
// BigInt via constructor — repo tsc target is ES2017, which rejects 0n literals.

import type { PointMM } from './engine'
import type { GridSpec } from './spec'

const ZERO = BigInt(0)
const THREE = BigInt(3)
const SAMPLE = BigInt(16)

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
    const lhs = (qx - xi) * den
    const rhs = (xj - xi) * (qy - yi)
    if (den > ZERO ? lhs < rhs : lhs > rhs) inside = !inside
  }
  return inside
}

function dist2Seg(qx: bigint, qy: bigint, ax: bigint, ay: bigint, bx: bigint, by: bigint): bigint {
  const vx = bx - ax
  const vy = by - ay
  const wx = qx - ax
  const wy = qy - ay
  const L = vx * vx + vy * vy
  if (L === ZERO) return wx * wx + wy * wy
  const h = wx * vx + wy * vy
  if (h <= ZERO) return wx * wx + wy * wy
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
  return best ?? ZERO
}

/** True iff every boundary segment is at least r away. Interior projection uses cross² ≥ r²L — no divide. */
function clearsRadius(p: PreparedOutline, qx: bigint, qy: bigint, r: bigint): boolean {
  const r2 = r * r
  const vs = p.verts
  const n = vs.length
  for (let i = 0; i < n; i++) {
    const a = vs[i]
    const b = vs[(i + 1) % n]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const wx = qx - a.x
    const wy = qy - a.y
    const L = vx * vx + vy * vy
    if (L === ZERO) {
      if (wx * wx + wy * wy < r2) return false
      continue
    }
    const h = wx * vx + wy * vy
    if (h <= ZERO) {
      if (wx * wx + wy * wy < r2) return false
      continue
    }
    if (h >= L) {
      const dx = qx - b.x
      const dy = qy - b.y
      if (dx * dx + dy * dy < r2) return false
      continue
    }
    const cross = vx * wy - vy * wx
    if (cross * cross < r2 * L) return false
  }
  return true
}

/** Full disc fits: centre interior and boundary distance ≥ radius. Equality passes. */
export function discFits(prep: PreparedOutline, center: PointMM, radiusMM: number): boolean {
  const qx = toUm(center[0])
  const qy = toUm(center[1])
  if (!interior(prep, qx, qy)) return false
  return clearsRadius(prep, qx, qy, toUm(radiusMM))
}

export function discFitsGrid(prep: PreparedOutline, center: PointMM, grid: GridSpec): boolean {
  return discFits(prep, center, grid.paddingMM)
}

export function bboxCenter(prep: PreparedOutline): PointMM {
  return [Number(prep.minX + prep.maxX) / 2000, Number(prep.minY + prep.maxY) / 2000]
}

export function centroidMM(prep: PreparedOutline): PointMM {
  let twice = ZERO
  let cx6 = ZERO
  let cy6 = ZERO
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
  if (twice === ZERO) return bboxCenter(prep)
  const den = THREE * twice
  return [Number(cx6) / Number(den) / 1000, Number(cy6) / Number(den) / 1000]
}

/** Discrete pole of inaccessibility on a 16×16 sample. Anchor only — not a second solver. */
export function maxClearanceMM(prep: PreparedOutline): PointMM {
  const w = prep.maxX - prep.minX
  const h = prep.maxY - prep.minY
  let best: { x: bigint; y: bigint; d2: bigint } | null = null
  for (let i = ZERO; i <= SAMPLE; i++) {
    for (let j = ZERO; j <= SAMPLE; j++) {
      const x = prep.minX + (w * i) / SAMPLE
      const y = prep.minY + (h * j) / SAMPLE
      if (!interior(prep, x, y)) continue
      const d2 = minDist2(prep, x, y)
      if (!best || d2 > best.d2) best = { x, y, d2 }
    }
  }
  if (!best) return bboxCenter(prep)
  return [Number(best.x) / 1000, Number(best.y) / 1000]
}
