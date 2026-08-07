// cutout-lab — native v5.3.1 segmentation option (Dan: the infra-vs-model control). PURE GLUE over
// v5.3.1's own segmentML/ben.worker (u2netp→silueta chain, self-hosted, phone-proven) — NOT a
// cutout-ai sub (ARCHITECTURE.md: u2net is v5.3.1's; the UI reaches it through v5.3.1's own path).
// Auto-only (no prompt → no brush); the lab uses it to separate model failures from infrastructure.

import { runCutout } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import type { MLResult } from '@/lib/effect/segment-ml'
import type { Mask } from '@/lib/mask-tools/types'

// CUT-INPUT CAP (Dan device 2026-08-07: iOS `[wasm] RangeError: Out of memory` → 'no backend').
// The cut worker decodes the SOURCE image (the engine notes a ~2GB 'upload half'); a 12MP phone
// photo blows past iOS Safari's WASM heap. The lab already downscales for display but was handing
// the ORIGINAL full-res URL to the cut — cap the cut's source here (lab-layer; the engine still
// owns its own internal mask/texture config, it just receives a bounded image).
const CUT_MAX = 1024

/** Downscale the source to CUT_MAX before the cut (returns a blob URL to revoke, or the original
 *  when already small). Keeps the worker's decode well inside the iOS memory envelope. */
async function cutSource(url: string): Promise<{ url: string; revoke: boolean }> {
  const img = new Image(); img.src = url
  try { await img.decode() } catch { return { url, revoke: false } }
  const long = Math.max(img.naturalWidth, img.naturalHeight)
  if (long <= CUT_MAX) return { url, revoke: false }
  const s = CUT_MAX / long
  const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
  return blob ? { url: URL.createObjectURL(blob), revoke: true } : { url, revoke: false }
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

/** image URL → v5.3.1's own segmentation through ITS OWN bridge primitive (`runCutout` owns the
 *  working-res config — mask/texture dims are the BRIDGE'S, never the lab's; Dan 2026-08-06: no
 *  engine logic outside the v5.3.1 perimeter). `preseg` is the untouched MLResult — the exact
 *  object the v5.3.1 flow hands prepareShaped (full soft saliency matte + hi-res texImage). The
 *  binary y-down `mask` is derived for UI overlay/brush state only. */
export async function segmentV531(url: string, uiW: number, uiH: number): Promise<{ mask: Mask; adapter: string; preseg: MLResult }> {
  crashStage('1·decode-source')                 // main-thread decode + downscale of the original photo
  const cut = await cutSource(url)
  let r: MLResult
  crashStage('2·engine-cut')                     // the v5.3.1 cut worker (u2net/ORT) — engine perimeter
  try { r = await runCutout(cut.url) } finally { if (cut.revoke) URL.revokeObjectURL(cut.url) }
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
