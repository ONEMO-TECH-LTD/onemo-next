// descriptors/image/vignette.ts — Vignette tool (one descriptor, one file). Composite vignette (imageFx.vignette,
// 0..1). slider 0–100%; writes via the surface-agnostic ctx image-fx binding. Remove = delete file + line.

import type { ToolDescriptor } from '../types'

export const vignetteDescriptor: ToolDescriptor<number> = {
  id: 'vignette',
  outlet: 'image',
  label: 'Vignette',
  icon: 'vignette',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => Math.round((ctx.getImageFx().vignette ?? 0) * 100),
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), vignette: v / 100 }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), vignette: v / 100 }); return { ok: true } },
}
