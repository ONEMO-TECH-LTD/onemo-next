// paint-module — Dan priority 1: "paint shape and eraser — must be absolutely same — cause it is
// working well." The v1 paint ORCHESTRATION compiled as a pure driver: the exact order of
// operations, guards and messages v1 ran, with zero React and zero engine math. Pixel stages come
// from mask-tools (verbatim v1); engine entry comes from paint-driver (prepareAI/finishDrawn).
// The adopting increment wires: stroke capture (shell) → paintPlan (here) → prepareAI → commit.

import {
  maskArea, polishMask, solidShapeMask, subtractMasks, swathMask, unionMasks,
  PAINT_DEFAULTS, type PaintConfig,
} from '@/lib/tool-paint-math'
import type { Mask } from '@/lib/tool-paint-math/types'
import type { VShape } from '@/lib/vector-core'

/** v1 status truth — the adopting shell maps codes to copy; the DECISIONS live here. */
export type PaintOutcome =
  | { kind: 'created'; mask: Mask }        // no base, add → painted shape created
  | { kind: 'combined'; mask: Mask; erase: boolean } // base exists → union/subtract, polished
  | { kind: 'nothing-to-erase' }           // erase with no base — loud no-op (v1 law)

/** THE v1 PAINT PLAN (verbatim semantics from v1 flow.paintStroke):
 *  swath (round caps, loop-close fill) → no base: polish + create · base: union/subtract then
 *  polish (the polish radius rides the brush — v1's "insect bites" fix). */
export function paintPlan(
  base: Mask | null, strokePx: { x: number; y: number }[], brushPx: number,
  erase: boolean, imgW: number, imgH: number, cfg: PaintConfig = PAINT_DEFAULTS,
): PaintOutcome {
  const painted = swathMask(strokePx, brushPx, imgW, imgH, cfg)
  if (!base) {
    if (erase) return { kind: 'nothing-to-erase' }
    return { kind: 'created', mask: polishMask(painted, brushPx, cfg.polishDiv) }
  }
  const combined = polishMask(erase ? subtractMasks(base, painted) : unionMasks(base, painted), brushPx, cfg.polishDiv)
  return { kind: 'combined', mask: combined, erase }
}

// ── SHAPE-IS-TRUTH normalization (v1 E6/E7/E8 — PAINT SOURCES ONLY, never model mattes) ─────────

export const MIN_DROPPED_REGION_PX = 60 // >this many dropped px = a disconnected region → warn loudly

export interface ShapeTruthResult {
  mask: Mask          // the resolved-outline solid mask — the ONE truth (tint ≡ outline ≡ matte)
  droppedPx: number   // pixels outside the resolved shape that were in the painted mask
  separateRegionDropped: boolean // droppedPx > MIN_DROPPED_REGION_PX → the loud SEPARATE-region message
}

/** Normalize a painted mask to the RESOLVED shape at ZERO OFFSET (v1 E8: the Offset knob is the
 *  band's outer ring, never part of the subject — inner line = the same auto-tuned shape, so the
 *  band is parallel by construction). Islands drop for real; slivers go solid. The caller passes
 *  the zero-offset resolved shape (from the engine resolver via paint-driver.finishDrawn or the
 *  bridge's descriptor session). */
export function shapeTruthNormalize(painted: Mask, zeroOffsetShape: VShape, imgW: number, imgH: number): ShapeTruthResult {
  const norm = solidShapeMask(zeroOffsetShape, imgW, imgH)
  let droppedPx = 0
  if (painted.w === norm.w && painted.h === norm.h) {
    for (let i = 0; i < painted.data.length; i++) if (painted.data[i] && !norm.data[i]) droppedPx++
  }
  return { mask: norm, droppedPx, separateRegionDropped: droppedPx > MIN_DROPPED_REGION_PX }
}

// ── NEVER-DESTROY guard (v1 law: erase can never gut the shape) ─────────────────────────────────

export const MIN_ERASE_KEEP_RATIO = 0.1

/** An erase leaving under 10% of the shape reverts loudly (v1's exact guard). */
export const eraseWouldDestroy = (before: Mask, after: Mask): boolean =>
  maskArea(after) <= maskArea(before) * MIN_ERASE_KEEP_RATIO
