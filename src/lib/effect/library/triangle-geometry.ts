// library/triangle-geometry.ts — the triangle's pure geometry. Integer lattice arithmetic only:
// identity and classification are EXACT, floating point is display metadata. No React, no engine.

export type LatticeNode = readonly [number, number]
export type TriangleSideClass = 'equilateral' | 'isosceles' | 'scalene'
export type TriangleAngleClass = 'acute' | 'right' | 'obtuse'
export type TriangleProductType = 'peak' | 'wedge' | 'sail'

export interface TriangleLayout {
  id: string
  vertices: readonly [LatticeNode, LatticeNode, LatticeNode]
}

export interface TriangleGeometry {
  sideClass: TriangleSideClass
  angleClass: TriangleAngleClass
  side2: readonly [number, number, number]
  minAngleDeg: number
}

const d2 = (a: LatticeNode, b: LatticeNode) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
const cross = (a: LatticeNode, b: LatticeNode, c: LatticeNode) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

/** Ordering/display metadata only — never identity. */
function minimumAngle(side2: readonly [number, number, number]): number {
  const [a2, b2, c2] = side2
  // the smallest angle faces the shortest side
  const cosA = (b2 + c2 - a2) / (2 * Math.sqrt(b2) * Math.sqrt(c2))
  return (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI
}

export function triangleGeometry(vertices: TriangleLayout['vertices']): TriangleGeometry {
  if (cross(vertices[0], vertices[1], vertices[2]) === 0) throw new Error('triangle: collinear vertices')
  const side2 = [
    d2(vertices[0], vertices[1]),
    d2(vertices[1], vertices[2]),
    d2(vertices[2], vertices[0]),
  ].sort((a, b) => a - b) as [number, number, number]
  const sideClass: TriangleSideClass = side2[0] === side2[2] ? 'equilateral'
    : side2[0] === side2[1] || side2[1] === side2[2] ? 'isosceles'
      : 'scalene'
  const sum = side2[0] + side2[1]
  const angleClass: TriangleAngleClass = sum === side2[2] ? 'right' : sum > side2[2] ? 'acute' : 'obtuse'
  return { sideClass, angleClass, side2, minAngleDeg: minimumAngle(side2) }
}

/** THE PRODUCT TYPES. TWO EQUAL SIDES WINS OUTRIGHT: a right-angled isosceles triangle is a
 *  Peak, not a Wedge — Dan, 08-26, on seeing the 2x3 filed as a Wedge: "2x3 is not wedge it is
 *  peak". A Wedge is therefore a right angle WITHOUT the symmetry; everything else is a Sail.
 *  (This reverses the spec's right-first precedence, on his direct ruling.) */
export function triangleProductType(g: TriangleGeometry): TriangleProductType {
  return g.sideClass === 'isosceles' ? 'peak'
    : g.angleClass === 'right' ? 'wedge'
      : 'sail'
}

export const TRIANGLE_TYPES: TriangleProductType[] = ['peak', 'wedge', 'sail']

/** The eight square-lattice symmetries. The lattice never rotates — these map a node set onto
 *  itself for identity and for orientation, they do not turn the grid. */
export const D4: Array<(n: LatticeNode) => LatticeNode> = [
  ([x, y]) => [x, y], ([x, y]) => [-y, x], ([x, y]) => [-x, -y], ([x, y]) => [y, -x],
  ([x, y]) => [-x, y], ([x, y]) => [y, x], ([x, y]) => [x, -y], ([x, y]) => [-y, -x],
]

const serialize = (ns: readonly LatticeNode[]) =>
  [...ns].sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(([x, y]) => x + ',' + y).join(';')

function normalise(ns: readonly LatticeNode[]): LatticeNode[] {
  const mx = Math.min(...ns.map((n) => n[0])), my = Math.min(...ns.map((n) => n[1]))
  return ns.map(([x, y]) => [x - mx, y - my] as LatticeNode)
}

export const boundsOf = (ns: readonly LatticeNode[]) => ({
  cols: Math.max(...ns.map((n) => n[0])) + 1,
  rows: Math.max(...ns.map((n) => n[1])) + 1,
})

/** The canonical identity: the lexicographically smallest PORTRAIT serialisation across the
 *  eight symmetries. Two layouts that are the same triangle turned or mirrored share one ID. */
export function canonicalTriangleId(vertices: readonly LatticeNode[]): string {
  let best: string | null = null
  for (const f of D4) {
    const pts = normalise(vertices.map(f))
    const { cols, rows } = boundsOf(pts)
    if (cols > rows) continue                 // a transposed equivalent always exists
    const s = serialize(pts)
    if (best === null || s < best) best = s
  }
  if (best === null) throw new Error('triangle: no canonical form')
  return 'tri:' + best
}

export const verticesOfId = (id: string): [LatticeNode, LatticeNode, LatticeNode] =>
  id.slice(4).split(';').map((p) => p.split(',').map(Number) as unknown as LatticeNode) as
    [LatticeNode, LatticeNode, LatticeNode]

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** Every exact lattice node on the closed segment a..b, endpoints included, in order. */
export function edgeRun(a: LatticeNode, b: LatticeNode): LatticeNode[] {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const g = gcd(Math.abs(dx), Math.abs(dy)) || 1
  const step: LatticeNode = [dx / g, dy / g]
  return Array.from({ length: g + 1 }, (_, i) => [a[0] + step[0] * i, a[1] + step[1] * i] as LatticeNode)
}

/** The perimeter as three DIRECTED runs, so a sampler indexes each side from its own start. */
export function perimeterRuns(v: TriangleLayout['vertices']): LatticeNode[][] {
  return [edgeRun(v[0], v[1]), edgeRun(v[1], v[2]), edgeRun(v[2], v[0])]
}

const key = (n: LatticeNode) => n[0] + ',' + n[1]
const dedupe = (ns: readonly LatticeNode[]): LatticeNode[] => {
  const seen = new Set<string>(); const out: LatticeNode[] = []
  for (const n of ns) { const k = key(n); if (!seen.has(k)) { seen.add(k); out.push(n) } }
  return out
}

export const perimeterNodes = (v: TriangleLayout['vertices']): LatticeNode[] => dedupe(perimeterRuns(v).flat())

/** Every lattice node inside or on the triangle — exact half-plane test, no rasterising. */
export function fullNodes(v: TriangleLayout['vertices']): LatticeNode[] {
  const { cols, rows } = boundsOf(v)
  const s = Math.sign(cross(v[0], v[1], v[2]))
  const out: LatticeNode[] = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const p: LatticeNode = [x, y]
    const a = cross(v[0], v[1], p), b = cross(v[1], v[2], p), c = cross(v[2], v[0], p)
    if ((a === 0 || Math.sign(a) === s) && (b === 0 || Math.sign(b) === s) && (c === 0 || Math.sign(c) === s))
      out.push(p)
  }
  return out
}

/** The symmetries that map this triangle onto itself — used to keep a sampled population as
 *  symmetric as the shape it sits on, so a Peak never leans because a run did not divide. */
export function selfSymmetries(v: TriangleLayout['vertices']): Array<(n: LatticeNode) => LatticeNode> {
  const target = serialize(normalise([...v]))
  const { cols, rows } = boundsOf([...v])
  return D4.filter((f) => {
    const pts = normalise(v.map(f))
    const b = boundsOf(pts)
    return b.cols === cols && b.rows === rows && serialize(pts) === target
  })
}

/** Close a population under the triangle's own symmetries. Canonical layouts are normalised,
 *  so a self-symmetry maps the node field onto itself once its image is translated back. */
export function symmetryClosure(
  v: TriangleLayout['vertices'], nodes: readonly LatticeNode[],
): LatticeNode[] {
  const out: LatticeNode[] = [...nodes]
  for (const f of selfSymmetries(v)) {
    const img = v.map(f)
    const tx = Math.min(...img.map((q) => q[0])), ty = Math.min(...img.map((q) => q[1]))
    for (const n of nodes) {
      const [x, y] = f(n)
      out.push([x - tx, y - ty])
    }
  }
  return dedupe(out)
}

/** Convex hull (monotone chain) of millimetre points — the outline's supporting polygon. */
export function convexHull(pts: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  const p = [...pts].map(([x, y]) => [x, y] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const half = (src: Array<[number, number]>) => {
    const h: Array<[number, number]> = []
    for (const q of src) {
      while (h.length >= 2) {
        const [ax, ay] = h[h.length - 2], [bx, by] = h[h.length - 1]
        if ((bx - ax) * (q[1] - ay) - (by - ay) * (q[0] - ax) <= 0) h.pop(); else break
      }
      h.push(q)
    }
    h.pop()
    return h
  }
  return [...half(p), ...half([...p].reverse())]
}
