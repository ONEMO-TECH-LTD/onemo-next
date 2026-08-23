// Magnetic-grid Compute geometry: frozen Centre seat kernel, lattice/nearest-boundary measurements, parity and perimeter helpers.
// The 0.001 mm BigInt path is only the frozen Centre phase prescreen; final Law seat/Wrap admission lives in wrap-measurement.ts on the 1 mm ruler.

import type { BBox, Contour, ExtremeCornerMeasurement, ParityMeasurement, Pt } from '../spec'
import { DEFAULT_PITCH_MM, FIELD_POSITIONS_PER_AXIS } from '../spec'

interface Prepared {
  /** Size of one integer step, in millimetres. */
  readonly quantumMM: number
  /** The ring in integer quanta, duplicate-free, at least three vertices. */
  readonly ring: readonly Pt[]
  /** Bounds in integer quanta. */
  readonly box: BBox
}

const big = (n: number): bigint => BigInt(n)
/** This project targets ES2017, where BigInt LITERALS (`0n`) do not compile. */
const ZERO = BigInt(0)

/** Twice the signed area of the triangle abc. Sign gives the turn direction. */
function orient(a: Pt, b: Pt, c: Pt): bigint {
  return big(b[0] - a[0]) * big(c[1] - a[1]) - big(b[1] - a[1]) * big(c[0] - a[0])
}

/** p lies on the closed segment ab. */
function onSegment(p: Pt, a: Pt, b: Pt): boolean {
  if (orient(a, b, p) !== ZERO) return false
  return (
    p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])
  )
}

/**
 * Quantise a millimetre ring to integer quanta and drop repeated vertices.
 *
 * Throws rather than guesses: a ring that collapses below three distinct
 * vertices, or encloses no area, is not a shape this can answer about.
 */
function prepare(ringMM: readonly Pt[], quantumMM = 0.001): Prepared {
  if (!(quantumMM > 0) || !Number.isFinite(quantumMM)) {
    throw new RangeError('quantum must be finite and positive')
  }
  const scaled: Pt[] = []
  for (const [x, y] of ringMM) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('outline contains a non-finite coordinate')
    }
    const p: Pt = [Math.round(x / quantumMM), Math.round(y / quantumMM)]
    const last = scaled[scaled.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) scaled.push(p)
  }
  const first = scaled[0]
  const last = scaled[scaled.length - 1]
  if (first && last && scaled.length > 1 && first[0] === last[0] && first[1] === last[1]) scaled.pop()
  if (scaled.length < 3) throw new RangeError('outline needs at least three distinct vertices')

  let twiceArea = ZERO
  for (let i = 0; i < scaled.length; i++) {
    const a = scaled[i]!
    const b = scaled[(i + 1) % scaled.length]!
    twiceArea += big(a[0]) * big(b[1]) - big(b[0]) * big(a[1])
  }
  if (twiceArea === ZERO) throw new RangeError('outline encloses no area')

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of scaled) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { quantumMM, ring: Object.freeze(scaled), box: { minX, minY, maxX, maxY } }
}

type Location = 'IN' | 'OUT' | 'ON'

/** Exact location of an integer point against the ring. Winding, no tolerance. */
function locate(shape: Prepared, p: Pt): Location {
  const { ring, box } = shape
  if (p[0] < box.minX || p[0] > box.maxX || p[1] < box.minY || p[1] > box.maxY) return 'OUT'
  let winding = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    if (onSegment(p, a, b)) return 'ON'
    if (a[1] <= p[1]) {
      if (b[1] > p[1] && orient(a, b, p) > ZERO) winding++
    } else if (b[1] <= p[1] && orient(a, b, p) < ZERO) winding--
  }
  return winding === 0 ? 'OUT' : 'IN'
}

/**
 * Is the squared distance from p to segment ab at least r²?
 *
 * Three cases, all exact: p projects before a, after b, or onto the segment's
 * interior — where the perpendicular distance is |cross| / |v|, so the test
 * becomes cross² >= r²·|v|² with no division and no root.
 */
function atLeast(p: Pt, a: Pt, b: Pt, r2: bigint): boolean {
  const vx = big(b[0] - a[0]), vy = big(b[1] - a[1])
  const wx = big(p[0] - a[0]), wy = big(p[1] - a[1])
  const dot = wx * vx + wy * vy
  if (dot <= ZERO) return wx * wx + wy * wy >= r2
  const len2 = vx * vx + vy * vy
  if (dot >= len2) {
    const ux = big(p[0] - b[0]), uy = big(p[1] - b[1])
    return ux * ux + uy * uy >= r2
  }
  const cross = vx * wy - vy * wx
  return cross * cross >= r2 * len2
}

/**
 * Does the closed disc of radius `radius` (in quanta) centred at `p` lie wholly
 * inside the outline?
 *
 * A centre exactly `radius` from the nearest edge PASSES — the disc is tangent
 * to the boundary and every part of it is on material. This is the whole reason
 * the arithmetic is integer: at 12.000000000mm the comparison must be equal, not
 * nearly equal.
 */
function holds(shape: Prepared, p: Pt, radius: number): boolean {
  if (locate(shape, p) === 'OUT') return false
  const r2 = big(radius) * big(radius)
  const { ring } = shape
  for (let i = 0; i < ring.length; i++) {
    if (!atLeast(p, ring[i]!, ring[(i + 1) % ring.length]!, r2)) return false
  }
  return true
}

export function bbox(pts: ReadonlyArray<Pt>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

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

/** Measure already-ruled Centre phases without choosing between them. */

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
export function edgeDistMM(outer: ReadonlyArray<Pt>, pt: Pt): number {
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
export function pointInOuter(pt: Pt, outer: ReadonlyArray<Pt>): boolean {
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

/** Float point-in-material over the complete supplied boundary: inside the outer ring, outside every hole. */
export function pointInMaterial(contour: Contour, pt: Pt): boolean {
  return pointInOuter(pt, contour.outer.pts) && contour.holes.every((hole) => !pointInOuter(pt, hole.pts))
}

/** Nearest distance from a point to the complete boundary (outer + holes), with every distinct
 *  outline point tied for it under the same double computation — exact native equality, no tolerance. */
export function nearestOutlineMM(contour: Contour, pt: Pt): { distMM: number; pointsMM: Pt[] } {
  let distMM = Infinity
  let pointsMM: Pt[] = []
  for (const ring of [contour.outer.pts, ...contour.holes.map((hole) => hole.pts)]) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i]
      const dx = bx - ax, dy = by - ay
      const len2 = dx * dx + dy * dy
      let t = len2 > 0 ? ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / len2 : 0
      if (t < 0) t = 0; else if (t > 1) t = 1
      const px = ax + t * dx, py = ay + t * dy
      const d = Math.hypot(pt[0] - px, pt[1] - py)
      if (d < distMM) { distMM = d; pointsMM = [[px, py]] }
      else if (d === distMM && !pointsMM.some(([x, y]) => x === px && y === py)) pointsMM.push([px, py])
    }
  }
  return { distMM, pointsMM }
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
  kernel: { quantumMM: number; guardMM: number },
): ((pt: Pt) => boolean) | null {
  const QUANTUM = kernel.quantumMM
  const GUARD = kernel.guardMM
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

/** Parity evidence for a seated population against the governed centre: per axis, an odd count of
 *  magnet lines must put a NODE on the centre, an even count the GAP. centreErrorMM is the larger
 *  axis miss from that required line, on the 1 mm ruler (0 when the centre law holds exactly). */
export function measureParity(seated: ReadonlyArray<Pt>, target: Pt, pitch: number, lineQuantumMM: number): ParityMeasurement {
  const PARITY_LINE_QUANTUM_MM = lineQuantumMM
  if (!seated.length || !(pitch > 0)) return { parityTrue: false, centreErrorMM: 0 }
  let parityTrue = true, worstMM = 0
  for (const axis of [0, 1] as const) {
    const lines = new Set(seated.map((s) => Math.round(s[axis] / PARITY_LINE_QUANTUM_MM))).size
    const off = (((seated[0][axis] - target[axis]) % pitch) + pitch) % pitch
    const nodeMiss = Math.min(off, pitch - off), gapMiss = Math.abs(pitch / 2 - off)
    const onNode = off < pitch / 4 || off > pitch * 3 / 4
    const odd = lines % 2 === 1
    if (odd !== onNode) parityTrue = false
    worstMM = Math.max(worstMM, odd ? nodeMiss : gapMiss)
  }
  return { parityTrue, centreErrorMM: Math.floor(worstMM + 0.5) }
}

/** Neutral extreme-corner measurements consumed by the magnet-plan policy. */
export function measureExtremeCorners(seated: ReadonlyArray<Pt>, bb: BBox): ExtremeCornerMeasurement[] {
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, extremeCorner: ex && ey }
  })
}

/** Scale a normalized contour (longest side = 1mm) to a real longest side in mm. */
export function scaleContour(base: Contour, longestMM: number): Contour {
  const scaleRing=(points:ReadonlyArray<Pt>):Pt[]=>points.map(([x,y])=>[x*longestMM,y*longestMM])
  const outer=scaleRing(base.outer.pts),holes=base.holes.map(hole=>({pts:scaleRing(hole.pts)}))
  if(!outer.length)return{outer:{pts:outer},holes}
  const bb=bbox(outer),actual=Math.max(bb.maxX-bb.minX,bb.maxY-bb.minY)
  if(actual===longestMM||actual===0)return{outer:{pts:outer},holes}
  const correction=longestMM/actual
  const correct=(points:ReadonlyArray<Pt>):Pt[]=>points.map(([x,y])=>[
    (x-bb.minX)*correction,
    (y-bb.minY)*correction,
  ])
  return{outer:{pts:correct(outer)},holes:holes.map(hole=>({pts:correct(hole.pts)}))}
}

// ─────────────────────────────────────────────────────────────────────────────
// v3.5.4 CANDIDATE ENUMERATION AND THE RULED GROUP REGION.
//
// Dan's laws (grid-laws.md:743-748): "candidates are EVERY window placement on the lattice — every
// sub-window size at every offset … Centred templates alone are not the candidate set." And the
// region/flap rule (:381-469): the layout's region is the union of its adjacent pairs' padded
// boxes, the shape must ENCAPSULATE it, and flap is the outline's overhang past it, per side.
// Everything here MEASURES. Nothing here judges — Logic does that.

/**
 * THE REGISTRATIONS A CENTRED LAYOUT CAN COME FROM — derived, not guessed, and not a shortcut.
 *
 * A layout's region spans from its lowest to its highest node plus the padding on both sides, so
 * its balance point is `(minNode + maxNode) / 2` = `phase + bbMin + m · pitch/2` for some integer
 * m (m even when the node count on that axis is odd, m odd when it is even). Law 1 admits the
 * layout only when that point meets the governed anchor within the ruler, so the phase MUST lie in
 * one of two residue classes per axis, widened by half a ruler step. Every other registration is
 * provably incapable of producing a centred layout — sweeping them changes nothing but the clock.
 *
 * The registration step still governs: the tolerance band around each residue is sampled at it.
 */
export function centredRegistrations(bb: BBox, pitchMM: number, anchor: Pt, rulerMM: number, stepMM: number): Pt[] {
  const step = Math.max(stepMM, 1 / 1024)
  const half = rulerMM / 2
  const axis = (anchorMM: number, minMM: number): number[] => {
    const out: number[] = []
    const seen = new Set<number>()
    for (const m of [0, 1]) {
      const residue = mod(anchorMM - minMM - (m * pitchMM) / 2, pitchMM)
      // the exact residue always, then the ruler's tolerance band sampled at the registration step
      const offsets = [0]
      for (let d = step; d <= half + 1e-9; d += step) offsets.push(d, -d)
      for (const d of offsets) {
        const value = mod(residue + d, pitchMM)
        const key = Math.round(value * 1024)
        if (seen.has(key)) continue
        seen.add(key)
        out.push(value)
      }
    }
    return out
  }
  const xs = axis(anchor[0], bb.minX), ys = axis(anchor[1], bb.minY)
  const out: Pt[] = []
  for (const x of xs) for (const y of ys) out.push([x, y])
  return out
}

const mod = (v: number, m: number): number => ((v % m) + m) % m

/** A seated node addressed by its lattice indices — the identity dedupe keys on. */
export interface SeatedNode { readonly p: Pt; readonly col: number; readonly row: number }

/** Seated nodes at one registration, indexed on the lattice. */
export function seatedNodesAt(bb: BBox, pitchMM: number, phase: Pt, fits: (pt: Pt) => boolean): SeatedNode[] {
  const nodes: SeatedNode[] = []
  for (const p of latticeAt(bb, pitchMM, phase[0], phase[1])) {
    if (!fits(p)) continue
    nodes.push({ p, col: Math.round((p[0] - bb.minX - phase[0]) / pitchMM), row: Math.round((p[1] - bb.minY - phase[1]) / pitchMM) })
  }
  return nodes
}

/** One candidate population: the nodes it holds, plus how it was formed (evidence, never identity). */
export interface LayoutCandidate {
  readonly family: 'single' | 'run' | 'rectangle-corners' | 'corner-triangle' | 'full-window'
  readonly populationStep: number
  readonly nodes: readonly SeatedNode[]
  /** (population, sorted held coordinates on the whole-mm grid) — Meta's ruled dedupe key. The
   *  population belongs in it: the same four nodes at step 1 and step 2 are DIFFERENT layouts,
   *  because adjacency — and therefore the ruled region — differs. */
  readonly heldKey: string
}

const heldKeyOf = (populationStep: number, nodes: ReadonlyArray<SeatedNode>): string =>
  `p${populationStep}:` + nodes.map((n) => `${Math.round(n.p[0])},${Math.round(n.p[1])}`).sort().join('|')

/**
 * The five ruled families over one registration's seated nodes: singles · runs (horizontal,
 * vertical and the ruled diagonal, at any whole population step) · rectangle corners ·
 * corner triangles · full windows. Bounded by the seated set — never the power set.
 */
export function enumerateLayouts(nodes: ReadonlyArray<SeatedNode>, maxPopulationStep: number): LayoutCandidate[] {
  const held = new Map<string, SeatedNode>()
  for (const n of nodes) held.set(`${n.col},${n.row}`, n)
  const at = (col: number, row: number) => held.get(`${col},${row}`)
  const out: LayoutCandidate[] = []
  const seen = new Set<string>()
  const push = (family: LayoutCandidate['family'], populationStep: number, members: SeatedNode[]) => {
    if (!members.length) return
    const heldKey = heldKeyOf(populationStep, members)
    const id = `${family}|${heldKey}`
    if (seen.has(id)) return
    seen.add(id)
    out.push({ family, populationStep, nodes: members, heldKey })
  }

  for (const node of nodes) push('single', 1, [node])

  for (let step = 1; step <= maxPopulationStep; step++) {
    for (const node of nodes) {
      for (const [dc, dr] of [[step, 0], [0, step], [step, step], [step, -step]] as const) {
        const members: SeatedNode[] = [node]
        for (let k = 1; ; k++) {
          const next = at(node.col + dc * k, node.row + dr * k)
          if (!next) break
          members.push(next)
          if (members.length >= 2) push('run', step, [...members])
        }
      }
    }
    // rectangle corners, corner triangles and full windows over every axis-aligned frame
    for (const a of nodes) {
      for (const b of nodes) {
        const dc = b.col - a.col, dr = b.row - a.row
        if (dc <= 0 || dr <= 0 || dc % step || dr % step) continue
        const corners = [at(a.col, a.row), at(b.col, a.row), at(a.col, b.row), at(b.col, b.row)]
        const present = corners.filter((c): c is SeatedNode => Boolean(c))
        if (present.length === 4) {
          push('rectangle-corners', step, present)
          const window: SeatedNode[] = []
          let full = true
          for (let c = a.col; c <= b.col && full; c += step) for (let r = a.row; r <= b.row && full; r += step) {
            const node = at(c, r)
            if (!node) { full = false; break }
            window.push(node)
          }
          if (full && window.length > 4) push('full-window', step, window)
        }
        if (present.length >= 3) {
          for (let skip = 0; skip < 4; skip++) {
            const triangle = corners.filter((c, i) => i !== skip && c) as SeatedNode[]
            if (triangle.length === 3) push('corner-triangle', step, triangle)
          }
        }
      }
    }
  }
  return out
}

/** One padded box of the ruled region — a single node's cell, or an adjacent pair's extent. */
export interface RegionBox { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }

/**
 * THE RULED GROUP REGION (Dan, grid-laws.md:381-469, confirmed: "measuring by joint pairs makes
 * the model smarter"). A lone node contributes its padded cell; every adjacent pair — axial or the
 * ruled diagonal — contributes the axis-aligned box of its two centres grown by the padding. The
 * region is their union, so a three-point L keeps its L shape with no invented fourth corner.
 */
export function measureGroupRegion(layout: LayoutCandidate, paddingMM: number): RegionBox[] {
  const nodes = layout.nodes
  const boxOf = (a: Pt, b: Pt): RegionBox => ({
    minX: Math.min(a[0], b[0]) - paddingMM, minY: Math.min(a[1], b[1]) - paddingMM,
    maxX: Math.max(a[0], b[0]) + paddingMM, maxY: Math.max(a[1], b[1]) + paddingMM,
  })
  if (nodes.length === 1) return [boxOf(nodes[0].p, nodes[0].p)]
  const step = layout.populationStep
  const boxes: RegionBox[] = []
  // A DIAGONAL pair is a ruled arrangement in its own right (Dan, 2026-08-13), so its two centres
  // make one box. Inside a larger layout, adjacency is AXIAL only — otherwise a three-point L
  // would acquire the fourth corner its own law forbids.
  const diagonalAllowed = nodes.length === 2
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dc = Math.abs(nodes[i].col - nodes[j].col), dr = Math.abs(nodes[i].row - nodes[j].row)
      const axial = (dc === step && dr === 0) || (dc === 0 && dr === step)
      const diagonal = diagonalAllowed && dc === step && dr === step
      if (axial || diagonal) boxes.push(boxOf(nodes[i].p, nodes[j].p))
    }
  }
  // A population whose members are not pair-adjacent (a wide corner frame) still owns its members'
  // own cells, so the region is never empty and never invents material between them.
  if (!boxes.length) for (const node of nodes) boxes.push(boxOf(node.p, node.p))
  return boxes
}

/** The region's outer extents — what Centre balances on and what flap is measured from. */
export function regionExtents(boxes: ReadonlyArray<RegionBox>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  return { minX, minY, maxX, maxY }
}

/** A STRICT crossing: each segment must have the other's endpoints strictly on opposite sides.
 *  Touching at an endpoint or running along a shared edge is contact, not a crossing — containment
 *  is closed (grid-laws.md: "the box boundary may touch the outline"). */
const segmentsCross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b)
  const opposite = (u: number, v: number) => (u > 0 && v < 0) || (u < 0 && v > 0)
  return opposite(o1, o2) && opposite(o3, o4)
}

/**
 * L18 — THE SHAPE MUST ENCAPSULATE THE REGION, and that containment IS the computation. Closed:
 * the boundary may touch the outline. A box lies in material when its corners are in material and
 * no outline (or hole) edge crosses it.
 */
export function regionInMaterial(contour: Contour, boxes: ReadonlyArray<RegionBox>, tolMM: number): boolean {
  const rings = [contour.outer.pts, ...contour.holes.map((hole) => hole.pts)]
  for (const box of boxes) {
    // Containment is CLOSED: the region's boundary may touch the outline (a 72 mm square holds its
    // own 72 mm region exactly). A corner is accepted when it is in material OR on the boundary
    // within the ruler; a crossing edge is a real crossing, never a shared boundary run.
    const corners: Pt[] = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]]
    for (const corner of corners) {
      if (pointInMaterial(contour, corner)) continue
      if (nearestOutlineMM(contour, corner).distMM <= tolMM) continue
      return false
    }
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4]
      for (const ring of rings) {
        for (let k = 0; k < ring.length; k++) {
          if (!segmentsCross(a, b, ring[k], ring[(k + 1) % ring.length])) continue
          // a crossing that only grazes the shared boundary is not a crossing
          const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
          if (nearestOutlineMM(contour, mid).distMM <= tolMM) continue
          return false
        }
      }
    }
  }
  return true
}

/** Flap: the outline's overhang past the region, per side, clamped at zero — four subtractions. */
export function measureOverhangs(shape: BBox, region: BBox): [number, number, number, number] {
  return [
    Math.max(0, region.minX - shape.minX),
    Math.max(0, shape.maxX - region.maxX),
    Math.max(0, region.minY - shape.minY),
    Math.max(0, shape.maxY - region.maxY),
  ]
}
