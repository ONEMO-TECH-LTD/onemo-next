// cutout-lab — native v5.3.1 segmentation option (Dan: the infra-vs-model control). PURE GLUE over
// v5.3.1's own segmentML/ben.worker (u2netp→silueta chain, self-hosted, phone-proven) — NOT a
// cutout-ai sub (ARCHITECTURE.md: u2net is v5.3.1's; the UI reaches it through v5.3.1's own path).
// Auto-only (no prompt → no brush); the lab uses it to separate model failures from infrastructure.

import { runCutout } from '@/lib/effect/cutout'
import { SegmentMLCancelled, type MLResult } from '@/lib/effect/segment-ml'
import { adapterIdFor, segment } from '@/lib/effect/mask'
import type { Mask } from '@/lib/mask-tools/types'

/** Encode the flow's already-decoded 1024px working canvas once for the worker. */
async function cutSource(source: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((res) => source.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not create the bounded cut-out source')
  return URL.createObjectURL(blob)
}

// CRASH BREADCRUMB (Dan device 2026-08-07: Detect HARD-CRASHES iOS Safari → the tab reloads,
// destroying the eruda console before it can show the error). Each Detect stage is stamped to
// localStorage BEFORE it runs and cleared on success; after a crash-reload the mount reader
// (flow.warmup) surfaces the last stage reached — so we learn WHICH allocation died (engine cut vs
// lab prepare/bake) with no surviving console. Lab-layer, always-on, ~two localStorage ops per cut.
export function crashStage(s: string | null): void {
  try { if (s === null) localStorage.removeItem('lab-detect-stage'); else localStorage.setItem('lab-detect-stage', s) } catch { /* private mode / no storage */ }
}
export function lastCrashStage(): string | null {
  try { return localStorage.getItem('lab-detect-stage') } catch { return null }
}

function fallbackCutout(source: HTMLCanvasElement): MLResult {
  const yUp = document.createElement('canvas'); yUp.width = source.width; yUp.height = source.height
  const ctx = yUp.getContext('2d', { willReadFrequently: true })!
  ctx.translate(0, source.height); ctx.scale(1, -1); ctx.drawImage(source, 0, 0)
  const imageData = ctx.getImageData(0, 0, source.width, source.height)
  const fallback = segment(imageData)
  return {
    ...fallback,
    texImage: imageData,
    texMask: fallback.mask,
    texW: fallback.width,
    texH: fallback.height,
    adapterId: adapterIdFor(imageData),
  }
}

/** Bounded working canvas → v5.3.1's own segmentation through ITS OWN bridge primitive (`runCutout` owns the
 *  working-res config — mask/texture dims are the BRIDGE'S, never the lab's; Dan 2026-08-06: no
 *  engine logic outside the v5.3.1 perimeter). `preseg` is the untouched MLResult — the exact
 *  object the v5.3.1 flow hands prepareShaped (full soft saliency matte + hi-res texImage). The
 *  binary y-down `mask` is derived for UI overlay/brush state only. */
export async function segmentV531(
  source: HTMLCanvasElement,
  uiW: number,
  uiH: number,
  isCurrent: () => boolean,
): Promise<{ mask: Mask; adapter: string; preseg: MLResult }> {
  crashStage('1·encode-source')                 // encode the flow's already-bounded working canvas once
  const cutUrl = await cutSource(source)
  let r: MLResult
  try {
    if (!isCurrent()) throw new SegmentMLCancelled()
    crashStage('2·engine-cut')                   // the v5.3.1 cut worker (u2net/ORT) — engine perimeter
    try { r = await runCutout(cutUrl) }
    catch (error) {
      if (error instanceof SegmentMLCancelled) throw error
      r = fallbackCutout(source)
    }
  } finally { URL.revokeObjectURL(cutUrl) }
  crashStage('3·derive-ui-mask')                 // lab-layer canvas flip/scale
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
