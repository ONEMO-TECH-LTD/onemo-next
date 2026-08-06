// cutout-lab — native v5.3.1 segmentation option (Dan: the infra-vs-model control). PURE GLUE over
// v5.3.1's own segmentML/ben.worker (u2netp→silueta chain, self-hosted, phone-proven) — NOT a
// cutout-ai sub (ARCHITECTURE.md: u2net is v5.3.1's; the UI reaches it through v5.3.1's own path).
// Auto-only (no prompt → no brush); the lab uses it to separate model failures from infrastructure.

import { runCutout } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import type { MLResult } from '@/lib/effect/segment-ml'
import type { Mask } from '@/lib/cutout-ai/types'

export const V531_KEY = 'u2net-v531'
export const V531_LABEL = 'u2net · v5.3.1 native (auto, no brush)'


/** image URL → v5.3.1's own segmentation through ITS OWN bridge primitive (`runCutout` owns the
 *  working-res config — mask/texture dims are the BRIDGE'S, never the lab's; Dan 2026-08-06: no
 *  engine logic outside the v5.3.1 perimeter). `preseg` is the untouched MLResult — the exact
 *  object the v5.3.1 flow hands prepareShaped (full soft saliency matte + hi-res texImage). The
 *  binary y-down `mask` is derived for UI overlay/brush state only. */
export async function segmentV531(url: string, uiW: number, uiH: number): Promise<{ mask: Mask; adapter: string; preseg: MLResult }> {
  const r = await runCutout(url)
  // Derive the y-down UI mask AT THE LAB'S canvas dims (the bridge's mask dims are its own config
  // and may differ) — canvas flip+scale in one pass. UI overlay/brush state only.
  const src = document.createElement('canvas'); src.width = r.width; src.height = r.height
  const sImg = new ImageData(r.width, r.height)
  for (let i = 0; i < r.width * r.height; i++) sImg.data[i * 4 + 3] = r.mask[i] ? 255 : 0
  src.getContext('2d')!.putImageData(sImg, 0, 0)
  const dst = document.createElement('canvas'); dst.width = uiW; dst.height = uiH
  const dctx = dst.getContext('2d', { willReadFrequently: true })!
  dctx.translate(0, uiH); dctx.scale(1, -1)
  dctx.drawImage(src, 0, 0, uiW, uiH)
  const px = dctx.getImageData(0, 0, uiW, uiH).data
  const data = new Uint8Array(uiW * uiH)
  for (let i = 0; i < uiW * uiH; i++) data[i] = px[i * 4 + 3] > 128 ? 1 : 0
  return { mask: { data, w: uiW, h: uiH }, adapter: r.adapterId, preseg: r }
}
