// descriptors/shape/offset.ts — the Offset tool (one descriptor, one file). GENERATION control: expands the
// re-derived source outward (Clipper2 outset) with a round/sharp/bevel JOIN — re-homed from
// OutlineEditor.previewTrace/commitTrace + the join selector via the shared EditorCtx.reDeriveTrace binding.
// Its value is { pct, join } (a slider-enum control). Applies only to a Magic-generated source with a cached
// raw trace. Remove = delete this file + its registry line (the shared reDeriveTrace binding stays for Detail).

import type { ToolDescriptor, EditorCtx } from '../types'
import type { OffsetJoin } from '@/lib/effect/offset'

export type OffsetValue = { pct: number; join: OffsetJoin }

const traceApplies = (ctx: EditorCtx): boolean => {
  const s = ctx.getSource()
  const raw = ctx.getSpec()?.rawTracePx as unknown[] | undefined
  return !!s && s.klass === 'generated' && (raw?.length ?? 0) > 0
}

export const offsetDescriptor: ToolDescriptor<OffsetValue> = {
  id: 'offset',
  outlet: 'adjust',
  label: 'Offset',
  icon: 'offset',
  control: {
    kind: 'slider-enum',
    min: 0,
    max: 100,
    format: (v) => `${Math.round(v)}%`,
    options: [{ id: 'round', label: 'Round' }, { id: 'sharp', label: 'Sharp' }, { id: 'bevel', label: 'Bevel' }],
  },
  applies: traceApplies,
  read: (ctx) => ({ pct: ctx.getGenParams().offset, join: ctx.getGenParams().offsetJoin }),
  preview: (v, ctx) => { ctx.reDeriveTrace({ offset: v.pct, offsetJoin: v.join }, false) },
  commit: (v, ctx) => ctx.reDeriveTrace({ offset: v.pct, offsetJoin: v.join }, true),
}
