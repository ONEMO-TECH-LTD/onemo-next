/**
 * GRID-FIRST ARITHMETIC — the neutral core (KAI-10044).
 *
 * Dan, 08-02/08-03: "grid law defines the sizes" · "the algorythm has a goal to wrap arround that
 * buffer padding and find the size match at each grid expansion redaction step on x and y axis" ·
 * "the standard mode must show all magnets - the light perimeter only".
 *
 * The engine does NOT walk candidate millimetres asking which grid fits. It walks grid populations
 * and COMPUTES the contour size each one requires. Nothing here reads a shape name, a source label,
 * or a stored catalogue value. Mode selects the magnet mask; everything else is arithmetic.
 */
import type { Contour, Pt } from './types'
import { pointInContour } from './polygon'

export type GridMask = 'all' | 'perimeter'

export interface GridFirstStep {
  /** lattice columns x rows — the 2-D construction identity. Never collapsed to one number. */
  nx: number
  ny: number
  /** magnets delivered after the mode mask */
  points: number
  /** exact size at which the contour wraps this population with `paddingMM` clearance */
  exactSizeMM: number
  /** published size: exact, rounded up to an even whole millimetre (3.23) */
  sizeMM: number
  anchors: Pt[]
}

/** Signed clearance: inside the material and at least this far from every boundary, holes included. */
function clearance(p: Pt, c: Contour): number {
  let min = Infinity
  for (const ring of [c.outer, ...c.holes]) {
    const pts = ring.pts
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      const dx = b[0] - a[0], dy = b[1] - a[1]
      const l2 = dx * dx + dy * dy
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
      min = Math.min(min, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)))
    }
  }
  return pointInContour(p, c) ? min : -min
}

/** The mode mask. Standard = every magnet in the block; Light = the block's boundary ring. */
export function maskPopulation(nx: number, ny: number, pitchMM: number, mask: GridMask): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const interior = i > 0 && i < nx - 1 && j > 0 && j < ny - 1
      if (mask === 'perimeter' && interior) continue
      out.push([(i - (nx - 1) / 2) * pitchMM, (j - (ny - 1) / 2) * pitchMM])
    }
  }
  return out
}

function centreOf(c: Contour): Pt {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of c.outer.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return [(x0 + x1) / 2, (y0 + y1) / 2]
}

/**
 * THE INVERSE. Given a population, return the smallest size at which the contour wraps it with
 * `paddingMM` clearance on every magnet — the size is COMPUTED, never scanned.
 *
 * NOTE — inherited assumption, stated rather than hidden: feasibility is taken to be monotone in
 * size. That holds for convex and star-shaped outlines and is what the previous size-scan assumed
 * implicitly. It is NOT guaranteed for a concave outline whose scaling origin lies outside its
 * kernel (a crescent): there, admissibility can flip twice as size grows. Such contours need the
 * certified solve, not this bisection. Control: `/tmp/nonmono.mjs`.
 */
export function wrapSizeFor(
  makeShape: (sizeMM: number) => Contour,
  population: ReadonlyArray<Pt>,
  paddingMM: number,
  maxSizeMM: number,
): number | null {
  const holds = (s: number): boolean => {
    const c = makeShape(s)
    const [cx, cy] = centreOf(c)
    return population.every(([x, y]) => clearance([x + cx, y + cy], c) >= paddingMM - 1e-9)
  }
  if (!holds(maxSizeMM)) return null
  let lo = 1, hi = maxSizeMM
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; holds(m) ? hi = m : lo = m }
  return hi
}

/**
 * The ladder. Walk grid populations — each successor one lattice step on X or Y (1.8, 3.24) —
 * and compute the size each requires. Construction identity stays two-dimensional: an X step, a Y
 * step and a square step may share a maximum extent while being different populations, so nothing
 * is ever keyed or deduplicated on a scalar.
 */
export function gridFirstLadder(
  makeShape: (sizeMM: number) => Contour,
  opts: { pitchMM: number; mask: GridMask; paddingMM: number; maxSizeMM: number; minAnchors?: number },
): GridFirstStep[] {
  const { pitchMM, mask, paddingMM, maxSizeMM, minAnchors = 2 } = opts
  const span = Math.floor(maxSizeMM / pitchMM) + 2
  const steps: GridFirstStep[] = []
  for (let nx = 1; nx <= span; nx++) {
    for (let ny = 1; ny <= span; ny++) {
      const population = maskPopulation(nx, ny, pitchMM, mask)
      if (population.length < minAnchors) continue
      const exact = wrapSizeFor(makeShape, population, paddingMM, maxSizeMM)
      if (exact === null) continue
      const sizeMM = 2 * Math.ceil(exact / 2)
      if (sizeMM > maxSizeMM) continue
      const c = makeShape(sizeMM), [cx, cy] = centreOf(c)
      steps.push({ nx, ny, points: population.length, exactSizeMM: exact, sizeMM,
        anchors: population.map(([x, y]) => [x + cx, y + cy] as Pt) })
    }
  }
  // Publication (never discovery): at a shared published size the richest construction wins, and a
  // rung must beat every smaller rung on magnet count or it is not a step.
  const best = new Map<number, GridFirstStep>()
  for (const s of steps) { const c = best.get(s.sizeMM); if (!c || s.points > c.points) best.set(s.sizeMM, s) }
  const out: GridFirstStep[] = []
  let top = 0
  for (const s of [...best.values()].sort((a, b) => a.sizeMM - b.sizeMM)) if (s.points > top) { out.push(s); top = s.points }
  return out
}
