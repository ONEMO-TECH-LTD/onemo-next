// descriptors/image/preset.ts — Preset tool (one descriptor, one file). One-tap look (imageFx.preset).
// swatches of PRESETS (data module, no React); writes via the surface-agnostic ctx image-fx binding.
// Remove = delete this file + its registry line.

import type { ToolDescriptor } from '../types'
import { PRESET_LABELS, type PresetKey } from '@/lib/effect/composite'
import { PRESETS } from '../../image-presets'

export const presetDescriptor: ToolDescriptor<string> = {
  id: 'preset',
  outlet: 'image',
  label: 'Preset',
  icon: 'preset',
  control: { kind: 'swatches', options: PRESETS.map((p) => ({ id: p, label: PRESET_LABELS[p], value: null })) },
  read: (ctx) => ctx.getImageFx().preset ?? 'none',
  preview: (v, ctx) => ctx.previewImageFx({ ...ctx.getImageFx(), preset: v as PresetKey }),
  commit: (v, ctx) => { ctx.commitImageFx({ ...ctx.getImageFx(), preset: v as PresetKey }); return { ok: true } },
}
