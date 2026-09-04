import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import { MANUFACTURING_OFFSET_ARC_TOLERANCE_MM, offsetPathMM } from '../offset'
import type { OutlineRecipe } from './class-contract'
import { convexHull, rotateAround } from './geometry'
import type { PointMM } from './types'

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
 *  Emitted TANGENT, not inscribed. Clipper's round join lays its vertices ON the true circle and its
 *  chords inside it, so a magnet that touches the circle sits 25.5 microns outside the polygon and the
 *  engine refuses the very disk the record certifies — and here EVERY magnet is exactly tangent. Each
 *  edge below is tangent instead, so the polygon contains the circle, and the four axis tangents are
 *  exact: the published size is the true stadium's, to the micron. */
function stadiumOutline(nodesMM: readonly PointMM[]): PointMM[] {
  const xs = nodesMM.map(([x]) => x), ys = nodesMM.map(([, y]) => y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const tall = x1 - x0 <= y1 - y0
  const across = Math.min(x1 - x0, y1 - y0)
  const radiusMM = across / 2 + RELEASED_PADDING_MM
  // THE TIGHTEST CORE THAT STILL HOLDS EVERY MAGNET, which is what makes the pill grow only where its
  // width demands it. A magnet off the centre line is already partway into the cap, so it needs less
  // length than one sitting on it: at half the reach out, the end can come in by the rest. A one-wide
  // frame therefore grows by nothing and keeps the rectangle's own size — "slim version is
  // unnecessarily tall or wide, it can easily wrap the layouts with standard sizes of rectangles" —
  // while a two-wide grows the 48mm band step Dan drew, and the magnets the caps then hold (canon's
  // pillCapNodes) cost no further length, because they sit exactly where the cap already reaches.
  const centre = tall ? (x0 + x1) / 2 : (y0 + y1) / 2
  const alongOf = (p: PointMM) => (tall ? p[1] : p[0])
  const spare = (p: PointMM) => Math.sqrt(Math.max(0, across * across / 4 - ((tall ? p[0] : p[1]) - centre) ** 2))
  const nearEnd = Math.min(...nodesMM.map((p) => alongOf(p) + spare(p)))
  const farEnd = Math.max(...nodesMM.map((p) => alongOf(p) - spare(p)))
  const [lo, hi] = nearEnd <= farEnd
    ? [nearEnd, farEnd] : [(nearEnd + farEnd) / 2, (nearEnd + farEnd) / 2]
  const core: PointMM[] = tall ? [[centre, hi], [centre, lo]] : [[hi, centre], [lo, centre]]
  // A tangent polygon's vertex stands radius/cos(step/2) out, so the manufacturing arc tolerance
  // bounds the EXCESS here, where Clipper's identical tolerance bounds the shortfall.
  const widest = 2 * Math.acos(1 / (1 + MANUFACTURING_OFFSET_ARC_TOLERANCE_MM / radiusMM))
  const steps = Math.max(1, Math.ceil(Math.PI / 2 / widest))
  const step = Math.PI / 2 / steps
  const reach = radiusMM / Math.cos(step / 2)
  const [head, tail] = core
  const corners: PointMM[] = [
    [Math.max(head[0], tail[0]), Math.max(head[1], tail[1])],
    [Math.min(head[0], tail[0]), Math.max(head[1], tail[1])],
    [Math.min(head[0], tail[0]), Math.min(head[1], tail[1])],
    [Math.max(head[0], tail[0]), Math.min(head[1], tail[1])],
  ]
  const out: PointMM[] = []
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const [cx, cy] = corners[quadrant]
    for (let i = 0; i < steps; i++) {
      const angle = quadrant * Math.PI / 2 + (i + 0.5) * step
      out.push([cx + reach * Math.cos(angle), cy + reach * Math.sin(angle)])
    }
  }
  return out
}

export function outlineFromLayout(nodesMM: readonly PointMM[], recipe: OutlineRecipe): PointMM[] {
  if (!nodesMM.length) throw new Error('library: empty population has no outline')
  if (recipe.corners === 'stadium') return stadiumOutline(nodesMM)
  const path = convexHull(nodesMM)
  if (!path.length) throw new Error('library: empty population has no outline')
  const end = path.length >= 3 ? 'polygon' : recipe.corners === 'round' ? 'round' : 'square'
  const raw = offsetPathMM(path.map(([x, y]) => [x, y]), RELEASED_PADDING_MM, recipe.corners, end)
  if (!raw) throw new Error('library: population has no outline')
  return path.length === 1 && recipe.pointRotationDeg ? rotateAround(raw, path[0], recipe.pointRotationDeg) : raw
}
