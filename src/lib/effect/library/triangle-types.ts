// library/triangle-types.ts — THE PRODUCT TAXONOMY. What a person calls the shape they are
// looking at. Geometry (triangle-geometry.ts) is pure and stays out of naming; naming reads the
// PRESENTED view, because how a shape sits is what is being looked at, not how it is stored.

import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import { transformLayout } from './transforms'
import type { FrameExtent, LibraryLayout, LibraryTransform } from './types'
import { boundsOf, triangleGeometry, type LatticeNode, type TriangleGeometry, type TriangleLayout } from './triangle-geometry'

/** Dan's own naming list (08-26), one word each. The retired three-name grouping must not reach
 *  the UI; current product labels are defined below.
 *
 *  Each name is his description made measurable on the presented view:
 *    Wedge     — a squared corner: the right angle stood on a level side and an upright side
 *    Needle    — symmetric on a level base, at least twice as tall as it is wide
 *    Arrowhead — symmetric on a level base, taller than wide
 *    Pyramid   — symmetric on a level base, exactly as wide as it is tall
 *    Mountain  — symmetric on a level base, wider than tall
 *    Flag      — leaning: no two sides equal, so it points off to one side
 *
 *  The retired leaning labels were four names for one family, split by proportion. A
 *  proportion is a number, not a thing anyone recognises, so the same shape read as a Ramp at
 *  one size and a Fin at another, and each tab collected whatever splinters fell in its band.
 *  Dan, 08-26: "remove ramp penant sail and fin ... these must go in one tab flag". */
export type TriangleProductType =
  | 'wedge' | 'needle' | 'arrowhead' | 'pyramid' | 'mountain' | 'flag'

export const TRIANGLE_TYPES = [
  'pyramid', 'arrowhead', 'mountain', 'needle', 'wedge', 'flag',
] as const satisfies readonly TriangleProductType[]

/** RETIRED FROM THE PRODUCT, still in the 79-geometry universe — a retirement leaves the
 *  catalogue, not the corpus, so the review evidence survives and nothing is unrecoverable. */
const RETIRED = new Set<string>([
  'tri:0,0;0,3;2,0', 'tri:0,0;1,3;2,1', 'tri:0,0;1,3;2,2',
  'tri:0,0;3,4;4,3', 'tri:0,0;1,2;3,3', 'tri:0,0;2,3;3,2', 'tri:0,0;1,3;4,4', 'tri:0,0;1,2;2,1',
  'tri:0,0;2,4;4,2', 'tri:0,0;2,4;3,1', 'tri:0,0;1,3;3,1', 'tri:0,0;1,4;4,1',
  'tri:0,0;0,2;2,3', 'tri:0,0;0,1;2,3', 'tri:0,0;0,3;3,4', 'tri:0,0;0,2;3,4', 'tri:0,0;0,1;3,4',
  'tri:0,0;0,1;1,2', 'tri:0,0;0,2;1,3', 'tri:0,0;0,1;1,3', 'tri:0,0;0,4;1,1', 'tri:0,0;0,3;1,4',
  'tri:0,0;0,2;1,4', 'tri:0,0;0,1;1,4', 'tri:0,0;0,3;2,4', 'tri:0,0;0,2;2,4', 'tri:0,0;0,1;2,4',
  'tri:0,0;1,4;2,1', 'tri:0,0;1,4;2,2', 'tri:0,0;1,4;2,3', 'tri:0,0;1,1;2,4', 'tri:0,0;1,0;2,3',
  'tri:0,0;1,0;2,4', 'tri:0,0;1,4;3,4', 'tri:0,0;1,0;3,4', 'tri:0,0;1,4;3,3', 'tri:0,0;0,1;2,2',
  'tri:0,0;0,2;3,3', 'tri:0,0;0,1;3,3', 'tri:0,0;0,3;4,4', 'tri:0,0;0,2;4,4', 'tri:0,0;0,1;4,4',
  'tri:0,0;1,1;2,3', 'tri:0,0;1,3;3,2', 'tri:0,0;1,4;3,1', 'tri:0,0;1,4;3,2', 'tri:0,0;2,4;3,2',
  'tri:0,0;1,3;3,4', 'tri:0,0;2,4;3,3', 'tri:0,0;1,2;3,4', 'tri:0,0;1,1;3,4', 'tri:0,0;1,4;4,2',
  'tri:0,0;1,4;4,3', 'tri:0,0;2,4;4,3', 'tri:0,0;1,2;4,4',
])

export const isActive = (triangle: TriangleLayout): boolean => !RETIRED.has(triangle.id)

/** How a shape sits, measured on the view it is presented in. */
interface TriangleShown {
  cols: number
  rows: number
  /** has a horizontal side */
  level: boolean
  /** has a vertical side */
  upright: boolean
}

/** A WEDGE IS A SQUARED CORNER, equal legs or not. What decides is HOW the right angle is
 *  presented, not the angle alone: standing on a level side with an upright side beside it, the
 *  corner is the whole shape. Resting on its hypotenuse, the same triangle's right angle sits up
 *  at the apex where nobody reads it as a corner — that is a Mountain.
 *
 *  I narrowed this to equal legs earlier today, which sent the unequal-legged squared corners
 *  into Ramp and Pennant. Dan, looking at the rendered shapes: "ramp has wedge option" and, of
 *  the 159x79 corner sitting under Pennant, "how is the first pennant?". Both are squared
 *  corners and both belong here. His earlier "2x3 is not wedge" was read off a CHIP LABEL — he
 *  had a 3x4 selected and never saw either shape — and that label is now the size in mm. */
/*  The symmetric proportions are RELATIONAL, not tuned numbers: wider / exactly square / taller /
 *  twice as tall. Earlier cut-offs of 0.8 and 1.25 were mine and arbitrary; the lattice only ever
 *  presents symmetric aspects of 0.25, 0.5, 0.75, 1, 1.5 and 2, so the words decide by themselves.
 *  Nothing splits the leaning family by proportion any more — that was the invention. */
export function triangleProductType(
  g: TriangleGeometry, shown: TriangleShown,
): TriangleProductType {
  if (g.angleClass === 'right' && shown.level && shown.upright) return 'wedge'
  if (g.sideClass === 'isosceles') {
    const w = Math.max(1, shown.cols - 1), h = Math.max(1, shown.rows - 1), a = h / w
    // 08-26 Dan, on the tilted symmetric shapes: "remove slice it is same as basic triangles
    // just turned". Every one of them is retired from the product, so this branch is not
    // reachable from the active catalogue; a symmetric shape that cannot stand flat reads as a
    // leaning shape, and the per-member sweep fires loudly if one is ever made active again.
    if (!shown.level) return 'flag'
    return a >= 2 ? 'needle' : a > 1 ? 'arrowhead' : a === 1 ? 'pyramid' : 'mountain'
  }
  return 'flag'
}

const presentedCorners = (triangle: TriangleLayout): { cols: number; rows: number; nodes: LatticeNode[] } => {
  const bounds = boundsOf([...triangle.vertices])
  return transformLayout({ cols: bounds.cols, rows: bounds.rows },
    { name: 'corners', nodes: [...triangle.vertices] }, uprightView(triangle))
}

export const triangleTypeOf = (triangle: TriangleLayout): TriangleProductType => {
  const hit = TYPE_OF.get(triangle.id)
  if (hit) return hit
  const shown = presentedCorners(triangle)
  const [p, q, s] = shown.nodes
  const edges: Array<[LatticeNode, LatticeNode]> = [[p, q], [q, s], [s, p]]
  const type = triangleProductType(triangleGeometry(triangle.vertices), {
    cols: shown.cols, rows: shown.rows,
    level: edges.some(([a, c]) => a[1] === c[1]),
    upright: edges.some(([a, c]) => a[0] === c[0]),
  })
  TYPE_OF.set(triangle.id, type)
  return type
}

export function restsFlat(triangle: TriangleLayout): boolean {
  const shown = presentedCorners(triangle)
  const [p, q, s] = shown.nodes
  const edges: Array<[LatticeNode, LatticeNode]> = [[p, q], [q, s], [s, p]]
  return edges.some(([a, c]) => a[1] === c[1] || a[0] === c[0])
}

export function trianglesOfType(type: TriangleProductType): TriangleLayout[] {
  const hit = BY_TYPE.get(type)
  if (hit) return hit
  const triangles = TRIANGLE_LAYOUTS.filter((triangle) => isActive(triangle) && triangleTypeOf(triangle) === type)
    .sort((a, b) => {
      if (restsFlat(a) !== restsFlat(b)) return restsFlat(a) ? -1 : 1
      const ba = boundsOf([...a.vertices]), bb = boundsOf([...b.vertices])
      return (ba.cols * ba.rows) - (bb.cols * bb.rows) || ba.cols - bb.cols || ba.rows - bb.rows
        || triangleGeometry(b.vertices).minAngleDeg - triangleGeometry(a.vertices).minAngleDeg
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })
  BY_TYPE.set(type, triangles)
  return triangles
}

const VIEWS: LibraryTransform[] = [
  { transpose: false, flipX: false, flipY: false }, { transpose: false, flipX: true, flipY: false },
  { transpose: false, flipX: false, flipY: true }, { transpose: false, flipX: true, flipY: true },
  { transpose: true, flipX: false, flipY: false }, { transpose: true, flipX: true, flipY: false },
  { transpose: true, flipX: false, flipY: true }, { transpose: true, flipX: true, flipY: true },
]

export function uprightView(triangle: TriangleLayout): LibraryTransform {
  const hit = UPRIGHT.get(triangle.id)
  if (hit) return hit
  const bounds = boundsOf([...triangle.vertices])
  const frame: FrameExtent = { cols: bounds.cols, rows: bounds.rows }
  const layout: LibraryLayout = { name: 'corners', nodes: [...triangle.vertices] }
  let best = VIEWS[0], bestScore = -1
  for (const view of VIEWS) {
    const shown = transformLayout(frame, layout, view)
    const [p, q, s] = shown.nodes
    const length = (a: LatticeNode, c: LatticeNode) => (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2
    const edges: Array<[LatticeNode, LatticeNode, LatticeNode]> = [[p, q, s], [q, s, p], [s, p, q]]
    const onFloor = edges.some(([a, c]) => a[1] === c[1] && a[1] === shown.rows - 1)
    const onWall = edges.some(([a, c]) => a[0] === c[0] && a[0] === 0)
    const odd = edges.find((edge) => {
      const others = edges.filter((other) => other !== edge)
      return length(others[0][0], others[0][1]) === length(others[1][0], others[1][1])
    })
    const [a, c, apex] = odd ?? edges.reduce((bestEdge, edge) =>
      length(edge[0], edge[1]) > length(bestEdge[0], bestEdge[1]) ? edge : bestEdge)
    const apexAbove = apex[1] <= a[1] && apex[1] <= c[1]
    const maxY = Math.max(...shown.nodes.map((node) => node[1]))
    const tip = shown.nodes.find((node) => node[1] !== maxY) ?? shown.nodes[0]
    const leansLeft = tip[0] * 2 <= shown.cols - 1
    const score = (onFloor ? 32 : 0) + (onWall ? 16 : 0) + (apexAbove ? 8 : 0)
      + (a[1] === c[1] && a[1] === shown.rows - 1 ? 4 : 0) + (shown.cols >= shown.rows ? 2 : 0)
      + (leansLeft ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = view }
  }
  UPRIGHT.set(triangle.id, best)
  return best
}

const UPRIGHT = new Map<string, LibraryTransform>()
const BY_TYPE = new Map<string, TriangleLayout[]>()
const TYPE_OF = new Map<string, TriangleProductType>()
