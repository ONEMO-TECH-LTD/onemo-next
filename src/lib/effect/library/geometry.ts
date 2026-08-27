import { transformLayout } from './transforms'
import type { FrameExtent, LibraryLayout, LibraryTransform, PointMM } from './types'

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
