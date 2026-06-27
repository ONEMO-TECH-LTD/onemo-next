// descriptors/image/saturate.ts — Color tool (one descriptor, one file). Image-fx slider (imageFx.saturate),
// surface-agnostic (editor draft + hero live), 0–100% via fxToPct/fxFromPct. Label "Color" per the UI.
// Remove = delete this file + its registry line.

import type { ToolDescriptor, EditorCtx } from '../types'
import { fxToPct, fxFromPct } from '../../sheets'

export const saturateDescriptor: ToolDescriptor<number> = {
  id: 'saturate',
  outlet: 'image',
  label: 'Color',
  icon: 'saturation',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  read: (ctx) => fxToPct('saturate', ctx.getImageFx().saturate),
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), saturate: fxFromPct('saturate', v) }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), saturate: fxFromPct('saturate', v) }); return { ok: true } },
}
