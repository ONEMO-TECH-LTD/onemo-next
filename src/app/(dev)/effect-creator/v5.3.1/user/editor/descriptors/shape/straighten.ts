// descriptors/shape/straighten.ts — the Straighten tool (one descriptor, one file). GLOBAL axis (whole-shape).
// Re-homed from useEditorAdjustments.previewGlobal/commitGlobal (DEC-v5-03): 0–100% to adjustments.global.straighten;
// resolve() owns the Clipper2 RDP/TrimCollinear. 0 = OFF. Remove = delete this file + its registry line.

import type { ToolDescriptor, EditorCtx } from '../types'
import type { OutlineAdjustments } from '@/lib/effect/outline-resolve'

const next = (ctx: EditorCtx, v: number): OutlineAdjustments => {
  const adj = ctx.getAdjustments()
  return { global: { ...adj.global, straighten: v }, local: adj.local }
}

export const straightenDescriptor: ToolDescriptor<number> = {
  id: 'straighten',
  outlet: 'adjust',
  label: 'Straighten',
  icon: 'line',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => ctx.getAdjustments().global.straighten,
  preview: (v, ctx) => ctx.preview(next(ctx, v)),
  commit: (v, ctx) => ctx.commitAdjustments(next(ctx, v)),
}
