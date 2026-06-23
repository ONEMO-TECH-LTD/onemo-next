// editor/seed-defaults.ts — Creator v5 seeding defaults (DEC-v5-03 · T5 sharp-wired seeding, T6
// auto-tune, T7 value-reflection).
//
// Every shape seeds a SHARP source; any rounding/polish is a reversible ADJUSTMENT on top, never baked
// into the source geometry (invariant 9). These helpers build those default adjustments and read them
// back so the sliders reflect the geometry's real values. The default VALUES are tuning constants.

import { GLOBAL_OFF, type OutlineAdjustments } from '@/lib/effect/outline-resolve'
import type { VShape } from '@/lib/vector-core'

/** T5 — whole-shape Radius as an ADJUSTMENT on the sharp source (sharp-wired stock seeding): the source
 *  stays sharp, the rounding is reversible, and the Radius slider reflects `radiusPx`. DEC-v5-03/04
 *  dual-engine: the default whole-shape rounding is the GLOBAL radius axis (Clipper2 offset-round,
 *  symmetric), not a per-corner local edit — so dragging Radius (no selection) updates THIS value and
 *  there is no double-round. A per-corner override (selecting a corner) layers on top via Paper. */
export function cornerRadiusAdjustments(_shape: VShape, radiusPx: number): OutlineAdjustments {
  return { global: { ...GLOBAL_OFF, radius: Math.max(0, radiusPx) }, local: {} }
}

/** T6 — post-generation AUTO-TUNE: the default recipe applied right after Magic so the cut-out is
 *  organic by default (the user need not touch a slider). simplify = sparse, straighten = clean trace
 *  jitter, smooth = the organic round. The raw source stays SHARP underneath — fully reversible (zero
 *  the sliders → the raw trace). Rounding is delivered by global Smooth (catmull): a per-corner Radius
 *  can't target post-straighten/simplify anchors (they carry no stable source id). The values are
 *  STARTING tuning constants — Dan tunes them on-device. */
export const AUTO_TUNE = { simplify: 40, straighten: 20, smooth: 45 } as const
export function autoTuneDefaults(): OutlineAdjustments {
  return { global: { ...GLOBAL_OFF, ...AUTO_TUNE }, local: {} }
}

/** T7 — value-reflection: the whole-shape value the Radius/Curve slider should show for the current
 *  recipe = the UNIFORM value across the source's corners, else 0 (mixed per-corner edits have no single
 *  whole-shape value). Returns the stored unit (radius px; curve factor 0..~2). */
export function representativeLocal(adj: OutlineAdjustments, shape: VShape, key: 'radius' | 'curve'): number {
  const ids: string[] = []
  for (const p of shape.paths) for (const a of p.anchors) if (a.id && (key === 'radius' ? a.corner : true)) ids.push(a.id)
  if (!ids.length) return 0
  const vals = ids.map((id) => adj.local[id]?.[key] ?? 0)
  return vals.every((v) => v === vals[0]) ? vals[0] : 0
}
