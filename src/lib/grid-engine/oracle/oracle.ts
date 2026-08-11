// THE INDEPENDENT ORACLE — blueprint §11.1. "It does not share production geometry."
//
// Deliberately different mathematics from the solver, so agreement means something:
//   · the solver finds exact contact-event intervals; the oracle WALKS every publishable even size
//     from the count-derived ceiling and tests each directly ("iterates every publishable even
//     longest-side size derived from the 9-count ceiling");
//   · the solver's containment is corner + subsegment-witness classification against exact
//     predicates; the oracle rasterises each pair box's boundary densely and tests every sample
//     with ITS OWN ray-crossing point-in-polygon — no import from solver/exact or solver/contacts;
//   · arrangements are re-derived from §6's grammar with the oracle's own adjacency and components.
//
// The oracle is slow by design; that is why it can check the engine and cannot be it. An even-size
// oracle cannot prove an interval containing no publishable integer — the event solver's analytic
// fixtures cover those (§11.1).
//
// It shares TYPES AND FIXTURES only (§11.1): the request shape and the family identity fields it
// compares — band, centreMethod, publishedEvenMM, and the two arrangements' vertex sets.

import type { GridEngineSpec, PointMM, SolveRequest } from '../solver/contract'

export interface OracleFamilyKey {
  readonly band: number
  readonly centreMethod: string
  readonly publishedEvenMM: number
  /** sorted engine-frame vertex keys of the base and sparse arrangements */
  readonly baseVertices: string
  readonly sparseVertices: string
}

/**
 * The oracle's OWN containment — ray crossing plus a CLOSED-BOUNDARY inclusion.
 *
 * Canon containment is closed: tangency is lawful, and the square's own coupled families publish
 * exactly AT tangency (the sparse pair meets the outline at precisely 168). A float sampler cannot
 * express "exactly on the boundary", so the oracle includes points within ORACLE_BOUNDARY_SLACK of
 * the boundary. This is a TEST-SIDE comparison slack for closed semantics — the production engine
 * carries no tolerance anywhere (§9); §11.1 already assigns exact boundary proof to the analytic
 * fixtures, not the even-size oracle.
 */
const ORACLE_BOUNDARY_SLACK = 1e-6

function oracleInside(x: number, y: number, poly: ReadonlyArray<readonly [number, number]>): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  if (c) return true
  // closed boundary: within slack of any edge counts as contained
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1]
    const bx = poly[i][0], by = poly[i][1]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    const px = ax + t * dx, py = ay + t * dy
    if ((x - px) * (x - px) + (y - py) * (y - py) <= ORACLE_BOUNDARY_SLACK * ORACLE_BOUNDARY_SLACK) return true
  }
  return false
}

/** The oracle's OWN box-in-polygon test: dense boundary sampling + the four corners. */
function oracleBoxContained(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  poly: ReadonlyArray<readonly [number, number]>,
  samplesPerEdge: number,
): boolean {
  const test = (px: number, py: number) => oracleInside(px, py, poly)
  for (const [cx, cy] of [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]) {
    if (!test(cx, cy)) return false
  }
  for (let s = 1; s < samplesPerEdge; s++) {
    const t = s / samplesPerEdge
    if (!test(x0 + (x1 - x0) * t, y0)) return false
    if (!test(x0 + (x1 - x0) * t, y1)) return false
    if (!test(x0, y0 + (y1 - y0) * t)) return false
    if (!test(x1, y0 + (y1 - y0) * t)) return false
  }
  return true
}

/** §5/§6.1 re-derived: the centred run and parity target, the oracle's own copy. */
function oracleRun(pitch: number, k: number): number[] {
  const shift = Math.floor((k - 1) / 2)
  return Array.from({ length: k }, (_, i) => pitch * (i - shift))
}

const oracleTarget = (k: number, basePitch: number) => (k % 2 === 1 ? 0 : basePitch / 2)

interface OracleArrangement {
  readonly vertices: ReadonlyArray<readonly [number, number]>
  readonly key: string
}

/** §6.2 re-derived: active pair edges by direct box test; components by the oracle's own union-find. */
function oracleArrangements(
  windowPoints: ReadonlyArray<readonly [number, number]>,
  pitch: number,
  padding: number,
  targetX: number,
  targetY: number,
  scaledPoly: ReadonlyArray<readonly [number, number]>,
  samplesPerEdge: number,
): OracleArrangement[] {
  const edges: Array<[number, number]> = []
  for (let i = 0; i < windowPoints.length; i++) {
    for (let j = i + 1; j < windowPoints.length; j++) {
      const dx = Math.abs(windowPoints[i][0] - windowPoints[j][0])
      const dy = Math.abs(windowPoints[i][1] - windowPoints[j][1])
      if (!((dx === pitch && dy === 0) || (dy === pitch && dx === 0))) continue
      const bx0 = Math.min(windowPoints[i][0], windowPoints[j][0]) - padding - targetX
      const by0 = Math.min(windowPoints[i][1], windowPoints[j][1]) - padding - targetY
      const bx1 = Math.max(windowPoints[i][0], windowPoints[j][0]) + padding - targetX
      const by1 = Math.max(windowPoints[i][1], windowPoints[j][1]) + padding - targetY
      if (oracleBoxContained(bx0, by0, bx1, by1, scaledPoly, samplesPerEdge)) edges.push([i, j])
    }
  }
  if (!edges.length) return []
  const parent = new Map<number, number>()
  const find = (v: number): number => {
    let r = v
    while (parent.get(r) !== r) r = parent.get(r)!
    return r
  }
  for (const [a, b] of edges) {
    for (const v of [a, b]) if (!parent.has(v)) parent.set(v, v)
    parent.set(find(a), find(b))
  }
  const groups = new Map<number, Set<number>>()
  for (const [a, b] of edges) {
    const r = find(a)
    if (!groups.has(r)) groups.set(r, new Set())
    groups.get(r)!.add(a)
    groups.get(r)!.add(b)
  }
  return [...groups.values()].map((vs) => {
    const vertices = [...vs].sort((a, b) => a - b).map((i) => windowPoints[i])
    return { vertices, key: vertices.map(([x, y]) => `${x},${y}`).join(';') }
  })
}

/**
 * §11.1: the complete oracle enumeration — every even size from 2·padding to the count-derived
 * field span, every operational band, both populations coupled at one size. Returns the canonical
 * family-key set for comparison against production output.
 */
export function oracleEnumerate(
  request: SolveRequest,
  centres: ReadonlyArray<{ method: string; centreMM: PointMM }>,
  samplesPerEdge = 24,
): OracleFamilyKey[] {
  const spec: GridEngineSpec = request.spec
  const fieldSpan = (spec.positionsPerAxis - 1) * spec.basePitchMM + 2 * spec.paddingMM
  const xs = request.outline.map((p) => p[0])
  const ys = request.outline.map((p) => p[1])
  const L = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const out: OracleFamilyKey[] = []

  for (const { method, centreMM } of centres) {
    const centred = request.outline.map(([x, y]) => [x - centreMM[0], y - centreMM[1]] as const)
    for (const band of spec.bands) {
      for (let m = 2 * Math.ceil(spec.paddingMM); m <= fieldSpan; m += 2) {
        const sigma = m / L
        const scaled = centred.map(([x, y]) => [x * sigma, y * sigma] as const)
        // every extent window, both populations, coupled at this size
        const perSlot = (['base', 'sparse'] as const).map((slot) => {
          const pitch = slot === 'base' ? spec.basePitchMM : spec.basePitchMM * spec.sparseFactor
          const found: Array<{ arr: OracleArrangement; tx: number; ty: number }> = []
          for (let r = 1; r <= band; r++) {
            for (let c = 1; c <= band; c++) {
              const tx = oracleTarget(c, spec.basePitchMM)
              const ty = oracleTarget(r, spec.basePitchMM)
              const pts: Array<readonly [number, number]> = []
              for (const y of oracleRun(pitch, r)) for (const x of oracleRun(pitch, c)) pts.push([x, y])
              for (const arr of oracleArrangements(pts, pitch, spec.paddingMM, tx, ty, scaled, samplesPerEdge)) {
                found.push({ arr, tx, ty })
              }
            }
          }
          return found
        })
        for (const b of perSlot[0]) {
          for (const s of perSlot[1]) {
            if (b.tx !== s.tx || b.ty !== s.ty) continue
            out.push({
              band,
              centreMethod: method,
              publishedEvenMM: m,
              baseVertices: b.arr.key,
              sparseVertices: s.arr.key,
            })
          }
        }
      }
    }
  }
  return out
}
