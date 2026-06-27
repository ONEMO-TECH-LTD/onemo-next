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

// KAI-9028 image-fx 0–100% conversions (PURE number math) — every filter shows ONE uniform 0–100% scale
// regardless of the engine range. Kept HERE (not in the React sheets.tsx) so the Layer-2 image descriptors
// import them without pulling a UI module into their graph (the F1 lesson). sheets.tsx re-exports for the UI.
export const FX_RANGE = { brightness: [50, 150], contrast: [50, 150], saturate: [0, 200], warmth: [0, 100] } as const
export type FxKey = keyof typeof FX_RANGE
export const fxToPct = (k: FxKey, v: number) => {
  const [lo, hi] = FX_RANGE[k]
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
}
export const fxFromPct = (k: FxKey, pct: number) => {
  const [lo, hi] = FX_RANGE[k]
  return lo + (pct / 100) * (hi - lo)
}
