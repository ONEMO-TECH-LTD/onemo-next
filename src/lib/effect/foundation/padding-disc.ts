// padding-disc.ts — THE PADDING, AS GEOMETRY.
//
// The 24mm magnetic lattice is invisible. What is visible at every seated magnet is its PADDING,
// and until now that could only be a circle — not because the engine decided so, but because the
// bench drew `<circle r={spotRadius}>` and the engine never stated a shape at all. A radius is not
// a shape, so nothing downstream could draw anything else, and no export or consumer could either.
//
// The padding is a SQUARE of `2 * padding`, grown by the edge padding, with a corner radius. A
// circle is that square at full radius — so the released behaviour is one variant of the rule
// rather than a separate path, and choosing a mode cannot break what a circle already did.
//
// Values live in the spec; this builds from them and states the disc's true shape to the solver as a
// square core plus a round margin, so the wrap clears the disc itself rather than a circle round it.

import {
  DISC_OFFSET_MM, OFFSET_SQUIRCLE_RADIUS_MM,
  PADDING_SHAPE, SQUIRCLE_RADIUS_MM, type PaddingShape,
} from '../grid-magnet-spec'
import type { Pt } from '../types'

export interface PaddingDiscSpec {
  shape: PaddingShape
  /** Half the cell: the rim plus the edge padding. The cell is `2 * halfMM`. */
  halfMM: number
  /** Corner radius, already clamped to half the cell (at which point the square IS a circle). */
  radiusMM: number
}

/** The disc a mode asks for, resolved against the spec. An unset radius takes the mode's default;
 *  `circle` ignores a radius entirely, because full radius is what makes it a circle.
 *
 *  THE EDGE PADDING IS NOT AN INPUT HERE, deliberately. It pads the wrapping LINE (Dan, 2026-09-22:
 *  "the line that wraps the grid must be padded = edge padding") and the disc is a separate
 *  category. When one number fed both, a 24mm edge padding inflated every disc to 72mm across and
 *  drew a released square as a four-petal blob — the line grew and dragged the cells with it. */
export function paddingDiscSpec(
  paddingMM: number,
  opts: { shape?: PaddingShape; radiusMM?: number; discOffsetMM?: number } = {},
): PaddingDiscSpec {
  const shape = opts.shape ?? PADDING_SHAPE
  const offset = shape === 'offset'
    ? Math.max(0, opts.discOffsetMM ?? DISC_OFFSET_MM)
    : Math.max(0, opts.discOffsetMM ?? 0)
  const halfMM = paddingMM + offset
  if (shape === 'circle') return { shape, halfMM, radiusMM: halfMM }
  const fallback = shape === 'offset' ? OFFSET_SQUIRCLE_RADIUS_MM : SQUIRCLE_RADIUS_MM
  const asked = opts.radiusMM ?? fallback
  return { shape, halfMM, radiusMM: Math.min(Math.max(0, asked), halfMM) }
}

/** THE DISC AS THE WRAP SEES IT — its true shape, not a circle round it. Every mode is an axis-
 *  aligned square of half `squareHalfMM` grown by a round margin of `roundMM`; a circle is the case
 *  with no square at all. The wrap erodes the outline by exactly those two, so a squircle is held
 *  where a squircle fits — tighter than its circumscribing circle along the flats, and refused where
 *  its corner would cut the line (Dan, 2026-09-22: "true shapes and wrap engine to react to that
 *  shape not circle"). A single reach number could only ever describe that circle. */
export function paddingDiscParts(spec: PaddingDiscSpec): { squareHalfMM: number; roundMM: number } {
  return { squareHalfMM: Math.max(0, spec.halfMM - spec.radiusMM), roundMM: spec.radiusMM }
}

/** The disc as a closed ring in millimetres about its magnet centre, at `segments` points per
 *  corner arc. Plain data: the bench draws it, the exporter writes it, a consumer reads it — none
 *  of them decides what it is. */
export function paddingDiscRingMM(spec: PaddingDiscSpec, segments = 16): Pt[] {
  const { halfMM: h, radiusMM: r } = spec
  if (r >= h) {                                       // a circle: one arc, no straight runs
    const ring: Pt[] = []
    const n = Math.max(12, segments * 4)
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2
      ring.push([h * Math.cos(t), h * Math.sin(t)])
    }
    return ring
  }
  const s = h - r                                     // the corner arcs' centres sit at (+-s, +-s)
  const corners: Array<{ cx: number; cy: number; from: number }> = [
    { cx: s, cy: s, from: 0 },                        // NE, sweeping 0 -> 90
    { cx: -s, cy: s, from: Math.PI / 2 },             // NW
    { cx: -s, cy: -s, from: Math.PI },                // SW
    { cx: s, cy: -s, from: (3 * Math.PI) / 2 },       // SE
  ]
  const ring: Pt[] = []
  for (const { cx, cy, from } of corners) {
    for (let i = 0; i <= segments; i++) {
      const t = from + (i / segments) * (Math.PI / 2)
      ring.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
    }
  }
  return ring
}
