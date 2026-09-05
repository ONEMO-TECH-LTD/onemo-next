import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import { MANUFACTURING_OFFSET_ARC_TOLERANCE_MM, offsetPathMM } from '../offset'
import { flattenPath, offsetConvexRingPath, pathBoundsMM, pathFromAnchors, type OutlinePath } from '../foundation/path'
import type { OutlineRecipe } from './class-contract'
import { boundsMM, convexHull, rotateAround } from './geometry'
import type { PointMM } from './types'

/** The library's one door to the path foundation: zone 5 reads the type from here, not from outside. */
export type { OutlinePath } from '../foundation/path'

/** What the library says a population's outline IS.
 *
 *  `path` is the truth wherever the outline bends: lines and circular arcs of exactly the rim radius,
 *  which is what the offset of a convex hull by the rim analytically is (Dan, 2026-09-04: "no polygons
 *  on canon and anywhere"). `pts` is a VIEW flattened from it for Clipper and for drawing, and nothing
 *  measures against it. A sharp or bevelled finish has no curve to lose, so it carries points only.
 *  Width and height are the path's exact extent where there is one — an arc reaches its extreme
 *  exactly, a point view only approaches it. */
export interface LibraryOutline {
  pts: PointMM[]
  path?: OutlinePath
  widthMM: number
  heightMM: number
}

const sized = (pts: PointMM[], path?: OutlinePath): LibraryOutline => {
  if (!path) return { pts, ...boundsMM(pts) }
  const b = pathBoundsMM(path)
  return { pts, path, widthMM: b.maxX - b.minX, heightMM: b.maxY - b.minY }
}

/** THE STADIUM — the rectangle carried out one band and rounded (Dan, 2026-09-04: "you expand
 *  rectangle to the next band by 48mm round corners and center it to the prior band", drawn as a
 *  720x1680 rectangle at corner radius 360 over a 2x3 layout).
 *
 *  It is radius plus offset on the population's own centre line: the corner radius is half the width,
 *  which is the largest a circle can be here, and the shape grows along its length by exactly that
 *  much so every magnet — the corner ones included — keeps its 12mm rim. Nothing is dropped and the
 *  layout stays centred in it. A 2x3 at 48mm is 72x168mm where the rectangle is 72x120: one lattice
 *  step longer. A one-wide frame grows by nothing, because there the rim already IS half the width.
 *
 *  The core is the TIGHTEST that still holds every magnet, which is what makes the pill grow only where
 *  its width demands it: a magnet off the centre line is already partway into the cap and needs less
 *  length than one sitting on it, and the magnets the caps hold (canon's pillCapNodes) cost nothing.
 *
 *  The outline is then simply that core offset by the radius — two points, so a stadium — as an exact
 *  path. The tangent-polygon emitter and the outward micron rounding that used to live here were both
 *  compensation for measuring against chords, and are gone with the chords. */
function stadiumOutline(nodesMM: readonly PointMM[]): LibraryOutline {
  const xs = nodesMM.map(([x]) => x), ys = nodesMM.map(([, y]) => y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const tall = x1 - x0 <= y1 - y0
  const across = Math.min(x1 - x0, y1 - y0)
  const radiusMM = across / 2 + RELEASED_PADDING_MM
  const centre = tall ? (x0 + x1) / 2 : (y0 + y1) / 2
  const alongOf = (p: PointMM) => (tall ? p[1] : p[0])
  const spare = (p: PointMM) => Math.sqrt(Math.max(0, across * across / 4 - ((tall ? p[0] : p[1]) - centre) ** 2))
  const nearEnd = Math.min(...nodesMM.map((p) => alongOf(p) + spare(p)))
  const farEnd = Math.max(...nodesMM.map((p) => alongOf(p) - spare(p)))
  const [lo, hi] = nearEnd <= farEnd
    ? [nearEnd, farEnd] : [(nearEnd + farEnd) / 2, (nearEnd + farEnd) / 2]
  const core: PointMM[] = lo === hi
    ? [tall ? [centre, lo] : [lo, centre]]
    : tall ? [[centre, lo], [centre, hi]] : [[lo, centre], [hi, centre]]
  const path = offsetConvexRingPath(core.map(([x, y]) => [x, y]), radiusMM)
  return sized(flattenPath(path, MANUFACTURING_OFFSET_ARC_TOLERANCE_MM), path)
}

export function outlineFromLayout(nodesMM: readonly PointMM[], recipe: OutlineRecipe): LibraryOutline {
  if (!nodesMM.length) throw new Error('library: empty population has no outline')
  if (recipe.corners === 'stadium') return stadiumOutline(nodesMM)
  const hull = convexHull(nodesMM)
  if (!hull.length) throw new Error('library: empty population has no outline')
  if (recipe.corners === 'round') {
    // the discs grown by the rim: a convex hull offset with round joins, which IS lines plus arcs
    const path = offsetConvexRingPath(hull.map(([x, y]) => [x, y]), RELEASED_PADDING_MM)
    return sized(flattenPath(path, MANUFACTURING_OFFSET_ARC_TOLERANCE_MM), path)
  }
  // sharp and bevel have no curve: the offset polygon is exact as points
  const end = hull.length >= 3 ? 'polygon' : 'square'
  const raw = offsetPathMM(hull.map(([x, y]) => [x, y]), RELEASED_PADDING_MM, recipe.corners, end)
  if (!raw) throw new Error('library: population has no outline')
  const pts = hull.length === 1 && recipe.pointRotationDeg ? rotateAround(raw, hull[0], recipe.pointRotationDeg) : raw
  // a polygon is a path of lines — carried as one, so its legal area can be built exactly from it
  return sized(pts, pathFromAnchors(pts.map(([x, y]) => ({ p: { x, y } })), (v) => [v.x, v.y]))
}
