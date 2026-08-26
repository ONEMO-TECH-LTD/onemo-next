// offset.ts — manufacturing OFFSET via Clipper2 (DEC-v5-02 · Creator v5 L5).
//
// The magnetic inset + cut bleed: integer-robust polygon offset with ROUND joins. Pure
// (mm in → mm out). Clipper2-ts is pure TS (no WASM). This is the OP; its live consumer — the
// attachment/backing flow — is Phase 2 (the attachment contracts are dormant per R6). The cut path
// never depends on float bézier booleans (DEC-v5-02): Clipper64 works in scaled integers.

import { Clipper, JoinType, EndType } from '@countertype/clipper2-ts'
import { MANUFACTURING_TOLERANCE_MM } from './geometry-truth'
import type { Pt } from './types'

// mm → integer nanometres. Clipper64 is integer-robust; this keeps the 12mm physical clearance
// on the safe side of the sub-micron outline calculations used by the library producer.
// manufacturing tolerance.
const SCALE = 1_000_000
export const MANUFACTURING_OFFSET_ARC_TOLERANCE_MM = MANUFACTURING_TOLERANCE_MM / 2

/** Offset corner join — the editor Offset tool's user choice (KAI-9128). */
export type OffsetJoin = 'round' | 'sharp' | 'bevel'
export type OffsetEnd = 'polygon' | 'round' | 'square'

function offset(
  pathMM: ReadonlyArray<Pt>, deltaMM: number, joinStyle: OffsetJoin, end: OffsetEnd, miterLimit: number,
): Pt[] | null {
  if (!pathMM.length) return null
  const flat: number[] = []
  for (const [x, y] of pathMM) flat.push(Math.round(x * SCALE), Math.round(y * SCALE))
  const join = joinStyle === 'sharp' ? JoinType.Miter : joinStyle === 'bevel' ? JoinType.Bevel : JoinType.Round
  const cap = end === 'polygon' ? EndType.Polygon : end === 'round' ? EndType.Round : EndType.Square
  const sol = Clipper.inflatePaths([Clipper.makePath(flat)], deltaMM * SCALE, join, cap, miterLimit,
    MANUFACTURING_OFFSET_ARC_TOLERANCE_MM * SCALE)
  if (!sol || sol.length === 0) return null
  let best = sol[0]
  for (const ring of sol) if (Math.abs(Clipper.area(ring)) > Math.abs(Clipper.area(best))) best = ring
  if (!best || !best.length) return null
  return best.map((point) => [point.x / SCALE, point.y / SCALE] as Pt)
}

export function offsetPathMM(
  pathMM: ReadonlyArray<Pt>, deltaMM: number, joinStyle: OffsetJoin, end: OffsetEnd,
): Pt[] | null {
  return offset(pathMM, deltaMM, joinStyle, end, joinStyle === 'sharp' ? Number.MAX_SAFE_INTEGER : 2)
}

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
  return offset(ringMM, deltaMM, joinStyle, 'polygon', 2)
}
