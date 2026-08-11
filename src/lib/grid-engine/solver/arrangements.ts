// M1 — THE FINITE ARRANGEMENT GRAMMAR. Blueprint §6.2–§6.4.
//
// §6.2: for each window, the fixed adjacency graph G = (V, E) — an edge exactly when two points are
// horizontal or vertical neighbours ONE POPULATION PITCH apart; diagonals never. At scale σ an edge
// is ACTIVE exactly when its padded pair box is contained. The material-derived arrangements are
// the connected components of (V, Eσ) with at least one edge; vertices with no active edge
// disappear (the pair floor, L4 — a single magnet can never appear).
//
// §6.4: exhaustive over law-authorised centred extents; translated windows and arbitrary subsets
// are outside the grammar. Two separated active pairs are TWO arrangements — the disconnected-union
// product question is DECLARED (§2.2 diagnostic), never silently combined or forbidden.

import type { BoxMM, GridEngineSpec, PointMM } from './contract'
import type { Window } from './lattice'

export interface PairEdge {
  readonly i: number
  readonly j: number
  /** §7.1: the closed padded box of the pair, engine frame. */
  readonly boxMM: BoxMM
}

/** §7.1: B(q1,q2) = [min x − P, max x + P] × [min y − P, max y + P]. */
export function pairBox(q1: PointMM, q2: PointMM, paddingMM: number): BoxMM {
  return {
    x0: Math.min(q1[0], q2[0]) - paddingMM,
    y0: Math.min(q1[1], q2[1]) - paddingMM,
    x1: Math.max(q1[0], q2[0]) + paddingMM,
    y1: Math.max(q1[1], q2[1]) + paddingMM,
  }
}

/** §6.2: the fixed adjacency graph of a window — one population pitch apart, never diagonal. */
export function adjacencyEdges(w: Window, spec: GridEngineSpec): PairEdge[] {
  const out: PairEdge[] = []
  const pts = w.points
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = Math.abs(pts[i][0] - pts[j][0])
      const dy = Math.abs(pts[i][1] - pts[j][1])
      if ((dx === w.pitchMM && dy === 0) || (dy === w.pitchMM && dx === 0)) {
        out.push({ i, j, boxMM: pairBox(pts[i], pts[j], spec.paddingMM) })
      }
    }
  }
  return out
}

export interface Component {
  /** vertex indices into the window's points, ascending */
  readonly vertices: readonly number[]
  /** the active edges of this component, as indices into the window's edge list */
  readonly edgeIndices: readonly number[]
  /** §6.2 / §9: canonical vertex-and-edge identity */
  readonly id: string
}

/**
 * Connected components of the active-edge subgraph, each with at least one edge. Canonical id from
 * sorted vertex and edge lists (§9: never runtime object order).
 */
export function componentsOf(w: Window, edges: readonly PairEdge[], activeEdgeIdx: readonly number[]): Component[] {
  const parent = new Map<number, number>()
  const find = (x: number): number => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    let c = x
    while (parent.get(c) !== c) {
      const next = parent.get(c)!
      parent.set(c, r)
      c = next
    }
    return r
  }
  const union = (a: number, b: number) => {
    for (const v of [a, b]) if (!parent.has(v)) parent.set(v, v)
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const ei of activeEdgeIdx) union(edges[ei].i, edges[ei].j)

  const byRoot = new Map<number, { v: Set<number>; e: number[] }>()
  for (const ei of activeEdgeIdx) {
    const root = find(edges[ei].i)
    if (!byRoot.has(root)) byRoot.set(root, { v: new Set(), e: [] })
    const g = byRoot.get(root)!
    g.v.add(edges[ei].i)
    g.v.add(edges[ei].j)
    g.e.push(ei)
  }
  const out: Component[] = []
  for (const g of byRoot.values()) {
    const vertices = [...g.v].sort((a, b) => a - b)
    const edgeIndices = [...g.e].sort((a, b) => a - b)
    out.push({
      vertices,
      edgeIndices,
      id: `${w.windowId}|v${vertices.join(',')}|e${edgeIndices
        .map((ei) => `${edges[ei].i}-${edges[ei].j}`)
        .join(',')}`,
    })
  }
  // deterministic order: by first vertex (§9 canonical ordering)
  out.sort((a, b) => a.vertices[0] - b.vertices[0])
  return out
}

/**
 * §6.3, occurrence-independent halves only: floor and the four-corner TOPOLOGY test. Whether a
 * four-corner component is `optimum` further requires being the FIRST lawful published size in its
 * own interval — that half is decided at publication, on the occurrence, never here.
 */
export function isPairFloor(c: Component): boolean {
  return c.vertices.length === 2
}

export function isFourCornerTopology(c: Component, w: Window): boolean {
  if (c.vertices.length !== 4) return false
  const pts = c.vertices.map((i) => w.points[i])
  const xs = [...new Set(pts.map((p) => p[0]))]
  const ys = [...new Set(pts.map((p) => p[1]))]
  if (xs.length !== 2 || ys.length !== 2) return false
  // the four corners of their own outermost rectangular extent
  return xs.every((x) => ys.every((y) => pts.some((p) => p[0] === x && p[1] === y)))
}
