// editor/image-presets.ts — the Filters preset + tint options as PURE DATA (no React), so the image-tool
// descriptors (preset/tint) import the data WITHOUT pulling the FiltersSurface React module into the engine
// layer (the F1 lesson from shape-pick). FiltersSurface (the UI client) imports the same data.

import type { PresetKey } from '@/lib/effect/composite'

export const PRESETS: PresetKey[] = ['none', 'bw', 'noir', 'sepia', 'vivid', 'fade', 'cool', 'warm', 'duotone']

export const TINTS: { label: string; value: string | null }[] = [
  { label: 'None', value: null },
  { label: 'Warm', value: '#ff8a3d' },
  { label: 'Rose', value: '#ff5d8f' },
  { label: 'Cool', value: '#3da5ff' },
  { label: 'Mint', value: '#37d6a0' },
  { label: 'Mono', value: '#8a8f9c' },
]
