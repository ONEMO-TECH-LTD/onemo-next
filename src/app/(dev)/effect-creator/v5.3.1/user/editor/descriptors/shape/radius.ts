// descriptors/shape/radius.ts — the Radius tool (one descriptor, one file). DUAL-ENGINE, selection-routed
// (DEC-v5-03/04), re-homed from useEditorAdjustments.previewRadius/commitRadius: a SELECTED corner rounds
// alone (per-corner Paper, local[id].radius); with NO selection the WHOLE shape rounds (global radius axis,
// Clipper2 offset-round). The slider carries 0–100%; the engine value is px = (pct/100)·maxRadius, where
// maxRadius = half the short side of the display bbox (KAI-8940: 100% on a square = the inscribed circle).
// 0 = sharp (off), reversible. Remove this tool = delete this file + its TOOL_REGISTRY line.

import type { ToolDescriptor, EditorCtx } from '../types'
import type { OutlineAdjustments } from '@/lib/effect/outline-resolve'
import { shapeBBox } from '@/lib/vector-core'
import { representativeLocal } from '../../seed-defaults'

/** maxRadius = half the short side of the display bbox (the slider's geometric 100%). */
function maxRadiusOf(ctx: EditorCtx): number {
  const d = ctx.getDisplay()
  if (!d) return 1
  const bb = shapeBBox(d, 1)
  return Math.max(1, Math.round(Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2))
}

/** Build the next adjustments for a 0–100% slider value (selection-routed). */
function nextAdj(ctx: EditorCtx, pct: number): OutlineAdjustments {
  const adj = ctx.getAdjustments()
  const px = (Math.max(0, Math.min(100, pct)) / 100) * maxRadiusOf(ctx)
  const sel = ctx.sourceIdForSelection()
  if (sel) return { global: adj.global, local: { ...adj.local, [sel]: { ...adj.local[sel], radius: px } } } // per-corner → Paper
  return { global: { ...adj.global, radius: Math.max(0, px) }, local: adj.local }                            // whole-shape → Clipper
}

export const radiusDescriptor: ToolDescriptor<number> = {
  id: 'radius',
  outlet: 'adjust',
  label: 'Radius', // the client may show 'Corner' when a corner anchor is selected (cornerMode) — a UI label, not a separate tool
  icon: 'corner',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  // tier-2 availability (Dan's rule): Radius needs a CORNER to round — keyed off the source (keeps its corners)
  // OR the display, never greyed away once a corner exists (Codex F3 reversibility).
  applies: (ctx) => {
    const s = ctx.getSource(); const d = ctx.getDisplay()
    return (!!s && s.shape.paths.some((p) => p.anchors.some((a) => a.corner))) || (!!d && d.paths[0].anchors.some((a) => a.corner))
  },
  read: (ctx) => {
    const adj = ctx.getAdjustments(); const max = maxRadiusOf(ctx); const sel = ctx.sourceIdForSelection(); const src = ctx.getSource()
    const px = sel ? (adj.local[sel]?.radius ?? 0) : (adj.global.radius || (src ? representativeLocal(adj, src.shape, 'radius') : 0))
    return Math.round((Math.min(px, max) / Math.max(max, 1)) * 100)
  },
  preview: (v, ctx) => ctx.preview(nextAdj(ctx, v)),
  commit: (v, ctx) => ctx.commitAdjustments(nextAdj(ctx, v)),
}
