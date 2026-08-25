// grid-magnet-compute.ts — COMPUTE: geometry and arithmetic. Values come from spec or the caller.

import type { Contour, Pt } from './types'
import { pointInPolygon } from './attachment'
import { holds, prepare } from '@/lib/grid-engine/compute/geometry'
import { DEFAULT_PITCH_MM, FIELD_POSITIONS_PER_AXIS } from './grid-magnet-spec'

/** Point-identity key quantum — 0.01mm hash resolution, not a law value. */
const KEY_QUANTUM_MM = 0.01

export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

export function dist(a: Pt, b: Pt): number { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

/** Spot radius = the padding, measured from the magnet centre. */
export function spotRadiusOf(padMM: number): number {
  return padMM
}

/** Full field span: the fixed 9×9 board on the base 48 grid, plus one spot either side — 408 at
 *  12 padding. Pitch never changes the board: 96 skips points on it, 24 adds points within it. */
export function fieldSpanMM(padMM: number): number {
  return (FIELD_POSITIONS_PER_AXIS - 1) * DEFAULT_PITCH_MM + 2 * spotRadiusOf(padMM)
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

/**
 * Bucketed edge index — accelerates nearest-edge distance and ray parity. Results are
 * BIT-IDENTICAL to the full scans: every edge that could be nearest is examined with the same
 * arithmetic, and edges a query skips contribute no ray crossing by construction. Built once
 * per outline array (WeakMap) — a solve reuses it across its thousands of queries.
 */
interface EdgeIdx {
  cell: number; ox: number; oy: number; cols: number; rows: number
  buckets: number[][]
  yBands: number[][]
  /** Chebyshev ring distance from each cell to the nearest edge-holding cell (BFS). */
  ring: Int16Array
  stamp: Int32Array
  tick: number
}
const EDGE_IDX = new WeakMap<object, EdgeIdx>()
function edgeIdxOf(outer: ReadonlyArray<Pt>): EdgeIdx {
  let idx = EDGE_IDX.get(outer as object)
  if (idx) return idx
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of outer) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const cell = Math.max(4, Math.max(maxX - minX, maxY - minY) / 32)
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1)
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1)
  const buckets: number[][] = Array.from({ length: cols * rows }, () => [])
  const yBands: number[][] = Array.from({ length: rows }, () => [])
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [ax, ay] = outer[j], [bx, by] = outer[i]
    const c0 = Math.max(0, Math.min(cols - 1, Math.floor((Math.min(ax, bx) - minX) / cell)))
    const c1 = Math.max(0, Math.min(cols - 1, Math.floor((Math.max(ax, bx) - minX) / cell)))
    const r0 = Math.max(0, Math.min(rows - 1, Math.floor((Math.min(ay, by) - minY) / cell)))
    const r1 = Math.max(0, Math.min(rows - 1, Math.floor((Math.max(ay, by) - minY) / cell)))
    for (let r = r0; r <= r1; r++) { for (let c = c0; c <= c1; c++) buckets[r * cols + c].push(i); yBands[r].push(i) }
  }
  // dedupe band lists (an edge may span several columns of the same row)
  for (let r = 0; r < rows; r++) yBands[r] = [...new Set(yBands[r])]
  // Ring field: multi-source BFS from edge cells — a deep query starts its scan at the ring
  // that can actually hold the nearest edge instead of expanding through empty space.
  const ring = new Int16Array(cols * rows).fill(-1)
  let frontier: number[] = []
  for (let i = 0; i < cols * rows; i++) if (buckets[i].length) { ring[i] = 0; frontier.push(i) }
  for (let d = 1; frontier.length; d++) {
    const next: number[] = []
    for (const cellIdx of frontier) {
      const cr0 = Math.floor(cellIdx / cols), cc0 = cellIdx % cols
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = cr0 + dr, c = cc0 + dc
        if (rr < 0 || rr >= rows || c < 0 || c >= cols) continue
        const k = rr * cols + c
        if (ring[k] === -1) { ring[k] = d; next.push(k) }
      }
    }
    frontier = next
  }
  idx = { cell, ox: minX, oy: minY, cols, rows, buckets, yBands, ring, stamp: new Int32Array(outer.length), tick: 0 }
  EDGE_IDX.set(outer as object, idx)
  return idx
}

function segDist2(outer: ReadonlyArray<Pt>, i: number, px: number, py: number): number {
  const j = i === 0 ? outer.length - 1 : i - 1
  const [ax, ay] = outer[j], [bx, by] = outer[i]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  if (t < 0) t = 0; else if (t > 1) t = 1
  const ex = px - (ax + t * dx), ey = py - (ay + t * dy)
  return ex * ex + ey * ey
}

/** Float distance from a point to the outline's nearest edge — the prescreen metric. */
function edgeDistMM(outer: ReadonlyArray<Pt>, pt: Pt): number {
  const idx = edgeIdxOf(outer)
  const [px, py] = pt
  const cc = Math.max(0, Math.min(idx.cols - 1, Math.floor((px - idx.ox) / idx.cell)))
  const cr = Math.max(0, Math.min(idx.rows - 1, Math.floor((py - idx.oy) / idx.cell)))
  const tick = ++idx.tick
  let best = Infinity
  const maxR = Math.max(idx.cols, idx.rows)
  const r0 = Math.max(0, idx.ring[cr * idx.cols + cc] - 1)
  for (let r = r0; ; r++) {
    // Once every unexamined edge is provably farther than the best, stop.
    if (r > r0) { const lb = (r - 1) * idx.cell; if (lb * lb > best || r > maxR + r0) break }
    for (let dr = -r; dr <= r; dr++) {
      const rr = cr + dr
      if (rr < 0 || rr >= idx.rows) continue
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue
        const c = cc + dc
        if (c < 0 || c >= idx.cols) continue
        for (const e of idx.buckets[rr * idx.cols + c]) {
          if (idx.stamp[e] === tick) continue
          idx.stamp[e] = tick
          const d2 = segDist2(outer, e, px, py)
          if (d2 < best) best = d2
        }
      }
    }
  }
  return Math.sqrt(best)
}

/** Even-odd ray parity via the y-band index — identical crossings to the full scan. */
function pointInOuter(pt: Pt, outer: ReadonlyArray<Pt>): boolean {
  const idx = edgeIdxOf(outer)
  const band = Math.max(0, Math.min(idx.rows - 1, Math.floor((pt[1] - idx.oy) / idx.cell)))
  let inside = false
  for (const i of idx.yBands[band]) {
    const j = i === 0 ? outer.length - 1 : i - 1
    const [xi, yi] = outer[i]
    const [xj, yj] = outer[j]
    const crosses = (yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * Seat predicate for one outline: centre at least `spotRadiusMM` from every boundary point,
 * tangency passing by equality (exact integer arithmetic, micron quantum).
 * A float prescreen answers the clear cases; only points within a guard band of the exact
 * threshold fall through to the integer test — the answer never changes, only the cost.
 * Null for a degenerate outline.
 */
export function makeSeatPredicate(
  outer: ReadonlyArray<Pt>,
  spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  const GUARD = 0.05
  let prep: ReturnType<typeof prepare>
  try { prep = prepare(outer, QUANTUM) } catch { return null }
  const rQ = Math.round(spotRadiusMM / QUANTUM)
  return (pt: Pt) => {
    // Ring-field lower bound: a point provably farther than the threshold from every edge
    // skips the distance query entirely — parity alone decides. Same answer, no scan.
    const idx = edgeIdxOf(outer)
    const cc = Math.max(0, Math.min(idx.cols - 1, Math.floor((pt[0] - idx.ox) / idx.cell)))
    const cr = Math.max(0, Math.min(idx.rows - 1, Math.floor((pt[1] - idx.oy) / idx.cell)))
    if ((idx.ring[cr * idx.cols + cc] - 1) * idx.cell > spotRadiusMM + GUARD) return pointInOuter(pt, outer)
    const d = edgeDistMM(outer, pt)
    if (d > spotRadiusMM + GUARD) return pointInOuter(pt, outer)
    if (d < spotRadiusMM - GUARD) return false
    return holds(prep, [Math.round(pt[0] / QUANTUM), Math.round(pt[1] / QUANTUM)], rQ)
  }
}

/**
 * Seat predicate for a TRUE CIRCLE (centre c, radius R): the disc of radius r fits iff
 * |p−c|² ≤ (R−r)² — integer microns, tangency by equality. A flattened polygon's chords sit
 * microns inside the curve and wrongly refuse the zero-margin case; the analytic form cannot.
 */
export function makeCircleSeatPredicate(
  cx: number, cy: number, R: number, spotRadiusMM: number,
): ((pt: Pt) => boolean) | null {
  const QUANTUM = 0.001
  const q = (v: number) => Math.round(v / QUANTUM)
  const slack = q(R) - q(spotRadiusMM)
  if (slack < 0) return null
  const cqx = q(cx), cqy = q(cy), s2 = slack * slack
  return (pt: Pt) => {
    const dx = q(pt[0]) - cqx, dy = q(pt[1]) - cqy
    return dx * dx + dy * dy <= s2
  }
}

/** THE WRAP LAW (Dan, 2026-08-20: "0 flap means magnets and edges touch"): wrap is each
 *  disc PRESSED against the outline. The force is the mean of every seated disc's own gap
 *  past its margined edge (spot + allowance) — zero when every disc that can touch does.
 *  Enforced through the dominance tiers, not preferred. */
export function pressExcessMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): number {
  if (!seated.length) return 0
  let sum = 0
  for (const s of seated) sum += Math.max(0, edgeDistMM(outer, s) - reach)
  return sum / seated.length
}

/** THE RIGID GATE (Dan, 2026-08-20): the worst disc's gap past its margined edge. A layout
 *  qualifies only when EVERY disc touches within the allowance — 0 = touch, 1 = 1mm space.
 *  Normal mode enforces this; Auto mode adapts the allowance instead. */
export function maxPressMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, reach: number): number {
  let m = 0
  for (const s of seated) { const g = edgeDistMM(outer, s) - reach; if (g > m) m = g }
  return m
}

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

/** The allowance a solved layout IMPLIES at its size — the binding gap between the discs and
 *  the edge: how much margin the discs can wear before one presses against the outline.
 *  0 = already tangent (true contact size). */
export function impliedFlapMM(outer: ReadonlyArray<Pt>, seated: ReadonlyArray<Pt>, spotRadiusMM: number): number {
  if (!seated.length) return 0
  let g = Infinity
  for (const a of seated) { const d = edgeDistMM(outer, a) - spotRadiusMM; if (d < g) g = d }
  return Math.max(0, g)
}

/** A mass inside an island — the region surviving the depth probe, with its outline. */
export interface SafeMass {
  areaMM2: number
  /** The deepest point of the mass — always inside the material. */
  centreMM: Pt
  /** The mass's peak clearance, mm. */
  peakClearMM: number
  bbox: BBox
  rings: Pt[][]
}

/** One connected island of the legal magnet-centre area, measured on a mesh. */
export interface SafeSegment {
  areaMM2: number
  /** The island's deepest point — max clearance, never a concave void. */
  centreMM: Pt
  /** The island's area-average point — can sit in a concave void; a test-mode reference. */
  meanMM: Pt
  /** The island's peak clearance, mm — how deep its most buried point sits. */
  peakClearMM: number
  bbox: BBox
  /** The island's edge-offset outline(s) — smooth closed rings, mm, engine y-up. */
  rings: Pt[][]
  /** Sub-masses at the depth probe: limbs and slivers die shallow, true masses survive. */
  masses: SafeMass[]
}

/** Marching-squares topology: per corner-sign mask (array position), the cell-edge pairs a
 *  contour crosses. Edges 0=top 1=right 2=bottom 3=left. */
const MS_CASES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[3, 0]], [[0, 1]], [[3, 1]],
  [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]],
  [[1, 3]], [[0, 1]], [[0, 3]], [],
]

/**
 * The legal area's separate islands with smooth offset outlines and depth masses. Signed
 * clearance (distance to the cut line minus the spot radius, negative outside) is sampled on
 * a mesh once; islands are its regions above zero, masses its regions above the depth probe,
 * and every outline is the level crossing traced between samples (marching squares with
 * linear interpolation), so drawn edges follow the true offset curves, not mesh cells.
 * Centres are DEEPEST POINTS, so a crescent's centre sits in its arc, never the void.
 * A MEASUREMENT for display and scoring — magnet legality stays the exact per-point test.
 */
export function safeSegments(
  outer: ReadonlyArray<Pt>, spotRadiusMM: number, massDepthMM: number,
  detail: 'full' | 'light' = 'full',
): SafeSegment[] {
  if (outer.length < 3) return []
  // Dense traced outlines are decimated for this measurement — display grain, not legality.
  const MAXV = 800
  const k = Math.max(1, Math.ceil(outer.length / MAXV))
  const ring: Pt[] = []
  for (let i = 0; i < outer.length; i += k) ring.push(outer[i])
  const r = spotRadiusMM
  const signed = (p: Pt): number => {
    const d = edgeDistMM(ring, p)
    return pointInOuter(p, ring) ? d - r : -(d + r)
  }
  const step = 2 // mesh grain, mm
  const bb = bbox(ring)
  // One sample beyond the box on every side so outlines always close.
  const x0 = bb.minX - step, y0 = bb.minY - step
  const nx = Math.max(2, Math.round((bb.maxX - bb.minX) / step) + 3)
  const ny = Math.max(2, Math.round((bb.maxY - bb.minY) / step) + 3)
  const S = new Float64Array(nx * ny)
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++)
      S[iy * nx + ix] = signed([x0 + ix * step, y0 + iy * step])

  const key = (p: Pt) => (Math.round(p[0] / KEY_QUANTUM_MM) + ',' + Math.round(p[1] / KEY_QUANTUM_MM))
  const lerp = (pa: Pt, sa: number, pb: Pt, sb: number): Pt => {
    const t = sa / (sa - sb)
    return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]
  }

  /** Pull a ring point onto the exact offset curve (Newton on the signed field), so drawn
   *  outlines follow the true edge offset instead of the mesh's facets. */
  const snapToIso = (p: Pt, thr: number): Pt => {
    let q = p
    for (let it = 0; it < 2; it++) {
      const s = signed(q) - thr
      if (Math.abs(s) < 0.02) break
      const e = 0.5
      const gx = (signed([q[0] + e, q[1]]) - signed([q[0] - e, q[1]])) / (2 * e)
      const gy = (signed([q[0], q[1] + e]) - signed([q[0], q[1] - e])) / (2 * e)
      const g2 = gx * gx + gy * gy
      if (g2 < 1e-9) break
      q = [q[0] - s * gx / g2, q[1] - s * gy / g2]
    }
    return q
  }
  /** One midpoint per edge, then every point snapped to the exact curve. */
  const smoothLoop = (loop: Pt[], thr: number): Pt[] => {
    const dense: Pt[] = []
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length]
      dense.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    }
    return dense.map((p) => snapToIso(p, thr))
  }

  interface LevelItem { areaMM2: number; centreMM: Pt; meanMM: Pt; peakClearMM: number; bbox: BBox; rings: Pt[][]; deepIdx: number }
  /** Regions of S ≥ thr: connectivity, deepest point, bbox and traced outlines. */
  const level = (thr: number): { comp: Int32Array; items: LevelItem[] } => {
    const comp = new Int32Array(nx * ny).fill(-1)
    type Acc = { n: number; sx: number; sy: number; minX: number; minY: number; maxX: number; maxY: number; deepIdx: number; deepS: number }
    const accs: Acc[] = []
    for (let seed = 0; seed < nx * ny; seed++) {
      if (S[seed] < thr || comp[seed] >= 0) continue
      const id = accs.length
      const acc: Acc = { n: 0, sx: 0, sy: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, deepIdx: seed, deepS: -Infinity }
      accs.push(acc)
      const stack = [seed]
      comp[seed] = id
      while (stack.length) {
        const i = stack.pop()!
        const ix = i % nx, iy = (i / nx) | 0
        const px = x0 + ix * step, py = y0 + iy * step
        acc.n++
        acc.sx += px; acc.sy += py
        if (S[i] > acc.deepS) { acc.deepS = S[i]; acc.deepIdx = i }
        if (px < acc.minX) acc.minX = px; if (px > acc.maxX) acc.maxX = px
        if (py < acc.minY) acc.minY = py; if (py > acc.maxY) acc.maxY = py
        for (const j of [i - 1, i + 1, i - nx, i + nx]) {
          if (j < 0 || j >= nx * ny || comp[j] >= 0 || S[j] < thr) continue
          if (Math.abs((j % nx) - ix) > 1) continue // row wrap
          comp[j] = id
          stack.push(j)
        }
      }
    }
    // Level-crossing segments per mesh cell, lerped; chained into closed rings.
    // 'light' skips outlines entirely — scoring needs centres/areas/boxes, only display needs rings.
    const segs: Array<[Pt, Pt]> = []
    if (detail === 'light') {
      const at0 = (i: number): Pt => [x0 + (i % nx) * step, y0 + ((i / nx) | 0) * step]
      return {
        comp,
        items: accs.map((a) => ({
          areaMM2: a.n * step * step,
          centreMM: at0(a.deepIdx),
          meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
          peakClearMM: a.deepS + r + thr,
          bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
          rings: [],
          deepIdx: a.deepIdx,
        })),
      }
    }
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const i00 = iy * nx + ix, i10 = i00 + 1, i01 = i00 + nx, i11 = i01 + 1
        const s00 = S[i00] - thr, s10 = S[i10] - thr, s01 = S[i01] - thr, s11 = S[i11] - thr
        const m = (s00 >= 0 ? 1 : 0) | (s10 >= 0 ? 2 : 0) | (s11 >= 0 ? 4 : 0) | (s01 >= 0 ? 8 : 0)
        if (m === 0 || m === MS_CASES.length - 1) continue
        const ax = x0 + ix * step, ay = y0 + iy * step
        const P00: Pt = [ax, ay], P10: Pt = [ax + step, ay], P01: Pt = [ax, ay + step], P11: Pt = [ax + step, ay + step]
        // Crossing point on each cell edge: 0=top 1=right 2=bottom 3=left.
        const edge = (e: number): Pt =>
          e === 0 ? lerp(P00, s00, P10, s10)
            : e === 1 ? lerp(P10, s10, P11, s11)
              : e === 2 ? lerp(P01, s01, P11, s11)
                : lerp(P00, s00, P01, s01)
        for (const [ea, eb] of MS_CASES[m]) segs.push([edge(ea), edge(eb)])
      }
    }
    const byEnd = new Map<string, Array<[Pt, Pt]>>()
    for (const s of segs) {
      for (const p of [s[0], s[1]]) {
        const kk = key(p)
        const list = byEnd.get(kk)
        if (list) list.push(s); else byEnd.set(kk, [s])
      }
    }
    const used = new Set<[Pt, Pt]>()
    const loops: Pt[][] = []
    for (const s of segs) {
      if (used.has(s)) continue
      used.add(s)
      const loop: Pt[] = [s[0], s[1]]
      for (; ;) {
        const tail = loop[loop.length - 1]
        const cands = byEnd.get(key(tail)) ?? []
        const next = cands.find((c) => !used.has(c))
        if (!next) break
        used.add(next)
        loop.push(key(next[0]) === key(tail) ? next[1] : next[0])
        if (key(loop[loop.length - 1]) === key(loop[0])) break
      }
      if (loop.length > 3) loops.push(loop)
    }
    // Attach each ring to the region of the nearest qualifying sample.
    const compAt = (p: Pt): number => {
      let best = -1, bd = Infinity
      const ix0 = Math.max(0, Math.min(nx - 1, Math.round((p[0] - x0) / step)))
      const iy0 = Math.max(0, Math.min(ny - 1, Math.round((p[1] - y0) / step)))
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const ix = ix0 + dx, iy = iy0 + dy
        if (ix < 0 || ix >= nx || iy < 0 || iy >= ny) continue
        const i = iy * nx + ix
        if (comp[i] < 0) continue
        const d = (ix * step + x0 - p[0]) ** 2 + (iy * step + y0 - p[1]) ** 2
        if (d < bd) { bd = d; best = comp[i] }
      }
      return best
    }
    const ringsByComp: Pt[][][] = accs.map(() => [])
    for (const loop of loops) {
      const id = compAt(loop[0])
      if (id >= 0) ringsByComp[id].push(smoothLoop(loop, thr))
    }
    const at = (i: number): Pt => [x0 + (i % nx) * step, y0 + ((i / nx) | 0) * step]
    return {
      comp,
      items: accs.map((a, id) => ({
        areaMM2: a.n * step * step,
        centreMM: at(a.deepIdx),
        meanMM: [a.sx / a.n, a.sy / a.n] as Pt,
        peakClearMM: a.deepS + r + thr,
        bbox: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
        rings: ringsByComp[id],
        deepIdx: a.deepIdx,
      })),
    }
  }

  const iso0 = level(0)
  if (!iso0.items.length) return []
  const depthOff = Math.max(0, massDepthMM - r)
  const isoD = depthOff > 0 ? level(depthOff) : iso0
  const massesByIsland: SafeMass[][] = iso0.items.map(() => [])
  for (const m of isoD.items) {
    const islandId = iso0.comp[m.deepIdx]
    if (islandId >= 0) massesByIsland[islandId].push({ areaMM2: m.areaMM2, centreMM: m.centreMM, peakClearMM: m.peakClearMM, bbox: m.bbox, rings: m.rings })
  }
  const out: SafeSegment[] = iso0.items.map((it, id) => ({
    areaMM2: it.areaMM2,
    centreMM: it.centreMM,
    meanMM: it.meanMM,
    peakClearMM: it.peakClearMM,
    bbox: it.bbox,
    rings: it.rings,
    masses: massesByIsland[id].sort((a, b) => a.areaMM2 - b.areaMM2),
  }))
  out.sort((a, b) => a.areaMM2 - b.areaMM2)
  return out
}

/** Area centroid of a polygon (shoelace) — the material's weight centre. */
export function centroidOf(pts: ReadonlyArray<Pt>): Pt {
  let a2 = 0, sx = 0, sy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a2 += cross
    sx += (pts[j][0] + pts[i][0]) * cross
    sy += (pts[j][1] + pts[i][1]) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    let mx = 0, my = 0
    for (const p of pts) { mx += p[0]; my += p[1] }
    return [mx / pts.length, my / pts.length]
  }
  return [sx / (3 * a2), sy / (3 * a2)]
}

/** Is a point inside a mass's real outline? Box prescreen, then the traced ring. */
export function pointInMass(p: Pt, mass: { bbox: BBox; rings: Pt[][] }): boolean {
  if (p[0] < mass.bbox.minX || p[0] > mass.bbox.maxX || p[1] < mass.bbox.minY || p[1] > mass.bbox.maxY) return false
  if (!mass.rings.length) return true
  return mass.rings.some((ring) => pointInPolygon(p, ring as Pt[]))
}

/** Split seated nodes into perimeter belt and fully-surrounded interior. */
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

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  return { outer: { pts: base.outer.pts.map(([x, y]) => [x * longestMM, y * longestMM] as Pt) }, holes: [] }
}
