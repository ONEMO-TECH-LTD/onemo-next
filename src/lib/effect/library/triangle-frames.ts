// library/triangle-frames.ts — materialising a chosen triangle geometry into the library's
// ordinary frame/layout vocabulary. Geometry lives in triangle-geometry.ts; the SPACING rule is
// the shared one from rules.ts. Nothing here re-decides either.

import { sample96, SPACING_96, SPACING_BASE } from './rules'
import { transformLayout } from './transforms'
import type { LibraryTransform } from './types'
import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import {
  boundsOf, canonicalTriangleId, fullNodes, perimeterNodes, perimeterRuns, symmetryClosure,
  triangleGeometry, triangleProductType, verticesOfId,
  type LatticeNode, type TriangleLayout, type TriangleProductType,
} from './triangle-geometry'
import type { LibraryFrame, LibraryLayout } from './types'

const key = (n: LatticeNode) => n[0] + ',' + n[1]

export const triangleById = (id: string): TriangleLayout => {
  const t = TRIANGLE_LAYOUTS.find((x) => x.id === id)
  if (!t) throw new Error('library: unknown triangle geometry ' + id)
  return t
}

export const triangleTypeOf = (t: TriangleLayout): TriangleProductType =>
  triangleProductType(triangleGeometry(t.vertices))

export const triangleFrameKey = (t: TriangleLayout): string => {
  const b = boundsOf([...t.vertices])
  return b.cols + 'x' + b.rows
}

/** The 96 population: the SHARED sampler run over each directed side, every vertex retained,
 *  then closed under the triangle's own symmetries so a non-divisible run cannot make a Peak
 *  lean to one side. */
export function trianglePerimeter96(t: TriangleLayout, pitchMM: number): LatticeNode[] {
  const keep: LatticeNode[] = []
  for (const run of perimeterRuns(t.vertices)) {
    const idx = sample96(run.length, pitchMM)
    run.forEach((n, i) => { if (idx.has(i)) keep.push(n) })
  }
  for (const v of t.vertices) keep.push(v)
  return symmetryClosure(t.vertices, keep)
}

/** A geometry as a LibraryFrame: the same four populations every other class carries. */
export function triangleFrame(t: TriangleLayout, pitchMM: number): LibraryFrame {
  const b = boundsOf([...t.vertices])
  const per = perimeterNodes(t.vertices)
  const full = fullNodes(t.vertices)
  const layouts: LibraryLayout[] = [
    { name: 'corners', nodes: [...t.vertices] },
    { name: SPACING_BASE, nodes: per },
    { name: SPACING_96, nodes: trianglePerimeter96(t, pitchMM) },
  ]
  if (full.length > per.length) layouts.push({ name: 'full', nodes: full, note: 'interior — Full grid only' })
  return { cols: b.cols, rows: b.rows, layouts }
}

/** The frames a product type offers, in the ruled order: area, then columns/rows, then
 *  blunt-to-sharp, then the stable ID. */
export function trianglesOfType(type: TriangleProductType): TriangleLayout[] {
  return TRIANGLE_LAYOUTS.filter((t) => triangleTypeOf(t) === type).sort((a, b) => {
    const ba = boundsOf([...a.vertices]), bb = boundsOf([...b.vertices])
    return (ba.cols * ba.rows) - (bb.cols * bb.rows) || ba.cols - bb.cols || ba.rows - bb.rows
      || triangleGeometry(b.vertices).minAngleDeg - triangleGeometry(a.vertices).minAngleDeg
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}

export const triangleFrameKeys = (type: TriangleProductType): string[] =>
  [...new Set(trianglesOfType(type).map(triangleFrameKey))]

export const trianglesOf = (type: TriangleProductType, frameKey: string): TriangleLayout[] =>
  trianglesOfType(type).filter((t) => triangleFrameKey(t) === frameKey)

/** A hand-authored population still has to be a triangle: exactly three hull corners. */
export function assertTrianglePopulation(nodes: readonly LatticeNode[]): void {
  const uniq = [...new Map(nodes.map((n) => [key(n), n])).values()]
  if (uniq.length < 3) throw new Error('triangle: collinear population')
  const hull = hullOfNodes(uniq)
  if (hull.length < 3) throw new Error('triangle: collinear population')
  if (hull.length !== 3) throw new Error('triangle: hull has ' + hull.length + ' vertices')
}

function hullOfNodes(pts: readonly LatticeNode[]): LatticeNode[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const half = (src: LatticeNode[]) => {
    const h: LatticeNode[] = []
    for (const q of src) {
      while (h.length >= 2) {
        const a = h[h.length - 2], b = h[h.length - 1]
        if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) <= 0) h.pop(); else break
      }
      h.push(q)
    }
    h.pop()
    return h
  }
  return [...half(p), ...half([...p].reverse())]
}

export { canonicalTriangleId, verticesOfId }

/** THE UPRIGHT VIEW — how a triangle should first appear: sitting on its longest side with the
 *  third point above it. The stored form is canonical for DE-DUPLICATION (the alphabetically
 *  smallest of the eight), which is a sorting rule with no idea which way is up — so a layout
 *  arrived lying on its side. The identity is untouched; this only picks the view it opens on. */
const VIEWS: LibraryTransform[] = [
  { transpose: false, flipX: false, flipY: false }, { transpose: false, flipX: true, flipY: false },
  { transpose: false, flipX: false, flipY: true }, { transpose: false, flipX: true, flipY: true },
  { transpose: true, flipX: false, flipY: false }, { transpose: true, flipX: true, flipY: false },
  { transpose: true, flipX: false, flipY: true }, { transpose: true, flipX: true, flipY: true },
]

export function uprightView(t: TriangleLayout): LibraryTransform {
  const b = boundsOf([...t.vertices])
  const frame: LibraryFrame = { cols: b.cols, rows: b.rows, layouts: [] }
  const layout: LibraryLayout = { name: 'corners', nodes: [...t.vertices] }
  let best = VIEWS[0], bestScore = -1
  for (const view of VIEWS) {
    const r = transformLayout(frame, layout, view)
    const [p, q, s2] = r.nodes
    const len = (a: LatticeNode, c: LatticeNode) => (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2
    const edges: Array<[LatticeNode, LatticeNode, LatticeNode]> = [[p, q, s2], [q, s2, p], [s2, p, q]]
    // A shape RESTS on a flat side. Prefer a level edge along the bottom, then a level edge up
    // the left; only a triangle with no axis-aligned side at all falls back to standing its
    // apex above the base. Ranking by apex-above alone hung a wedge from its point.
    const onFloor = edges.some(([a, c]) => a[1] === c[1] && a[1] === r.rows - 1)
    const onWall = edges.some(([a, c]) => a[0] === c[0] && a[0] === 0)
    // the base is the odd side out for an isosceles triangle — the apex is the vertex between
    // the two equal sides — and the longest side only when all three differ
    const odd = edges.find((e) => {
      const others = edges.filter((x) => x !== e)
      return len(others[0][0], others[0][1]) === len(others[1][0], others[1][1])
    })
    const [a, c, apex] = odd ?? edges.reduce((m, e) => (len(e[0], e[1]) > len(m[0], m[1]) ? e : m))
    const apexAbove = apex[1] <= a[1] && apex[1] <= c[1]
    const score = (onFloor ? 16 : 0) + (onWall ? 8 : 0) + (apexAbove ? 4 : 0)
      + (a[1] === c[1] && a[1] === r.rows - 1 ? 2 : 0) + (r.cols >= r.rows ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = view }
  }
  return best
}
