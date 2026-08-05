// cutout-ai — model registry. The ONE list (ARCHITECTURE.md law 5): one entry per model sub.
// u2net/silueta are v5.3.1's own (ben-chain) — reached through v5.3.1, never re-listed here.

import type { Point, SegModelConfig } from './types'

export const MODELS: Record<string, SegModelConfig> = {
  slim77: { key: 'slim77', label: 'SlimSAM-77 · ~5.5M', sub: 'slimsam', id: 'Xenova/slimsam-77-uniform' },
  slim50: { key: 'slim50', label: 'SlimSAM-50 · larger', sub: 'slimsam', id: 'Xenova/slimsam-50-uniform' },
  mobilesam: { key: 'mobilesam', label: 'MobileSAM · ~10M', sub: 'mobilesam', enc: '/seg-models/mobilesam.encoder.onnx', dec: '/seg-models/mobilesam.decoder.onnx' },
  edgesam: { key: 'edgesam', label: 'EdgeSAM · fastest', sub: 'edgesam', enc: '/seg-models/edgesam.encoder.onnx', dec: '/seg-models/edgesam.decoder.onnx' },
  sam2tiny: { key: 'sam2tiny', label: 'SAM2-tiny · best', sub: 'sam2', id: 'onnx-community/sam2-hiera-tiny-ONNX' },
}

export const DEFAULT_MODEL = 'slim77'

/** Central auto-prompt when no user hint exists (recognise the main object). */
export const CENTRAL_PROMPT: Point[] = [
  { x: 0.5, y: 0.5, label: 1 }, { x: 0.4, y: 0.4, label: 1 }, { x: 0.6, y: 0.4, label: 1 },
  { x: 0.4, y: 0.6, label: 1 }, { x: 0.6, y: 0.6, label: 1 }, { x: 0.5, y: 0.3, label: 1 }, { x: 0.5, y: 0.7, label: 1 },
]
