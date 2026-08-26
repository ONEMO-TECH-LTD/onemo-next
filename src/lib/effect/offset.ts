// offset.ts — manufacturing OFFSET via Clipper2 (DEC-v5-02 · Creator v5 L5).
//
// The magnetic inset + cut bleed: integer-robust polygon offset with ROUND joins. Pure
// (mm in → mm out). Clipper2-ts is pure TS (no WASM). This is the OP; its live consumer — the
// attachment/backing flow — is Phase 2 (the attachment contracts are dormant per R6). The cut path
// never depends on float bézier booleans (DEC-v5-02): Clipper64 works in scaled integers.

import { Clipper, JoinType, EndType } from '@countertype/clipper2-ts'
import { MANUFACTURING_TOLERANCE_MM } from './geometry-truth'
import type { Pt } from './types'

// mm → integer microns. Clipper64 is integer-robust; 1000 = micron precision, far below the 0.05 mm
// manufacturing tolerance.
const SCALE = 1000
export const MANUFACTURING_OFFSET_ARC_TOLERANCE_MM = MANUFACTURING_TOLERANCE_MM / 2

/** Offset corner join — the editor Offset tool's user choice (KAI-9128). */
export type OffsetJoin = 'round' | 'sharp' | 'bevel'

/**
 * Inset (deltaMM < 0) or outset (deltaMM > 0) a closed mm ring. Returns the largest resulting ring — a
 * simple polygon inset yields one ring; an over-inset (delta beyond the shape's inradius) collapses to
 * nothing → null. The magnetic inset is RELEASED_PADDING_MM — built into the magnet, so every shape
 * carries it — passed as the delta (round joins, manufacturing); the
 * editor Offset tool passes the user's `joinStyle` — 'round' (soft macro outline), 'sharp' (Miter, keep
 * corners) or 'bevel' (chamfer).
 */
export function insetRingMM(ringMM: ReadonlyArray<Pt>, deltaMM: number, joinStyle: OffsetJoin = 'round'): Pt[] | null {
  if (ringMM.length < 3) return null
  const flat: number[] = []
  for (const [x, y] of ringMM) flat.push(Math.round(x * SCALE), Math.round(y * SCALE))
  const join = joinStyle === 'sharp' ? JoinType.Miter : joinStyle === 'bevel' ? JoinType.Bevel : JoinType.Round
  const sol = Clipper.inflatePaths(
    [Clipper.makePath(flat)],
    deltaMM * SCALE,
    join,
    EndType.Polygon,
    2,
    // Reserve half the physical budget for Clipper's integer-micron projection.
    MANUFACTURING_OFFSET_ARC_TOLERANCE_MM * SCALE,
  )
  if (!sol || sol.length === 0) return null
  // keep the largest ring (guards against an offset that splits a concave shape into slivers)
  let best = sol[0]
  for (const r of sol) if (Math.abs(Clipper.area(r)) > Math.abs(Clipper.area(best))) best = r
  if (!best || best.length < 3) return null
  return best.map((p) => [p.x / SCALE, p.y / SCALE] as Pt)
}
