// descriptors/image/warmth.ts — Warmth tool (one descriptor, one file). Image-fx slider (imageFx.warmth),
// surface-agnostic (editor draft + hero live), 0–100% via fxToPct/fxFromPct. Remove = delete this file + its line.

import type { ToolDescriptor, EditorCtx } from '../types'
import { fxToPct, fxFromPct } from '../../image-presets'

export const warmthDescriptor: ToolDescriptor<number> = {
  id: 'warmth',
  outlet: 'image',
  label: 'Warmth',
  icon: 'warmth',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => fxToPct('warmth', ctx.getImageFx().warmth),
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), warmth: fxFromPct('warmth', v) }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), warmth: fxFromPct('warmth', v) }); return { ok: true } },
}
