// descriptors/image/contrast.ts — Contrast tool (one descriptor, one file). Image-fx slider, surface-agnostic
// (editor draft + hero live), 0–100% via fxToPct/fxFromPct. Remove = delete this file + its registry line.

import type { ToolDescriptor, EditorCtx } from '../types'
import { fxToPct, fxFromPct } from '../../image-presets'

export const contrastDescriptor: ToolDescriptor<number> = {
  id: 'contrast',
  outlet: 'image',
  label: 'Contrast',
  icon: 'contrast',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => fxToPct('contrast', ctx.getImageFx().contrast),
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), contrast: fxFromPct('contrast', v) }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), contrast: fxFromPct('contrast', v) }); return { ok: true } },
}
