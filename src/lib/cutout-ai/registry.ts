// cutout-ai — model registry. ONE selected sub after the s62 on-device verdict (Dan: EdgeSAM +
// u2net selected; SlimSAM/SAM2/MobileSAM killed — crash/slow/worse). u2net/silueta are v5.3.1's
// own (ben-chain) — reached through v5.3.1, never re-listed here. Re-adding a model = one new
// sub file + one entry here (the SegModel seam is unchanged).

import type { Point, SegModelConfig } from './types'

export const MODELS: Record<string, SegModelConfig> = {
  edgesam: { key: 'edgesam', label: 'EdgeSAM · selected (self-hosted)', sub: 'edgesam', enc: '/seg-models/edgesam.encoder.onnx', dec: '/seg-models/edgesam.decoder.onnx' },
}

export const DEFAULT_MODEL = 'edgesam'

/** Central auto-prompt when no user hint exists (recognise the main object). */
export const CENTRAL_PROMPT: Point[] = [
  { x: 0.5, y: 0.5, label: 1 }, { x: 0.4, y: 0.4, label: 1 }, { x: 0.6, y: 0.4, label: 1 },
  { x: 0.4, y: 0.6, label: 1 }, { x: 0.6, y: 0.6, label: 1 }, { x: 0.5, y: 0.3, label: 1 }, { x: 0.5, y: 0.7, label: 1 },
]
