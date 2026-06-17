// vector-core/clipper-kernel.ts — the BOUGHT Clipper2 geometry math (DEC-v5-03, Creator v5 Phase 3).
//
// Clipper2 (pure TS, no WASM) is the kernel for the STRAIGHTEN tool — the integer/CAD-grade
// collinear-collapse that Paper has no equivalent for (Paper `simplify` fits curves; `flatten` is the
// opposite). Used as MATH ONLY (anchors in → op → anchors out); we never let it own state. Imported
// directly (not via the vector-core barrel) so Clipper stays in the create/manufacturing bundle, never
// the v1/v2/shaped bundles — the same containment rule as paper-kernel.
//
// (The same library also backs the manufacturing offset — see lib/effect/offset.ts. ONE engine.)

import { Clipper } from '@countertype/clipper2-ts'
import type { VPath } from './types'

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
  const flat: number[] = []
  for (const a of path.anchors) flat.push(a.p.x, a.p.y)
  const pd = Clipper.makePathD(flat)
  let out = Clipper.ramerDouglasPeuckerD(pd, epsPx) // collapse near-collinear runs (keeps real corners)
  out = Clipper.trimCollinearD(out, 3, false) // drop any exactly-collinear vertices (closed path, 3dp)
  if (out.length < 3) return path // collapsed past a triangle — leave the source untouched
  return { anchors: out.map((p) => ({ p: { x: p.x, y: p.y }, hIn: null, hOut: null, corner: true })) }
}
