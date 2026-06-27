// descriptors/image/brightness.ts — Bright tool (one descriptor, one file). Image-fx slider re-homed from
// ImageSheet/FiltersSurface: writes imageFx.brightness via the surface-agnostic ctx preview/commit. Bound by
// BOTH the editor Image mode AND the hero FiltersSurface (the two welded UIs unified at the descriptor layer).
// 0–100% via fxToPct/fxFromPct. Remove = delete this file + its registry line.

import type { ToolDescriptor, EditorCtx } from '../types'
import { fxToPct, fxFromPct } from '../../sheets'

export const brightnessDescriptor: ToolDescriptor<number> = {
  id: 'brightness',
  outlet: 'image',
  label: 'Bright',
  icon: 'brightness',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => fxToPct('brightness', ctx.getImageFx().brightness),
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), brightness: fxFromPct('brightness', v) }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), brightness: fxFromPct('brightness', v) }); return { ok: true } },
}
