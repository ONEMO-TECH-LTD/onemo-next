// grid-engine/solve.ts — SUB 1 continued. The SOLVE: a shape goes in, a layout and a size come out.
//
// Dan, 2026-08-10: "place a shape, pull the handles, it snaps itself to the magnets — any shape,
// geometric or not, automatic and fail-proof", and "research prior art first, reuse or approximate
// it, do not invent."
//
// Nothing here is invented. Four standard steps, in this order:
//
//   1. THE LEGAL REGION IS AN EROSION, NOT A TEST. A magnet centre is legal exactly when it lies
//      inside the outline shrunk by paddingMM. That is the inward polygon offset every CAM tool
//      does. Computed here as an exact signed distance to the boundary, which IS the erosion
//      evaluated at a point: `inside AND distance-to-edge >= padding`. There is no epsilon, so the
//      historical 9.947mm class cannot recur — clearance is geometry, not a comparison that a
//      tolerance can soften, and Dan has now deleted tolerance outright.
//
//   2. THE LADDER IS A SORT, NOT A SEARCH. The lattice is fixed and the shape scales. Scaling a
//      shape scales its distance field: dist(sP, q) = s * dist(P, q/s). So for each lattice point
//      there is a scale at which it FIRST becomes legal. Collect those, sort them, and the sorted
//      list is the ladder — each distinct value a rung. This replaces the 200,000-attempt search
//      the old build ran, and it cannot land on an illegal size because every rung is a solution.
//
//   3. BALANCE IS A FILTER OVER CANDIDATES, NOT A RULE ABOUT SHAPES. Dan's 162mm star has a
//      mathematically smaller four-magnet fit at 130mm — reached by shoving all four into the
//      fattest lobe. Correct arithmetic, rejected on sight. So balance is applied BEFORE tightest-
//      wins, and it is measured against the shape's own centroid and its own axes. No shape is
//      named anywhere; the star is excluded by construction rather than by a rule written for stars.
//
//   4. REGISTRATION IS FOUR COMBINATIONS, NOT A SEARCH SPACE. point/gap on each axis. Solve all
//      four and keep the best. Which registration a shape ships with is then the ENGINE'S ANSWER
//      for that shape — never a default anyone sets.
//
// Consequences that fall out rather than being coded: a circle and a 3:1 oval differ because their
// distance fields differ; rotating the shape rotates the answer because everything is defined from
// the shape's own centroid; changing padding or pitch moves every output because nothing is pinned.

import type { GridSystemSpec, Registration } from './spec'
import { cellDiameterMM, registrationOffsetMM, type PointMM } from './engine'

/** A shape is points in millimetres and nothing more. The engine never learns what it is. */
export type OutlineMM = ReadonlyArray<PointMM>

export interface Layout {
  /** The shape's size — its longest bounding-box side at the solved scale. */
  sizeMM: number
  /** What the outline was multiplied by to reach it. */
  scale: number
  /** The magnet centres, in the solved shape's own millimetres. */
  magnets: PointMM[]
  /** Where the lattice registered against the shape, per axis. The engine's answer, not an input. */
  registration: { x: Registration; y: Registration }
}

// ── the shape, measured on its own terms ────────────────────────────────────

/** Area centroid. Everything downstream is defined from it, which is what makes rotation free. */
function centroidOf(outline: OutlineMM): PointMM {
  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[(i + 1) % outline.length]
    const cross = x0 * y1 - x1 * y0
    twiceArea += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  if (twiceArea === 0) {
    // degenerate ring — fall back to the mean of its vertices rather than divide by zero
    const n = outline.length
    return [outline.reduce((a, p) => a + p[0], 0) / n, outline.reduce((a, p) => a + p[1], 0) / n]
  }
  const k = 1 / (3 * twiceArea)
  return [cx * k, cy * k]
}

function boundsOf(outline: OutlineMM) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/** Translate so the shape's own centroid is the origin. Every later step is centroid-relative. */
function centred(outline: OutlineMM): PointMM[] {
  const [cx, cy] = centroidOf(outline)
  return outline.map(([x, y]) => [x - cx, y - cy] as PointMM)
}

// ── step 1: the legal region, as an exact erosion evaluated at a point ──────

function pointInPolygon(outline: OutlineMM, qx: number, qy: number): boolean {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]
    const [xj, yj] = outline[j]
    const straddles = yi > qy !== yj > qy
    if (straddles && qx < ((xj - xi) * (qy - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distanceToEdge(outline: OutlineMM, qx: number, qy: number): number {
  let best = Infinity
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]
    const [xj, yj] = outline[j]
    const dx = xj - xi
    const dy = yj - yi
    const lenSq = dx * dx + dy * dy
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((qx - xi) * dx + (qy - yi) * dy) / lenSq))
    const ex = xi + t * dx
    const ey = yi + t * dy
    const d = Math.hypot(qx - ex, qy - ey)
    if (d < best) best = d
  }
  return best
}

/**
 * Signed distance to the boundary: positive inside, negative outside. Positive-and-at-least-padding
 * is precisely "inside the eroded region", which is the whole clearance law with nothing to soften.
 */
export function signedDistanceMM(outline: OutlineMM, qx: number, qy: number): number {
  const d = distanceToEdge(outline, qx, qy)
  return pointInPolygon(outline, qx, qy) ? d : -d
}

/**
 * Is a world point legal when the shape is drawn at `scale`?
 *
 * dist(scale * P, q) = scale * dist(P, q / scale) — so the shape is never rebuilt at each scale;
 * the point is measured against the unit shape instead. Exact, and free.
 */
function legalAt(
  unit: OutlineMM,
  paddingMM: number,
  scale: number,
  [qx, qy]: PointMM,
): boolean {
  return scale * signedDistanceMM(unit, qx / scale, qy / scale) >= paddingMM
}

// ── step 2: the ladder — the scales at which each lattice point first becomes legal ──

/**
 * The smallest scale at which a point is legal, or null if it never is inside the range.
 *
 * Scanned coarsely first, then bisected inside the interval the scan found. That order is what makes
 * a deep concavity safe: a point can leave the legal region as the shape grows, so legality is an
 * INTERVAL, not a threshold — the scan finds where an interval starts rather than assuming there is
 * only one crossing. (Cheap to do correctly now, expensive to retrofit — s62-meta.)
 */
function firstLegalScale(
  unit: OutlineMM,
  paddingMM: number,
  point: PointMM,
  minScale: number,
  maxScale: number,
  scanSteps: number,
  refineSteps: number,
): number | null {
  const step = (maxScale - minScale) / scanSteps
  let lo: number | null = null
  let hi = minScale
  for (let i = 0; i <= scanSteps; i++) {
    const s = minScale + i * step
    if (legalAt(unit, paddingMM, s, point)) {
      hi = s
      lo = i === 0 ? null : s - step
      break
    }
  }
  if (lo === null) return legalAt(unit, paddingMM, minScale, point) ? minScale : null

  let a = lo
  let b = hi
  for (let i = 0; i < refineSteps; i++) {
    const mid = (a + b) / 2
    if (legalAt(unit, paddingMM, mid, point)) b = mid
    else a = mid
  }
  return b
}

// ── step 3: balance — the filter that outranks smallest ─────────────────────

/** Mean position of a population. A balanced one sits on the shape's centroid, which is the origin. */
function populationCentroid(points: ReadonlyArray<PointMM>): PointMM {
  const n = points.length
  return [points.reduce((a, p) => a + p[0], 0) / n, points.reduce((a, p) => a + p[1], 0) / n]
}

/**
 * Is the population unchanged by reflection in the given axis through the origin?
 *
 * Exact: every magnet's mirror must also be a magnet. This is what rejects the bunched-into-one-lobe
 * layout — its mirror image is empty — and it is what accepts a 1-1-3 triangle, whose rows mirror
 * about the vertical even though the population is not symmetric top-to-bottom.
 */
function mirrorsOnto(points: ReadonlyArray<PointMM>, axis: 'x' | 'y', tolMM: number): boolean {
  return points.every(([x, y]) => {
    const mx = axis === 'y' ? -x : x
    const my = axis === 'x' ? -y : y
    return points.some(([ax, ay]) => Math.hypot(ax - mx, ay - my) <= tolMM)
  })
}

/** Does the outline itself mirror in that axis? Only then may the population be asked to. */
function outlineMirrors(unit: OutlineMM, axis: 'x' | 'y', tolMM: number): boolean {
  return unit.every(([x, y]) => {
    const mx = axis === 'y' ? -x : x
    const my = axis === 'x' ? -y : y
    return signedDistanceMM(unit, mx, my) >= -tolMM
  })
}

interface Candidate {
  scale: number
  magnets: PointMM[]
}

/**
 * The hard constraints. A layout failing any of these is not a worse answer — it is not an answer.
 *
 *   GRAVITY (§3.1c) — at least one magnet above the shape's centroid, so the top is held rather than
 *   hanging off a single bottom row.
 *
 *   SYMMETRY (§3.1a) — where the SHAPE mirrors, the population must mirror with it. Measured against
 *   the shape's own axes, so no shape is named and a rotated shape rotates its answer.
 *
 *   CENTRING (§3.1a) — the population's centroid on the shape's. Bounded by half the populated pitch:
 *   an offset of that size means the population has slid a whole magnet off centre, which is the
 *   130mm-star failure exactly. The bound is read off the lattice, not chosen.
 */
function balanced(
  spec: GridSystemSpec,
  unit: OutlineMM,
  scale: number,
  magnets: ReadonlyArray<PointMM>,
): boolean {
  if (magnets.length === 0) return false

  // NO FLAP (§3.1d). Dan, 2026-08-10: "perfect shape x grid match is 4 points balanced and
  // symmetrically centred on the shape", and of his star: "1 column x 2 rows works, or 2x2, which is
  // optimal — the second." So a population must SPAN the grid in both axes: two distinct columns and
  // two distinct rows. A single column of two is centred, symmetric and gravity-supported, so it
  // passed every other constraint and won on every shape — it is precisely the layout he called
  // workable but not optimal, and the shape pivots about its axis with nothing holding the sides.
  //
  // This is his sentence transcribed, not a threshold anyone picked. It is why 4@88 beats 2@68.
  const columns = new Set(magnets.map(([x]) => x)).size
  const rows = new Set(magnets.map(([, y]) => y)).size
  if (columns < 2 || rows < 2) return false

  const above = magnets.some(([, y]) => y > 0)
  if (!above) return false

  const [cx, cy] = populationCentroid(magnets)
  const centreBound = spec.grid.pitchMM / 2
  if (Math.hypot(cx, cy) >= centreBound) return false

  // a magnet may land anywhere on the lattice, so two magnets "match" when they are the same magnet
  const same = spec.grid.pitchMM / 2
  const shapeTol = Math.max(...unit.map(([x, y]) => Math.hypot(x, y))) / spec.solver.scanSteps
  for (const axis of ['x', 'y'] as const) {
    if (outlineMirrors(unit, axis, shapeTol) && !mirrorsOnto(magnets, axis, same)) return false
  }
  return true
}

// ── step 4: the four registrations, and the answer ──────────────────────────

function candidatesFor(
  spec: GridSystemSpec,
  unit: OutlineMM,
  radius: number,
  regX: Registration,
  regY: Registration,
  minScale: number,
  maxScale: number,
): Candidate[] {
  const { basePitchMM, pitchMM, paddingMM } = spec.grid
  const offX = registrationOffsetMM({ ...spec.grid }, regX)
  const offY = registrationOffsetMM({ ...spec.grid }, regY)
  const stride = pitchMM / basePitchMM

  const reach = radius * maxScale

  const lattice: PointMM[] = []
  const span = Math.ceil(reach / (basePitchMM * stride))
  for (let i = -span; i <= span; i++) {
    for (let j = -span; j <= span; j++) {
      lattice.push([offX + i * basePitchMM * stride, offY + j * basePitchMM * stride])
    }
  }

  const thresholds = lattice
    .map((q) =>
      firstLegalScale(unit, paddingMM, q, minScale, maxScale, spec.solver.scanSteps, spec.solver.refineSteps),
    )
    .filter((s): s is number => s !== null)

  const rungs = [...new Set(thresholds.map((s) => s))].sort((a, b) => a - b)

  return rungs.map((scale) => ({
    scale,
    magnets: lattice.filter((q) => legalAt(unit, paddingMM, scale, q)),
  }))
}

/**
 * THE ENGINE. A shape and the values go in; a layout and a size come out.
 *
 * Balance filters first, then the tightest survivor wins — that ordering IS law 3.2, and it is what
 * makes the 130mm answer impossible to return rather than merely discouraged.
 */
export function solveLayout(spec: GridSystemSpec, outline: OutlineMM): Layout | null {
  if (outline.length < 3) return null

  const unit = centred(outline)

  // THE SHAPE'S OWN SIZE, measured rotation-invariantly: the farthest point from its centroid.
  // The bounding box is NOT invariant — turn a shape 45 degrees and its box grows — so deriving the
  // scale range from a box made the whole solve depend on how the artwork happened to be sitting.
  const radius = Math.max(...unit.map(([x, y]) => Math.hypot(x, y)))
  if (radius <= 0) return null

  const longest = Math.max(boundsOf(unit).w, boundsOf(unit).h)
  const minScale = (cellDiameterMM(spec.grid) + spec.grid.paddingMM) / radius
  const maxScale = spec.grid.maxSizeMM / (radius + radius)
  if (maxScale <= minScale) return null

  let best: { candidate: Candidate; registration: Layout['registration'] } | null = null
  for (const regX of ['point', 'gap'] as const) {
    for (const regY of ['point', 'gap'] as const) {
      for (const candidate of candidatesFor(spec, unit, radius, regX, regY, minScale, maxScale)) {
        if (!balanced(spec, unit, candidate.scale, candidate.magnets)) continue
        if (best === null || candidate.scale < best.candidate.scale) {
          best = { candidate, registration: { x: regX, y: regY } }
        }
        break // rungs are sorted, so the first balanced one is this registration's tightest
      }
    }
  }
  if (best === null) return null

  return {
    sizeMM: longest * best.candidate.scale,
    scale: best.candidate.scale,
    magnets: best.candidate.magnets,
    registration: best.registration,
  }
}

/**
 * PUBLICATION (law 3.23) — the exact wrap rounded up to an even whole millimetre.
 *
 * Dan, 2026-07-29, having challenged the rule himself: *"we need round to the highest number
 * obviously not lowest because the shape must not be smaller than grid. And this also must round to
 * the next non-odd number so that grid is centered as well with no fractions — we cannot place
 * anything on a fraction, it is just humanly impossible with fabric."*
 *
 * ASKED AS A LEGALITY QUESTION, NOT AS ARITHMETIC ON A FLOAT. The exact wrap is a bisection result
 * carrying convergence noise, and `2 * ceil(x / 2)` amplifies a billionth of a millimetre into two
 * whole ones: a square solving to exactly 68 published as 70. So publication does not round the
 * float — it walks even whole millimetres and stops at the first one where every magnet still
 * clears its padding. Even by the step, up by the direction of the walk, never down.
 *
 * That also makes the clearance re-check STRUCTURAL: a size is published *because* it clears, so
 * publication cannot produce an illegal size even in principle. (s62-meta's ruling, 2026-08-10,
 * refusing a stated-precision value on the grounds that the arithmetic already existed here.)
 */
export function publishedSizeMM(spec: GridSystemSpec, outline: OutlineMM, layout: Layout): number {
  const unit = centred(outline)
  const longest = Math.max(boundsOf(unit).w, boundsOf(unit).h)
  const clears = (sizeMM: number) => {
    const scale = sizeMM / longest
    return layout.magnets.every((q) => legalAt(unit, spec.grid.paddingMM, scale, q))
  }
  let size = 2 * Math.floor(layout.sizeMM / 2)
  while (!clears(size)) size += 2
  return size
}
