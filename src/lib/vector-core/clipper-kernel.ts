// vector-core/clipper-kernel.ts — the BOUGHT Clipper2 geometry math (DEC-v5-03, Creator v5 Phase 3).
//
// Clipper2 (pure TS, no WASM) is the kernel for the STRAIGHTEN tool — the integer/CAD-grade
// collinear-collapse that Paper has no equivalent for (Paper `simplify` fits curves; `flatten` is the
// opposite). Used as MATH ONLY (anchors in → op → anchors out); we never let it own state. Imported
// directly (not via the vector-core barrel) so Clipper stays in the create/manufacturing bundle, never
// the v1/v2/shaped bundles — the same containment rule as paper-kernel.
//
// (The same library also backs the manufacturing offset — see lib/effect/offset.ts. ONE engine.)

import { Clipper, JoinType, EndType, FillRule } from '@countertype/clipper2-ts'
import type { VPath, VShape } from './types'
import { flattenPath, flattenShape } from './path'

// px → centi-px integers for Clipper64 (integer-robust; 100 = 0.01px precision, far below display tol).
const ROUND_SCALE = 100

/** Boolean-subtract one finished shape from another through the existing Clipper2 kernel. */
export function subtractShape(subject: VShape, negative: VShape): VShape | null {
  const toClipper = (shape: VShape) => flattenShape(shape, 0.25)
    .filter((ring) => ring.length >= 3)
    .map((ring) => Clipper.makePathD(ring.flatMap((point) => [point.x, point.y])))
  const subjectPaths = toClipper(subject)
  const negativePaths = toClipper(negative)
  if (!Clipper.intersectD(subjectPaths, negativePaths, FillRule.NonZero, 2).length) return subject
  const result = Clipper.differenceD(subjectPaths, negativePaths, FillRule.NonZero, 2)
  const paths = result
    .filter((path) => path.length >= 3)
    .map((path) => {
      const points = path.map((point) => ({ x: point.x, y: point.y }))
      return { anchors: points.map((point) => ({ p: point, hIn: null, hOut: null, corner: true })) }
    })
  return paths.length ? { paths } : null
}

/**
 * STRAIGHTEN — collapse near-collinear runs to true straight edges, via Clipper2 Ramer-Douglas-Peucker
 * + TrimCollinear, applied DIRECTLY to the path's anchor points (DEC-v5-03: one library op, no
 * flatten-and-refit wrapper). A real corner deviates far more than `epsPx` and is KEPT; a near-straight
 * run (trace jitter, a wall with noise) collapses to one straight edge. It is a polygon op — it returns
 * SHARP-corner anchors (handles dropped); on a curved input it polygonalizes near-collinear spans.
 * OFF (epsPx <= 0) returns the source unchanged.
 */
export function straightenPath(path: VPath, epsPx: number): VPath {
  if (epsPx <= 0 || path.anchors.length < 4) return path
  // Operate on the FLATTENED outline (KAI-9118 — tools adjust curved input gracefully): on a polygon
  // flatten() returns the anchor points unchanged (straights never subdivide), so noisy-trace behaviour
  // is identical; on a CURVED input (stock/Magic curves) it samples the TRUE curve so RDP follows the
  // shape, not a handful of control points (which would mangle the curve into a coarse facet polygon).
  const ring = flattenPath(path, 0.5)
  if (ring.length < 4) return path
  const flat: number[] = []
  for (const p of ring) flat.push(p.x, p.y)
  const pd = Clipper.makePathD(flat)
  let out = Clipper.ramerDouglasPeuckerD(pd, epsPx) // collapse near-collinear runs (keeps real corners)
  out = Clipper.trimCollinearD(out, 3, false) // drop any exactly-collinear vertices (closed path, 3dp)
  if (out.length < 3) return path // collapsed past a triangle — leave the source untouched
  return { anchors: out.map((p) => ({ p: { x: p.x, y: p.y }, hIn: null, hOut: null, corner: true })) }
}

/**
 * WHOLE-SHAPE RADIUS — round every convex corner uniformly via Clipper2 morphological OPENING (erode −r
 * then dilate +r, ROUND joins), the standard CAD whole-shape round (blueprint v5.2 §4 / DEC-v5-03,04).
 * Symmetric BY CONSTRUCTION (no per-corner orchestration, no seam): a square at r = ½ short-side → a
 * circle. This replaces the per-corner Paper plugin for the WHOLE-SHAPE (no-selection) Radius case — the
 * Paper plugin (single-segment) stays for the per-corner case. `radiusPx` is clamped to just under ½ the
 * ring's short side so the erosion never fully collapses (which would lose the shape, not round it).
 * OFF (radiusPx<=0) returns the source. Runs on the FLATTENED outline (handles curved input too) and
 * returns a dense smooth point-ring (corner:false); the resolver fold-guards the result.
 */
export function roundWholeShapePx(path: VPath, radiusPx: number): VPath {
  if (radiusPx <= 0 || path.anchors.length < 3) return path
  const ring = flattenPath(path, 0.25) // true outline (curves included)
  if (ring.length < 3) return path
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of ring) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y }
  const shortSide = Math.min(maxX - minX, maxY - minY)
  const rMax = Math.min(radiusPx, 0.499 * shortSide) // < ½ short side → erosion leaves a (tiny) core to round
  if (rMax <= 0) return path
  const flat: number[] = []
  for (const p of ring) flat.push(Math.round(p.x * ROUND_SCALE), Math.round(p.y * ROUND_SCALE))
  const subj = [Clipper.makePath(flat)]
  const srcArea = Math.abs(Clipper.area(subj[0]))
  // BOTH polarities (Dan 2026-08-06 'radius does not attack every corner'): erode→dilate (opening)
  // rounds CONVEX corners only — concave notches passed through sharp; the mirror dilate→erode
  // (closing) rounds the concave ones — together every corner rounds uniformly.
  // FEATURE-PRESERVATION back-off (Dan 16:30 'above 70 it goes into smaller shape'): erosion at
  // large r swallows whole features (spikes) that the grow-back cannot resurrect — the shape
  // collapses to its core. If the result loses >18% of the source area, retreat r and retry: the
  // knob saturates at the largest radius that keeps the shape's features instead of eating them.
  const attempt = (r: number) => {
    const eroded = Clipper.inflatePaths(subj, -r * ROUND_SCALE, JoinType.Round, EndType.Polygon)
    if (!eroded || eroded.length === 0) return null
    const opened = Clipper.inflatePaths(eroded, r * ROUND_SCALE, JoinType.Round, EndType.Polygon)
    if (!opened || opened.length === 0) return null
    const grown = Clipper.inflatePaths(opened, r * ROUND_SCALE, JoinType.Round, EndType.Polygon)
    if (!grown || grown.length === 0) return null
    const dilated = Clipper.inflatePaths(grown, -r * ROUND_SCALE, JoinType.Round, EndType.Polygon)
    if (!dilated || dilated.length === 0) return null
    let bestRg = dilated[0]
    for (const rg of dilated) if (Math.abs(Clipper.area(rg)) > Math.abs(Clipper.area(bestRg))) bestRg = rg
    if (!bestRg || bestRg.length < 3) return null
    if (Math.abs(Clipper.area(bestRg)) < srcArea * 0.75) return null // features eaten — below the square→circle legal loss (π/4 ≈ 0.785), above spike-collapse
    return bestRg
  }
  let best = null
  for (let r = rMax, n = 0; r > rMax * 0.1 && n < 8; r *= 0.72, n++) { best = attempt(r); if (best) break }
  if (!best) return path
  return { anchors: best.map((p) => ({ p: { x: p.x / ROUND_SCALE, y: p.y / ROUND_SCALE }, hIn: null, hOut: null, corner: false })) }
}
