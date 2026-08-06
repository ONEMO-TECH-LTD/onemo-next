// cutout-ai — model registry. ONE selected sub after the s62 on-device verdict (Dan: EdgeSAM +
// u2net selected; SlimSAM/SAM2/MobileSAM killed — crash/slow/worse). u2net/silueta are v5.3.1's
// own (ben-chain) — reached through v5.3.1, never re-listed here. Re-adding a model = one new
// sub file + one entry here (the SegModel seam is unchanged).

import type { Point, SegModelConfig } from './types'

export const MODELS: Record<string, SegModelConfig> = {
  edgesam: { key: 'edgesam', label: 'EdgeSAM · selected (self-hosted)', sub: 'edgesam', enc: '/seg-models/edgesam.encoder.onnx', dec: '/seg-models/edgesam.decoder.onnx' },
}

export const DEFAULT_MODEL = 'edgesam'

/** Central auto-prompt when no user hint exists — THE engine's own prompt (ben-chain), mapped to
 *  the brush point format. One prompt, one source. */
import { SAM_CENTRAL_PROMPT } from '@/lib/effect/ben-chain'
export const CENTRAL_PROMPT: Point[] = SAM_CENTRAL_PROMPT.map(([x, y]) => ({ x, y, label: 1 }))
