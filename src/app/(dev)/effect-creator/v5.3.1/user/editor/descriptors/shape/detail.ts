// descriptors/shape/detail.ts — the Detail tool (one descriptor, one file). GENERATION control: re-derives
// the SHARP source from the cached AI trace (no AI re-run) at a chosen tightness — re-homed from
// OutlineEditor.previewTrace/commitTrace via the shared EditorCtx.reDeriveTrace binding. 100% = tightest
// pixel-true; lower = coarser facets. Applies only to a Magic-generated source with a cached raw trace.
// Remove this tool = delete this file + its registry line (the shared reDeriveTrace binding stays for Offset).

import type { ToolDescriptor, EditorCtx } from '../types'

/** Detail/Offset apply only to a generated source carrying a cached raw trace (stock/upload have none). */
const traceApplies = (ctx: EditorCtx): boolean => {
  const s = ctx.getSource()
  const raw = ctx.getSpec()?.rawTracePx as unknown[] | undefined
  return !!s && s.klass === 'generated' && (raw?.length ?? 0) > 0
}

export const detailDescriptor: ToolDescriptor<number> = {
  id: 'detail',
  outlet: 'adjust',
  label: 'Detail',
  icon: 'trace-detail',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  applies: traceApplies,
  hideWhenUnavailable: true, // generation tool: hidden on a non-Magic source (parity with the old conditional chip)
  read: (ctx) => ctx.getGenParams().detail,
  preview: (v, ctx) => { ctx.reDeriveTrace({ detail: v }, false) },
  commit: (v, ctx) => ctx.reDeriveTrace({ detail: v }, true),
}
