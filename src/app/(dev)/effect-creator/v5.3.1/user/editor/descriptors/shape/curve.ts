// descriptors/shape/curve.ts — the Curve tool (one descriptor, one file). Selection-routed, re-homed from
// useEditorAdjustments.previewCurve/commitCurve: a SELECTED anchor bends alone; with NO selection it bends
// EVERY source anchor (whole-shape) — mirroring Radius. The slider carries 0–100%; the engine value is the
// bezier factor (pct/100)·2. 0 = straight (off), reversible. Remove = delete this file + its registry line.

import type { ToolDescriptor, EditorCtx } from '../types'
import type { OutlineAdjustments } from '@/lib/effect/outline-resolve'
import { representativeLocal } from '../../seed-defaults'

/** Curve targets: the selected source id, else EVERY source anchor id (whole-shape bend). */
function curveTargets(ctx: EditorCtx): string[] {
  const sel = ctx.sourceIdForSelection()
  if (sel) return [sel]
  const src = ctx.getSource()
  return src ? src.shape.paths.flatMap((p) => p.anchors.filter((a) => a.id).map((a) => a.id as string)) : []
}

function nextAdj(ctx: EditorCtx, pct: number): OutlineAdjustments {
  const adj = ctx.getAdjustments()
  const curve = (pct / 100) * 2
  const local = { ...adj.local }
  for (const id of curveTargets(ctx)) local[id] = { ...local[id], curve }
  return { global: adj.global, local }
}

export const curveDescriptor: ToolDescriptor<number> = {
  id: 'curve',
  outlet: 'adjust',
  label: 'Curve',
  icon: 'round',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  applies: (ctx) => !!ctx.getDisplay(),
  read: (ctx) => {
    const src = ctx.getSource()
    return src ? representativeLocal(ctx.getAdjustments(), src.shape, 'curve') * 50 : 0 // factor(0..2) → 0..100
  },
  preview: (v, ctx) => ctx.preview(nextAdj(ctx, v)),
  commit: (v, ctx) => ctx.commitAdjustments(nextAdj(ctx, v)),
}
