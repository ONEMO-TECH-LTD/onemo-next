// freeshape — data types (ARCHITECTURE.md). No runtime, no DOM, no AI.

import type { Vec2 } from '@/lib/vector-core'

export type { Vec2 }

/** One sampled input point in image/canvas space (whatever space the caller draws in). */
export interface StrokePoint {
  x: number
  y: number
}

/** What the classifier decided the drawn loop is. */
export type ShapeVerdict = 'circle' | 'ellipse' | 'rect' | 'triangle' | 'blob'

export interface NormalizeOptions {
  /** endpoint gap tolerated as "closed", as a fraction of the stroke's perimeter (default 0.15) */
  closeTolerance?: number
  /** resample spacing as a fraction of the stroke bbox diagonal (default 0.01) */
  sampleSpacing?: number
  /** Schneider fit error budget as a fraction of the bbox diagonal (default 0.012) */
  fitTolerance?: number
}

export interface NormalizedShape {
  /** the idealized closed shape — a first-class v5.3.1 VShape (seeds an OutlineSource as-is) */
  shape: import('@/lib/vector-core').VShape
  verdict: ShapeVerdict
  /** the resampled raw ring — provenance, kept so normalization is never a bake */
  ring: Vec2[]
}
