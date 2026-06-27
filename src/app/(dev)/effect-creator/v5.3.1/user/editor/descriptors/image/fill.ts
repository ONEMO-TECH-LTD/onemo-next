// descriptors/image/fill.ts — Fill tool (one descriptor, one file). When the Offset cut expands past the
// photo: TILE the photo (RepeatWrapping = the no-AI "fill") vs CLAMP the edge. A toggle over wrapTile, via
// the shared ctx binding (live in both surfaces). Remove = delete file + line.

import type { ToolDescriptor } from '../types'

export const fillDescriptor: ToolDescriptor<boolean> = {
  id: 'fill',
  outlet: 'image',
  label: 'Fill',
  icon: 'fill',
  control: { kind: 'toggle', onLabel: 'Tile fill', offLabel: 'Clamp' },
  read: (ctx) => ctx.getWrapTile(),
  preview: (v, ctx) => ctx.setWrapTile(v),
  commit: (v, ctx) => { ctx.setWrapTile(v); return { ok: true } },
}
