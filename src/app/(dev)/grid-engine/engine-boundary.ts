import type { StudioPoint } from '@onemo/magnetic-next'
import type { OutlineUV } from '@/lib/grid-engine/ui/trace-cutout'

export function toMagneticStudioOutline(
  outline: Readonly<OutlineUV>,
  box: Readonly<{ w: number; h: number }>,
): StudioPoint[] {
  return outline.map(([u, v]) => ({ x: u * box.w, y: v * box.h }))
}
