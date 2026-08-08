// descriptors/shape/smooth.ts — the Smooth tool (one descriptor, one file). GLOBAL axis (whole-shape).
// Re-homed from useEditorAdjustments.previewGlobal/commitGlobal (DEC-v5-03): 0–100% to adjustments.global.smooth;
// resolve() owns the Paper catmull blend. 0 = OFF. Remove = delete this file + its registry line.

import type { ToolDescriptor, EditorCtx } from '../types'
import type { OutlineAdjustments } from '@/lib/effect/outline-resolve'

const next = (ctx: EditorCtx, v: number): OutlineAdjustments => {
  const adj = ctx.getAdjustments()
  return { global: { ...adj.global, smooth: v }, local: adj.local }
}

export const smoothDescriptor: ToolDescriptor<number> = {
  id: 'smooth',
  outlet: 'adjust',
  label: 'Smooth',
  icon: 'smooth',
  // 0-200 (Dan 2026-08-06 deployed; restored 08-08): 0-50 single-pass, each further 50 adds a
  // fold-guarded rounding pass. Bites on the sparse anchors a Detail/Simplify workflow produces.
  control: { kind: 'slider', min: 0, max: 200, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => ctx.getAdjustments().global.smooth,
  preview: (v, ctx) => ctx.preview(next(ctx, v)),
  commit: (v, ctx) => ctx.commitAdjustments(next(ctx, v)),
}
