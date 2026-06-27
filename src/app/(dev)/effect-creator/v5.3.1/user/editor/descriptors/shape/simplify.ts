// descriptors/shape/simplify.ts — the Simplify tool (one descriptor, one file). GLOBAL axis (whole-shape).
// Engine-binding re-homed from useEditorAdjustments.previewGlobal/commitGlobal (DEC-v5-03): a 0–100% axis
// written to adjustments.global.simplify; resolve() owns the Paper curve-fit. 0 = OFF (full detail). Remove
// this tool = delete this file + its TOOL_REGISTRY line; disable = runtime config (no code change).

import type { ToolDescriptor, EditorCtx } from '../types'
import type { OutlineAdjustments } from '@/lib/effect/outline-resolve'

const next = (ctx: EditorCtx, v: number): OutlineAdjustments => {
  const adj = ctx.getAdjustments()
  return { global: { ...adj.global, simplify: v }, local: adj.local }
}

export const simplifyDescriptor: ToolDescriptor<number> = {
  id: 'simplify',
  outlet: 'adjust',
  label: 'Simplify',
  icon: 'detail',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => ctx.getAdjustments().global.simplify,
  preview: (v, ctx) => ctx.preview(next(ctx, v)),
  commit: (v, ctx) => ctx.commitAdjustments(next(ctx, v)),
}
