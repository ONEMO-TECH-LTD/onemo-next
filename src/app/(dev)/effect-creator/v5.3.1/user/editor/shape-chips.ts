// editor/shape-chips.ts — the Shape picker's chip lineup + default params as PURE DATA (no React), so the
// descriptor layer (shape-pick) imports it WITHOUT dragging the React UI module (chips.tsx) into the engine
// layer. chips.tsx (the icon UI client) re-exports these. (pixel step-4 F1: descriptor-data / UI-client split.)

import { type ShapeKind, type ShapeParams } from '../shapes'

// CURATED launch set (KAI-9129, Dan 2026-06-17): basics first; squircle/pill = math-derived; ✦ = generative.
export const SHAPE_CHIPS: { kind: ShapeKind; label: string }[] = [
  { kind: 'square', label: 'Square' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'squircle', label: 'Squircle' },
  { kind: 'pill', label: 'Pill' },
  { kind: 'polygon', label: 'Polygon' },
  { kind: 'star', label: 'Star' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'heart', label: 'Heart' },
  { kind: 'sparkle', label: 'Sparkle' },
  { kind: 'pinched', label: 'Pinched' },
  { kind: 'daisy', label: 'Daisy ✦' },
  { kind: 'pinwheel', label: 'Pinwheel ✦' },
  { kind: 'form', label: 'Form ✦' },
  { kind: 'blob', label: 'Blob ✦' },
]

/** Default generator params (persist across picks within an editor session). */
export const DEFAULT_SHAPE_PARAMS: Required<Omit<ShapeParams, 'kind' | 'rotateDeg'>> = {
  sides: 6, points: 5, spikiness: 45, lobes: 4, pinch: 50,
  petals: 8, depth: 55, blades: 5, swirl: 50, waviness: 50, seed: 1,
}
