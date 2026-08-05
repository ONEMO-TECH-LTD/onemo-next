// freeshape — the one entry point (ARCHITECTURE.md): a drawn stroke in, an idealized v5.3.1
// shape out. ZERO AI. Open strokes return null — this tool never guesses (gate 4); the knife
// gesture is a separate future sub.

import { isClosedLoop, resampleClosed, strokeStats } from './capture'
import { classify } from './classify'
import { harmonize } from './harmonize'
import type { NormalizedShape, NormalizeOptions, StrokePoint } from './types'

export type { NormalizedShape, NormalizeOptions, ShapeVerdict, StrokePoint } from './types'

export function strokeToShape(points: StrokePoint[], opts: NormalizeOptions = {}): NormalizedShape | null {
  const closeTolerance = opts.closeTolerance ?? 0.15
  const sampleSpacingFrac = opts.sampleSpacing ?? 0.01
  const stats = strokeStats(points)
  if (points.length < 8 || stats.diag < 8) return null // too small/short to be a shape
  if (!isClosedLoop(points, stats, closeTolerance)) return null // open stroke — not this tool's job
  const ring = resampleClosed(points, Math.max(1, stats.diag * sampleSpacingFrac))
  if (ring.length < 24) return null
  const cls = classify(ring)
  const shape = harmonize(cls, stats.diag)
  return { shape, verdict: cls.verdict, ring }
}
