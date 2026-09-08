import { transformLayout } from './transforms'
import { BOARD_HEIGHT_MM, BOARD_WIDTH_MM, RELEASED_PADDING_MM } from '../grid-magnet-spec'
import type { FrameExtent, LibraryLayout, LibraryTransform, PointMM } from './types'

/** THE RIM IN LATTICE UNITS — the released rim, expressed in the units a mask counts in. */
export const rimLattice = (pitchMM: number): number => RELEASED_PADDING_MM / pitchMM

/** THE BOARD IN POSITIONS, per lattice — the inverse of the flip below: millimetres to a position
 *  count. The board is fixed at 384x480mm of legal area; a coarser pitch reaches it with fewer
 *  positions (17x21 at 24mm, 9x11 at 48, 5x6 at 96). Lives here because geometry.ts is the one
 *  owner of every lattice<->mm conversion, in both directions. */
export function boardPositions(pitchMM: number): { cols: number; rows: number } {
  if (!Number.isFinite(pitchMM) || pitchMM <= 0) throw new Error('library: bad pitch ' + pitchMM)
  return {
    cols: Math.floor(BOARD_WIDTH_MM / pitchMM) + 1,
    rows: Math.floor(BOARD_HEIGHT_MM / pitchMM) + 1,
  }
}

/** THE LEGAL SPAN of a frame's canon population at a pitch, in millimetres — n positions span n-1
 *  gaps. The conversion half of bandOfFrame: rules.ts owns which band that span falls in. */
export function frameLegalSpanMM(frame: FrameExtent, pitchMM: number): number {
  return (Math.max(frame.cols, frame.rows) - 1) * pitchMM
}

/** THE PLACEMENT: a layout, under a view, at a pitch, in millimetres. Library canon counts rows
 *  downward from the top; millimetres count upward, so the flip happens here and nowhere else.
 *  It was written twice — once for the canvas, once for the chip label — and the two disagreeing
 *  is exactly what put a 120x120 chip on a 135x135 shape (08-26). */
export function placeMM(
  frame: FrameExtent, layout: LibraryLayout, view: LibraryTransform, pitchMM: number,
): { cols: number; rows: number; nodesMM: PointMM[] } {
  const t = transformLayout(frame, layout, view)
  return {
    cols: t.cols, rows: t.rows,
    nodesMM: t.nodes.map(([ix, iy]) => [ix * pitchMM, (t.rows - 1 - iy) * pitchMM] as PointMM),
  }
}

/** placeMM for ONE point that is not a magnet — the centre a shape is drawn about, say. The flip is
 *  the same one placeMM applies, which is the point of it living here: written out a second time in a
 *  class, the two disagreed and a polygon was drawn about a mirrored centre (2026-09-06). */
export const placePointMM = (
  rows: number, point: readonly [number, number], pitchMM: number,
): PointMM => [point[0] * pitchMM, (rows - 1 - point[1]) * pitchMM]

/** placeMM inverted for ONE point: where a millimetre click lands on the view's lattice. The
 *  flip is the same one, so it lives beside it rather than being written out at the click site. */
export const nodeAtMM = (
  pMM: readonly [number, number], rows: number, pitchMM: number,
): [number, number] => [Math.round(pMM[0] / pitchMM), rows - 1 - Math.round(pMM[1] / pitchMM)]

/** THE EDGE NORMALS of a regular n-gon with a CORNER AT THE TOP — outward unit vectors, y-up, in the
 *  orientation the product publishes. ONE definition: the population is selected against these and
 *  the outline is drawn from them, and those two disagreeing is what drew a pentagon about a
 *  mirrored centre (2026-09-06). */
export const regularNormals = (sides: number): readonly (readonly [number, number])[] =>
  Array.from({ length: sides }, (_, k) => {
    const a = Math.PI / 2 + Math.PI / sides + (2 * Math.PI * k) / sides
    return [Math.cos(a), Math.sin(a)] as const
  })

/** Inradius over circumradius for a regular n-gon: where its edge sits when its corner is at 1. */
export const regularApothem = (sides: number): number => Math.cos(Math.PI / sides)

/** WILL THE BOARD CARRY IT — the largest shape it can is its legal area plus the rim on each side.
 *
 *  A record whose MAGNETS fit is not a record whose SHAPE fits: a polygon reaches half again past its
 *  population, a diamond's corners and a pill's caps reach past theirs too, and asking only about the
 *  magnets published records the board cannot make (2026-09-06/08). One rule, every class. */
export const fitsBoardMM = (widthMM: number, heightMM: number): boolean =>
  widthMM <= BOARD_WIDTH_MM + 2 * RELEASED_PADDING_MM + 1e-9
  && heightMM <= BOARD_HEIGHT_MM + 2 * RELEASED_PADDING_MM + 1e-9

const det3 = (a: readonly (readonly number[])[]): number =>
  a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
  - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
  + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])

/** THE SMALLEST REGULAR n-GON THAT COVERS A POINT SET, corner up, clearing every point by `rim` —
 *  its CENTRE and its size together.
 *
 *  Solving for size alone, about a pinned centre, is what forced a pentagon to 1.6x the square it
 *  wrapped: a magnet out on one side can only be reached by growing on every side, and all of that
 *  growth lands as dead material opposite it (Dan, 2026-09-06: "why the size is larger than required
 *  to wrap the lattice"). Freed, the shape slides to the population instead of swelling around it.
 *
 *  It stays deterministic because sliding is solved, not searched. The polygon is the intersection of
 *  n half-planes whose normals do not move as it grows or slides, so "p clears edge k" is
 *  `(p - c)·n_k <= u - rim` with u the inradius — linear in the three unknowns (u, cx, cy). Only the
 *  extreme point per edge can ever bind, so the whole population collapses to n constraints
 *  `u + c·n_k >= m_k`, and minimising u over them is a three-variable linear program. Its feasible
 *  region is pointed — a regular polygon's normals sum to zero and span the plane — so the optimum
 *  sits on a vertex where three of those hold with equality. With n <= 12 every candidate vertex can
 *  be solved for outright and checked, which is an exact answer in bounded work: no bisection, no
 *  search over placements, one shape per population. */
export function smallestRegularCover(
  points: readonly (readonly [number, number])[], sides: number, rim: number,
): { centre: readonly [number, number]; inradius: number } {
  if (!points.length) throw new Error('library: an empty population has no cover')
  const normals = regularNormals(sides)
  const m = normals.map(([nx, ny]) => {
    let far = -Infinity
    for (const [x, y] of points) { const d = x * nx + y * ny; if (d > far) far = d }
    return far + rim
  })
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y)
  const refX = (Math.min(...xs) + Math.max(...xs)) / 2, refY = (Math.min(...ys) + Math.max(...ys)) / 2
  let best: { centre: readonly [number, number]; inradius: number; ref: number } | null = null
  for (let i = 0; i < sides; i++) for (let j = i + 1; j < sides; j++) for (let k = j + 1; k < sides; k++) {
    const rows = [i, j, k].map((q) => [1, normals[q][0], normals[q][1]] as const)
    const det = det3(rows)
    if (Math.abs(det) < 1e-12) continue
    const rhs = [m[i], m[j], m[k]]
    const at = (c: number) => det3(rows.map((row, r) => row.map((v, q) => (q === c ? rhs[r] : v))))
    const u = at(0) / det, cx = at(1) / det, cy = at(2) / det
    if (normals.some(([nx, ny], q) => u + cx * nx + cy * ny < m[q] - 1e-9)) continue
    // a tie in size is broken towards the population's own middle, so one population has one shape
    const ref = (cx - refX) ** 2 + (cy - refY) ** 2
    if (!best || u < best.inradius - 1e-9 || (u < best.inradius + 1e-9 && ref < best.ref - 1e-12))
      best = { centre: [cx, cy], inradius: u, ref }
  }
  if (!best) throw new Error('library: no regular cover for ' + sides + ' sides')
  return { centre: best.centre, inradius: best.inradius }
}

export function boundsMM(points: readonly PointMM[]): { widthMM: number; heightMM: number } {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return {
    widthMM: Math.max(...xs) - Math.min(...xs),
    heightMM: Math.max(...ys) - Math.min(...ys),
  }
}

export function convexHull(pts: readonly PointMM[]): PointMM[] {
  const sorted = pts.map(([x, y]) => [x, y] as PointMM).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length < 3) return sorted
  const half = (points: PointMM[]) => {
    const hull: PointMM[] = []
    for (const point of points) {
      while (hull.length >= 2) {
        const a = hull[hull.length - 2], b = hull[hull.length - 1]
        if ((b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]) <= 0) hull.pop(); else break
      }
      hull.push(point)
    }
    hull.pop()
    return hull
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

export function rotateAround(points: readonly PointMM[], centre: PointMM, deg: number): PointMM[] {
  const radians = deg * Math.PI / 180
  const cos = Math.cos(radians), sin = Math.sin(radians)
  return points.map(([x, y]) => [centre[0] + (x - centre[0]) * cos - (y - centre[1]) * sin, centre[1] + (x - centre[0]) * sin + (y - centre[1]) * cos] as PointMM)
}
