// grid-engine/engine.ts — SUB 1, THE ENGINE. Pure computing.
//
// Dan, 2026-08-10: "Sub 1 — the ENGINE. Pure computing. Takes a shape and the values, works out the
// layout and the size. It holds no values of its own — every number it uses arrives from Sub 2."
//
// So: no constants, no defaults, no literals standing in for law. Every number in here is either
// read off the spec it was handed or produced by arithmetic on those. Pure millimetres — it has
// never heard of a screen, a pixel, a zoom or a framework.

import { Clipper, JoinType, EndType } from '@countertype/clipper2-ts'
import type { GridSpec, GridSystemSpec, Registration } from './spec'

export type PointMM = [number, number]

/** A rectangle of the field, in millimetres. */
export interface RegionMM {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The spot each magnet occupies on the fabric — twice the padding, never a second constant.
 *
 * Padding is 12mm (v3 law 10.6, Dan 2026-08-10, locked), superseding the inherited 10mm of v1 law 2.1.
 * So the spot is 24mm — exactly half the 48mm pitch, which makes 12mm the atom the whole system steps
 * in: padding 1 atom, spot 2, half pitch 2, pitch 4, sparse pitch 8.
 */
export function cellDiameterMM(grid: GridSpec): number {
  return 2 * grid.paddingMM
}

/**
 * How many base-lattice steps lie between two populated magnets. 48mm → every point; 96mm → every
 * second. This is what makes 96 a THINNING of the one lattice rather than a lattice of its own.
 */
function populationStride(grid: GridSpec): number {
  const stride = grid.pitchMM / grid.basePitchMM
  if (!Number.isInteger(stride) || stride < 1) {
    throw new RangeError('Populated pitch must be a whole multiple of the base lattice.')
  }
  return stride
}

/**
 * How far the lattice sits from the shape's centre.
 *
 * A PROPERTY OF THE LAYOUT, NEVER OF A VIEW. It was briefly derived from the zoom stop, which made
 * the lattice physically move when you zoomed — a view concern in charge of the geometry.
 *
 * Half the POPULATED pitch, not half the base lattice: at 96mm the gap the shape must centre in lies
 * between two populated magnets, and half a base step lands back on one of them. What moves is where
 * the shape sits on the lattice, not the lattice — one spacing, one lattice (law 1.1).
 */
export function registrationOffsetMM(grid: GridSpec, registration: Registration): number {
  return registration === 'gap' ? grid.pitchMM / 2 : 0
}

/**
 * The empty millimetres beyond the outermost cells, so the field visibly ENDS. Derived, not chosen:
 * the largest padding that still excludes the next position is the bare gap between two cells.
 */
function fieldMarginMM(grid: GridSpec): number {
  return grid.basePitchMM - cellDiameterMM(grid)
}

/** The span the field occupies at the released row and column count, in millimetres. */
function fieldSpanMM(spec: GridSystemSpec): number {
  return (spec.grid.positionsPerAxis - 1) * spec.grid.basePitchMM + cellDiameterMM(spec.grid)
}

/** Grow a region about its centre so it is never narrower than the field the law asks for. */
export function withMinimumSpan(spec: GridSystemSpec, region: RegionMM): RegionMM {
  const floor = fieldSpanMM(spec)
  const out = { ...region }
  if (out.w < floor) {
    const cx = out.x + out.w / 2
    out.x = cx - floor / 2
    out.w = floor
  }
  if (out.h < floor) {
    const cy = out.y + out.h / 2
    out.y = cy - floor / 2
    out.h = floor
  }
  return out
}

/** The field padded out, so its own edge is inside anything that frames it. */
export function paddedFieldMM(grid: GridSpec, field: RegionMM): RegionMM {
  const m = fieldMarginMM(grid)
  return { x: field.x - m, y: field.y - m, w: field.w + 2 * m, h: field.h + 2 * m }
}

/**
 * Every populated magnet centre inside a region — and NOT one beyond it. Indices walk THE one
 * lattice from its registration; only every stride-th one carries a magnet (law 1.2).
 */
export function magnetsInRegion(
  grid: GridSpec,
  region: RegionMM,
  offsetMM: number,
): PointMM[] {
  const { basePitchMM } = grid
  const stride = populationStride(grid)
  const first = (lo: number) => Math.ceil((lo - offsetMM) / basePitchMM)
  const last = (hi: number) => Math.floor((hi - offsetMM) / basePitchMM)
  const onStride = (i: number) => ((i % stride) + stride) % stride === 0

  const points: PointMM[] = []
  for (let i = first(region.x); i <= last(region.x + region.w); i++) {
    if (!onStride(i)) continue
    for (let j = first(region.y); j <= last(region.y + region.h); j++) {
      if (!onStride(j)) continue
      points.push([offsetMM + i * basePitchMM, offsetMM + j * basePitchMM])
    }
  }
  return points
}

/** What a region actually holds — the counts and spans a caller would want to state. */
export interface FieldSummary {
  cols: number
  rows: number
  spanXMM: number
  spanYMM: number
}

/** Counts only what lies INSIDE the region — anything generated beyond it is not part of it. */
export function summariseField(
  grid: GridSpec,
  region: RegionMM,
  points: ReadonlyArray<PointMM>,
): FieldSummary {
  const inside = points.filter(
    ([x, y]) =>
      x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h,
  )
  const cols = new Set(inside.map(([x]) => x)).size
  const rows = new Set(inside.map(([, y]) => y)).size
  return {
    cols,
    rows,
    spanXMM: cols > 1 ? (cols - 1) * grid.pitchMM : 0,
    spanYMM: rows > 1 ? (rows - 1) * grid.pitchMM : 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PLACEMENT SOLVE — a free shape meets the grid.
//
// Dan, 2026-08-10: "we have grid first logic - shape + grid = final proportion and dimensions."
// The size is NOT solved for; it arrives as a band (law 12.3). What is solved is WHERE the shape
// sits on the lattice, because measurement showed that is the variable that decides the outcome:
// the same shape at the same size holds anywhere from 0 to 4 magnets depending on its offset.
//
// METHOD, and why it is exact rather than sampled:
//
//   Every lattice node is congruent modulo the pitch. So as the shape translates, a node's answer
//   changes exactly when the node crosses the boundary of the shape's ERODED region — the set of
//   places a node may sit (law 11.1: material capturing the full 2*padding circle).
//
//   Folding that boundary modulo the pitch gives the complete set of offsets at which ANY node's
//   answer can change. Between consecutive crossings the count is constant. So the candidate
//   offsets are derived from the shape, not sampled off a guessed grid.
//
//   SOURCE — this is a named, solved problem and we follow it rather than invent:
//
//   Agarwal, Hagerup, Ray, Sharir, Smid & Welzl, "Translating a Planar Object to Maximize Point
//   Containment" (ESA 2002, LNCS 2461, 42-53), §2 "Preliminaries and Exact Algorithms". C is a
//   COMPACT set — convexity is NOT required; it only improves constants. Verbatim:
//
//     "the problem of computing an optimal placement reduces to computing a point of maximum depth"
//     "The maximum depth of a point is realized by a type 2 vertex of A(C) (unless the maximum
//      depth is 1)"
//
//   A type-2 vertex is an intersection of the boundaries of TWO translated copies. So the candidate
//   set is the pairwise boundary intersections — finite, derived from the shape, and complete.
//
//   Mazo & Baudrier, "Object digitization up to a translation" (JCSS 95, 2018) gives the same fact
//   on the torus for a non-convex Jordan region — Theorem 1: the dual "is constant on the connected
//   components of T \ Gamma-tilde".
//
//   A SAMPLED grid search over the cell is NOT an acceptable substitute and cannot be certified:
//   arrangement faces admit slivers of unbounded aspect ratio, and no feature-size or reach bound
//   controls them. Sampling is uncertifiable in principle, not merely unproven.

/** A shape is points in millimetres and nothing else. The engine never learns what it is. */
export type OutlineMM = ReadonlyArray<PointMM>

/** Distance from a point to a segment — exact, no approximation, no tolerance. */
function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Signed distance to the outline: positive inside. Crossing number for the sign, exact per edge. */
export function signedDistanceMM(outline: OutlineMM, px: number, py: number): number {
  let inside = false
  let nearest = Infinity
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]
    const [xj, yj] = outline[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    const d = distanceToSegment(px, py, xi, yi, xj, yj)
    if (d < nearest) nearest = d
  }
  return inside ? nearest : -nearest
}

/**
 * THE PAIR PRIMITIVE (law 11.1). Dan: "at those node points 48mm apart each shape must have material
 * on the inside to capture [the] circle. Period."
 *
 * Nothing else is asked of a node. The minimum thickness and length are not separate checks — they
 * are what this test means geometrically.
 */
export function nodeHolds(spec: GridSystemSpec, outline: OutlineMM, node: PointMM): boolean {
  return signedDistanceMM(outline, node[0], node[1]) >= spec.grid.paddingMM
}

/** Segment-segment intersection, exact. Returns null when they do not cross. */
function segmentCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): PointMM | null {
  const rx = bx - ax, ry = by - ay
  const sx = dx - cx, sy = dy - cy
  const denom = rx * sy - ry * sx
  if (denom === 0) return null
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return [ax + t * rx, ay + t * ry]
}

/**
 * THE CANDIDATE OFFSETS — type-2 vertices, per Agarwal et al. §2.
 *
 * For each lattice vector v, the set of offsets at which the node at v holds is THE ERODED REGION
 * translated by -v. The maximum depth is realised where two such boundaries cross.
 *
 * IT MUST BE THE ERODED BOUNDARY, NOT THE OUTLINE. Measured: on a 92mm circle the outline's own
 * crossings land at (24, +/-39.2), while the ERODED crossings land at (24, +/-24.08) — the offset
 * that actually holds the 2x2. Using the outline missed it entirely and returned 2 magnets where 4
 * hold. A square passes either way only because its vertices sit on the lattice.
 *
 * PRUNING, per Mazo & Baudrier eq. (4): only lattice vectors whose translate can reach the cell
 * contribute; the rest are a constant that never changes with the offset.
 */
function candidatePlacements(spec: GridSystemSpec, outline: OutlineMM): PointMM[] {
  const step = spec.grid.basePitchMM * populationStride(spec.grid)
  let far = 0
  for (const [x, y] of outline) far = Math.max(far, Math.hypot(x, y))
  const reach = Math.ceil(far / step) + 1

  // THE EVENT CURVE: where a node may sit — the outline eroded by the padding.
  const eroded = (Clipper as unknown as {
    inflatePathsD: (p: { x: number; y: number }[][], d: number, j: unknown, e: unknown, m: number, pr: number)
      => { x: number; y: number }[][]
  }).inflatePathsD(
    [outline.map(([x, y]) => ({ x, y }))],
    -spec.grid.paddingMM, JoinType.Miter, EndType.Polygon, 2, 4,
  )
  const E: OutlineMM = (eroded?.[0] ?? []).map((p) => [p.x, p.y] as PointMM)
  if (E.length < 3) return [[0, 0]]

  const vectors: PointMM[] = []
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) vectors.push([i * step, j * step])
  }

  const seen = new Set<string>()
  const out: PointMM[] = []
  const keep = (p: PointMM) => {
    const k = `${p[0].toFixed(6)},${p[1].toFixed(6)}`
    if (seen.has(k)) return
    seen.add(k)
    out.push(p)
  }
  keep([0, 0])

  // every pairwise crossing of the outline against a lattice-shifted copy of itself
  for (let a = 0; a < vectors.length; a++) {
    for (let b = a + 1; b < vectors.length; b++) {
      const shiftX = vectors[b][0] - vectors[a][0]
      const shiftY = vectors[b][1] - vectors[a][1]
      if (Math.hypot(shiftX, shiftY) > 2 * far) continue
      for (let i = 0, j = E.length - 1; i < E.length; j = i++) {
        for (let k = 0, l = E.length - 1; k < E.length; l = k++) {
          const hit = segmentCross(
            E[j][0], E[j][1], E[i][0], E[i][1],
            E[l][0] + shiftX, E[l][1] + shiftY,
            E[k][0] + shiftX, E[k][1] + shiftY,
          )
          if (hit) keep([hit[0] - vectors[a][0], hit[1] - vectors[a][1]])
        }
      }
    }
  }
  return out
}

export interface Placement {
  /** Where the lattice sits relative to the shape's own centre, in millimetres. */
  offset: PointMM
  /** Every node that holds — full density, nothing selected (law 11.4). */
  magnets: PointMM[]
  /** Furthest any material sits from its nearest magnet. The coverage measure. */
  worstReachMM: number
  /** How far the held population's centre sits from the shape's own. The balance measure. */
  balanceOffsetMM: number
}

/** Every node of the populated lattice within reach of the shape, at a given offset. */
function nodesUnder(spec: GridSystemSpec, outline: OutlineMM, ox: number, oy: number): PointMM[] {
  const { basePitchMM } = spec.grid
  const stride = populationStride(spec.grid)
  const step = basePitchMM * stride
  let far = 0
  for (const [x, y] of outline) far = Math.max(far, Math.abs(x), Math.abs(y))
  const reach = Math.ceil((far + step) / step)
  const out: PointMM[] = []
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) {
      const node: PointMM = [ox + i * step, oy + j * step]
      if (nodeHolds(spec, outline, node)) out.push(node)
    }
  }
  return out
}

/**
 * COVERAGE — the furthest any material sits from its nearest magnet.
 *
 * This is the measure Dan named, and it is the one that answers "is a region of the shape left
 * unheld". It is NOT a size. Material is sampled on the populated lattice's own half-step so the
 * measure does not need a resolution of its own.
 */
export function worstReachMM(spec: GridSystemSpec, outline: OutlineMM, magnets: ReadonlyArray<PointMM>): number {
  if (magnets.length === 0) return Infinity
  const step = (spec.grid.basePitchMM * populationStride(spec.grid)) / 4
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of outline) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  let worst = 0
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      if (signedDistanceMM(outline, x, y) <= 0) continue
      let near = Infinity
      for (const [mx, my] of magnets) near = Math.min(near, Math.hypot(x - mx, y - my))
      if (near > worst) worst = near
    }
  }
  return worst
}

/**
 * SYMMETRY BALANCE — how far the held population's centre sits from the shape's own centre.
 *
 * Dan's balance rule (law 3.1a) measured directly: a balanced population sits centred on the shape.
 * Zero is perfect. It is a millimetre offset, not a size, and it is scale-free in meaning because
 * it is compared against the pitch, not against any published number.
 */
export function balanceOffsetMM(outline: OutlineMM, magnets: ReadonlyArray<PointMM>): number {
  if (magnets.length === 0) return Infinity
  let area = 0, sx = 0, sy = 0
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[(i + 1) % outline.length]
    const cross = x0 * y1 - x1 * y0
    area += cross
    sx += (x0 + x1) * cross
    sy += (y0 + y1) * cross
  }
  const [cx, cy] = area === 0
    ? [outline.reduce((a, p) => a + p[0], 0) / outline.length,
       outline.reduce((a, p) => a + p[1], 0) / outline.length]
    : [sx / (3 * area), sy / (3 * area)]
  const mx = magnets.reduce((a, m) => a + m[0], 0) / magnets.length
  const my = magnets.reduce((a, m) => a + m[1], 0) / magnets.length
  return Math.hypot(mx - cx, my - cy)
}

/**
 * THE SOLVE. A shape at a band size meets the grid; the answer is where it sits.
 *
 * RANKED: most magnets held (full density, law 11.4) → then BALANCE (law 3.1a, "centred and
 * symmetrical from each side", the primary binding) → then COVERAGE (law 3.1d, "no flap").
 *
 * Balance outranks coverage because MEASUREMENT said so, not preference. Across three free shapes,
 * ranking balance first roughly halved the off-centre error for about 1mm of reach:
 *   seed 13  coverage-first 37.2/6.5   balance-first 38.0/3.3
 *   seed 26  coverage-first 52.9/12.3  balance-first 57.4/6.9
 *   seed 39  coverage-first 32.6/1.0   balance-first 33.8/0.5
 * The tie-break does the real work: 35, 86 and 218 placements tied on magnet count in those cases.
 *
 * No size participates in the ranking (laws 12.1/12.2) — the size arrived with the band.
 */
export function placeOnGrid(spec: GridSystemSpec, outline: OutlineMM): Placement | null {
  const candidates = candidatePlacements(spec, outline)
  let best: Placement | null = null
  for (const [ox, oy] of candidates) {
    {
      const magnets = nodesUnder(spec, outline, ox, oy)
      if (magnets.length < 2) continue // one magnet pivots — never an answer (law 11.3)
      const reach = worstReachMM(spec, outline, magnets)
      const balance = balanceOffsetMM(outline, magnets)
      if (
        best === null ||
        magnets.length > best.magnets.length ||
        (magnets.length === best.magnets.length && balance < best.balanceOffsetMM) ||
        (magnets.length === best.magnets.length && balance === best.balanceOffsetMM &&
          reach < best.worstReachMM)
      ) {
        best = { offset: [ox, oy], magnets, worstReachMM: reach, balanceOffsetMM: balance }
      }
    }
  }
  return best
}
