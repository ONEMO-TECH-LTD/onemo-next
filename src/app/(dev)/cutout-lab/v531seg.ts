// cutout-lab — native v5.3.1 segmentation option (Dan: the infra-vs-model control). PURE GLUE over
// v5.3.1's own segmentML/ben.worker (u2netp→silueta chain, self-hosted, phone-proven) — NOT a
// cutout-ai sub (ARCHITECTURE.md: u2net is v5.3.1's; the UI reaches it through v5.3.1's own path).
// Auto-only (no prompt → no brush); the lab uses it to separate model failures from infrastructure.

import { preloadBen, segmentML } from '@/lib/effect/segment-ml'
import type { Mask } from '@/lib/cutout-ai/types'

export const V531_KEY = 'u2net-v531'
export const V531_LABEL = 'u2net · v5.3.1 native (auto, no brush)'

export { preloadBen }

/** image URL → binary mask via v5.3.1's own worker chain. segment-ml rasterizes Y-UP; the lab
 *  canvas is y-down, so flip rows. Mask dims track the matte's own bound (≈ the lab's, ±1px). */
export async function segmentV531(url: string, workMax: number): Promise<{ mask: Mask; adapter: string }> {
  const r = await segmentML(url, workMax, workMax)
  const { mask, width: w, height: h } = r
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) data.set(mask.subarray((h - 1 - y) * w, (h - y) * w), y * w)
  return { mask: { data, w, h }, adapter: r.adapterId }
}
