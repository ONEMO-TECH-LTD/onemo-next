// descriptors/image/tint.ts — Tint tool (one descriptor, one file). Composite tint colour (imageFx.tint).
// swatches of TINTS (data module, no React); writes via the surface-agnostic ctx image-fx binding.
// Remove = delete this file + its registry line.

import type { ToolDescriptor } from '../types'
import { TINTS } from '../../image-presets'

export const tintDescriptor: ToolDescriptor<string | null> = {
  id: 'tint',
  outlet: 'image',
  label: 'Tint',
  icon: 'tint',
  control: { kind: 'swatches', options: TINTS.map((t) => ({ id: t.value ?? 'none', label: t.label, value: t.value })) },
  read: (ctx) => ctx.getImageFx().tint ?? null,
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), tint: v }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), tint: v }); return { ok: true } },
}
