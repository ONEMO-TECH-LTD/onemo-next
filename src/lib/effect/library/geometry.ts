import type { PointMM } from './types'

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
