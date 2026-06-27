// descriptors/image/blend.ts — Blend tool (one descriptor, one file). The magic-blend (bgBlur): a soft real-
// background blur behind the subject. slider 0–100% (0 = off, the ruler IS the switch). Reads/writes bgBlur
// via the shared ctx binding (live in both surfaces). Remove = delete file + line.

import type { ToolDescriptor } from '../types'

export const blendDescriptor: ToolDescriptor<number> = {
  id: 'blend',
  outlet: 'image',
  label: 'Blend',
  icon: 'blur',
  control: { kind: 'slider', min: 0, max: 100, format: (v) => (v === 0 ? 'off' : `${Math.round(v)}%`) },
  read: (ctx) => { const b = ctx.getBgBlur(); return b == null ? 0 : Math.round(b * 100) },
  preview: (v, ctx) => ctx.setBgBlur(v <= 0 ? 0 : v / 100),
  commit: (v, ctx) => { ctx.setBgBlur(v <= 0 ? 0 : v / 100); return { ok: true } },
}
