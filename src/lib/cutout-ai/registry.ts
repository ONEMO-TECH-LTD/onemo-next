// cutout-ai — model registry. The ONE list (ARCHITECTURE.md law 5): one entry per model sub.
// u2net/silueta are v5.3.1's own (ben-chain) — reached through v5.3.1, never re-listed here.

import type { Point, SegModelConfig } from './types'

// DEFAULT = EdgeSAM: weights SELF-HOSTED same-origin (no hub download — the mobile "stuck loading"
// was SlimSAM pulling ~40MB from HF on the phone), fastest CPU/WASM encode, quality ≈ slim on the
// Mac A/B (Dan 2026-08-05). The hub-fetched models stay for desktop comparison only.
export const MODELS: Record<string, SegModelConfig> = {
  edgesam: { key: 'edgesam', label: 'EdgeSAM · default (self-hosted, fastest)', sub: 'edgesam', enc: '/seg-models/edgesam.encoder.onnx', dec: '/seg-models/edgesam.decoder.onnx' },
  mobilesam: { key: 'mobilesam', label: 'MobileSAM · self-hosted', sub: 'mobilesam', enc: '/seg-models/mobilesam.encoder.onnx', dec: '/seg-models/mobilesam.decoder.onnx' },
  slim77: { key: 'slim77', label: 'SlimSAM-77 · hub download', sub: 'slimsam', id: 'Xenova/slimsam-77-uniform' },
  slim50: { key: 'slim50', label: 'SlimSAM-50 · hub download', sub: 'slimsam', id: 'Xenova/slimsam-50-uniform' },
  sam2tiny: { key: 'sam2tiny', label: 'SAM2-tiny · hub download', sub: 'sam2', id: 'onnx-community/sam2-hiera-tiny-ONNX' },
}

export const DEFAULT_MODEL = 'edgesam'

/** Central auto-prompt when no user hint exists (recognise the main object). */
export const CENTRAL_PROMPT: Point[] = [
  { x: 0.5, y: 0.5, label: 1 }, { x: 0.4, y: 0.4, label: 1 }, { x: 0.6, y: 0.4, label: 1 },
  { x: 0.4, y: 0.6, label: 1 }, { x: 0.6, y: 0.6, label: 1 }, { x: 0.5, y: 0.3, label: 1 }, { x: 0.5, y: 0.7, label: 1 },
]
