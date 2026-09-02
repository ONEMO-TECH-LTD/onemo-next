import { transformLayout } from './transforms'
import { BOARD_HEIGHT_MM, BOARD_WIDTH_MM } from '../grid-magnet-spec'
import type { FrameExtent, LibraryLayout, LibraryTransform, PointMM } from './types'

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

/** placeMM inverted for ONE point: where a millimetre click lands on the view's lattice. The
 *  flip is the same one, so it lives beside it rather than being written out at the click site. */
export const nodeAtMM = (
  pMM: readonly [number, number], rows: number, pitchMM: number,
): [number, number] => [Math.round(pMM[0] / pitchMM), rows - 1 - Math.round(pMM[1] / pitchMM)]

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
