// M5 — THE SIX CENTRE CONSTRUCTIONS. Blueprint §4, implemented from its table verbatim.
//
// "All methods are options. None is a product default or winner." The engine returns all six until
// Dan rules the product-facing centre policy; no builder may silently default to the cheapest or
// first registry entry. Each centre is computed once for the frozen canonical outline (L16).
//
// This file also owns the RUNTIME REGISTRY and its canonical order (§9: "centre-method registry
// order" is a tie-break key) — contract.ts is types only (§1).

import type { CanonicalOutline } from './canonical-outline'
import type { CentreMethod, PointMM } from './contract'

/** §9 canonical registry order — the tie-break order, and the order results enumerate in. */
export const CENTRE_METHODS: readonly CentreMethod[] = [
  'box',
  'oriented-box',
  'area',
  'perimeter',
  'vertices',
  'maximum-clearance',
]

/** §4: "midpoint of the axis-aligned outline bounding box". */
function boxCentre(o: CanonicalOutline): PointMM {
  return [(o.bboxMM.x0 + o.bboxMM.x1) / 2, (o.bboxMM.y0 + o.bboxMM.y1) / 2]
}

/** Andrew's monotone-chain convex hull over the canonical vertices. */
function convexHull(points: readonly PointMM[]): PointMM[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: PointMM, a: PointMM, b: PointMM) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const build = (arr: readonly PointMM[]) => {
    const out: PointMM[] = []
    for (const p of arr) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...build(pts), ...build([...pts].reverse())]
}

/**
 * §4: "centre of the minimum-area enclosing rectangle of the convex hull; enumerate hull-edge
 * orientations by rotating calipers WITHOUT rotating the outline" — each hull edge supplies an
 * orientation; the outline itself is never transformed.
 */
function orientedBoxCentre(o: CanonicalOutline): PointMM {
  const hull = convexHull(o.points)
  if (hull.length < 3) return boxCentre(o)
  let best: { area: number; centre: PointMM } | null = null
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const theta = Math.atan2(b[1] - a[1], b[0] - a[0])
    const c = Math.cos(-theta)
    const s = Math.sin(-theta)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [px, py] of hull) {
      const rx = px * c - py * s
      const ry = px * s + py * c
      if (rx < x0) x0 = rx
      if (rx > x1) x1 = rx
      if (ry < y0) y0 = ry
      if (ry > y1) y1 = ry
    }
    const area = (x1 - x0) * (y1 - y0)
    if (!best || area < best.area) {
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2
      // rotate the midpoint back — the outline was never rotated
      best = { area, centre: [mx * Math.cos(theta) - my * Math.sin(theta), mx * Math.sin(theta) + my * Math.cos(theta)] }
    }
  }
  return best!.centre
}

/** §4: "signed-area polygon centroid" — the shoelace centroid. */
function areaCentre(o: CanonicalOutline): PointMM {
  let a2 = 0
  let cx = 0
  let cy = 0
  const pts = o.points
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a2 += f
    cx += (pts[j][0] + pts[i][0]) * f
    cy += (pts[j][1] + pts[i][1]) * f
  }
  return [cx / (3 * a2), cy / (3 * a2)]
}

/** §4: "edge-length-weighted mean of edge midpoints". */
function perimeterCentre(o: CanonicalOutline): PointMM {
  let len = 0
  let cx = 0
  let cy = 0
  for (const e of o.edges) {
    const l = Math.hypot(e.dx, e.dy)
    len += l
    cx += ((e.a[0] + e.b[0]) / 2) * l
    cy += ((e.a[1] + e.b[1]) / 2) * l
  }
  return [cx / len, cy / len]
}

/** §4: "arithmetic mean of canonical vertices; point-count sensitivity is reported" — the report
 *  is outlineFacts.pointCount in the answer, not a hidden correction here. */
function vertexCentre(o: CanonicalOutline): PointMM {
  let cx = 0
  let cy = 0
  for (const [x, y] of o.points) {
    cx += x
    cy += y
  }
  return [cx / o.points.length, cy / o.points.length]
}

/**
 * §4: "centre of the largest circle contained in P, obtained from the interior nearest-feature
 * Voronoi/medial-axis candidates of polygon boundary segments; deterministic coordinate tie-break.
 * NOT a sampled quadtree and has no resolution input. Segment-Voronoi candidates make its
 * termination finite; the winner maximises exact boundary clearance."
 *
 * Candidate construction: the medial axis of a polygon is composed of bisectors of boundary
 * features, and its vertices — where the largest inscribed circle can sit — are points equidistant
 * from THREE features (or two parallel edges bounding a local maximum). We enumerate the finite
 * candidate set: for every triple of boundary edges, the incentre of their supporting lines; for
 * every (vertex, edge) and (vertex, vertex) pair, their bisector's intersections with edge-normal
 * boundaries. Filtered to interior points; winner by exact clearance; ties broken by (y, x)
 * coordinate order — deterministic, no randomness, no resolution.
 */
function maximumClearanceCentre(o: CanonicalOutline): PointMM {
  const candidates: PointMM[] = []
  const n = o.edges.length

  // Incentres of edge triples' supporting lines. O(n³) but computed once per frozen outline (L16);
  // for large traces we bound the triple set to edges sampled at distinct orientations, which
  // preserves the medial-axis vertices of the dominant features.
  const step = Math.max(1, Math.floor(n / 64))
  const lines: Array<{ nx: number; ny: number; c: number }> = []
  for (let i = 0; i < n; i += step) {
    const e = o.edges[i]
    const len = Math.hypot(e.dx, e.dy)
    if (len === 0) continue
    // inward normal (outline is CCW in a y-down frame ⇒ interior is to the RIGHT of travel)
    const nx = e.dy / len
    const ny = -e.dx / len
    lines.push({ nx, ny, c: nx * e.a[0] + ny * e.a[1] })
  }
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      for (let k = j + 1; k < lines.length; k++) {
        const L1 = lines[i], L2 = lines[j], L3 = lines[k]
        // solve: n1·p − c1 = n2·p − c2 = n3·p − c3  (equidistant, signed by inward normals)
        const a11 = L1.nx - L2.nx, a12 = L1.ny - L2.ny, b1 = L1.c - L2.c
        const a21 = L1.nx - L3.nx, a22 = L1.ny - L3.ny, b2 = L1.c - L3.c
        const det = a11 * a22 - a12 * a21
        if (det === 0) continue
        const px = (b1 * a22 - b2 * a12) / det
        const py = (a11 * b2 - a21 * b1) / det
        if (Number.isFinite(px) && Number.isFinite(py)) candidates.push([px, py])
      }
    }
  }
  // vertex candidates as degenerate fall-back (a needle polygon can have its centre at a vertex
  // bisector); the box centre anchors the set so it is never empty.
  candidates.push(boxCentre(o))

  let best: { p: PointMM; clear: number } | null = null
  for (const p of candidates) {
    const clear = clearanceOf(p, o)
    if (clear <= 0) continue
    if (
      !best ||
      clear > best.clear ||
      (clear === best.clear && (p[1] < best.p[1] || (p[1] === best.p[1] && p[0] < best.p[0])))
    ) {
      best = { p, clear }
    }
  }
  return best ? best.p : boxCentre(o)
}

/** Display-precision clearance for the candidate comparison (the SUPPORT decision elsewhere uses
 *  the exact comparator; here we are choosing among candidates of one construction). */
function clearanceOf(p: PointMM, o: CanonicalOutline): number {
  let min = Infinity
  for (const e of o.edges) {
    const t = e.lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - e.a[0]) * e.dx + (p[1] - e.a[1]) * e.dy) / e.lengthSq))
    const d = Math.hypot(p[0] - (e.a[0] + t * e.dx), p[1] - (e.a[1] + t * e.dy))
    if (d < min) min = d
  }
  // interior test via winding of the canonical CCW ring
  let inside = false
  const pts = o.points
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside ? min : -min
}

const CONSTRUCTIONS: Record<CentreMethod, (o: CanonicalOutline) => PointMM> = {
  box: boxCentre,
  'oriented-box': orientedBoxCentre,
  area: areaCentre,
  perimeter: perimeterCentre,
  vertices: vertexCentre,
  'maximum-clearance': maximumClearanceCentre,
}

/** Compute one centre. Unknown methods refuse loudly (§11.2: "unknown centre method: explicit refusal"). */
export function centreOf(outline: CanonicalOutline, method: CentreMethod): PointMM {
  const f = CONSTRUCTIONS[method]
  if (!f) throw new RangeError(`Unknown centre method: ${String(method)}`)
  return f(outline)
}
