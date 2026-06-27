// descriptors/image/tint.ts — Tint tool (one descriptor, one file). Composite tint colour (imageFx.tint).
// swatches of TINTS (data module, no React); writes via the surface-agnostic ctx image-fx binding.
// Remove = delete this file + its registry line.

import type { ToolDescriptor } from '../types'
import { TINTS } from '../../image-presets'

export const tintDescriptor: ToolDescriptor<string> = {
  id: 'tint',
  outlet: 'image',
  label: 'Tint',
  icon: 'tint',
  // swatch id = the colour (or 'none'); `swatch` renders the dot. V = the id; commit/preview map 'none' → null.
  control: { kind: 'swatches', options: TINTS.map((t) => ({ id: t.value ?? 'none', label: t.label, swatch: t.value })) },
  read: (ctx) => ctx.getImageFx().tint ?? 'none',
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), tint: v === 'none' ? null : v }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), tint: v === 'none' ? null : v }); return { ok: true } },
}
